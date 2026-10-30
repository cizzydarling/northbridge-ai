import Button from "./ui/Button";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import RuleTrust from "./RuleTrust";
import { createLanguageAssessment, getCurrentUserLocal, getLanguageAssessments, selectLanguageAssessment } from "../api";

const exams = [
  ["ielts_general", "IELTS General Training", "en", "general_training_original"],
  ["celpip_general", "CELPIP-General", "en", "celpip_general"],
  ["pte_core", "PTE Core", "en", "pte_core"],
  ["tef_canada", "TEF Canada — Équivalence ancien score", "fr", "previous_score_equivalency"],
  ["tcf_canada", "TCF Canada", "fr", "tcf_canada"],
];
const skills = [["listening", "Listening", "Compréhension orale"], ["reading", "Reading", "Compréhension écrite"], ["writing", "Writing", "Expression écrite"], ["speaking", "Speaking", "Expression orale"]];

export default function StructuredLanguageEvidence({ summary = false }) {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const tr = (en, french) => fr ? french : en;
  const userId = getCurrentUserLocal()?.id;
  const evidenceRef = useRef(null);
  useEffect(() => {
    if (summary || window.location.hash !== "#language-evidence") return;
    const frame = requestAnimationFrame(() => {
      evidenceRef.current?.focus({ preventScroll: true });
      evidenceRef.current?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [summary]);
  const epoch = useRef(0);
  const invalidate = useCallback(() => { ++epoch.current; }, []);
  const [data, setData] = useState(null);
  const [dataOwner, setDataOwner] = useState(null);
  const [state, setState] = useState("loading");
  const [exam, setExam] = useState(exams[0][0]);
  const [tested, setTested] = useState("");
  const [raw, setRaw] = useState({ listening: "", reading: "", writing: "", speaking: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const version = ++epoch.current;
    getLanguageAssessments().then(response => {
      if (active && version === epoch.current && getCurrentUserLocal()?.id === userId) {
        setData(response.data); setDataOwner(userId); setState("ready");
      }
    }).catch(() => { if (active) setState("failed"); });
    return () => { active = false; invalidate(); };
  }, [userId, reload, invalidate]);
  async function change(operation) {
    setBusy(true); setError("");
    const version = ++epoch.current;
    try {
      await operation();
      const response = await getLanguageAssessments();
      if (version === epoch.current && getCurrentUserLocal()?.id === userId) { setData(response.data); setDataOwner(userId); setState("ready"); }
    } catch {
      if (version === epoch.current) setError(tr("Not saved. Check all four results, exam edition and date. Expired/unsupported results cannot be selected.", "Non enregistré. Vérifiez les quatre résultats, l’édition et la date. Les résultats expirés ou non pris en charge ne peuvent pas être sélectionnés."));
    } finally { if (version === epoch.current) setBusy(false); }
  }
  const selectedExam = exams.find(x => x[0] === exam);
  const statusLabel = value => ({ current: tr("Current date", "Date valide"), expired: tr("Expired", "Expiré"), below_published_range: tr("Below published range", "Sous la plage publiée"), unsupported_mapping: tr("Mapping unavailable", "Conversion indisponible") }[value] || tr("Unknown", "Inconnu"));
  return <section ref={evidenceRef} tabIndex={-1} id={summary ? undefined : "language-evidence"} className="scroll-mt-32 col-span-full space-y-4 rounded-xl border border-slate-200 bg-white p-4" aria-label={tr("Test evidence", "Résultats d’examen")} onKeyDown={e => {
    // This section sits inside the legacy Profile form. Enter in an assessment
    // input must not silently submit unrelated Profile fields.
    if (e.key === "Enter" && ["INPUT", "SELECT"].includes(e.target.tagName)) e.preventDefault();
  }}>
    <h2 className="text-xl font-semibold">{tr("Four-skill test evidence", "Résultats d’examen par compétence")}</h2>
    <p>{tr("User-reported results, not independently verified. Legacy single scores are not test evidence. Published 10+ bands do not establish an exact CLB/NCLC 11 or 12.", "Résultats déclarés, non vérifiés indépendamment. Les anciens scores uniques ne constituent pas des résultats d’examen. Une tranche 10+ ne donne pas un niveau exact 11 ou 12.")}</p>
    {state === "loading" && <p role="status">{tr("Loading saved results…", "Chargement des résultats…")}</p>}
    {state === "failed" && <div role="alert">{tr("Results could not be loaded. No changes were made.", "Impossible de charger les résultats. Aucune modification effectuée.")} <Button variant="secondary" type="button" onClick={() => setReload(n => n + 1)}>{tr("Retry", "Réessayer")}</Button></div>}
    {error && <p role="alert">{error}</p>}
    {state === "ready" && dataOwner === userId && <>
      <p>{tr("Current selections", "Sélections actuelles")}: {[["en", "English", "Anglais"], ["fr", "French", "Français"]].map(([lang, en, french]) => {
        const result = data.assessments.find(a => a.id === data.selected[lang]);
        return <span key={lang} className="mr-4">{tr(en, french)} — {result ? `${result.exam} · ${statusLabel(result.status)}` : tr("Unknown / not tested", "Inconnu / pas encore testé")}</span>;
      })}</p>
      {!summary && <>
        <label className="block">{tr("Approved test and edition", "Examen et édition pris en charge")}<select aria-label={tr("Approved test and edition", "Examen et édition pris en charge")} className="mt-1 w-full rounded border p-2" value={exam} onChange={e => { setExam(e.target.value); setRaw({ listening: "", reading: "", writing: "", speaking: "" }); }}>
          {exams.map(([key, label]) => <option value={key} key={key}>{label}</option>)}
        </select></label>
        <p className="text-sm">{exam === "tef_canada" ? tr("Enter the previous-score-equivalency column only, not Score /699. Corrected 2023–2024 statements must use the reissued scores.", "Saisissez uniquement la colonne Équivalence ancien score, jamais Score /699. Utilisez les résultats réémis si votre attestation 2023–2024 a été corrigée.") : tr("IELTS Academic, IELTS One Skill Retake and PTE Academic are not supported.", "IELTS Academic, IELTS One Skill Retake et PTE Academic ne sont pas pris en charge.")}</p>
        <label className="block">{tr("Test date", "Date de l’examen")}<input className="ml-2 rounded border p-2" type="date" value={tested} onChange={e => setTested(e.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">{skills.map(([key, en, french]) => <label key={key}>{tr(en, french)}<input className="mt-1 w-full rounded border p-2" type="number" inputMode="decimal" step={exam === "ielts_general" ? "0.5" : "1"} value={raw[key]} onChange={e => setRaw({ ...raw, [key]: e.target.value })} /></label>)}</div>
        <Button variant="primary" type="button" disabled={busy || !tested || Object.values(raw).some(x => x === "")} onClick={() => change(() => createLanguageAssessment({ language: selectedExam[2], exam, edition: selectedExam[3], test_date: tested, raw_scores: raw }))}>{tr("Save test record", "Enregistrer les résultats")}</Button>
        <p className="text-sm">{tr("Saving preserves history; selection is separate. Results expire on the second anniversary. Existing Profile benchmarks are unchanged.", "L’enregistrement conserve l’historique ; la sélection est distincte. Les résultats expirent au deuxième anniversaire. Les niveaux du profil restent inchangés.")}</p>
        <ul className="space-y-3">{data.assessments.map(a => <li key={a.id} className="rounded-lg border p-3">
          <h3 className="font-semibold">{a.exam} — {a.test_date}</h3><p>{a.edition} · {statusLabel(a.status)} · {tr("Expires", "Expiration")}: {a.expires_on}</p>
          <dl className="grid gap-2 sm:grid-cols-2">{skills.map(([s, en, french]) => <div key={s}><dt>{tr(en, french)}</dt><dd>{a.raw_scores[s]} → {a.skills[s].benchmark === null ? tr("Below published range", "Sous la plage publiée") : `${a.skills[s].benchmark}${a.skills[s].at_least ? "+" : ""}`}</dd></div>)}</dl>
          <p className="text-xs">{a.mapping_version} · {tr("User-reported", "Déclaré par vous")}</p>
          <RuleTrust source={a.source} version={a.mapping_version} status={a.mapping_review_status} />
          <Button variant="secondary" type="button" className="nb-button-secondary" disabled={busy || !a.usable || data.selected[a.language] === a.id} onClick={() => change(() => selectLanguageAssessment(a.language, a.id))}>{data.selected[a.language] === a.id ? tr("Selected", "Sélectionné") : tr("Use as current", "Utiliser actuellement")}</Button>
          <a href={a.source} target="_blank" rel="noopener noreferrer" className="ml-3 underline">{tr("Official mapping", "Table officielle")}</a>
        </li>)}</ul>
        <div className="flex flex-wrap gap-3">{["en", "fr"].map(lang => <Button variant="secondary" key={lang} type="button" disabled={busy || !data.selected[lang]} onClick={() => change(() => selectLanguageAssessment(lang, null))}>{tr("Set unknown", "Définir inconnu")} — {lang.toUpperCase()}</Button>)}</div>
      </>}
    </>}
    <nav aria-label={tr("Language resources", "Ressources linguistiques")} className="flex flex-wrap gap-3 underline">
      <Link to="/profile">{tr("Profile and language", "Profil et langues")}</Link>
      <Link to="/strategy">{tr("CRS / Strategy context", "Contexte SCG / stratégie")}</Link>
      {dataOwner===userId&&data?.assessments.filter(a=>Object.values(data.selected||{}).includes(a.id)&&a.usable).map(a=>{const provider={ielts_general:"ielts",celpip_general:"celpip",pte_core:"pte",tef_canada:"tef",tcf_canada:"tcf"}[a.exam];return provider?<Link key={a.id} to={"/official-finders?tab=tests&provider="+provider}>{tr("Find centres for selected test","Trouver les centres du test sélectionné")} — {a.exam}</Link>:null;})}
      <Link to="/official-finders?tab=tests">{tr("Official test centres", "Centres de tests officiels")}</Link>
      <Link to="/official-finders?tab=schools">{tr("Schools and DLI", "Établissements et EED")}</Link>
      <Link to="/language-practice">{tr("Language practice (Premium; not test evidence)", "Pratique linguistique (Premium ; pas un résultat d’examen)")}</Link>
    </nav>
  </section>;
}
