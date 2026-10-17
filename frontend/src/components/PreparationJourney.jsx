import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";

// Navigation only: the existing server-owned active case remains authoritative.
export default function PreparationJourney() {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const steps = [["/profile", "Profile", "Profil"], ["/household", "Household", "Ménage"], ["/applications", "Application", "Demande"], ["/documents", "Documents", "Documents"], ["/forms", "Draft information", "Renseignements de préparation"]];
  return <nav className="nb-journey" aria-label={fr ? "Parcours de préparation" : "Preparation journey"}>
    {steps.map(([to, en, french]) => <NavLink key={to} to={to} className={({ isActive }) => `nb-journey-link${isActive ? " nb-journey-current" : ""}`}>{fr ? french : en}</NavLink>)}
  </nav>;
}
