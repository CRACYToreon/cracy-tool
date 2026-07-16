/**
 * Assemble Layer 1 + Layer 2 + risk + Q8 add-ons into HTML (filtered by selected frameworks).
 * All visible titles are normalized (no em dash) for display.
 */

import { deriveLayer1Profile, deriveRiskLevel } from "./survey-profile.js";
import { humanQuestionRef } from "./question-labels.js";
import { computePlatformFindings } from "./platform-findings.js";

const Q4_LABELS = {
  local: "On-device IAM (Architecture A path)",
  remote: "Remote / cloud IAM (Architecture B path)",
  hybrid: "Hybrid local + remote (A+B path)",
  customer: "Customer IAM integration (Architecture D path)",
};

const Q5_LABELS = {
  yes: "Question 5: Manufacturer cloud / commissioned (B-FULL scope)",
  no: "Question 5: Third-party IdP (B-3P / due diligence)",
  partial: "Question 5: Hybrid manufacturer layer + third-party IdP (B-HYBRID)",
};

const Q6_LABELS = {
  config: "Configuration / management",
  data: "User / personal data",
  safety: "Physical safety",
  systems: "Connected systems / ICS",
};

const Q7_LABELS = {
  unique: "Question 7: Unique per-device credentials",
  shared_forced: "Question 7: Shared default, change enforced",
  shared_optional: "Question 7: Shared default, optional change",
  none: "Question 7: No credentials (open access)",
};

function cleanDisplay(s) {
  if (s == null) return "";
  return String(s)
    .replace(/\u2014/g, " - ")
    .replace(/\u2013/g, " - ")
    .replace(/—/g, " - ");
}

function esc(s) {
  if (s == null) return "";
  return cleanDisplay(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render label as an external link when a url is given, else plain escaped text. */
function extLink(url, label) {
  if (!url) return esc(label);
  return `<a class="survey-ext-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

/** Point each CRA reference at its own section anchor so they don't all land in the same place. */
function craLinkFor(id, base) {
  const b = base || "https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng";
  if (id === "art14") return b + "#art_14";
  if (id === "annex2_user_info") return b + "#anx_II";
  return b + "#anx_I"; // Annex I essential requirements (2a-2m) and Part II
}

/** Escape text but keep **bold** markers as <strong>. */
function richText(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}


/** Legend documenting which stakeholders should discuss which questions. */
function buildRolesHtml(meta) {
  const roles = meta && meta.roles;
  if (!roles || typeof roles !== "object") return "";
  const items = Object.keys(roles)
    .map((k) => `<li><strong>${esc(k)}</strong>: ${esc(roles[k])}</li>`)
    .join("");
  if (!items) return "";
  return (
    '<section class="survey-roles-section">' +
    '<h3 class="survey-assembled-title">Suggested stakeholders</h3>' +
    '<div class="survey-explanation survey-explanation--tight">' +
    '<p class="survey-explanation__p">Each question is tagged with the stakeholders best placed to discuss it (shown above each question as "Best discussed with"). A lead is marked; the others are collaborators to involve. Stakeholders:</p>' +
    `<ul class="survey-explanation__list">${items}</ul>` +
    "</div></section>"
  );
}

function applicableStatuses() {
  return ["full", "partial", "violation"];
}

export function getApplicableRequirementRows(profile, applicabilityJson) {
  if (!profile || !applicabilityJson?.requirements) return [];
  return applicabilityJson.requirements
    .map((row) => {
      const status = row.applicability?.[profile];
      return { ...row, status };
    })
    .filter((row) => applicableStatuses().includes(row.status));
}

function buildDigestHtml(answers, profile, risk, selectedFrameworkKeys, fwLabels) {
  const rows = [];
  if (answers.Q1 === "yes") rows.push(["Survey path", "Interfaces: yes (in scope for IAM assessment)"]);
  const q4 = answers.Q4;
  if (q4) rows.push(["IAM architecture (Question 4)", Q4_LABELS[q4] || q4]);
  if ((q4 === "remote" || q4 === "hybrid") && answers.Q5) {
    rows.push(["Remote IAM scope (Question 5)", Q5_LABELS[answers.Q5] || answers.Q5]);
  }
  const q6 = answers.Q6;
  if (Array.isArray(q6) && q6.length > 0) {
    const parts = q6.map((k) => Q6_LABELS[k] || k);
    rows.push(["IAM protects (Question 6)", parts.join(", ")]);
  }
  if (answers.Q7) rows.push(["Credentials (Question 7)", Q7_LABELS[answers.Q7] || answers.Q7]);

  rows.push(["Derived Layer 1 profile", profile]);
  rows.push(["Derived risk level (from Question 6)", risk]);

  const fwNames = selectedFrameworkKeys.map((k) => fwLabels[k]?.label || k).join(", ");
  rows.push(["Frameworks in this report", fwNames || "(none)"]);

  let html = '<aside class="survey-digest" aria-label="Inputs used for this report">';
  html += '<div class="survey-digest__header"><span class="survey-digest__badge">Your answers</span>';
  html += "<h4 class=\"survey-digest__title\">What drives this report</h4>";
  html += '<div class="survey-digest__prose">';
  html +=
    "<p>The CRA applicability rows and framework references in this report are computed from the values in the list below, the Layer 1 matrix for your profile, and only the frameworks you selected.</p>";
  html +=
    "<p>What you will see next, in order: <strong>Profile and risk</strong> (architecture code and Question 6 rigour hints), " +
    "<strong>Applicable CRA requirements</strong> (Annex I points 2(a)-2(m), plus Part II, Article 14, and Annex II where listed), " +
    "then <strong>Question 8 add-ons</strong> if you answered Yes on any Question 8 item.</p>";
  html += "</div></div>";
  html += '<dl class="survey-digest__list">';
  rows.forEach(([dt, dd]) => {
    html += `<dt class="survey-digest__dt">${esc(dt)}</dt><dd class="survey-digest__dd">${esc(dd)}</dd>`;
  });
  html += "</dl></aside>";
  return html;
}

function buildCraRequirementsExplainerHtml() {
  return (
    '<div class="survey-explanation" role="note">' +
    "<p class=\"survey-explanation__p\">" +
    "Each row is included because your profile marks it as <strong>full</strong>, <strong>partial</strong>, or <strong>violation</strong> in the Layer 1 matrix (not \"not applicable\"). " +
    "Framework control text is limited to the frameworks you ticked.</p>" +
    "<h4 class=\"survey-explanation__h\">How to read the CRA rows</h4>" +
    "<p class=\"survey-explanation__p\">" +
    "Each <strong>2a</strong>, <strong>2b</strong>, … <strong>2m</strong> id is shorthand for <strong>Annex I, paragraph 2</strong> of the EU Cyber Resilience Act: the essential cybersecurity requirements 2(a) through 2(m) for products with digital elements. " +
    "The line under each id describes that requirement (for example access control, logging, updates).</p>" +
    "<ul class=\"survey-explanation__list\">" +
    "<li><strong>2a - 2m</strong> - Annex I essential requirements. Listed here only when your architecture profile marks them in scope (not \"not applicable\").</li>" +
    "<li><strong>part2_vuln</strong> - <strong>Annex I, Part II</strong>: vulnerability handling (triage, updates, disclosure) for the product.</li>" +
    "<li><strong>art14</strong> - <strong>Article 14</strong>: reporting to market surveillance when the law applies to serious incidents or vulnerabilities.</li>" +
    "<li><strong>annex2_user_info</strong> - <strong>Annex II</strong>: information you give users (instructions, security-relevant behaviour).</li>" +
    "</ul>" +
    "<p class=\"survey-explanation__p\">" +
    "The <strong>full</strong>, <strong>partial</strong>, or <strong>violation</strong> label is how this tool classifies applicability for <em>your</em> profile. " +
    "It is not a compliance certificate: combine it with the narrative recommendations above and your own evidence.</p>" +
    "</div>"
  );
}

export function buildAssembledReportHtml(engine, selectedFrameworkKeys, mapping, platforms, applyLogic) {
  const answers = engine.answers || {};
  const profile = deriveLayer1Profile(answers);
  const risk = deriveRiskLevel(answers);
  const { meta, layer1Applicability, layer2Requirements, riskCalibration, q8Addons } = mapping;
  const findings = computePlatformFindings(answers, platforms || [], applyLogic);
  const sevToPill = (s) => (s === "gap" ? "violation" : s === "warn" ? "partial" : "full");

  if (!profile) {
    return "<div class=\"survey-assembled survey-assembled--empty\"><p class=\"survey-assemble-note\">Could not derive architecture profile from answers. Complete the survey through Question 4 (and Question 5 if remote or hybrid) for a full mapping.</p></div>";
  }

  const fwLabels = meta?.framework_keys || {};
  const keys = selectedFrameworkKeys.filter((k) => fwLabels[k]);

  let html = '<div class="survey-assembled survey-assembled--layout">';
  html += '<div class="survey-assembled__rail">';
  html += buildDigestHtml(answers, profile, risk, keys, fwLabels);
  html += buildRolesHtml(meta);

  html += '<section class="survey-profile-card">';
  html += "<h3 class=\"survey-assembled-title\">Profile and risk calibration</h3>";
  html += '<div class="survey-explanation survey-explanation--tight">';
  html +=
    "<p class=\"survey-explanation__p\">" +
    "<strong>Layer 1</strong> is your IAM architecture code from the survey (A, B-FULL, and so on). " +
    "<strong>Risk</strong> comes from Question 6 and sets the indicative rigour targets in the tiles below (standards guidance only, not a legal label).</p>";
  html += `<p class="survey-explanation__p survey-explanation__p--meta">Derived codes: Layer 1 <span class="survey-pill survey-pill--profile">${esc(profile)}</span> Risk <span class="survey-pill survey-pill--risk">${esc(risk)}</span></p>`;
  html += "</div>";

  const riskRow = riskCalibration?.levels?.[risk];
  if (riskRow) {
    html += "<div class=\"survey-risk-grid\">";
    html += `<div class="survey-risk-tile"><span class="survey-risk-tile__label">IEC 62443-4-2</span><span class="survey-risk-tile__value">${esc(riskRow.IEC_62443_4_2_target_sl)}</span></div>`;
    html += `<div class="survey-risk-tile"><span class="survey-risk-tile__label">NIST 800-63B</span><span class="survey-risk-tile__value">${esc(riskRow.NIST_63B_target_aal)}</span></div>`;
    html += `<div class="survey-risk-tile"><span class="survey-risk-tile__label">CC (indicative)</span><span class="survey-risk-tile__value">${esc(riskRow.CC_EAL_indicative)}</span></div>`;
    html += `<div class="survey-risk-tile"><span class="survey-risk-tile__label">ISO 27002 depth</span><span class="survey-risk-tile__value">${esc(riskRow.ISO_27002_depth)}</span></div>`;
    html += "</div>";
  }
  html += "</section>";
  html += "</div>";

  html += '<div class="survey-assembled__main">';

  const applicable = getApplicableRequirementRows(profile, layer1Applicability);
  const layer2ById = {};
  (layer2Requirements?.requirements || []).forEach((r) => {
    layer2ById[r.id] = r;
  });

  html += "<section class=\"survey-cra-section\">";
  html += "<div class=\"survey-cra-section__intro\">";
  html += "<h3 class=\"survey-assembled-title\">Applicable CRA requirements</h3>";
  html += buildCraRequirementsExplainerHtml();
  const craUrl = (meta && meta.cra_source && meta.cra_source.url) || "https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng";
  html += `<p class="survey-cra-source">Official text: ${extLink(craUrl, "Regulation (EU) 2024/2847, Cyber Resilience Act (EUR-Lex)")}. The requirement ids below (2a, 2b, ...) refer to Annex I of that regulation; each id links to the source.</p>`;
  html += "</div>";
  html += '<div class="survey-cra-section__cards">';

  applicable.forEach((row) => {
    const l2 = layer2ById[row.id];
    const title = cleanDisplay(row.title);
    const rowFindings = findings.filter(
      (f) => Array.isArray(f.cra) && f.cra.includes(row.id) && (f.severity === "gap" || f.severity === "warn")
    );
    const noteHtml = rowFindings.length
      ? '<div class="survey-explanation survey-explanation--tight survey-cra-card__platform-note"><p class="survey-explanation__p"><strong>Cloud platform findings for this requirement:</strong></p><ul class="survey-explanation__list">' +
        rowFindings
          .map(
            (f) =>
              `<li>${esc(f.platformLabel)} &middot; ${esc(f.questionLabel)} <span class="survey-cra-pill survey-cra-pill--${sevToPill(f.severity)}">${esc(f.severity)}</span></li>`
          )
          .join("") +
        "</ul></div>"
      : "";
    html += `<article class="survey-cra-card"><header class="survey-cra-card__head">`;
    html += `<span class="survey-cra-card__id">${extLink(craLinkFor(row.id, craUrl), row.id)}</span>`;
    html += `<span class="survey-cra-pill survey-cra-pill--${esc(row.status)}">${esc(row.status)}</span>`;
    html += `</header><p class="survey-cra-card__title">${esc(title)}</p>`;
    if (!l2) {
      html += "<p class=\"survey-assemble-note\">No Layer 2 mapping entry.</p>" + noteHtml + "</article>";
      return;
    }
    html += '<div class="survey-fw-grid">';
    keys.forEach((fk) => {
      const block = l2.frameworks?.[fk];
      if (!block) return;
      const label = fwLabels[fk]?.label || fk;
      const fwUrl = fwLabels[fk]?.url;
      const refs = (block.references || []).join(", ");
      const help = cleanDisplay(block.how_it_helps || "");
      html += `<div class="survey-fw-card"><div class="survey-fw-card__name">${extLink(fwUrl, label)}</div>`;
      if (refs) html += `<div class="survey-fw-card__refs">${esc(refs)}</div>`;
      if (help) html += `<p class="survey-fw-card__help">${esc(help)}</p>`;
      html += "</div>";
    });
    html += "</div>" + noteHtml + "</article>";
  });
  html += "</div></section>";

  html += "<section class=\"survey-addon-section\">";
  html += "<h3 class=\"survey-assembled-title\">Question 8 operational add-ons</h3>";
  html += '<div class="survey-explanation survey-explanation--tight">';
  html +=
    "<p class=\"survey-explanation__p\">" +
    "These are extra framework pointers for <strong>Question 8</strong> topics (roles, storage, offline access, logging, update model). " +
    "They appear only where you answered <strong>Yes</strong> on Questions 8a through 8e and only for frameworks you selected.</p>";
  html += "</div>";
  const addonIds = ["Q8a", "Q8b", "Q8c", "Q8d", "Q8e"];
  let anyAddon = false;
  addonIds.forEach((qid) => {
    if (answers[qid] !== "yes") return;
    anyAddon = true;
    const pack = q8Addons?.addons?.[qid];
    if (!pack) return;
    html += `<article class="survey-addon-card"><h4 class="survey-addon-card__title">${esc(humanQuestionRef(qid))}: ${esc(pack.summary)}</h4><ul class="survey-addon-card__list">`;
    (pack.controls || []).forEach((c) => {
      if (!keys.includes(c.framework)) return;
      const fl = fwLabels[c.framework]?.label || c.framework;
      const flUrl = fwLabels[c.framework]?.url;
      html += `<li><span class="survey-addon-fw">${extLink(flUrl, fl)}</span> <code class="survey-addon-ref">${esc(c.reference)}</code> ${esc(c.note)}</li>`;
    });
    html += "</ul></article>";
  });
  if (!anyAddon) {
    html += "<p class=\"survey-assemble-note\">No Question 8 items answered \"Yes\" for your path.</p>";
  }
  html += "</section>";

  html += "<section class=\"survey-addon-section survey-platform-section\">";
  html += "<h3 class=\"survey-assembled-title\">Cloud platform hardening</h3>";
  html += '<div class="survey-explanation survey-explanation--tight">';
  html +=
    "<p class=\"survey-explanation__p\">" +
    "Platform-specific findings from the cloud IAM platform(s) you selected, mapped to the Annex I points they support. " +
    "These are configuration best-practices for the named platform, cross-referenced for gap analysis, not an official crosswalk.</p>";
  html += "</div>";
  if (!findings.length) {
    html += "<p class=\"survey-assemble-note\">No cloud platform selected, or no platform questions answered.</p>";
  } else {
    const byPlatform = {};
    const order = [];
    findings.forEach((f) => {
      if (!byPlatform[f.platformLabel]) {
        byPlatform[f.platformLabel] = [];
        order.push(f.platformLabel);
      }
      byPlatform[f.platformLabel].push(f);
    });
    order.forEach((pl) => {
      html += `<article class="survey-addon-card"><h4 class="survey-addon-card__title">${esc(pl)}</h4><ul class="survey-addon-card__list">`;
      byPlatform[pl].forEach((f) => {
        const craTxt = f.cra && f.cra.length ? ` <span class="survey-addon-ref">Annex I ${esc(f.cra.join(", "))}</span>` : "";
        html += `<li><span class="survey-cra-pill survey-cra-pill--${sevToPill(f.severity)}">${esc(f.severity)}</span> <strong>${esc(f.questionLabel)}</strong>${craTxt}`;
        if ((f.severity === "gap" || f.severity === "warn") && f.text) {
          html += `<div class="survey-addon-finding-note">${richText(f.text)}</div>`;
        }
        html += "</li>";
      });
      html += "</ul></article>";
    });
  }
  html += "</section>";

  html += "</div>";
  html += "</div>";
  return html;
}
