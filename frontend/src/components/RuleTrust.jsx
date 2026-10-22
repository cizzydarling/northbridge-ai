import { useTranslation } from "react-i18next";

export default function RuleTrust({ source, effectiveDate, reviewedDate, version, status }) {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const tr = (en, french) => fr ? french : en;
  return <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
    <p>{tr("Review status", "État de révision")}: {status === "CURRENT_VERIFIED" ? tr("Reviewed reference — not an eligibility verdict", "Référence révisée — pas une décision d’admissibilité") : tr("Under review / not verified", "En cours de révision / non vérifié")}</p>
    <p>{tr("Effective", "En vigueur")}: {effectiveDate || tr("Unknown", "Inconnue")} · {tr("Reviewed", "Révisé")}: {reviewedDate || tr("Not independently reviewed", "Pas de révision indépendante")}</p>
    {version && <p className="break-words">{tr("Version", "Version")}: {version}</p>}
    {source && <a href={source} target="_blank" rel="noopener noreferrer" className="underline">{tr("Official source", "Source officielle")}</a>}
  </div>;
}
