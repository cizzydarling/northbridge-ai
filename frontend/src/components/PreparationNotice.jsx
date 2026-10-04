import { useTranslation } from "react-i18next";

export default function PreparationNotice() {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  return <aside className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800">
    {fr
      ? "Aide à la préparation : la progression concerne uniquement les renseignements et documents que vous organisez. Elle ne confirme ni l’admissibilité, ni les documents obligatoires, ni la complétude d’un formulaire officiel. Vérifiez les formulaires et listes actuels d’IRCC avant toute soumission."
      : "Preparation assistance: progress covers only the information and documents you organize. It does not establish eligibility, mandatory documents or official form completeness. Verify current IRCC forms and checklists before filing."}
  </aside>;
}
