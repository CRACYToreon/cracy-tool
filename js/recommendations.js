/**
 * Builds an overview and recommendations from survey answers (for END screen).
 */

import { humanQuestionRef } from "./question-labels.js";

export function buildRecommendations(engine) {
  const a = engine.answers || {};
  const sections = [];

  if (a.Q2 === "some") {
    sections.push({
      title: "GAP",
      text: "Some interfaces lack authentication. Document which interfaces lack it. Potential violation of Annex I, 2(d) and 2(j).",
    });
  }

  const arch = a.Q4;
  if (arch === "local") {
    sections.push({
      title: "Architecture",
      text: "Architecture A (on-device IAM). Focus compliance work on local security controls, secure defaults, logging, and vulnerability management.",
    });
  } else if (arch === "remote" || arch === "hybrid") {
    const scope = a.Q5;
    if (scope === "yes") {
      sections.push({
        title: "Architecture",
        text: arch === "hybrid"
          ? "Architecture A+B. The manufacturer's remote IAM service is in full CRA scope; all Annex I requirements apply to that remote component."
          : "Architecture B-FULL. Remote IAM is within CRA scope; all Annex I requirements apply to that service.",
      });
    } else if (scope === "no") {
      sections.push({
        title: "Architecture",
        text: arch === "hybrid"
          ? "Architecture A+B. Remote IAM is third-party (B-3P): Art. 13(5) due diligence on the supplier relationship; the PDE must still meet essential requirements."
          : "Architecture B-3P. Third-party IAM is outside CRA “remote data processing” scope for that component; Art. 13(5) due diligence applies.",
      });
    } else if (scope === "partial") {
      sections.push({
        title: "Architecture",
        text: "Architecture B-HYBRID. The manufacturer's own orchestration layer is in full CRA scope; the underlying third-party IdP is covered by Art. 13(5) due diligence.",
      });
    }
  } else if (arch === "customer") {
    sections.push({
      title: "Architecture",
      text: "Architecture D (customer IAM). Document integration and security behaviour for operators per Annex II, 8(f).",
    });
  }

  const q6 = a.Q6;
  if (Array.isArray(q6) && q6.length > 0) {
    let risk = "STANDARD";
    if (q6.includes("safety") || q6.includes("systems")) risk = "HIGH";
    else if (q6.includes("data")) risk = "ELEVATED";
    sections.push({
      title: "Risk calibration",
      text: `Highest category from Question 6 sets access control level (Annex I, 2(d)): **${risk}**. Ensure controls are appropriate to this risk level.`,
    });
  }

  const q7 = a.Q7;
  if (q7 === "unique") {
    sections.push({ title: "Credentials", text: "Unique per-device: **COMPLIANT** with 2(b)." });
  } else if (q7 === "shared_forced") {
    sections.push({ title: "Credentials", text: "Shared default, change enforced: **ACCEPTABLE**. Verify enforcement is robust and cannot be bypassed." });
  } else if (q7 === "shared_optional") {
    sections.push({ title: "Credentials", text: "Shared default, change optional: **NON-COMPLIANT** with 2(b). Implement change-at-first-use or similar." });
  } else if (q7 === "none") {
    sections.push({ title: "Credentials", text: "No credentials (open access): **NON-COMPLIANT** with 2(b) and 2(d)." });
  }

  const q8 = [
    {
      id: "Q8a",
      yes: "**RBAC:** Implement least privilege by default (2(d)), role separation, document roles in user instructions (Annex II, 8(a)).",
      no: "Verify minimum separation between administrative and normal operation.",
    },
    {
      id: "Q8b",
      yes: "**Credential storage:** Encryption at rest, state-of-the-art storage (2(e)). Passwords: Argon2id/bcrypt/scrypt. Keys/tokens: encrypted or hardware-backed.",
      no: "Document where credentials are stored. If cloud-only, ensure Architecture B controls cover cloud side; if Architecture D, document that PDE does not store credentials.",
    },
    {
      id: "Q8c",
      yes: "**Offline/fallback:** Define fallback authentication (2(h)), bounded validity for cached credentials, document fallback behaviour.",
      no: "**AVAILABILITY RISK.** Cloud outage may mean total loss of PDE functionality. Mitigation plan required.",
    },
    {
      id: "Q8d",
      yes: "**Audit:** Verify completeness per 2(l): authentication attempts, access decisions, credential/config changes. User opt-out. Tamper protection on logs.",
      no: "**GAP.** Violates 2(d) and 2(l). Must implement logging before Dec 2027.",
    },
    {
      id: "Q8e",
      yes: "**Good:** Supports rapid security patching. Aligns with Part II(2) separation of security and feature updates.",
      no: "**RISK.** Auth vulnerability would require full firmware update. Document update path in vulnerability handling plan.",
    },
  ];

  q8.forEach((item) => {
    const v = a[item.id];
    if (v !== undefined && v !== "") {
      sections.push({
        title: humanQuestionRef(item.id),
        text: v === "yes" ? item.yes : item.no,
      });
    }
  });

  if (sections.length === 0) {
    return "<p>No recommendations (answers may not have reached IAM architecture questions).</p>";
  }

  let html = '<div class="survey-recommendations">';
  html +=
    '<div class="survey-recommendation survey-recommendation--intro">' +
    "<p class=\"survey-recommendation-text\">" +
    "Each titled block below comes straight from your answers. " +
    "<strong>Architecture</strong> reflects Question 4 and, when you use remote or hybrid IAM, Question 5. " +
    "<strong>Risk calibration</strong> uses Question 6. <strong>Credentials</strong> uses Question 7. " +
    "<strong>Question 8a</strong> through <strong>Question 8e</strong> are optional deep-dives when those questions were shown and answered. " +
    "Further down, the report adds the structured CRA annex mapping and framework references.</p></div>";
  sections.forEach((s) => {
    html += `<div class="survey-recommendation"><strong class="survey-recommendation-title">${escapeHtml(s.title)}</strong><p class="survey-recommendation-text">${formatInline(s.text)}</p></div>`;
  });
  html += "</div>";
  return html;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatInline(text) {
  if (!text) return "";
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}
