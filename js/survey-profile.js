/**
 * Derive Layer 1 profile and risk from determination survey answers (full path only).
 */

export function deriveLayer1Profile(answers) {
  if (!answers || answers.Q1 !== "yes") return null;
  const q4 = answers.Q4;
  if (!q4) return null;
  if (q4 === "local") return "A";
  if (q4 === "customer") return "D";
  if (q4 === "remote") {
    const q5 = answers.Q5;
    if (q5 === "yes") return "B_FULL";
    if (q5 === "no") return "B_3P";
    if (q5 === "partial") return "B_HYBRID";
    return null;
  }
  if (q4 === "hybrid") return "A_B";
  return null;
}

export function deriveRiskLevel(answers) {
  const q6 = answers.Q6;
  if (!Array.isArray(q6) || q6.length === 0) return "STANDARD";
  if (q6.includes("safety") || q6.includes("systems")) return "HIGH";
  if (q6.includes("data")) return "ELEVATED";
  return "STANDARD";
}
