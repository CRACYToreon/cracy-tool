/**
 * Smoke test for profile + assembly (no browser).
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function load(name) {
  return JSON.parse(readFileSync(join(root, "data/mapping", name), "utf8"));
}

const mapping = {
  meta: load("meta.json"),
  layer1Applicability: load("layer1-applicability.json"),
  layer2Requirements: load("layer2-requirements.json"),
  riskCalibration: load("risk-calibration.json"),
  q8Addons: load("q8-addons.json"),
};

const { deriveLayer1Profile, deriveRiskLevel } = await import(join(root, "js/survey-profile.js"));
const { buildAssembledReportHtml } = await import(join(root, "js/assemble-report.js"));

const answers = {
  Q1: "yes",
  Q2: "all",
  Q4: "local",
  Q6: ["config", "data"],
  Q7: "unique",
  Q8a: "no",
  Q8b: "yes",
};

const engine = { answers };
const profile = deriveLayer1Profile(answers);
const risk = deriveRiskLevel(answers);
console.log("profile", profile, "risk", risk);
if (profile !== "A") throw new Error("expected A");

const html = buildAssembledReportHtml(engine, ["EN_303_645", "NIST_63B"], mapping);
if (!html.includes("2d") || !html.includes("Applicable CRA")) throw new Error("expected CRA blocks in HTML");
if (!html.includes("Question 4") || !html.includes("Question 8")) throw new Error("expected human question labels in HTML");
console.log("assemble OK, HTML length", html.length);
