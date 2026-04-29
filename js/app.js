/**
 * Load questions, create engine (with JSON-Logic), mount renderer.
 */
import { createEngine } from "./survey-engine.js";
import { render } from "./survey-renderer.js";
import { buildRecommendations } from "./recommendations.js";
import { buildAssembledReportHtml } from "./assemble-report.js";
import { humanQuestionRef } from "./question-labels.js";

const jsonLogic = window.jsonLogic;

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

function updateSummary(engine) {
  const answers = engine.answers;
  const keys = Object.keys(answers);
  if (keys.length === 0) {
    summaryBody.textContent = "No answers yet.";
    return;
  }
  let html = '<dl class="survey-summary-list">';
  for (const key of sortAnswerKeys(keys)) {
    const label = humanQuestionRef(key);
    const value = formatAnswerValue(answers[key]);
    html += `<dt class="survey-summary-list__dt">${escapeSummaryHtml(label)}</dt>`;
    html += `<dd class="survey-summary-list__dd">${escapeSummaryHtml(value)}</dd>`;
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

function refreshUi(engine, totalQuestions, isSurveyEnded) {
  if (isSurveyEnded === undefined) isSurveyEnded = false;
  updateSummary(engine);
  updateProgress(engine, totalQuestions, isSurveyEnded);
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
    render(container, engine, {
      onEnd: (state) => refreshUi(engine, totalQuestions, state.ended),
      onUpdate: (opts) => refreshUi(engine, totalQuestions, opts && opts.surveyComplete),
      getRecommendations: (eng) => buildRecommendations(eng),
      session,
      postSurveyConfig,
      buildAssembledReport: (eng, keys) => buildAssembledReportHtml(eng, keys, mappingBundle),
    });
  }

  doRender();
  refreshUi(engine, totalQuestions, false);

  document.getElementById("btn-copy").addEventListener("click", () => {
    const payload = {
      answers: engine.answers,
      selectedFrameworks: session.selectedFrameworks,
      postSurveyPhase: session.phase,
    };
    const json = JSON.stringify(payload, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      const btn = document.getElementById("btn-copy");
      const prev = btn.textContent;
      btn.textContent = "Copied!";
      setTimeout(() => { btn.textContent = prev; }, 1500);
    });
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    engine.reset();
    session.phase = "frameworks";
    session.selectedFrameworks = [];
    doRender();
    refreshUi(engine, totalQuestions, false);
  });
}

init();
