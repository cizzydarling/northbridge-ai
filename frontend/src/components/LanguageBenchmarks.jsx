import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { benchmarkState } from "../utils/languageBenchmarks";
import StructuredLanguageEvidence from "./StructuredLanguageEvidence";

export default function LanguageBenchmarks({ form, onChange, errors = {} }) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const copy = (key) => t(`languageIntelligence.${key}`);
  const official = i18n.language.startsWith("fr")
    ? "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/entree-express/documents/examen-langue.html"
    : "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html";
  const clear = () => {
    for (const name of ["english_language_score", "french_language_score", "language_score"]) {
      onChange({ target: { name, value: "", type: "select-one" } });
    }
  };
  return <section className="col-span-full min-w-0 space-y-3 rounded-xl border border-slate-200 p-4" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="text-lg font-semibold">{copy("title")}</h2>
    <p className="text-sm">{copy("intro")}</p>
    <details><summary className="cursor-pointer text-sm underline">{copy("more")}</summary><p className="mt-2 text-sm">{copy("detail")}</p></details>
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      {[["english_language_score", "english"], ["french_language_score", "french"]].map(([name, label]) => {
        const review = benchmarkState(form[name]) === "review";
        const error = errors[name];
        return <div key={name} className="min-w-0">
          <label htmlFor={`${id}-${name}`} className="block text-sm font-medium">{copy(label)}</label>
          <select id={`${id}-${name}`} name={name} value={form[name] ?? ""} onChange={onChange}
            className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 p-2" aria-describedby={`${id}-${name}-hint`} aria-invalid={Boolean(error)}>
            <option value="">{copy("unknown")}</option>
            {review && <option value={form[name]} disabled>{copy("review")}</option>}
            {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
          </select>
          <p id={`${id}-${name}-hint`} className="mt-1 text-xs text-slate-600">{error ? copy("invalid") : review ? copy("review") : benchmarkState(form[name]) === "unknown" ? copy("noResults") : copy("reported")}</p>
        </div>;
      })}
    </div>
    {form.language_score !== "" && form.language_score != null && <p role="status" className="text-sm text-amber-800">{copy("review")}: {copy("legacy")}</p>}
    <button type="button" onClick={clear} aria-describedby={`${id}-clear`} className="min-h-11 rounded-lg border border-slate-300 px-3 text-left text-sm">{copy("notTested")}</button>
    <p id={`${id}-clear`} className="text-xs text-slate-600">{copy("clearHint")}</p>
    <p className="text-sm">{copy("raw")} <a href={official} target="_blank" rel="noopener noreferrer" className="underline">{copy("official")}</a></p>
    <nav aria-label={copy("title")} className="flex flex-wrap gap-4 text-sm underline">
      <Link to="/official-finders">{copy("finders")}</Link><Link to="/language-practice">{copy("practice")}</Link><Link to="/strategy">{copy("strategy")}</Link>
    </nav>
    <StructuredLanguageEvidence />
  </section>;
}

export function LanguageResultsSummary({ profile }) {
  const { t } = useTranslation();
  const copy = key => t(`languageIntelligence.${key}`);
  const values = [["english_language_score", "english"], ["french_language_score", "french"]];
  return <section className="my-4 min-w-0 rounded-lg border border-slate-200 p-3" aria-label={copy("status")}>
    <h2 className="text-sm font-semibold">{copy("status")}</h2>
    {values.map(([field, label]) => <p key={field} className="text-sm">{copy(label)}: {benchmarkState(profile?.[field]) === "reported" ? `${profile[field]} — ${copy("reported")}` : copy(benchmarkState(profile?.[field]) === "review" ? "review" : "noResults")}</p>)}
    {profile?.language_score != null && <p className="text-sm">{copy("review")}: {copy("legacy")}</p>}
  </section>;
}
