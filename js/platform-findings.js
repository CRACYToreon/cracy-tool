/**
 * Resolve selected-platform answers into findings.
 * One finding per answered platform question, matched to its first satisfied guidance rule.
 * Shared by recommendations.js (narrative) and assemble-report.js (CRA crosswalk) so both agree.
 */
export function computePlatformFindings(answers, platforms, applyLogic) {
  const out = [];
  if (!answers) return out;
  const selected = Array.isArray(answers.PLATFORMS) ? answers.PLATFORMS : [];
  const evalLogic = typeof applyLogic === "function" ? applyLogic : null;

  for (const p of platforms || []) {
    if (!selected.includes(p.id)) continue;
    for (const q of p.questions || []) {
      const v = answers[q.id];
      const answered = q.type === "multi" ? Array.isArray(v) : v !== undefined && v !== "";
      if (!answered) continue;

      let matched = null;
      for (const rule of q.guidance || []) {
        const when = rule.when;
        const ok =
          when === true || when === undefined
            ? true
            : evalLogic
            ? !!evalLogic(when, { answers })
            : false;
        if (ok) {
          matched = rule;
          break;
        }
      }
      if (!matched) continue;

      out.push({
        platformId: p.id,
        platformLabel: p.label || p.id,
        questionId: q.id,
        questionLabel: q.label || q.id,
        severity: matched.severity || "info",
        text: matched.text,
        cra: Array.isArray(q.cra) ? q.cra : [],
        questionReferences: Array.isArray(q.references) ? q.references : [],
      });
    }
  }
  return out;
}

/** Selected platform ids that have no loaded module (e.g. "other"), for a fallback note. */
export function selectedUnknownPlatforms(answers, platforms) {
  const selected = Array.isArray(answers && answers.PLATFORMS) ? answers.PLATFORMS : [];
  const known = new Set((platforms || []).map((p) => p.id));
  return selected.filter((id) => !known.has(id));
}
