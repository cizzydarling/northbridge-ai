import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  createLanguagePracticeSession,
  getLanguagePracticePrompts,
  getLanguagePracticeSessions,
} from "../api";
import { normalizeFrenchText } from "../utils/frenchText";

export default function LanguagePracticePage() {
  const { i18n } = useTranslation();
  const uiLanguage = i18n.language === "fr" ? "fr" : "en";
  const [targetLanguage, setTargetLanguage] = useState(uiLanguage === "fr" ? "en" : "fr");
  const [prompts, setPrompts] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [responseText, setResponseText] = useState("");
  const [selfScore, setSelfScore] = useState(70);
  const [sessions, setSessions] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [promptRes, sessionRes] = await Promise.all([
        getLanguagePracticePrompts(targetLanguage),
        getLanguagePracticeSessions(),
      ]);
      if (!mounted) return;
      const nextPrompts =
        targetLanguage === "fr"
          ? normalizeFrenchText(promptRes.data?.prompts || [])
          : promptRes.data?.prompts || [];
      setPrompts(nextPrompts);
      setPrompt((current) => current || nextPrompts[0] || "");
      setSessions(uiLanguage === "fr" ? normalizeFrenchText(sessionRes.data || []) : sessionRes.data || []);
    }
    load().catch((err) => {
      console.error(err);
      if (mounted) {
        setMessage(uiLanguage === "fr" ? "Chargement impossible." : "Unable to load practice.");
      }
    });
    return () => {
      mounted = false;
    };
  }, [targetLanguage, uiLanguage]);

  const feedback = useMemo(() => {
    if (!responseText.trim()) return "";
    if (selfScore >= 80) {
      return targetLanguage === "fr"
        ? "Bonne confiance. Continuez à ajouter des détails et des connecteurs."
        : "Good confidence. Keep adding detail and linking words.";
    }
    return targetLanguage === "fr"
      ? "Reprenez la réponse lentement, corrigez les verbes, puis réessayez à voix haute."
      : "Slow the answer down, check verbs, then try saying it aloud again.";
  }, [responseText, selfScore, targetLanguage]);

  async function saveSession() {
    if (!prompt.trim() || !responseText.trim()) {
      setMessage(uiLanguage === "fr" ? "Ajoutez une réponse avant d'enregistrer." : "Add a response before saving.");
      return;
    }
    const res = await createLanguagePracticeSession({
      target_language: targetLanguage,
      practice_type: "citizenship_conversation",
      prompt,
      response_text: responseText,
      self_score: Number(selfScore),
      feedback,
    });
    setSessions((prev) => [res.data, ...prev]);
    setResponseText("");
    setMessage(uiLanguage === "fr" ? "Session enregistrée." : "Session saved.");
  }

  const rawText =
    uiLanguage === "fr"
      ? {
          title: "Pratique linguistique",
          subtitle: "Renforcez votre anglais ou votre français avec des invites liées à la citoyenneté.",
          target: "Langue cible",
          prompt: "Invite",
          response: "Votre réponse",
          score: "Confiance",
          save: "Enregistrer",
          recent: "Sessions récentes",
          english: "Anglais",
          french: "Français",
          noPrompt: "Aucune invite disponible pour le moment.",
          savedScore: "confiance",
        }
      : {
          title: "Language practice",
          subtitle: "Build English or French confidence with citizenship-focused prompts.",
          target: "Target language",
          prompt: "Prompt",
          response: "Your response",
          score: "Confidence",
          save: "Save",
          recent: "Recent sessions",
          english: "English",
          french: "French",
          noPrompt: "No prompt available yet.",
          savedScore: "confidence",
        };
  const text = uiLanguage === "fr" ? normalizeFrenchText(rawText) : rawText;

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
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{text.target}</span>
              <select
                className="input mt-2"
                value={targetLanguage}
                onChange={(event) => {
                  setTargetLanguage(event.target.value);
                  setPrompt("");
                }}
              >
                <option value="en">{text.english}</option>
                <option value="fr">{text.french}</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">{text.prompt}</span>
              <select
                className="input mt-2"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              >
                {prompts.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
                {!prompts.length ? (
                  <option value="">{text.noPrompt}</option>
                ) : null}
              </select>
            </label>
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-700">{text.response}</span>
            <textarea
              className="input mt-2 min-h-40"
              value={responseText}
              onChange={(event) => setResponseText(event.target.value)}
            />
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-medium text-slate-700">
              {text.score}: {selfScore}%
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={selfScore}
              onChange={(event) => setSelfScore(event.target.value)}
              className="mt-3 w-full"
            />
          </label>

          {feedback ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {feedback}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end">
            <Button onClick={saveSession}>{text.save}</Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-semibold text-slate-950">{text.recent}</h2>
          <div className="mt-5 space-y-3">
            {sessions.length ? (
              sessions.slice(0, 8).map((session) => (
                <div key={session.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-950">
                    {session.target_language === "fr" ? text.french : text.english} - {session.self_score || 0}% {text.savedScore}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{session.prompt}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                {uiLanguage === "fr" ? "Aucune session pour le moment." : "No sessions yet."}
              </p>
            )}
          </div>
        </Card>
      </section>
    </Layout>
  );
}
