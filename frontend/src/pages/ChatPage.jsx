import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  getCurrentUserLocal,
  getMyProfile,
  sendAIMessage,
} from "../api";

function normalizeLanguage(value) {
  return String(value || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

function mapActionToRoute(action) {
  const raw =
    typeof action === "string"
      ? action
      : action?.route || action?.path || action?.href || action?.label || "";

  const value = String(raw || "").toLowerCase().trim();

  if (!value) return null;

  if (value === "/profile" || value.includes("profile") || value.includes("profil")) {
    return "/profile";
  }

  if (
    value === "/strategy" ||
    value.includes("strategy") ||
    value.includes("stratég")
  ) {
    return "/strategy";
  }

  if (value === "/chat" || value.includes("assistant") || value.includes("chat")) {
    return "/chat";
  }

  if (
    value === "/self/documents" ||
    value.includes("document") ||
    value.includes("documents")
  ) {
    return "/self/documents";
  }

  if (
    value === "/self/application" ||
    value.includes("application") ||
    value.includes("workspace") ||
    value.includes("demande")
  ) {
    return "/self/application";
  }

  if (
    value === "/documents/generator" ||
    value.includes("generator") ||
    value.includes("générateur")
  ) {
    return "/documents/generator";
  }

  if (
    value === "/documents/review" ||
    value.includes("review") ||
    value.includes("révision")
  ) {
    return "/documents/review";
  }

  if (
    value === "/legal/disclosure" ||
    value.includes("disclosure") ||
    value.includes("divulgation")
  ) {
    return "/legal/disclosure";
  }

  if (value === "/pricing" || value.includes("pricing") || value.includes("tarif")) {
    return "/pricing";
  }

  return null;
}

function normalizeSuggestedAction(action, language) {
  const lang = normalizeLanguage(language);

  if (!action) return null;

  if (typeof action === "string") {
    return {
      label: action,
      route: mapActionToRoute(action),
    };
  }

  if (typeof action !== "object") return null;

  const label =
    action.label ||
    action.title ||
    action.name ||
    action.text ||
    (lang === "fr" ? "Action suggérée" : "Suggested action");

  const directRoute =
    action.route || action.path || action.href || action.url || null;

  return {
    label: String(label),
    route: directRoute ? String(directRoute) : mapActionToRoute(label),
  };
}

function normalizeInsights(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

export default function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const currentUser = getCurrentUserLocal();

  const [profile, setProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [lastSuggestedActions, setLastSuggestedActions] = useState([]);
  const [lastInsights, setLastInsights] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const initialPrompt = location.state?.initialPrompt || "";
  const sourceTitle = location.state?.title || "";
  const forcedLanguage = location.state?.language;
  const language = normalizeLanguage(forcedLanguage);

  const firstName =
    currentUser?.first_name ||
    profile?.first_name ||
    currentUser?.email?.split("@")?.[0] ||
    "there";

  const starterPrompts = useMemo(() => {
    if (language === "fr") {
      return [
        `Comment puis-je améliorer mon score CRS, ${firstName} ?`,
        "Quel est mon meilleur parcours d’immigration en ce moment ?",
        "Quels documents devrais-je préparer ensuite ?",
        "Quelle est mon action prioritaire maintenant ?",
      ];
    }

    return [
      `How can I improve my CRS score, ${firstName}?`,
      "What is my best immigration pathway right now?",
      "What documents should I prepare next?",
      "What is my highest-priority action right now?",
    ];
  }, [firstName, language]);

  const welcomeText = useMemo(() => {
    if (language === "fr") {
      return `Bonjour ${firstName}, je suis votre assistant NorthBridgeAI personnalisé. Je peux vous aider à comprendre votre stratégie, vos prochaines étapes, vos documents et la meilleure action à prendre maintenant.`;
    }

    return `Hi ${firstName}, I’m your personalized NorthBridgeAI assistant. I can help you understand your strategy, next steps, documents, and the best action to take right now.`;
  }, [firstName, language]);

  const ui = useMemo(() => {
    if (language === "fr") {
      return {
        eyebrow: "NorthBridgeAI",
        title: "Assistant IA personnalisé",
        subtitle:
          "Posez des questions basées sur votre vrai profil, votre stratégie et votre workflow documentaire.",
        sourceLabel: "Démarré depuis",
        starterTitle: "Essayez l’une de ces questions",
        loadingAssistant: "Chargement de l’assistant...",
        thinking: "Réflexion en cours...",
        suggestedActions: "Actions suggérées",
        insightsTitle: "Insights clés",
        textareaPlaceholder: `Posez une question précise, ${firstName}...`,
        send: "Envoyer",
        errorReply:
          "Désolé, un problème est survenu pendant la génération de votre réponse personnalisée.",
        assistantBadge: "Copilote IA",
        helperTitle: "Meilleures questions à poser",
        helperBody:
          "Posez des questions sur votre score CRS, votre meilleur parcours, vos documents ou votre prochaine priorité.",
        noMessages:
          "Commencez une conversation pour obtenir un accompagnement personnalisé.",
        useThisPrompt: "Utiliser",
        quickNav: "Navigation rapide",
        quickNavTitle: "Aller directement à une section",
      };
    }

    return {
      eyebrow: "NorthBridgeAI",
      title: "Personalized AI Assistant",
      subtitle:
        "Ask questions based on your real profile, strategy, and document workflow.",
      sourceLabel: "Started from",
      starterTitle: "Try one of these",
      loadingAssistant: "Loading assistant...",
      thinking: "Thinking...",
      suggestedActions: "Suggested actions",
      insightsTitle: "Key insights",
      textareaPlaceholder: `Ask something specific, ${firstName}...`,
      send: "Send",
      errorReply:
        "Sorry, something went wrong while generating your personalized reply.",
      assistantBadge: "AI Copilot",
      helperTitle: "Best things to ask",
      helperBody:
        "Ask about your CRS score, best pathway, documents, or highest-priority next step.",
      noMessages:
        "Start a conversation to get personalized guidance.",
      useThisPrompt: "Use this prompt",
      quickNav: "Quick navigation",
      quickNavTitle: "Jump directly to a section",
    };
  }, [firstName, language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, lastSuggestedActions, lastInsights]);

  useEffect(() => {
    let mounted = true;

    async function loadProfileAndBoot() {
      try {
        const res = await getMyProfile();
        if (!mounted) return;
        setProfile(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        if (!mounted) return;

        const starterMessages = [
          {
            role: "assistant",
            content: welcomeText,
          },
        ];

        setMessages(starterMessages);
        setPageLoading(false);

        if (String(initialPrompt || "").trim()) {
          void runPrompt(
            String(initialPrompt || "").trim(),
            starterMessages,
            language
          );
        }
      }
    }

    loadProfileAndBoot();

    return () => {
      mounted = false;
    };
  }, [welcomeText, initialPrompt, language]);

  async function runPrompt(promptText, baseMessages = messages, languageOverride) {
    const trimmed = String(promptText || "").trim();
    if (!trimmed) return;

    const nextMessages = [...baseMessages, { role: "user", content: trimmed }];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setLastSuggestedActions([]);
    setLastInsights([]);

    try {
      const historyPayload = nextMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-10)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await sendAIMessage({
        message: trimmed,
        chat_history: historyPayload.slice(0, -1),
        language: normalizeLanguage(languageOverride || language),
      });

      const reply =
        res.data?.reply ||
        (language === "fr"
          ? "Désolé, je n’ai pas pu générer de réponse."
          : "Sorry, I could not generate a response.");

      const rawSuggestedNextActions = Array.isArray(
        res.data?.suggested_next_actions
      )
        ? res.data.suggested_next_actions
        : [];

      const normalizedActions = rawSuggestedNextActions
        .map((action) => normalizeSuggestedAction(action, language))
        .filter(Boolean)
        .slice(0, 3);

      const normalizedInsights = normalizeInsights(res.data?.insights);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
        },
      ]);

      setLastSuggestedActions(normalizedActions);
      setLastInsights(normalizedInsights);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: ui.errorReply,
        },
      ]);
      setLastSuggestedActions([]);
      setLastInsights([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    await runPrompt(input);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleActionClick(action) {
    const normalized = normalizeSuggestedAction(action, language);
    if (!normalized) return;

    if (normalized.route) {
      navigate(normalized.route);
      return;
    }

    setInput(normalized.label);
  }

  function handleStarterPromptClick(prompt) {
    void runPrompt(prompt);
  }

  if (pageLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-16">
          <p className="text-slate-600">{ui.loadingAssistant}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-600">{ui.eyebrow}</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            {ui.title}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{ui.subtitle}</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {ui.assistantBadge}
            </div>

            {sourceTitle ? (
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                {ui.sourceLabel}: {sourceTitle}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mb-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-slate-200 bg-white px-4 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {ui.starterTitle}
              </p>
              <div className="flex flex-wrap gap-2">
                {starterPrompts.map((prompt, index) => (
                  <button
                    key={`${prompt}-${index}`}
                    type="button"
                    onClick={() => handleStarterPromptClick(prompt)}
                    disabled={loading}
                    className="rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[520px] space-y-4 overflow-y-auto bg-slate-50 p-6">
              {messages.length === 0 && !loading && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                  {ui.noMessages}
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
                      message.role === "user"
                        ? "bg-blue-900 text-white"
                        : "border border-slate-200 bg-white text-slate-800"
                    }`}
                  >
                    <pre className="whitespace-pre-wrap font-sans">
                      {message.content}
                    </pre>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                    {ui.thinking}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {(lastInsights.length > 0 || lastSuggestedActions.length > 0) && (
              <div className="border-t border-slate-200 bg-white px-4 py-4">
                {lastInsights.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {ui.insightsTitle}
                    </p>
                    <div className="space-y-2">
                      {lastInsights.map((insight, index) => (
                        <div
                          key={`${insight}-${index}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                        >
                          {insight}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lastSuggestedActions.length > 0 && (
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {ui.suggestedActions}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {lastSuggestedActions.map((action, index) => (
                        <button
                          key={`${action.label}-${index}`}
                          type="button"
                          onClick={() => handleActionClick(action)}
                          className="rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-slate-200 bg-white p-4">
              <div className="flex gap-3">
                <textarea
                  rows={3}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={ui.textareaPlaceholder}
                  className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
                />
                <div className="flex items-end">
                  <Button onClick={handleSend} disabled={loading || !input.trim()}>
                    {ui.send}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {ui.helperTitle}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {language === "fr"
                  ? "Posez de meilleures questions"
                  : "Ask better questions"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {ui.helperBody}
              </p>

              <div className="mt-5 space-y-3">
                {starterPrompts.map((prompt, index) => (
                  <div
                    key={`${prompt}-helper-${index}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <p className="text-sm text-slate-700">{prompt}</p>
                    <div className="mt-3">
                      <Button
                        variant="secondary"
                        onClick={() => handleStarterPromptClick(prompt)}
                      >
                        {ui.useThisPrompt}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {ui.quickNav}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {ui.quickNavTitle}
              </h2>

              <div className="mt-5 flex flex-col gap-3">
                <Button variant="secondary" onClick={() => navigate("/strategy")}>
                  {language === "fr" ? "Voir ma stratégie" : "View my strategy"}
                </Button>
                <Button variant="secondary" onClick={() => navigate("/profile")}>
                  {language === "fr" ? "Mettre à jour mon profil" : "Update my profile"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate("/self/application")}
                >
                  {language === "fr" ? "Continuer ma demande" : "Continue my application"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate("/self/documents")}
                >
                  {language === "fr" ? "Gérer mes documents" : "Manage my documents"}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}