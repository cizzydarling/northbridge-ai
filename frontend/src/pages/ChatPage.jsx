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

function mapActionToRoute(action) {
  const value = String(action || "").toLowerCase();

  if (value.includes("profile") || value.includes("profil")) {
    return "/profile";
  }

  if (value.includes("strategy") || value.includes("stratég")) {
    return "/strategy";
  }

  if (value.includes("document") || value.includes("documents")) {
    return "/self/documents";
  }

  if (
    value.includes("application") ||
    value.includes("workspace") ||
    value.includes("demande")
  ) {
    return "/self/application";
  }

  if (value.includes("generator") || value.includes("générateur")) {
    return "/documents/generator";
  }

  if (value.includes("review") || value.includes("révision")) {
    return "/documents/review";
  }

  if (value.includes("disclosure") || value.includes("divulgation")) {
    return "/legal/disclosure";
  }

  return null;
}

export default function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const currentUser = getCurrentUserLocal();

  const [profile, setProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [lastSuggestedActions, setLastSuggestedActions] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const initialPrompt = location.state?.initialPrompt || "";
  const sourceTitle = location.state?.title || "";
  const forcedLanguage = location.state?.language;

  const firstName =
    currentUser?.first_name ||
    profile?.first_name ||
    currentUser?.email?.split("@")?.[0] ||
    "there";

  const starterPrompts = useMemo(() => {
    const name = firstName || "there";
    return [
      `How can I improve my CRS score, ${name}?`,
      "What is my best immigration pathway right now?",
      "What documents should I prepare next?",
    ];
  }, [firstName]);

  const welcomeText = useMemo(() => {
    return `Hi ${firstName}, I’m your personalized NorthBridgeAI assistant. Ask me about your strategy, your next steps, your documents, or how to improve your file.`;
  }, [firstName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, lastSuggestedActions]);

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

        if (initialPrompt.trim()) {
          void runPrompt(initialPrompt.trim(), starterMessages, forcedLanguage);
        }
      }
    }

    loadProfileAndBoot();

    return () => {
      mounted = false;
    };
  }, [welcomeText, initialPrompt, forcedLanguage]);

  async function runPrompt(promptText, baseMessages = messages, languageOverride) {
    const trimmed = String(promptText || "").trim();
    if (!trimmed) return;

    const nextMessages = [...baseMessages, { role: "user", content: trimmed }];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setLastSuggestedActions([]);

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
        language: languageOverride || "en",
      });

      const reply =
        res.data?.reply || "Sorry, I could not generate a response.";
      const suggestedNextActions = Array.isArray(
        res.data?.suggested_next_actions
      )
        ? res.data.suggested_next_actions
        : [];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
        },
      ]);

      setLastSuggestedActions(suggestedNextActions);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, something went wrong while generating your personalized reply.",
        },
      ]);
      setLastSuggestedActions([]);
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
    const route = mapActionToRoute(action);

    if (route) {
      navigate(route);
      return;
    }

    setInput(action);
  }

  function handleStarterPromptClick(prompt) {
    void runPrompt(prompt);
  }

  if (pageLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-16">
          <p className="text-slate-600">Loading assistant...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-600">NorthBridgeAI</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Personalized AI Assistant
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Ask questions based on your real profile, strategy, and document
            workflow.
          </p>

          {sourceTitle ? (
            <div className="mt-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              Started from: {sourceTitle}
            </div>
          ) : null}
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-white px-4 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Try one of these
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
                  Thinking...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {lastSuggestedActions.length > 0 && (
            <div className="border-t border-slate-200 bg-white px-4 py-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Suggested next actions
              </p>

              <div className="flex flex-wrap gap-2">
                {lastSuggestedActions.slice(0, 3).map((action, index) => (
                  <button
                    key={`${action}-${index}`}
                    type="button"
                    onClick={() => handleActionClick(action)}
                    className="rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 bg-white p-4">
            <div className="flex gap-3">
              <textarea
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask something specific, ${firstName}...`}
                className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
              <div className="flex items-end">
                <Button onClick={handleSend} disabled={loading || !input.trim()}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}