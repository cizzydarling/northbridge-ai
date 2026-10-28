import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Button from "./ui/Button";
import { getApplicationContext, getCurrentUserLocal, getCrsPreparation, saveCrsPreparation, recordProductActivity } from "../api";

function invalidateEpoch(ref, version) {
  if (ref.current === version) ref.current += 1;
}

export default function CommercialCrsWorkspace() {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const tr = (en, french) => fr ? french : en;
  const [view, setView] = useState({ state: "loading", caseId: null, owner: null, revision: 0, facts: {} });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const epoch = useRef(0);
  const owner = getCurrentUserLocal()?.id;
  useEffect(() => {
    let active = true;
    const version = ++epoch.current;
    async function load() {
      setView({ state: "loading", owner, caseId: null, revision: 0, facts: {} });
      setError(false); setSaved(false); setBusy(false);
      try {
        const context = (await getApplicationContext()).data;
        const result = (await getCrsPreparation(context.case_id)).data;
        if (result.case_id !== context.case_id || !Number.isInteger(result.revision) || result.score !== null) throw new Error("Invalid preparation contract");
        if (active && epoch.current === version && getCurrentUserLocal()?.id === owner) {
          setView({ state: "ready", owner, caseId: result.case_id, revision: result.revision, facts: result.facts });
          recordProductActivity("crs_engaged", "strategy");
          recordProductActivity("strategy_engaged", "strategy");
        }
      } catch { if (active && epoch.current === version && getCurrentUserLocal()?.id === owner) setView({ state: "failed", owner, caseId: null, revision: 0, facts: {} }); }
    }
    load();
    return () => { active = false; invalidateEpoch(epoch, version); };
  }, [owner, reload]);
  const ready = view.state === "ready" && owner === view.owner;
  function change(key, value) {
    setSaved(false); setError(false);
    setView(v => ({ ...v, facts: { ...v.facts, [key]: value } }));
  }
  async function save() {
    if (!ready || busy) return;
    const version = epoch.current;
    setBusy(true); setError(false);
    try {
      const result = (await saveCrsPreparation(view.caseId, { revision: view.revision, facts: view.facts })).data;
      if (epoch.current === version && getCurrentUserLocal()?.id === owner) {
        if (result.case_id !== view.caseId || result.revision !== view.revision + 1 || result.score !== null) throw new Error("Invalid save contract");
        setView(v => ({ ...v, revision: result.revision })); setSaved(true);
      }
    } catch { if (epoch.current === version && getCurrentUserLocal()?.id === owner) setError(true); }
    finally { if (epoch.current === version && getCurrentUserLocal()?.id === owner) setBusy(false); }
  }
  const fields = [
    ["age", "Age", "Âge", 120],
    ["canadian_work_years", "Qualifying Canadian work years (to verify)", "Années de travail canadien admissible (à vérifier)", 60],
    ["spouse_canadian_work_years", "Spouse Canadian work years (to verify)", "Années de travail canadien du conjoint (à vérifier)", 60],
    ["foreign_work_years", "Qualifying foreign work years (to verify)", "Années de travail étranger admissible (à vérifier)", 60],
  ];
  const confirmations = [
    ["education_evidence_current", "Education evidence current and qualifying (to verify)", "Preuves d’études actuelles et admissibles (à vérifier)"],
    ["language_evidence_current", "Language evidence current (to verify)", "Preuves linguistiques actuelles (à vérifier)"],
    ["no_second_language_test", "No second-language test", "Aucun examen de deuxième langue"],
    ["canadian_work_qualified", "Canadian work qualification checked (to verify)", "Qualification du travail canadien vérifiée (à confirmer)"],
    ["foreign_work_qualified", "Foreign work qualification checked (to verify)", "Qualification du travail étranger vérifiée (à confirmer)"],
    ["spouse_education_evidence_current", "Spouse education evidence current", "Preuves d’études du conjoint actuelles"],
    ["spouse_no_language_test", "Spouse has no language test", "Conjoint sans examen linguistique"],
    ["spouse_language_evidence_current", "Spouse language evidence current", "Preuves linguistiques du conjoint actuelles"],
    ["spouse_work_qualified", "Spouse Canadian work qualification checked", "Qualification du travail canadien du conjoint vérifiée"],
    ["certificate_of_qualification", "Qualifying trade certificate (to verify)", "Certificat de qualification admissible (à vérifier)"],
    ["provincial_nomination", "Express Entry nomination (to verify)", "Désignation Entrée express (à vérifier)"],
    ["sibling_in_canada", "Qualifying sibling in Canada (to verify)", "Fratrie admissible au Canada (à vérifier)"],
    ["additional_evidence_qualified", "Additional-factor evidence checked (to verify)", "Preuves des facteurs supplémentaires vérifiées (à confirmer)"],
  ];
  return <section className="nb-card space-y-4 border border-slate-200 bg-white p-4" aria-label={tr("Saved CRS preparation", "Préparation SCG enregistrée")}>
    <h2 className="text-xl font-semibold">{tr("Save incomplete CRS preparation", "Enregistrer la préparation SCG incomplète")}</h2>
    <p>{tr("Ranking, program eligibility and invitation eligibility are separate decisions. Numerical scoring awaits independent rule review. Unknown answers stay unknown; saving does not change your Profile, language tests or paid access.", "Le classement, l’admissibilité au programme et l’admissibilité à une invitation sont distincts. Le calcul attend la révision indépendante des règles. Les réponses inconnues restent inconnues ; l’enregistrement ne modifie ni le profil, ni les examens, ni l’accès payant.")}</p>
    {!ready && <p role={view.state === "failed" ? "alert" : "status"}>{view.state === "failed" ? tr("Could not load saved preparation. Saving is blocked.", "Chargement impossible. L’enregistrement est bloqué.") : tr("Loading saved preparation…", "Chargement de la préparation…")}</p>}
    <fieldset disabled={!ready || busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <legend className="sr-only">{tr("CRS facts", "Renseignements SCG")}</legend>
      {fields.map(([key, en, french, maximum]) => <label key={key} className="min-w-0">{tr(en, french)}<input type="number" min="0" max={maximum} className="block w-full min-w-0 rounded border p-2" value={ready ? view.facts[key] ?? "" : ""} onChange={e => change(key, e.target.value === "" ? null : Number(e.target.value))} /></label>)}
      <label>{tr("Education", "Études")}<select className="block w-full min-w-0 rounded border p-2" value={ready ? view.facts.education || "" : ""} onChange={e => change("education", e.target.value || null)}>{[["", "Unknown", "Inconnu"], ["less_than_secondary", "Less than secondary", "Moins que secondaire"], ["secondary", "Secondary", "Secondaire"], ["one_year", "One-year credential", "Diplôme d’un an"], ["two_year", "Two-year credential", "Diplôme de deux ans"], ["bachelor", "Bachelor / three-year credential", "Baccalauréat / diplôme de trois ans"], ["two_or_more", "Two or more credentials", "Deux diplômes ou plus"], ["master", "Master / qualifying professional degree", "Maîtrise / diplôme professionnel admissible"], ["doctorate", "Doctorate", "Doctorat"]].map(([value,en,french]) => <option key={value} value={value}>{tr(en,french)}</option>)}</select></label>
      <label>{tr("Spouse / partner status", "Statut du conjoint")}<select className="block w-full rounded border p-2" value={ready ? view.facts.spouse_status || "" : ""} onChange={e => change("spouse_status", e.target.value || null)}>{[["", "Unknown", "Inconnu"], ["none", "No spouse / partner", "Sans conjoint"], ["non_accompanying", "Not accompanying", "Non accompagnant"], ["citizen_or_pr", "Canadian citizen / permanent resident", "Citoyen canadien / résident permanent"], ["accompanying", "Accompanying", "Accompagnant"]].map(([value,en,french]) => <option key={value} value={value}>{tr(en,french)}</option>)}</select></label>
      <label>{tr("Spouse education", "Études du conjoint")}<select className="block w-full min-w-0 rounded border p-2" value={ready ? view.facts.spouse_education || "" : ""} onChange={e => change("spouse_education", e.target.value || null)}>{[["", "Unknown", "Inconnu"], ["less_than_secondary", "Less than secondary", "Moins que secondaire"], ["secondary", "Secondary", "Secondaire"], ["one_year", "One-year credential", "Diplôme d’un an"], ["two_year", "Two-year credential", "Diplôme de deux ans"], ["bachelor", "Bachelor / three-year credential", "Baccalauréat / diplôme de trois ans"], ["two_or_more", "Two or more credentials", "Deux diplômes ou plus"], ["master", "Master / qualifying professional degree", "Maîtrise / diplôme professionnel admissible"], ["doctorate", "Doctorate", "Doctorat"]].map(([value,en,french]) => <option key={value} value={value}>{tr(en,french)}</option>)}</select></label>
      <label>{tr("First official language", "Première langue officielle")}<select className="block w-full rounded border p-2" value={ready ? view.facts.first_language || "" : ""} onChange={e => change("first_language", e.target.value || null)}><option value="">{tr("Unknown", "Inconnue")}</option><option value="en">{tr("English", "Anglais")}</option><option value="fr">{tr("French", "Français")}</option></select></label>
      <label>{tr("Canadian education", "Études canadiennes")}<select className="block w-full rounded border p-2" value={ready ? view.facts.canadian_education || "" : ""} onChange={e => change("canadian_education", e.target.value || null)}>{[["", "Unknown", "Inconnues"], ["none", "None", "Aucune"], ["one_or_two_years", "One or two years", "Un ou deux ans"], ["three_or_more_years", "Three or more years", "Trois ans ou plus"]].map(([value,en,french]) => <option key={value} value={value}>{tr(en,french)}</option>)}</select></label>
      {confirmations.map(([key,en,french]) => <label key={key}>{tr(en,french)}<select className="block w-full rounded border p-2" value={ready && view.facts[key] != null ? String(view.facts[key]) : ""} onChange={e => change(key,e.target.value === "" ? null : e.target.value === "true")}><option value="">{tr("Unknown", "Inconnu")}</option><option value="true">{tr("Yes — user-reported", "Oui — déclaré")}</option><option value="false">{tr("No — user-reported", "Non — déclaré")}</option></select></label>)}
      {[["english", "English CLB", "Anglais CLB"], ["french", "French NCLC", "Français NCLC"], ["spouse_language", "Spouse CLB/NCLC", "Conjoint CLB/NCLC"]].map(([key,en,french]) => <fieldset key={key} className="min-w-0 space-y-2 rounded border p-3"><legend>{tr(en,french)}</legend>{[["listening", "Listening", "Compréhension orale"], ["reading", "Reading", "Compréhension écrite"], ["writing", "Writing", "Expression écrite"], ["speaking", "Speaking", "Expression orale"]].map(([skill,label,frLabel]) => <label key={skill} className="block">{tr(label,frLabel)}<input type="number" min="1" max="12" className="block w-full min-w-0 rounded border p-2" value={ready ? view.facts[key]?.[skill] ?? "" : ""} onChange={e => {const next={...(view.facts[key] || {}),[skill]:e.target.value === "" ? null : Number(e.target.value)}; change(key,Object.values(next).every(v=>v==null) ? null : next);}} /></label>)}</fieldset>)}
    </fieldset>
    <div className="flex flex-wrap gap-3"><Button type="button" variant="secondary" disabled={!ready || busy} onClick={save}>{tr("Save preparation", "Enregistrer la préparation")}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => setReload(v => v+1)}>{tr("Reload saved preparation", "Recharger la préparation")}</Button></div>
    {saved && <p role="status">{tr("Saved on server. Incomplete evidence does not produce a score.", "Enregistré sur le serveur. Les preuves incomplètes ne produisent aucun score.")}</p>}
    {error && <p role="alert">{tr("Save not confirmed. Your edits remain here; reload to resolve a conflict before retrying.", "Enregistrement non confirmé. Vos modifications restent ici ; rechargez pour résoudre un conflit avant de réessayer.")}</p>}
    <nav className="flex flex-wrap gap-4"><Link to="/profile?section=language">{tr("Review language evidence", "Réviser les preuves linguistiques")}</Link><Link to="/forms">{tr("Continue saved preparation", "Continuer la préparation enregistrée")}</Link></nav>
  </section>;
}
