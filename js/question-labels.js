/**
 * Survey ids like Q4 or Q8a shown to users as "Question 4", "Question 8a".
 * Platform modules register friendlier labels for their question ids at load time.
 */
const REGISTERED_LABELS = {};

export function registerQuestionLabels(map) {
  if (!map || typeof map !== "object") return;
  for (const key of Object.keys(map)) {
    if (map[key]) REGISTERED_LABELS[key] = map[key];
  }
}

export function humanQuestionRef(id) {
  if (id == null || typeof id !== "string") return id;
  if (Object.prototype.hasOwnProperty.call(REGISTERED_LABELS, id)) return REGISTERED_LABELS[id];
  if (id === "PLATFORMS") return "Cloud IAM platform(s)";
  if (!/^Q[\da-z]/i.test(id)) return id;
  return "Question " + id.slice(1);
}
