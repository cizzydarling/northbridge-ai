import { WorkspaceHeading, WorkflowLinks } from '../components/PremiumWorkspacePrimitives';
import { workspaceText } from '../content/premiumWorkspaceCopy';
import ProcessingTimesExplorer from "../components/ProcessingTimesExplorer";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import Layout from "../components/Layout";
import ApplicationContextBanner from "../components/ApplicationContextBanner";
import OfficialCrsHandoff from "../components/OfficialCrsHandoff";
import PreparationJourney from "../components/PreparationJourney";
import StructuredLanguageEvidence from "../components/StructuredLanguageEvidence";
import CommercialCrsWorkspace from "../components/CommercialCrsWorkspace";
import CrsReadiness from "../components/CrsReadiness";
import ProgramReferences from "../components/ProgramReferences";

export default function PlanningStrategyPage() {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const copy = workspaceText(i18n.language);
  const simulator = useLocation().pathname.endsWith("/simulator");
  const sources = [
    [fr ? "Entrée express : critères officiels" : "Express Entry: official criteria", "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html"],
    [fr ? "Programmes provinciaux : sources officielles" : "Provincial programs: official sources", "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/provincial-nominees.html"],
    [fr ? "Rondes d’invitations publiées" : "Published invitation rounds", "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html"],
    [fr ? "Délais de traitement officiels" : "Official processing times", "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html"],
  ];
  return <Layout><div className="premium-core premium-explore space-y-6">
    <PreparationJourney />
    <WorkspaceHeading title={simulator ? (fr ? "Simulateur temporairement indisponible" : "Simulator temporarily unavailable") : copy.explore}>{copy.exploreIntro}</WorkspaceHeading>
    <p>{fr ? "Organisez vos renseignements et consultez les sources officielles. Les évaluations d’admissibilité, prévisions et rapports analytiques sont indisponibles pendant la vérification des règles." : "Organize your information and consult official sources. Eligibility assessments, forecasts and analytical reports are unavailable while rules are verified."}</p>
    <ApplicationContextBanner />
    <WorkflowLinks />
    <section className="premium-notice"><h2>{copy.directory}</h2><nav className="flex flex-wrap gap-4"><Link to="/official-finders?tab=schools">{fr ? "Établissements et EED" : "Schools & DLI"}</Link><Link to="/official-finders?tab=tests">{fr ? "Répertoire des centres de tests" : "Test-centre directory"}</Link></nav></section>
    <section id="processing-times" className="scroll-mt-32 rounded-xl border border-blue-200 bg-blue-50 p-5">
      <h2 className="text-xl font-semibold">{fr ? "Délais de traitement officiels" : "Official processing times"}</h2>
      <p className="my-3">{fr ? "Source : IRCC. Les délais sont des estimations officielles qui peuvent changer, pas une prévision personnelle. Consultez le vérificateur pour les renseignements actuels." : "Source: IRCC. Processing times are official estimates that can change, not a personal prediction. Consult the checker for current information."}</p>
      <a className="underline" href={fr ? "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/demande/verifier-delais-traitement.html" : "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/check-processing-times.html"} target="_blank" rel="noopener noreferrer">{fr ? "Ouvrir le vérificateur IRCC" : "Open the IRCC processing-time checker"}</a>
      <ProcessingTimesExplorer />
    </section>
    <OfficialCrsHandoff />
    <StructuredLanguageEvidence summary />
    <section id="saved-preparation" className="scroll-mt-32 space-y-4" aria-label={fr ? "Préparation enregistrée" : "Saved preparation"}>
      <nav className="flex flex-wrap gap-5 underline"><Link to="/official-finders?tab=schools#resource-shortlist">{fr ? "Liste de ressources" : "Resource shortlist"}</Link><Link to="/documents">{fr ? "Documents enregistrés" : "Saved documents"}</Link><Link to="/forms">{fr ? "Reprendre les formulaires" : "Return to Forms"}</Link></nav>
      <CommercialCrsWorkspace />
    </section>
    <CrsReadiness />
    <ProgramReferences />
    <nav className="flex flex-wrap gap-5">
      <Link to="/profile">{fr ? "Profil et suggestion CNP" : "Profile and NOC suggestion"}</Link>
      <Link to="/career-match">{fr ? "Explorer les carrières depuis la CNP" : "Explore careers from NOC"}</Link>
      <Link to="/strategy#program-references">{fr ? "Consulter les références de programmes" : "Browse supported program references"}</Link>
      <Link to="/citizenship/quiz">{fr ? "Pratique de citoyenneté" : "Citizenship practice"}</Link>
      <Link to="/household">{fr ? "Ménage" : "Household"}</Link>
      <Link to="/documents">{fr ? "Organiser les documents" : "Organize documents"}</Link>
      <Link to="/forms">{fr ? "Préparer les renseignements" : "Prepare draft information"}</Link>
    </nav>
    <section id="official-resources" className="scroll-mt-32"><h2 className="text-xl font-semibold">{fr ? "Sources officielles — information générale" : "Official sources — general information"}</h2>
      <ul className="space-y-3 py-4">{sources.map(([label, url]) => <li key={url}><a className="underline" href={url} target="_blank" rel="noopener noreferrer">{label}</a></li>)}</ul>
      <p>{fr ? "Les renseignements publiés ne constituent pas une prévision personnelle. Les faits familiaux sont déclarés par l’utilisateur; un statut inconnu reste inconnu." : "Published information is not a personal forecast. Family facts are user-entered; unknown status remains unknown."}</p>
    </section>
    <section id="study-preparation" className="scroll-mt-32 rounded-xl border border-slate-200 p-5">
      <h2 className="text-xl font-semibold">{fr ? "Préparation aux études" : "Study preparation"}</h2>
      <p className="my-3">{fr ? "Consignez vos renseignements existants dans votre dossier. Vérifiez séparément la désignation EED, le programme et les exigences du permis d’études auprès d’IRCC ; aucune admissibilité n’est déterminée ici." : "Organize existing information in your case. Check DLI designation, the programme and study-permit requirements separately with IRCC; no eligibility is determined here."}</p>
      <nav className="flex flex-wrap gap-5 underline"><Link to="/official-finders?tab=schools">{fr ? "Répertoires EED et PTPD" : "DLI and PGWP resources"}</Link><Link to="/applications">{fr ? "Dossiers" : "Cases"}</Link><Link to="/forms">{fr ? "Préparer les formulaires" : "Prepare Forms"}</Link></nav>
    </section>
  </div></Layout>;
}
