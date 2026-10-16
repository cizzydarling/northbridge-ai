export const LANGUAGE_FIELDS = ["language_score", "english_language_score", "french_language_score"];
export function benchmarkState(value) {
  if (value === null || value === undefined || value === "") return "unknown";
  const number = typeof value === "string" && /^([1-9]|1[0-2])$/.test(value) ? Number(value) : value;
  return typeof number === "number" && Number.isInteger(number) && number >= 1 && number <= 12 ? "reported" : "review";
}
export function languagePatch(form, original = {}) {
  const changes = {};
  for (const field of LANGUAGE_FIELDS) {
    if (form[field] === original[field]) continue;
    // Never synthesize a new ambiguous combined score.
    if (field === "language_score" && form[field] !== "" && form[field] !== null) continue;
    const state = benchmarkState(form[field]);
    if (state === "review") throw new Error("Invalid benchmark level");
    changes[field] = state === "unknown" ? null : Number(form[field]);
  }
  return changes;
}
export function profileLanguagePayload(payload, form, original) {
  const result = { ...payload };
  for (const field of LANGUAGE_FIELDS) delete result[field];
  const comparable = value => value === null || value === undefined || value === "" ? null : typeof value === "string" ? value.trim() : value;
  const changed = Object.fromEntries(Object.entries(result).filter(([key, value]) =>
    comparable(value) !== comparable(original?.[key])));
  return { ...changed, ...languagePatch(form, original) };
}
