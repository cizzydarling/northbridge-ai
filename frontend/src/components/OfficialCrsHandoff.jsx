import { useTranslation } from "react-i18next";

export const OFFICIAL_CRS_URL = "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html";

export default function OfficialCrsHandoff() {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  return <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-slate-900">
    <h2 className="font-semibold">{fr ? "Vérifiez votre score CRS avec l’outil officiel" : "Check your official CRS score"}</h2>
    <p className="my-3">{fr ? "Le calcul CRS intégré de NorthBridgeAI est en cours de vérification. Aucun score ni gain de points n’est calculé ici." : "NorthBridgeAI’s integrated CRS calculation is being verified. No score or point gains are calculated here."}</p>
    <a href={OFFICIAL_CRS_URL} target="_blank" rel="noopener noreferrer" className="underline">{fr ? "Ouvrir le calculateur du gouvernement du Canada" : "Open the Government of Canada calculator"}</a>
  </section>;
}
