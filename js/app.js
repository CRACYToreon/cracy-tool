/**
 * Load questions, create engine (with JSON-Logic), mount renderer.
 */
import { createEngine } from "./survey-engine.js";
import { render } from "./survey-renderer.js";
import { buildRecommendations } from "./recommendations.js";
import { buildAssembledReportHtml } from "./assemble-report.js";
import { humanQuestionRef } from "./question-labels.js";

const jsonLogic = window.jsonLogic;

const WELCOME_STORAGE_KEY = "cracy_welcome_seen_v1";

function initWelcomeModal() {
  const overlay = document.getElementById("survey-welcome-overlay");
  const dismiss = document.getElementById("survey-welcome-dismiss");
  const about = document.getElementById("survey-welcome-about");
  if (!overlay || !dismiss) return;

  let persistOnDismiss = false;

  function openWelcome(opts) {
    const o = opts || {};
    persistOnDismiss = !!o.persistOnDismiss;
    overlay.removeAttribute("hidden");
    document.body.classList.add("survey-welcome-open");
    dismiss.textContent = persistOnDismiss ? "Continue to survey" : "Close";
    dismiss.focus();
  }

  function closeWelcome() {
    overlay.setAttribute("hidden", "");
    document.body.classList.remove("survey-welcome-open");
    if (persistOnDismiss) {
      try {
        localStorage.setItem(WELCOME_STORAGE_KEY, "1");
      } catch (_) {}
    }
    persistOnDismiss = false;
  }

  dismiss.addEventListener("click", closeWelcome);
  if (about) {
    about.addEventListener("click", () => openWelcome({ persistOnDismiss: false }));
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeWelcome();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (overlay.hasAttribute("hidden")) return;
    closeWelcome();
  });

  let seen = false;
  try {
    seen = !!localStorage.getItem(WELCOME_STORAGE_KEY);
  } catch (_) {
    seen = false;
  }
  if (!seen) {
    if (overlay.hasAttribute("hidden")) {
      openWelcome({ persistOnDismiss: true });
    } else {
      persistOnDismiss = true;
    }
  }
  if (!overlay.hasAttribute("hidden") && !document.body.classList.contains("survey-welcome-open")) {
    document.body.classList.add("survey-welcome-open");
  }
}

/** Minimal JSON-Logic fallback for var, ==, !=, or, all (when CDN fails to load). */
function fallbackLogic(expr, data) {
  if (expr == null) return false;
  if (typeof expr !== "object" || Array.isArray(expr)) return expr;
  const op = Object.keys(expr)[0];
  const args = expr[op];
  if (op === "var") {
    const path = Array.isArray(args) ? args : (typeof args === "string" ? args.split(".") : [args]);
    return path.reduce((obj, key) => obj?.[key], data);
  }
  if (op === "==") return args != null && args.length >= 2 && fallbackLogic(args[0], data) === fallbackLogic(args[1], data);
  if (op === "!=") return args != null && args.length >= 2 && fallbackLogic(args[0], data) !== fallbackLogic(args[1], data);
  if (op === "or") return Array.isArray(args) && args.some((a) => fallbackLogic(a, data));
  if (op === "all") return Array.isArray(args) && args.every((a) => fallbackLogic(a, data));
  return false;
}

function applyLogic(expr, data) {
  try {
    if (jsonLogic && typeof jsonLogic.apply === "function") {
      return jsonLogic.apply(jsonLogic, [expr, data]);
    }
  } catch (_) {}
  return fallbackLogic(expr, data);
}

const container = document.getElementById("survey-container");
const summaryBody = document.getElementById("survey-summary-body");
const progressEl = document.getElementById("survey-progress");

let surveyRenderApi = { render: () => {}, clearEnded: () => {} };

function escapeSummaryHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function formatAnswerValue(value) {
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (value === null || value === undefined) return "";
  return String(value);
}

function sortAnswerKeys(keys) {
  return [...keys].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
}

function orderedAnswerKeys(keys, questions) {
  const want = new Set(keys);
  const out = [];
  for (const q of questions) {
    if ((q.type === "single" || q.type === "multi") && want.has(q.id)) out.push(q.id);
  }
  for (const k of sortAnswerKeys(keys)) {
    if (!out.includes(k)) out.push(k);
  }
  return out;
}

function plainQuestionText(text) {
  if (text == null) return "";
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s*\n+\s*/g, " ")
    .trim();
}

function resolveAnswerSummary(q, raw) {
  if (!q) return formatAnswerValue(raw);
  if (q.type === "multi" && Array.isArray(raw)) {
    const labels = (q.options || [])
      .filter((o) => raw.includes(o.value))
      .map((o) => o.label);
    return labels.length ? labels.join("; ") : formatAnswerValue(raw);
  }
  if (q.type === "single" && raw != null && raw !== "") {
    const opt = (q.options || []).find((o) => o.value === raw);
    return opt ? opt.label : String(raw);
  }
  return formatAnswerValue(raw);
}

function buildAnswersExportPayload(engine, questions, session) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const answers = engine.answers || {};
  const keys = orderedAnswerKeys(Object.keys(answers), questions);
  const responses = keys.map((id) => {
    const q = byId.get(id);
    return {
      questionId: id,
      questionText: q ? plainQuestionText(q.text) : "",
      storedValue: answers[id],
      answerSummary: resolveAnswerSummary(q, answers[id]),
    };
  });
  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    postSurveyPhase: session.phase,
    selectedFrameworks: session.selectedFrameworks,
    responses,
    answers: { ...answers },
  };
}

function escHtmlAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Full HTML document for print/PDF (opened via print-report.html so the URL is not about:blank). */
function buildReportPrintDocumentHtml(engine, session, mappingBundle) {
  const fw = session.selectedFrameworks || [];
  const rec = buildRecommendations(engine);
  const assembled = buildAssembledReportHtml(engine, fw, mappingBundle);
  const baseHref = escHtmlAttr(new URL(".", window.location.href).href);
  const printCss =
    "html{box-sizing:border-box;background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    "*,*::before,*::after{box-sizing:inherit}" +
    "body.survey-print-doc{margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#fff!important;color:#121212!important;-webkit-text-fill-color:#121212!important;font-size:11pt;line-height:1.45}" +
    "body.survey-print-doc header{margin:0 0 0.75rem 0;padding:0 0 0.5rem 0;border-bottom:1px solid #ccc;background:#fff!important}" +
    "body.survey-print-doc header h1{margin:0;font-size:14pt;font-weight:650;color:#0d1117!important;-webkit-text-fill-color:#0d1117!important}" +
    "body.survey-print-doc main{max-width:100%;width:100%;box-sizing:border-box;background:#fff!important;color:#121212!important;padding:0;margin:0;overflow-x:hidden}" +
    /* Undo wide-viewport grid/sticky from survey.css so everything stacks within page width */
    "body.survey-print-doc .survey-assembled--layout{display:block!important;grid-template-columns:unset!important;gap:1rem!important}" +
    "body.survey-print-doc .survey-assembled__rail,body.survey-print-doc .survey-assembled__main{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;position:static!important}" +
    "body.survey-print-doc .survey-assembled__rail{max-height:none!important;overflow:visible!important;padding-right:0!important}" +
    "body.survey-print-doc .survey-cra-section__cards{display:block!important;grid-template-columns:unset!important}" +
    "body.survey-print-doc .survey-addon-section{display:block!important;grid-template-columns:unset!important}" +
    "body.survey-print-doc .survey-fw-grid{display:block!important;width:100%!important}" +
    "body.survey-print-doc .survey-fw-card{width:100%!important;max-width:100%!important;box-sizing:border-box}" +
    "body.survey-print-doc .survey-digest__list{grid-template-columns:minmax(0,1fr)!important}" +
    /* Readable on white: force dark text on light surfaces (after survey.css) */
    "body.survey-print-doc main,body.survey-print-doc main p,body.survey-print-doc main li,body.survey-print-doc main dt,body.survey-print-doc main dd," +
    "body.survey-print-doc main td,body.survey-print-doc main th,body.survey-print-doc main span,body.survey-print-doc main div,body.survey-print-doc main label," +
    "body.survey-print-doc main strong{color:#121212!important;-webkit-text-fill-color:#121212!important}" +
    "body.survey-print-doc main h2,body.survey-print-doc main h3,body.survey-print-doc main h4," +
    "body.survey-print-doc main .survey-assembled-title,body.survey-print-doc main .survey-cra-card__title," +
    "body.survey-print-doc main .survey-fw-card__name,body.survey-print-doc main .survey-addon-card__title{color:#0d1117!important;-webkit-text-fill-color:#0d1117!important}" +
    "body.survey-print-doc main .survey-muted,body.survey-print-doc main .survey-explanation__p," +
    "body.survey-print-doc main .survey-digest__prose,body.survey-print-doc main .survey-fw-card__help{color:#3d3d3d!important;-webkit-text-fill-color:#3d3d3d!important}" +
    "body.survey-print-doc main .survey-recommendation,body.survey-print-doc main .survey-recommendation-text," +
    "body.survey-print-doc main .survey-recommendation-title{color:#121212!important;-webkit-text-fill-color:#121212!important}" +
    "body.survey-print-doc main .survey-recommendations,body.survey-print-doc main .survey-recommendations-wrap,body.survey-print-doc main .survey-assembled," +
    "body.survey-print-doc main .survey-digest,body.survey-print-doc main .survey-profile-card," +
    "body.survey-print-doc main .survey-cra-card,body.survey-print-doc main .survey-fw-card," +
    "body.survey-print-doc main .survey-addon-card,body.survey-print-doc main .survey-explanation," +
    "body.survey-print-doc main .survey-risk-tile,body.survey-print-doc main .survey-recommendation{background:#fff!important;color:#121212!important;border-color:#c9c9c9!important;-webkit-text-fill-color:#121212!important}" +
    "body.survey-print-doc main .survey-cra-pill,body.survey-print-doc main .survey-pill," +
    "body.survey-print-doc main .survey-digest__badge{background:#ececec!important;color:#111!important;border:1px solid #888!important;-webkit-text-fill-color:#111!important}" +
    "body.survey-print-doc main .survey-cra-card__id,body.survey-print-doc main code," +
    "body.survey-print-doc main .survey-addon-ref{color:#032f62!important;background:#eef2f6!important;border:1px solid #bbb!important;-webkit-text-fill-color:#032f62!important}" +
    "body.survey-print-doc main a{color:#0550ae!important;-webkit-text-fill-color:#0550ae!important}" +
    "@page{size:A4;margin:11mm}" +
    "@media print{" +
    "body.survey-print-doc{font-size:10.5pt}" +
    "body.survey-print-doc,body.survey-print-doc main,html{background:#fff!important}" +
    "body.survey-print-doc{padding:0!important;margin:0!important}" +
    "body.survey-print-doc main{overflow-wrap:anywhere}" +
    "*{box-shadow:none!important;text-shadow:none!important}" +
    ".survey-cra-card,.survey-fw-card,.survey-addon-card,.survey-digest,.survey-profile-card,.survey-recommendations,.survey-recommendations-wrap{break-inside:avoid;page-break-inside:avoid}" +
    ".survey-fw-card{margin-bottom:0.5rem}" +
    "}";
  const headAssets =
    `<base href="${baseHref}" />` +
    '<link rel="stylesheet" href="css/survey.css" />' +
    '<link rel="stylesheet" href="css/ui.css" />' +
    `<style>${printCss}</style>`;
  const printRunner =
    "<script>" +
    "(function(){var printed=false;function runPrint(){if(printed)return;printed=true;try{window.focus();window.print();}catch(e){}}" +
    "var links=[].slice.call(document.querySelectorAll('link[rel=\"stylesheet\"]'));" +
    "if(!links.length){setTimeout(runPrint,350);return;}" +
    "var pending=links.length;function tick(){pending--;if(pending<=0)setTimeout(runPrint,150);}" +
    "links.forEach(function(link){if(link.sheet)tick();else{link.addEventListener('load',tick);link.addEventListener('error',tick);}});" +
    "setTimeout(runPrint,2400);})();" +
    "<\/script>";
  return (
    "<!DOCTYPE html>\n<html lang=\"en\"><head><meta charset=\"utf-8\" />" +
    headAssets +
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
    "<title>CRA report</title></head><body class=\"survey-print-doc\">\n" +
    "<header><h1>CRA questionnaire report</h1></header>\n" +
    "<main>" +
    rec +
    assembled +
    "</main>\n" +
    printRunner +
    "\n</body></html>"
  );
}

function openReportPrintOrPdf(engine, session, mappingBundle) {
  const html = buildReportPrintDocumentHtml(engine, session, mappingBundle);
  try {
    sessionStorage.setItem("craPrintReportHtml", html);
  } catch (e) {
    alert("Could not store the report for printing (storage may be full). Try again or use a shorter report.");
    return;
  }
  const printUrl = new URL("print-report.html", window.location.href).href;
  const w = window.open(printUrl, "_blank");
  if (!w) {
    try {
      sessionStorage.removeItem("craPrintReportHtml");
    } catch (_) {}
    alert("Pop-up was blocked. Allow pop-ups for this site, then try again.");
  }
}

function canGoPrevious(engine) {
  const cid = engine.getCurrentQuestionId();
  if (cid == null) return false;
  const visible = engine.getVisibleQuestions();
  const idx = visible.findIndex((q) => q.id === cid);
  if (idx <= 0) return false;
  let t = idx - 1;
  while (t >= 0 && visible[t].type === "message") t--;
  return t >= 0;
}

function isReportExportReady(session) {
  return (
    session &&
    session.phase === "report" &&
    Array.isArray(session.selectedFrameworks) &&
    session.selectedFrameworks.length > 0
  );
}

let exportJsonButtonDefaultHtml = "";

function cacheExportButtonDefaults() {
  const j = document.getElementById("btn-copy");
  if (j) exportJsonButtonDefaultHtml = j.innerHTML;
}

function updateSummary(engine, questions) {
  const answers = engine.answers;
  const keys = Object.keys(answers);
  const byId = new Map(questions.map((q) => [q.id, q]));
  if (keys.length === 0) {
    summaryBody.textContent = "No answers yet.";
    return;
  }
  let html = '<dl class="survey-summary-list">';
  for (const key of orderedAnswerKeys(keys, questions)) {
    const label = humanQuestionRef(key);
    const value = resolveAnswerSummary(byId.get(key), answers[key]);
    const jump = byId.get(key) && (byId.get(key).type === "single" || byId.get(key).type === "multi");
    if (jump) {
      html += '<div class="survey-summary-row">';
      html += `<dt class="survey-summary-list__dt survey-summary-row__hit" data-jump-question="${escapeSummaryHtml(key)}" role="button" tabindex="0" title="Go to this question">${escapeSummaryHtml(label)}</dt>`;
      html += `<dd class="survey-summary-list__dd survey-summary-row__hit" data-jump-question="${escapeSummaryHtml(key)}" title="Go to this question">${escapeSummaryHtml(value)}</dd>`;
      html += "</div>";
    } else {
      html += `<dt class="survey-summary-list__dt">${escapeSummaryHtml(label)}</dt>`;
      html += `<dd class="survey-summary-list__dd">${escapeSummaryHtml(value)}</dd>`;
    }
  }
  html += "</dl>";
  summaryBody.innerHTML = html;
}

function updateProgress(engine, totalQuestions, isSurveyEnded) {
  const total = totalQuestions;
  const answered = Object.keys(engine.answers).length;
  const complete = isSurveyEnded === true || (engine.allApplicableAnswered && engine.allApplicableAnswered());
  if (total === 0) {
    progressEl.innerHTML = "";
    progressEl.hidden = true;
    return;
  }
  progressEl.hidden = false;
  const pct = complete ? 100 : (total ? Math.min(100, Math.round((answered / total) * 100)) : 0);
  const labelHtml = complete ? "" : `<span class="progress__label">${answered} of ${total} questions</span>`;
  progressEl.innerHTML =
    labelHtml +
    `<div class="progress__bar" role="progressbar" aria-valuenow="${complete ? total : answered}" aria-valuemin="0" aria-valuemax="${total}">` +
    `<div class="progress__fill" style="width:${pct}%"></div></div>`;
}

function refreshUi(engine, totalQuestions, isSurveyEnded, questions, session) {
  if (isSurveyEnded === undefined) isSurveyEnded = false;
  updateSummary(engine, questions || []);
  updateProgress(engine, totalQuestions, isSurveyEnded);
  const prevBtn = document.getElementById("btn-previous");
  if (prevBtn) prevBtn.disabled = !canGoPrevious(engine);
  const reportReady = isReportExportReady(session);
  const hint = document.getElementById("survey-export-hint");
  const actions = document.getElementById("survey-export-actions");
  if (hint && actions) {
    actions.hidden = !reportReady;
    hint.hidden = reportReady;
  }
  const copyBtn = document.getElementById("btn-copy");
  const printBtn = document.getElementById("btn-print-report");
  if (copyBtn) copyBtn.disabled = !reportReady;
  if (printBtn) printBtn.disabled = !reportReady;
}

async function loadMappingBundle() {
  const paths = [
    ["meta", "data/mapping/meta.json"],
    ["layer1Applicability", "data/mapping/layer1-applicability.json"],
    ["layer2Requirements", "data/mapping/layer2-requirements.json"],
    ["riskCalibration", "data/mapping/risk-calibration.json"],
    ["q8Addons", "data/mapping/q8-addons.json"],
  ];
  const bundle = {};
  for (const [key, url] of paths) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(url + ": " + res.statusText);
    bundle[key] = await res.json();
  }
  return bundle;
}

async function init() {
  initWelcomeModal();

  let data;
  let mappingBundle = null;
  let postSurveyConfig = null;

  try {
    const res = await fetch("data/questions.json");
    if (!res.ok) throw new Error(res.statusText);
    data = await res.json();
  } catch (e) {
    container.innerHTML = "<p class='survey-error'>Could not load questions: " + e.message + "</p>";
    return;
  }

  try {
    const [mapping, psRes] = await Promise.all([
      loadMappingBundle(),
      fetch("data/mapping/post-survey-frameworks.json"),
    ]);
    mappingBundle = mapping;
    if (psRes.ok) postSurveyConfig = await psRes.json();
  } catch (e) {
    console.warn("Mapping load failed:", e);
    mappingBundle = { meta: {}, layer1Applicability: { requirements: [] }, layer2Requirements: { requirements: [] }, riskCalibration: { levels: {} }, q8Addons: { addons: {} } };
  }

  if (!postSurveyConfig && mappingBundle.meta?.framework_keys) {
    const fk = mappingBundle.meta.framework_keys;
    postSurveyConfig = {
      option_keys: Object.keys(fk),
      labels: Object.fromEntries(Object.entries(fk).map(([k, v]) => [k, v.label || k])),
      text: "Select which security frameworks to include in your CRA control mapping.",
    };
  }

  const questions = data.questions || [];
  const totalQuestions = questions.filter((q) => q.type === "single" || q.type === "multi").length;
  const engine = createEngine(questions, applyLogic);

  const session = { phase: "frameworks", selectedFrameworks: [] };

  function doRender() {
    surveyRenderApi = render(container, engine, {
      onEnd: (state) => refreshUi(engine, totalQuestions, state.ended, questions, session),
      onUpdate: (opts) => refreshUi(engine, totalQuestions, opts && opts.surveyComplete, questions, session),
      getRecommendations: (eng) => buildRecommendations(eng),
      session,
      postSurveyConfig,
      buildAssembledReport: (eng, keys) => buildAssembledReportHtml(eng, keys, mappingBundle),
    });
  }

  function afterNavigate() {
    surveyRenderApi.render();
    refreshUi(engine, totalQuestions, false, questions, session);
  }

  doRender();
  refreshUi(engine, totalQuestions, false, questions, session);
  cacheExportButtonDefaults();

  summaryBody.addEventListener("click", (e) => {
    const hit = e.target.closest("[data-jump-question]");
    if (!hit || !summaryBody.contains(hit)) return;
    const qid = hit.getAttribute("data-jump-question");
    if (!qid) return;
    const wasComplete = engine.allApplicableAnswered && engine.allApplicableAnswered();
    surveyRenderApi.clearEnded();
    if (!engine.goToQuestion(qid)) return;
    if (wasComplete) {
      session.phase = "frameworks";
      session.selectedFrameworks = [];
    }
    afterNavigate();
  });

  summaryBody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const hit = e.target.closest("[data-jump-question]");
    if (!hit || !summaryBody.contains(hit)) return;
    e.preventDefault();
    hit.click();
  });

  document.getElementById("btn-copy").addEventListener("click", () => {
    if (!isReportExportReady(session)) return;
    const payload = buildAnswersExportPayload(engine, questions, session);
    const json = JSON.stringify(payload, null, 2);
    const btn = document.getElementById("btn-copy");
    navigator.clipboard.writeText(json).then(() => {
      btn.innerHTML =
        '<span class="survey-export-btn__title">Copied to clipboard</span><span class="survey-export-btn__meta">JSON</span>';
      setTimeout(() => {
        btn.innerHTML = exportJsonButtonDefaultHtml;
      }, 1500);
    });
  });

  document.getElementById("btn-print-report").addEventListener("click", () => {
    if (!isReportExportReady(session)) return;
    openReportPrintOrPdf(engine, session, mappingBundle);
  });

  document.getElementById("btn-previous").addEventListener("click", () => {
    const wasComplete = engine.allApplicableAnswered && engine.allApplicableAnswered();
    surveyRenderApi.clearEnded();
    if (!engine.goToPrevious()) return;
    if (wasComplete) {
      session.phase = "frameworks";
      session.selectedFrameworks = [];
    }
    afterNavigate();
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    engine.reset();
    session.phase = "frameworks";
    session.selectedFrameworks = [];
    doRender();
    refreshUi(engine, totalQuestions, false, questions, session);
  });
}

init();
