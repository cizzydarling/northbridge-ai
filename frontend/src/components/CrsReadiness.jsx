import Button from "./ui/Button";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentUserLocal, getToken, getApplicationContext, getCrsPreparation, reviewCrsInputs } from "../api";
import RuleTrust from "./RuleTrust";

export default function CrsReadiness() {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const tr = (en, french) => fr ? french : en;
  const [age, setAge] = useState("");
  const [scenarioAge, setScenarioAge] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const active = useRef(true);
  const generation = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; generation.current += 1; }; }, []);
  useEffect(() => {
    const invalidate = () => { generation.current += 1; setResult(null); setBusy(false); setError(false); setAge(""); setScenarioAge(""); };
    window.addEventListener('nbai-active-case-updated', invalidate);
    window.addEventListener('nbai-bootstrap-refresh', invalidate);
    window.addEventListener('userUpdated', invalidate);
    return () => {
      window.removeEventListener('nbai-active-case-updated', invalidate);
      window.removeEventListener('nbai-bootstrap-refresh', invalidate);
      window.removeEventListener('userUpdated', invalidate);
    };
  }, []);
  const labels = {
    age: tr("Age", "Âge"), education: tr("Education and credential evidence", "Études et preuves du diplôme"),
    accompanying_spouse: tr("Accompanying spouse status", "Statut du conjoint accompagnant"),
    canadian_work_years: tr("Qualifying Canadian work history", "Expérience canadienne admissible à vérifier"),
    foreign_work_years: tr("Foreign work history", "Expérience à l’étranger"),
    provincial_nomination: tr("Verified provincial nomination", "Désignation provinciale à vérifier"),
    canadian_education: tr("Canadian education", "Études canadiennes"), sibling_in_canada: tr("Sibling in Canada", "Frère ou sœur au Canada"),
    current_four_skill_first_language_assessment: tr("Current four-skill first-language result", "Résultat actuel des quatre compétences de la première langue"),
    qualifying_work_and_occupation_classification: tr("Qualifying periods and official NOC classification", "Périodes admissibles et classification CNP officielle"),
    spouse_education: tr("Spouse education", "Études du conjoint"), spouse_canadian_work_years: tr("Spouse Canadian work", "Expérience canadienne du conjoint"), spouse_language: tr("Spouse language evidence", "Preuves linguistiques du conjoint"),
  };
  async function check() {
    const owner = getCurrentUserLocal()?.id;
    const token = getToken();
    const version = ++generation.current;
    const current = () => active.current && generation.current === version && getCurrentUserLocal()?.id === owner && getToken() === token;
    setBusy(true); setError(false); setResult(null);
    try {
      const context = (await getApplicationContext()).data;
      const saved = (await getCrsPreparation(context.case_id)).data;
      if (saved.case_id !== context.case_id) throw new Error("Case context changed");
      const facts = { ...saved.facts };
      if (age !== "") facts.age = Number(age);
      const response = await reviewCrsInputs({ baseline: { ranking_facts: facts }, scenario: scenarioAge === "" ? null : { ranking_facts: { ...facts, age: Number(scenarioAge) } } });
      const latest = (await getApplicationContext()).data;
      if (latest.case_id !== context.case_id) throw new Error("Case context changed");
      if (current()) setResult(response.data);
    } catch { if (current()) { setError(true); setResult(null); } }
    finally { if (current()) setBusy(false); }
  }
  return <section className="nb-card border border-slate-200 bg-white space-y-3 p-4" aria-label={tr("CRS input readiness", "Préparation des données SCG")}>
    <h2 className="text-xl font-semibold">{tr("CRS input readiness — not a score", "Préparation des données SCG — pas un score")}</h2>
    <p>{tr("Numerical CRS remains unavailable pending complete rules verification. This tool lists missing evidence and keeps scenarios separate from your actual profile. No profile or assessment is changed.", "Le SCG numérique reste indisponible pendant la vérification complète des règles. Cet outil indique les preuves manquantes et sépare les scénarios du profil réel. Aucun profil ni résultat d’examen n’est modifié.")}</p>
    <p>{tr("Uses saved preparation from your current owned case and your selected language evidence. Optional age values below are detached what-if inputs. The November ruleset remains under review; no total cap or invitation outcome is inferred.", "Utilise la préparation enregistrée du dossier actif et vos preuves linguistiques sélectionnées. Les âges facultatifs ci-dessous sont des hypothèses distinctes. Les règles de novembre restent à l’étude ; aucun plafond global ni résultat d’invitation n’est déduit.")}</p>
    <div className="grid gap-3 sm:grid-cols-2"><label>{tr("Baseline age (optional)", "Âge de référence (facultatif)")}<input className="block rounded border p-2" type="number" min="0" max="120" value={age} onChange={e => setAge(e.target.value)} /></label><label>{tr("Scenario age (optional)", "Âge du scénario (facultatif)")}<input className="block rounded border p-2" type="number" min="0" max="120" value={scenarioAge} onChange={e => setScenarioAge(e.target.value)} /></label></div>
    <Button variant="secondary" type="button" className="nb-button-secondary" disabled={busy} onClick={check}>{tr("Check missing evidence", "Vérifier les preuves manquantes")}</Button>
    {error && <p role="alert">{tr("Could not check inputs. No data changed.", "Vérification impossible. Aucune donnée modifiée.")}</p>}
    {result && <div role="status"><p>{tr("No score calculated", "Aucun score calculé")} · {result.baseline.ruleset_version} · {result.baseline.calculation_date}</p><ul>{result.baseline.missing_inputs.map(x => <li key={x}>{labels[x] || tr("Additional evidence required", "Preuves supplémentaires requises")}</li>)}</ul><RuleTrust source={result.baseline.sources[0]} version={result.baseline.ruleset_version} effectiveDate={result.baseline.ruleset_version.includes("2026-11-03") ? "2026-11-03" : "2025-03-25"} status={result.baseline.validation_status} />{result.scenario && <p>{tr("Scenario is a separate, unsaved snapshot. No numerical difference is available.", "Le scénario est un instantané distinct non enregistré. Aucune différence numérique n’est disponible.")}</p>}</div>}
  </section>;
}
