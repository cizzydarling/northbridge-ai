import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import Layout from "../components/Layout";
import ApplicationContextBanner from "../components/ApplicationContextBanner";
import OfficialCrsHandoff from "../components/OfficialCrsHandoff";

export default function PlanningStrategyPage() {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const simulator = useLocation().pathname.endsWith("/simulator");
  const sources = [
    [fr ? "Entrée express : critères officiels" : "Express Entry: official criteria", "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html"],
    [fr ? "Programmes provinciaux : sources officielles" : "Provincial programs: official sources", "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees.html"],
    [fr ? "Rondes d’invitations publiées" : "Published invitation rounds", "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html"],
    [fr ? "Délais de traitement officiels" : "Official processing times", "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html"],
  ];
  return <Layout><main className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-3xl font-semibold">{simulator ? (fr ? "Simulateur temporairement indisponible" : "Simulator temporarily unavailable") : (fr ? "Préparer votre démarche" : "Plan your next steps")}</h1>
    <p>{fr ? "Organisez vos renseignements et consultez les sources officielles. Les évaluations d’admissibilité, prévisions et rapports analytiques sont indisponibles pendant la vérification des règles." : "Organize your information and consult official sources. Eligibility assessments, forecasts and analytical reports are unavailable while rules are verified."}</p>
    <ApplicationContextBanner />
    <OfficialCrsHandoff />
    <nav className="flex flex-wrap gap-5">
      <Link to="/profile">{fr ? "Profil et suggestion CNP" : "Profile and NOC suggestion"}</Link>
      <Link to="/household">{fr ? "Ménage" : "Household"}</Link>
      <Link to="/documents">{fr ? "Organiser les documents" : "Organize documents"}</Link>
      <Link to="/forms">{fr ? "Préparer les renseignements" : "Prepare draft information"}</Link>
    </nav>
    <section><h2 className="text-xl font-semibold">{fr ? "Sources officielles — information générale" : "Official sources — general information"}</h2>
      <ul className="space-y-3 py-4">{sources.map(([label, url]) => <li key={url}><a className="underline" href={url} target="_blank" rel="noopener noreferrer">{label}</a></li>)}</ul>
      <p>{fr ? "Les renseignements publiés ne constituent pas une prévision personnelle. Les faits familiaux sont déclarés par l’utilisateur; un statut inconnu reste inconnu." : "Published information is not a personal forecast. Family facts are user-entered; unknown status remains unknown."}</p>
    </section>
  </main></Layout>;
}
