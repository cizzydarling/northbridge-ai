import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import { getCitizenshipProgress } from "../api";

function ProgressTile({ label, value }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
    </Card>
  );
}

const SECTION_LABELS = {
  en: {
    rights_responsibilities: "Rights and responsibilities",
    history_symbols: "History and symbols",
    government: "Government and elections",
    geography_economy: "Geography and economy",
  },
  fr: {
    rights_responsibilities: "Droits et responsabilités",
    history_symbols: "Histoire et symboles",
    government: "Gouvernement et élections",
    geography_economy: "Géographie et économie",
  },
};

export default function CitizenshipProgressPage() {
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    getCitizenshipProgress()
      .then((res) => setProgress(res.data))
      .catch((err) => console.error(err));
  }, []);

  const text =
    language === "fr"
      ? {
          title: "Progression citoyenneté",
          subtitle: "Suivez vos scores, vos thèmes faibles et votre pratique linguistique.",
          attempts: "Essais",
          best: "Meilleur score",
          average: "Moyenne",
          answered: "Questions répondues",
          language: "Sessions langue",
          weak: "Thèmes à renforcer",
          empty: "Aucun thème faible pour le moment.",
        }
      : {
          title: "Citizenship progress",
          subtitle: "Track scores, weak themes, and language practice.",
          attempts: "Attempts",
          best: "Best score",
          average: "Average",
          answered: "Answered",
          language: "Language sessions",
          weak: "Themes to strengthen",
          empty: "No weak themes yet.",
        };

  return (
    <Layout>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
          NorthBridgeAI
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
          {text.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{text.subtitle}</p>
      </div>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <ProgressTile label={text.attempts} value={progress?.attempts_count || 0} />
        <ProgressTile label={text.best} value={`${progress?.best_score_percent || 0}%`} />
        <ProgressTile label={text.average} value={`${progress?.average_score_percent || 0}%`} />
        <ProgressTile label={text.answered} value={progress?.questions_answered || 0} />
        <ProgressTile label={text.language} value={progress?.language_sessions_count || 0} />
      </section>

      <Card className="mt-5">
        <h2 className="text-2xl font-semibold text-slate-950">{text.weak}</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {progress?.weak_sections?.length ? (
            progress.weak_sections.map((section) => (
              <div key={section.section} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-950">
                  {SECTION_LABELS[language]?.[section.section] || section.section}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {section.correct}/{section.total} - {section.accuracy}%
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">{text.empty}</p>
          )}
        </div>
      </Card>
    </Layout>
  );
}
