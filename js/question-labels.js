/**
 * Survey ids like Q4 or Q8a shown to users as "Question 4", "Question 8a".
 */
export function humanQuestionRef(id) {
  if (id == null || typeof id !== "string") return id;
  if (!/^Q[\da-z]/i.test(id)) return id;
  return "Question " + id.slice(1);
}
