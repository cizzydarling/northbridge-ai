import Button from "./ui/Button";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getCurrentUserLocal, reviewCrsInputs } from "../api";
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
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
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
    setBusy(true); setError(false);
    try {
      const response = await reviewCrsInputs({ baseline: { age: age === "" ? null : Number(age) }, scenario: scenarioAge === "" ? null : { age: Number(scenarioAge) } });
      if (active.current && getCurrentUserLocal()?.id === owner) setResult(response.data);
    } catch { if (active.current && getCurrentUserLocal()?.id === owner) { setError(true); setResult(null); } }
    finally { if (active.current && getCurrentUserLocal()?.id === owner) setBusy(false); }
  }
  return <section className="nb-card border border-slate-200 bg-white space-y-3 p-4" aria-label={tr("CRS input readiness", "Préparation des données SCG")}>
    <h2 className="text-xl font-semibold">{tr("CRS input readiness — not a score", "Préparation des données SCG — pas un score")}</h2>
    <p>{tr("Numerical CRS remains unavailable pending complete rules verification. This tool lists missing evidence and keeps scenarios separate from your actual profile. No profile or assessment is changed.", "Le SCG numérique reste indisponible pendant la vérification complète des règles. Cet outil indique les preuves manquantes et sépare les scénarios du profil réel. Aucun profil ni résultat d’examen n’est modifié.")}</p>
    <div className="grid gap-3 sm:grid-cols-2"><label>{tr("Baseline age (optional)", "Âge de référence (facultatif)")}<input className="block rounded border p-2" type="number" min="0" max="120" value={age} onChange={e => setAge(e.target.value)} /></label><label>{tr("Scenario age (optional)", "Âge du scénario (facultatif)")}<input className="block rounded border p-2" type="number" min="0" max="120" value={scenarioAge} onChange={e => setScenarioAge(e.target.value)} /></label></div>
    <Button variant="secondary" type="button" className="nb-button-secondary" disabled={busy} onClick={check}>{tr("Check missing evidence", "Vérifier les preuves manquantes")}</Button>
    {error && <p role="alert">{tr("Could not check inputs. No data changed.", "Vérification impossible. Aucune donnée modifiée.")}</p>}
    {result && <div role="status"><p>{tr("No score calculated", "Aucun score calculé")} · {result.baseline.ruleset_version} · {result.baseline.calculation_date}</p><ul>{result.baseline.missing_inputs.map(x => <li key={x}>{labels[x] || tr("Additional evidence required", "Preuves supplémentaires requises")}</li>)}</ul><RuleTrust source={result.baseline.sources[0]} version={result.baseline.ruleset_version} effectiveDate={result.baseline.ruleset_version.includes("2026-11-03") ? "2026-11-03" : "2025-03-25"} status={result.baseline.validation_status} />{result.scenario && <p>{tr("Scenario is a separate, unsaved snapshot. No numerical difference is available.", "Le scénario est un instantané distinct non enregistré. Aucune différence numérique n’est disponible.")}</p>}</div>}
  </section>;
}
