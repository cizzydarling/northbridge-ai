import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { getMyJourney, sendAIMessage } from "../api";

const STARTER_PROMPTS = {
  en: [
    "What should I do next in my immigration journey?",
    "Which pathway looks strongest for my profile?",
    "How can I improve my chances for permanent residence?",
    "Does my profile have any francophone advantage?",
  ],
  fr: [
    "Quelle est ma prochaine meilleure étape ?",
    "Quel parcours semble le plus fort pour mon profil ?",
    "Comment puis-je améliorer mes chances de résidence permanente ?",
    "Mon profil a-t-il un avantage francophone ?",
  ],
};

const ACTION_ROUTE_MAP = {
  profile: "/profile",
  strategy: "/strategy",
  document: "/self/documents",
  documents: "/self/documents",
  application: "/self/application",
  permit: "/self/application",
  pathway: "/strategy",
  express: "/strategy",
  pnp: "/strategy",
  francophone: "/strategy",
  french: "/strategy",
  chat: "/chat",
};

function inferRouteFromAction(actionText = "") {
  const text = actionText.toLowerCase();

  for (const [keyword, route] of Object.entries(ACTION_ROUTE_MAP)) {
    if (text.includes(keyword)) return route;
  }

  return "/strategy";
}

export default function ChatPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [journey, setJourney] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(true);
  const [suggestedActions, setSuggestedActions] = useState([]);
  const [pathways, setPathways] = useState([]);
  const [frenchAdvantage, setFrenchAdvantage] = useState(null);

  const bottomRef = useRef(null);
  const language = i18n.language === "fr" ? "fr" : "en";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, suggestedActions, pathways]);

  useEffect(() => {
    loadJourney();
  }, [language]);

  async function loadJourney() {
    try {
      setJourneyLoading(true);
      const res = await getMyJourney(language);
      setJourney(res.data);
    } catch {
      setJourney(null);
    } finally {
      setJourneyLoading(false);
    }
  }

  const starterPrompts = useMemo(() => {
    return STARTER_PROMPTS[language] || STARTER_PROMPTS.en;
  }, [language]);

  const readinessLabel = journey?.readiness?.label || "—";
  const currentStage = journey?.current_stage || "—";
  const nextBestAction =
    journey?.next_best_action || t("chat.placeholderAction", { defaultValue: "Review your strategy" });
  const recommendedRoute = journey?.recommended_route || "/dashboard";
  const documentProgress = journey?.documents?.progress_percent ?? 0;
  const remainingRequired = journey?.documents?.remaining_required ?? 0;

  const frenchSignals = Array.isArray(frenchAdvantage?.signals)
    ? frenchAdvantage.signals
    : [];
  const frenchRecommendations = Array.isArray(frenchAdvantage?.recommendations)
    ? frenchAdvantage.recommendations
    : [];
  const frenchStrategicValue = frenchAdvantage?.strategic_value || null;

  const sendMessage = async (messageText = input) => {
    const trimmed = (messageText || "").trim();
    if (!trimmed || loading) return;

    const userMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await sendAIMessage({
        message: trimmed,
        language,
        chat_history: updatedMessages,
      });

      const data = res.data || {};

      setMessages([
        ...updatedMessages,
        { role: "assistant", content: data.reply || "" },
      ]);

      setSuggestedActions(
        Array.isArray(data.suggested_next_actions)
          ? data.suggested_next_actions
          : []
      );

      setPathways(Array.isArray(data.pathways) ? data.pathways : []);
      setFrenchAdvantage(data.french_advantage || null);
    } catch (err) {
      const errorMessage =
        err?.response?.data?.detail ||
        (language === "fr"
          ? "Une erreur est survenue. Veuillez réessayer."
          : "Something went wrong. Please try again.");

      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: errorMessage,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {t("chat.title")}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {t("chat.disclaimer")}
            </p>
          </div>

          <Button variant="secondary" onClick={loadJourney} disabled={journeyLoading}>
            {journeyLoading
              ? t("common.loading")
              : t("chat.refresh", { defaultValue: "Refresh" })}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5">
            <p className="text-sm text-slate-500">
              {t("chat.currentStage", { defaultValue: "Current stage" })}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {currentStage}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-slate-500">
              {t("chat.readiness", { defaultValue: "Readiness" })}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {readinessLabel}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-slate-500">
              {t("chat.documentProgress", { defaultValue: "Document progress" })}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {documentProgress}%
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-sm text-slate-500">
              {t("chat.remainingRequired", { defaultValue: "Remaining required documents" })}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {remainingRequired}
            </p>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t("chat.nextBestAction", { defaultValue: "Next best action" })}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {nextBestAction}
            </p>

            <div className="mt-5">
              <Button
                variant="primary"
                onClick={() => navigate(recommendedRoute)}
              >
                {t("chat.goToNext", { defaultValue: "Go to next step" })}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {t("chat.suggestedPrompts", { defaultValue: "Suggested prompts" })}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {(suggestedActions.length > 0 || pathways.length > 0 || frenchStrategicValue) && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-6 lg:col-span-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {t("chat.actionableSteps", { defaultValue: "Actionable next steps" })}
              </p>

              {suggestedActions.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {suggestedActions.map((action, index) => (
                    <div
                      key={`${action}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="text-sm text-slate-800">{action}</p>
                      <div className="mt-3">
                        <Button
                          variant="secondary"
                          onClick={() => navigate(inferRouteFromAction(action))}
                        >
                          {t("chat.openAction", { defaultValue: "Open related page" })}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  {t("chat.noActions", { defaultValue: "No actions suggested yet." })}
                </p>
              )}
            </Card>

            <Card className="p-6 lg:col-span-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {t("chat.topPathways", { defaultValue: "Top pathways" })}
              </p>

              {pathways.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {pathways.map((pathway, index) => (
                    <div
                      key={`${pathway}-${index}`}
                      className={`rounded-2xl border p-4 ${
                        index === 0
                          ? "border-blue-200 bg-blue-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          index === 0 ? "text-blue-700" : "text-slate-500"
                        }`}
                      >
                        {index === 0
                          ? t("chat.primaryPathway", { defaultValue: "Primary pathway" })
                          : t("common.option", { index })}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900">
                        {pathway}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  {t("chat.noPathways", { defaultValue: "No pathways surfaced yet." })}
                </p>
              )}
            </Card>

            <Card className="p-6 lg:col-span-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {t("chat.francophoneAngle", { defaultValue: "Francophone angle" })}
              </p>

              {frenchStrategicValue ? (
                <div className="mt-4 space-y-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      frenchStrategicValue === "high"
                        ? "bg-green-100 text-green-700"
                        : frenchStrategicValue === "medium"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {frenchStrategicValue}
                  </span>

                  {frenchSignals.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {t("chat.signals", { defaultValue: "Signals" })}
                      </p>
                      <ul className="mt-2 space-y-2">
                        {frenchSignals.slice(0, 3).map((item, index) => (
                          <li
                            key={`${item}-${index}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {frenchRecommendations.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {t("chat.recommendations", { defaultValue: "Recommendations" })}
                      </p>
                      <ul className="mt-2 space-y-2">
                        {frenchRecommendations.slice(0, 3).map((item, index) => (
                          <li
                            key={`${item}-${index}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  {t("chat.noFrancophoneAngle", {
                    defaultValue: "No francophone angle surfaced yet.",
                  })}
                </p>
              )}
            </Card>
          </div>
        )}

        <Card className="h-[520px] overflow-y-auto p-6">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm text-slate-500">
                  {t("chat.startSubtitle", {
                    defaultValue:
                      "Ask a question about your strategy, pathways, documents, or next steps.",
                  })}
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-6 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-slate-100 text-slate-900"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}

            {loading && (
              <p className="text-sm text-slate-400">
                {t("chat.thinking")}
              </p>
            )}

            <div ref={bottomRef} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder={t("chat.placeholder")}
              className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />

            <div className="flex items-end">
              <Button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
                {t("chat.send")}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}