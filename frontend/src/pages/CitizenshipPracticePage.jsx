import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  getCitizenshipProgress,
  getCitizenshipStudyGuide,
} from "../api";
import { normalizeFrenchText } from "../utils/frenchText";

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export default function CitizenshipPracticePage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";
  const [guide, setGuide] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const [guideRes, progressRes] = await Promise.all([
          getCitizenshipStudyGuide(language),
          getCitizenshipProgress(),
        ]);
        if (!mounted) return;
        setGuide(language === "fr" ? normalizeFrenchText(guideRes.data) : guideRes.data);
        setProgress(progressRes.data);
      } catch (err) {
        console.error(err);
        if (mounted) {
          setMessage(
            language === "fr"
              ? "Impossible de charger le module de citoyenneté."
              : "Unable to load citizenship practice."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [language]);

  const rawText =
    language === "fr"
      ? {
          eyebrow: "Citoyenneté",
          title: "Coach de citoyenneté canadienne",
          subtitle:
            "Pratiquez les thèmes du test, suivez vos résultats et renforcez votre anglais ou votre français.",
          quiz: "Commencer un quiz",
          mock: "Examen blanc",
          language: "Pratique linguistique",
          progress: "Progression",
          attempts: "Essais",
          best: "Meilleur score",
          answered: "Questions",
          sections: "Thèmes d'étude",
        }
      : {
          eyebrow: "Citizenship",
          title: "Canadian Citizenship Coach",
          subtitle:
            "Practice citizenship test themes, track your scores, and strengthen your English or French.",
          quiz: "Start quiz",
          mock: "Mock exam",
          language: "Language practice",
          progress: "Progress",
          attempts: "Attempts",
          best: "Best score",
          answered: "Questions",
          sections: "Study themes",
        };
  const text = language === "fr" ? normalizeFrenchText(rawText) : rawText;

  if (loading) {
    return (
      <Layout>
        <p className="text-slate-600">{language === "fr" ? "Chargement..." : "Loading..."}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="rounded-[30px] border border-slate-900/10 bg-[#172033] p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
          {text.eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight">
          {text.title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
          {guide?.description || text.subtitle}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="white" onClick={() => navigate("/citizenship/quiz")}>
            {text.quiz}
          </Button>
          <Button
            variant="outlineLight"
            onClick={() => navigate("/citizenship/quiz?mode=mock")}
          >
            {text.mock}
          </Button>
          <Button
            variant="outlineLight"
            onClick={() => navigate("/language-practice")}
          >
            {text.language}
          </Button>
        </div>
      </section>

      {message ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      ) : null}

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        <Stat label={text.attempts} value={progress?.attempts_count || 0} />
        <Stat label={text.best} value={`${progress?.best_score_percent || 0}%`} />
        <Stat label={text.answered} value={progress?.questions_answered || 0} />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                {text.sections}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                {guide?.title || text.title}
              </h2>
            </div>
            <Button variant="secondary" onClick={() => navigate("/citizenship/progress")}>
              {text.progress}
            </Button>
          </div>

          <div className="mt-5 grid gap-3">
            {(guide?.sections || []).map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => navigate(`/citizenship/quiz?section=${section.key}`)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-amber-300 hover:bg-amber-50"
              >
                <p className="font-semibold text-slate-950">{section.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{section.summary}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            NorthBridgeAI
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">
            {language === "fr" ? "Votre chemin vers la citoyenneté" : "Your path to citizenship"}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {guide?.official_note}
          </p>
          <div className="mt-5 space-y-3">
            <Button className="w-full" onClick={() => navigate("/citizenship/quiz")}>
              {text.quiz}
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => navigate("/language-practice")}
            >
              {text.language}
            </Button>
          </div>
        </Card>
      </section>
    </Layout>
  );
}
