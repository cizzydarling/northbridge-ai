import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getProgramReferences } from "../api";
import RuleTrust from "./RuleTrust";

export default function ProgramReferences() {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const tr = (en, french) => fr ? french : en;
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const label = p => p.family === "express_entry" ? tr("Federal Express Entry", "Entrée express fédéral")
    : p.family === "quebec_selection" ? tr("Quebec skilled-worker selection", "Sélection québécoise des travailleurs qualifiés")
    : p.jurisdiction === "ON" ? tr("Ontario Immigrant Nominee Program (OINP)", "Programme ontarien des candidats à l’immigration (POCI)")
    : `${p.jurisdiction} — ${tr("provincial nominee program reference", "référence du programme des candidats des provinces")}`;
  useEffect(() => {
    let active = true;
    getProgramReferences().then(r => { if (active) setData(r.data); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  return <section className="nb-card space-y-3 border border-slate-200 bg-white p-4" aria-label={tr("Jurisdiction references", "Références territoriales")}>
    <h2 className="text-xl font-semibold">{tr("Programs and settlement jurisdiction", "Programmes et lieu d’établissement")}</h2>
    <p>{tr("Quebec and Nunavut have no PNP. Quebec selection is separate from federal Express Entry. French-speaking pathways must meet their settlement rules. Program existence does not establish an open stream or your eligibility.", "Le Québec et le Nunavut n’ont pas de PCP. La sélection québécoise est distincte d’Entrée express fédéral. Les voies francophones doivent respecter les règles d’établissement. L’existence d’un programme ne signifie ni qu’un volet est ouvert ni que vous êtes admissible.")}</p>
    {failed ? <p role="alert">{tr("References unavailable. No active stream is recommended.", "Références indisponibles. Aucun volet actif n’est recommandé.")}</p> : !data ? <p role="status">{tr("Loading references…", "Chargement des références…")}</p> : <>
      <p>{tr("Recorded destination", "Destination enregistrée")}: {data.jurisdiction || tr("Unknown", "Inconnue")}</p>
      {data.references.map(p => <div key={p.identifier}><p>{label(p)} · {tr("Availability unverified", "Ouverture non vérifiée")}</p><p className="text-sm text-slate-600">{tr("Source checked", "Source consultée")}: {p.checked_on || tr("Unknown", "Inconnue")} · {tr("Eligibility not assessed", "Admissibilité non évaluée")}</p><RuleTrust source={p.official_source} effectiveDate={p.effective_from} status={p.review_status} /></div>)}
    </>}
  </section>;
}
