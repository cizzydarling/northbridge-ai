import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import UpgradePrompt from "../components/UpgradePrompt";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  buildPremiumPricingPath,
  getCitizenshipQuestions,
  getMyAccess,
  submitCitizenshipQuiz,
} from "../api";
import { normalizeFrenchText } from "../utils/frenchText";

export default function CitizenshipQuizPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const language = i18n.language === "fr" ? "fr" : "en";
  const mode = searchParams.get("mode") || "practice";
  const section = searchParams.get("section") || "";
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setResult(null);
        setAnswers({});
        const accessRes = await getMyAccess();
        if (!mounted) return;
        setAccess(accessRes.data);
        if (mode === "mock" && !accessRes.data?.can_take_citizenship_mock_exam) {
          setQuestions([]);
          return;
        }
        const res = await getCitizenshipQuestions({
          language,
          mode,
          limit: mode === "mock" ? 20 : 10,
          section,
        });
        if (mounted) {
          setQuestions(language === "fr" ? normalizeFrenchText(res.data || []) : res.data || []);
        }
      } catch (err) {
        console.error(err);
        if (mounted) {
          setMessage(language === "fr" ? "Impossible de charger le quiz." : "Unable to load quiz.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [language, mode, section]);

  const complete = useMemo(
    () => questions.length > 0 && questions.every((q) => typeof answers[q.id] === "number"),
    [answers, questions]
  );

  async function handleSubmit() {
    if (!complete) {
      setMessage(language === "fr" ? "Répondez à toutes les questions." : "Answer every question first.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      const res = await submitCitizenshipQuiz({
        mode,
        language,
        answers: questions.map((question) => ({
          question_id: question.id,
          selected_option_index: answers[question.id],
        })),
      });
      setResult(language === "fr" ? normalizeFrenchText(res.data) : res.data);
    } catch (err) {
      console.error(err);
      setMessage(language === "fr" ? "Impossible d'enregistrer le résultat." : "Unable to save result.");
    } finally {
      setSubmitting(false);
    }
  }

  const rawText =
    language === "fr"
      ? {
          title: mode === "mock" ? "Examen blanc de citoyenneté" : "Quiz de citoyenneté",
          subtitle: "Choisissez la meilleure réponse, puis consultez les explications.",
          submit: "Corriger le quiz",
          score: "Score",
          passed: "Réussi",
          keepPracticing: "A pratiquer",
          explanation: "Explication",
          answered: "bonnes réponses",
        }
      : {
          title: mode === "mock" ? "Citizenship mock exam" : "Citizenship quiz",
          subtitle: "Choose the best answer, then review explanations.",
          submit: "Grade quiz",
          score: "Score",
          passed: "Passed",
          keepPracticing: "Keep practicing",
          explanation: "Explanation",
          answered: "correct answers",
        };
  const text = language === "fr" ? normalizeFrenchText(rawText) : rawText;
  const premiumPath = buildPremiumPricingPath("citizenship", "mock");
  const mockLocked = mode === "mock" && !access?.can_take_citizenship_mock_exam;
  const notSavedText =
    language === "fr"
      ? "Passez à Pro pour sauvegarder vos scores et suivre vos thèmes faibles."
      : "Upgrade to Pro to save scores and track weak themes.";
  const mockLockedTitle =
    language === "fr" ? "Examen blanc réservé à Premium" : "Mock exams are Premium";
  const mockLockedBody =
    language === "fr"
      ? "Premium débloque les examens blancs complets de 20 questions et une préparation plus approfondie."
      : "Premium unlocks full 20-question mock exams and deeper preparation.";
  const premiumCta = language === "fr" ? "Voir Premium" : "See Premium";

  if (loading) {
    return (
      <Layout>
        <p className="text-slate-600">{language === "fr" ? "Chargement..." : "Loading..."}</p>
      </Layout>
    );
  }

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

      {message ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </div>
      ) : null}

      {mockLocked ? (
        <UpgradePrompt
          title={mockLockedTitle}
          body={mockLockedBody}
          buttonLabel={premiumCta}
          pricingPath={premiumPath}
        />
      ) : null}

      {result ? (
        <Card className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            {text.score}
          </p>
          <h2 className="mt-2 text-4xl font-semibold text-slate-950">
            {result.score_percent}%
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {result.correct_answers}/{result.total_questions} {text.answered} - {result.passed ? text.passed : text.keepPracticing}
          </p>
          {!result.attempt_id && !access?.can_track_citizenship_progress ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p>{notSavedText}</p>
              <Button
                className="mt-3"
                variant="secondary"
                onClick={() =>
                  navigate("/pricing?plan=pro&source=citizenship&intent=progress")
                }
              >
                {language === "fr" ? "Voir Pro" : "See Pro"}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {!mockLocked ? (
      <>
      <div className="space-y-4">
        {questions.map((question, index) => {
          const answerResult = result?.answers?.find((item) => item.question_id === question.id);
          return (
            <Card key={question.id}>
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">{question.question_text}</p>
                  <div className="mt-4 grid gap-2">
                    {question.options.map((option, optionIndex) => {
                      const selected = answers[question.id] === optionIndex;
                      const correct = answerResult?.correct_option_index === optionIndex;
                      const wrong = answerResult?.selected_option_index === optionIndex && !answerResult?.is_correct;
                      return (
                        <button
                          key={`${question.id}-${option}`}
                          type="button"
                          disabled={Boolean(result)}
                          onClick={() =>
                            setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }))
                          }
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            correct
                              ? "border-green-300 bg-green-50 text-green-800"
                              : wrong
                              ? "border-red-300 bg-red-50 text-red-800"
                              : selected
                              ? "border-amber-300 bg-amber-50 text-slate-950"
                              : "border-slate-200 bg-white text-slate-700 hover:border-amber-300"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>

                  {answerResult ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                      <span className="font-semibold text-slate-950">{text.explanation}: </span>
                      {answerResult.explanation}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {!result ? (
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "..." : text.submit}
          </Button>
        </div>
      ) : null}
      </>
      ) : null}
    </Layout>
  );
}
