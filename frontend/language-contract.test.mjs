import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { benchmarkState, languagePatch, profileLanguagePayload } from "./src/utils/languageBenchmarks.js";

test("benchmark boundaries and unknown are distinct", () => {
  for (const value of [1,12,"1","12"]) assert.equal(benchmarkState(value), "reported");
  for (const value of [null,undefined,""]) assert.equal(benchmarkState(value), "unknown");
  for (const value of [0,13,40,-1,1.5,true,false,NaN,Infinity,"40","1.5","bad"]) assert.equal(benchmarkState(value), "review");
});
test("legacy values are omitted until deliberately corrected or cleared", () => {
  const original = { language_score:40, english_language_score:40, french_language_score:"" };
  assert.deepEqual(languagePatch({...original}, original), {});
  assert.deepEqual(languagePatch({...original, english_language_score:"12"}, original), {english_language_score:12});
  assert.deepEqual(languagePatch({language_score:"", english_language_score:"", french_language_score:""}, original), {language_score:null, english_language_score:null});
  assert.deepEqual(profileLanguagePayload({...original,occupation:"Changed"}, original, original), {occupation:"Changed"});
  assert.throws(() => languagePatch({...original, french_language_score:"40"}, original));
});
test("API normalization preserves omitted fields", () => {
  const source = fs.readFileSync("./src/api.js", "utf8");
  const body = source.slice(source.indexOf("export const normalizeProfilePayload"), source.indexOf("export const getMyProfile"));
  const normalize = vm.runInNewContext(body.replace("export const", "const") + "; normalizeProfilePayload", { getLanguage: () => "en" });
  assert.deepEqual(JSON.parse(JSON.stringify(normalize({occupation:" Changed "}))), {occupation:"Changed"});
  assert.deepEqual(JSON.parse(JSON.stringify(normalize({english_language_score:null}))), {english_language_score:null});
});
test("education is fully bilingual and distinguishes raw scores", () => {
  const en = JSON.parse(fs.readFileSync("./src/locales/en.json", "utf8")).languageIntelligence;
  const fr = JSON.parse(fs.readFileSync("./src/locales/fr.json", "utf8")).languageIntelligence;
  assert.deepEqual(Object.keys(en),Object.keys(fr));
  assert.match(en.detail,/listening|Listening/);
  assert.match(fr.detail,/compréhension orale/);
  assert.match(en.raw,/do not guess/);
  assert.match(fr.raw,/ne le devinez pas/);
});

test("small language edits do not resubmit unrelated profile fields", () => {
  const original = {first_name:"Owner",age:30,occupation:"Original",english_language_score:7,french_language_score:"",language_score:40};
  const edited = {...original,english_language_score:"12"};
  assert.deepEqual(profileLanguagePayload(edited,edited,original), {english_language_score:12});
  assert.deepEqual(profileLanguagePayload({...original,occupation:"Changed"},original,original), {occupation:"Changed"});
});

test("production c7147f7 full PUT shapes preserve the exact legacy transformations", async () => {
  // Exact frozen excerpts from production c7147f7; works in shallow CI checkouts.
  const { defaults, helpers, expression, normalizer, api } = {"defaults": "const defaultForm = {\n  first_name: \"\",\n  last_name: \"\",\n  nationality: \"\",\n  current_country: \"\",\n  current_city: \"\",\n  phone_number: \"\",\n  date_of_birth: \"\",\n  marital_status: \"\",\n  preferred_language: \"en\",\n\n  age: \"\",\n  education: \"\",\n  language_score: \"\",\n  english_language_score: \"\",\n  french_language_score: \"\",\n  experience_years: \"\",\n  has_job_offer: false,\n  has_canadian_experience: false,\n  studied_in_canada: false,\n  occupation: \"\",\n  noc_code: \"\",\n  job_description: \"\",\n  job_duties: \"\",\n  preferred_province: \"\",\n};\n\n", "helpers": "function hydrateProfileForm(data) {\n  const merged = {\n    ...defaultForm,\n    ...(data || {}),\n  };\n\n  Object.entries(defaultForm).forEach(([key, fallback]) => {\n    if (merged[key] === null || typeof merged[key] === \"undefined\") {\n      merged[key] = fallback;\n    }\n  });\n\n  if (!merged.english_language_score && merged.language_score) {\n    merged.english_language_score = merged.language_score;\n  }\n\n  return merged;\n}\n\nfunction normalizeNumber(value) {\n  if (value === \"\" || value === null || typeof value === \"undefined\") return null;\n  const parsed = Number(value);\n  return Number.isNaN(parsed) ? null : parsed;\n}\n\n", "expression": "{\n        ...form,\n        age: normalizeNumber(form.age),\n        english_language_score: normalizeNumber(form.english_language_score),\n        french_language_score: normalizeNumber(form.french_language_score),\n        language_score: Math.max(\n          normalizeNumber(form.english_language_score) || 0,\n          normalizeNumber(form.french_language_score) || 0\n        ) || null,\n        experience_years: normalizeNumber(form.experience_years),\n        first_name: form.first_name?.trim() || null,\n        last_name: form.last_name?.trim() || null,\n        nationality: form.nationality?.trim() || null,\n        current_country: form.current_country?.trim() || null,\n        current_city: form.current_city?.trim() || null,\n        phone_number: form.phone_number?.trim() || null,\n        date_of_birth: form.date_of_birth || null,\n        marital_status: form.marital_status || null,\n        preferred_language: form.preferred_language || \"en\",\n        occupation: form.occupation?.trim() || null,\n        noc_code: form.noc_code?.trim() || null,\n        job_description: nocDescription?.trim() || null,\n        job_duties: nocDutyInput?.trim() || null,\n        preferred_province: form.preferred_province || null,\n      }", "normalizer": "const normalizeProfilePayload = (payload = {}) => {\n  const normalized = {\n    ...payload,\n    first_name: payload.first_name?.trim() || null,\n    last_name: payload.last_name?.trim() || null,\n    nationality: payload.nationality?.trim() || null,\n    current_country: payload.current_country?.trim() || null,\n    current_city: payload.current_city?.trim() || null,\n    phone_number: payload.phone_number?.trim() || null,\n    date_of_birth: payload.date_of_birth || null,\n    marital_status: payload.marital_status || null,\n    preferred_language:\n      String(payload.preferred_language || getLanguage()).toLowerCase().startsWith(\"fr\")\n        ? \"fr\"\n        : \"en\",\n\n    age:\n      payload.age === \"\" || payload.age === null || payload.age === undefined\n        ? null\n        : Number(payload.age),\n\n    language_score:\n      payload.language_score === \"\" ||\n      payload.language_score === null ||\n      payload.language_score === undefined\n        ? null\n        : Number(payload.language_score),\n\n    english_language_score:\n      payload.english_language_score === \"\" ||\n      payload.english_language_score === null ||\n      payload.english_language_score === undefined\n        ? null\n        : Number(payload.english_language_score),\n\n    french_language_score:\n      payload.french_language_score === \"\" ||\n      payload.french_language_score === null ||\n      payload.french_language_score === undefined\n        ? null\n        : Number(payload.french_language_score),\n\n    experience_years:\n      payload.experience_years === \"\" ||\n      payload.experience_years === null ||\n      payload.experience_years === undefined\n        ? null\n        : Number(payload.experience_years),\n\n    education: payload.education?.trim() || null,\n    occupation: payload.occupation?.trim() || null,\n    noc_code: payload.noc_code?.trim() || null,\n\n    job_description: payload.job_description?.trim() || null,\n    job_duties: payload.job_duties?.trim() || null,\n\n    preferred_province: payload.preferred_province || null,\n\n    has_job_offer: Boolean(payload.has_job_offer),\n    has_canadian_experience: Boolean(payload.has_canadian_experience),\n    studied_in_canada: Boolean(payload.studied_in_canada),\n  };\n\n  return normalized;\n};\n\n", "api": "export const updateMyProfile = (payload) =>\n  api.put(\"/profiles/me\", normalizeProfilePayload(payload));\n\n"};
  const make = vm.runInNewContext(defaults + helpers + normalizer + "; (saved, edits) => { const form = {...hydrateProfileForm(saved), ...edits}; const nocDescription = form.job_description; const nocDutyInput = form.job_duties; const language = 'en'; return normalizeProfilePayload(" + expression + "); }", {getLanguage:() => "en"});
  const defaultsOnly = make({}, {});
  assert.equal(defaultsOnly.phone_number, null);
  assert.equal(defaultsOnly.job_description, null);
  assert.equal(defaultsOnly.has_job_offer, false);
  assert.match(api, /updateMyProfile = [\s\S]*?api\.put/);
  for (const [saved,edits,expected] of [
    [{language_score:9,english_language_score:9,french_language_score:7},{occupation:"Edited"},[9,9,7]],
    [{language_score:40,english_language_score:40},{occupation:"Edited"},[40,40,null]],
    [{language_score:9,english_language_score:null},{occupation:"Edited"},[9,9,null]],
    [{language_score:40,english_language_score:null},{occupation:"Edited"},[40,40,null]],
    [{},{occupation:"Edited"},[null,null,null]],
    [{english_language_score:9},{english_language_score:null},[null,null,null]],
    [{language_score:9,english_language_score:9},{english_language_score:12},[12,12,null]],
  ]) {
    const body = make(saved,edits);
    assert.deepEqual([body.language_score,body.english_language_score,body.french_language_score],expected);
    for (const key of ["first_name","last_name","age","education","occupation","experience_years","preferred_language"]) assert.ok(Object.hasOwn(body,key));
  }
});
