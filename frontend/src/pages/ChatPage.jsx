import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import { getMyJourney, sendAIMessage } from "../api";

export default function ChatPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [journey, setJourney] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(true);
  const [refreshingJourney, setRefreshingJourney] = useState(false);

  const bottomRef = useRef(null);

  const language = i18n.language === "fr" ? "fr" : "en";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    loadJourney(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  async function loadJourney(initialLoad = false) {
    try {
      if (initialLoad) {
        setJourneyLoading(true);
      } else {
        setRefreshingJourney(true);
      }

      const res = await getMyJourney(language);
      setJourney(res.data);
    } catch (err) {
      setJourney(null);
    } finally {
      if (initialLoad) {
        setJourneyLoading(false);
      } else {
        setRefreshingJourney(false);
      }
    }
  }

  const suggestedQuestions = useMemo(() => {
    return [
      t("chat.suggestions.nextStep"),
      t("chat.suggestions.crs"),
      t("chat.suggestions.eligibility"),
      t("chat.suggestions.province"),
    ];
  }, [t, language]);

  const followUpActions = useMemo(() => {
    return [
      language === "fr"
        ? "Comment améliorer mon profil ?"
        : "How can I improve my profile?",
      language === "fr"
        ? "Quelle est ma prochaine étape ?"
        : "What should I do next?",
      language === "fr"
        ? "Quels programmes me conviennent ?"
        : "Which programs fit my profile?",
    ];
  }, [language]);

  const readinessLabel = useMemo(() => {
    const label = journey?.readiness?.label;
    if (!label) {
      return language === "fr" ? "Non commencé" : "Not started";
    }
    if (label === "Strong") {
      return language === "fr" ? "Fort" : "Strong";
    }
    if (label === "Moderate") {
      return language === "fr" ? "Modéré" : "Moderate";
    }
    if (label === "Weak") {
      return language === "fr" ? "À améliorer" : "Needs improvement";
    }
    return label;
  }, [journey, language]);

  const stageLabel =
    journey?.current_stage || (language === "fr" ? "Parcours" : "Journey");

  const nextBestAction =
    journey?.next_best_action ||
    (language === "fr"
      ? "Posez une question pour obtenir votre prochaine meilleure étape."
      : "Ask a question to get your next best action.");

  const recommendedRoute = journey?.recommended_route || "/dashboard";

  const recommendedRouteLabel = useMemo(() => {
    if (recommendedRoute === "/profile") {
      return t("selfDashboard.routeLabels.profile");
    }
    if (recommendedRoute === "/strategy") {
      return t("selfDashboard.routeLabels.strategy");
    }
    if (recommendedRoute === "/self/documents") {
      return t("selfDashboard.routeLabels.documents");
    }
    if (recommendedRoute === "/chat") {
      return t("selfDashboard.routeLabels.chat");
    }
    if (recommendedRoute === "/dashboard") {
      return t("selfDashboard.routeLabels.dashboard");
    }
    return t("selfDashboard.routeLabels.application");
  }, [recommendedRoute, t]);

  const sendMessage = async (messageText = input) => {
    if (!messageText.trim() || loading) return;

    const userMessage = { role: "user", content: messageText };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await sendAIMessage({
        message: messageText,
        language,
        chat_history: updatedMessages,
      });

      const aiMessage = {
        role: "assistant",
        content: res.data.reply,
      };

      setMessages([...updatedMessages, aiMessage]);
      loadJourney(false);
    } catch (err) {
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content:
            err?.response?.data?.detail ||
            (language === "fr"
              ? "Une erreur est survenue. Veuillez réessayer."
              : "Something went wrong. Please try again."),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  function handleGoToNextStep() {
    navigate(recommendedRoute);
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#0B1F3A] text-white flex flex-col">
        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
          <h1 className="text-xl font-semibold">{t("chat.title")}</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadJourney(false)}
              disabled={refreshingJourney}
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-50"
            >
              {refreshingJourney
                ? t("chat.refreshing")
                : t("chat.refresh")}
            </button>

            <div className="text-xs bg-white/10 px-3 py-1 rounded-full">
              {language.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="border-b border-slate-700 bg-white/5">
          <div className="max-w-4xl mx-auto px-6 py-5">
            <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {t("chat.currentStage")}
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {journeyLoading ? t("chat.loadingShort") : stageLabel}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-300">
                      {t("chat.readiness")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {journeyLoading ? "—" : readinessLabel}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-300">
                      {t("chat.score")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {journeyLoading ? "—" : journey?.readiness?.score ?? "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-red-400/20 bg-red-600/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-100">
                  {t("chat.nextBestAction")}
                </p>
                <p className="mt-2 text-sm leading-6 text-white">
                  {journeyLoading
                    ? t("chat.loadingJourney")
                    : nextBestAction}
                </p>

                {!journeyLoading && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => sendMessage(t("chat.suggestions.nextStep"))}
                      className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/15"
                    >
                      {t("chat.exploreStep")}
                    </button>

                    <button
                      onClick={() =>
                        sendMessage(
                          language === "fr"
                            ? "Peux-tu m’expliquer cette prochaine étape ?"
                            : "Can you explain this next step?"
                        )
                      }
                      className="rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white hover:bg-white/15"
                    >
                      {t("chat.explainIt")}
                    </button>

                    <button
                      onClick={handleGoToNextStep}
                      className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      {t("chat.goToLabel", {
                        destination: recommendedRouteLabel.toLowerCase(),
                      })}
                    </button>
                  </div>
                )}

                {!journeyLoading && (
                  <p className="mt-3 text-xs text-red-100">
                    {t("chat.recommendedDestination")}{" "}
                    <span className="font-semibold text-white">
                      {recommendedRouteLabel}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-slate-300 mt-12">
                <p className="text-2xl font-semibold">{t("chat.startTitle")}</p>
                <p className="text-sm mt-2 text-slate-400">
                  {t("chat.startSubtitle")}
                </p>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="bg-slate-800 hover:bg-slate-700 px-4 py-3 rounded-xl text-left text-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx}>
                <div
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xl px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-red-600 text-white"
                        : "bg-white text-slate-900"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>

                {msg.role === "assistant" && idx === messages.length - 1 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {followUpActions.map((action) => (
                      <button
                        key={action}
                        onClick={() => sendMessage(action)}
                        className="text-xs border border-slate-600 px-3 py-2 rounded-full text-slate-200 hover:bg-slate-800"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="text-sm text-slate-400">
                {t("chat.thinking")}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-700">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("chat.placeholder")}
                className="flex-1 rounded-lg px-4 py-3 bg-slate-800 border border-slate-600 text-white focus:outline-none"
                rows={2}
              />

              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="bg-red-600 px-5 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {t("chat.send")}
              </button>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              {t("chat.disclaimer")}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}