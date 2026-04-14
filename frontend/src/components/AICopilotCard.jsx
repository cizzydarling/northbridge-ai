import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendAIMessage } from "../api";
import Button from "./ui/Button";
import Card from "./ui/Card";

function normalizeLanguage(language) {
  return String(language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return String(item.label || item.title || item.text || "").trim();
      }
      return "";
    })
    .filter(Boolean);
}

function normalizeActions(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        return {
          label: item.trim(),
          route: "",
        };
      }

      if (item && typeof item === "object") {
        return {
          label: String(item.label || item.title || item.text || "").trim(),
          route: String(item.route || item.path || item.url || "").trim(),
        };
      }

      return null;
    })
    .filter((item) => item && item.label);
}

function extractReply(data) {
  if (!data || typeof data !== "object") return "";

  return (
    data.reply ||
    data.summary ||
    data.overall_assessment ||
    data.message ||
    ""
  );
}

function extractInsights(data) {
  if (!data || typeof data !== "object") return [];

  if (Array.isArray(data.insights)) return normalizeStringArray(data.insights);

  const fallback = [
    ...(Array.isArray(data.pathways) ? data.pathways : []),
    ...(Array.isArray(data.strengths) ? data.strengths : []),
  ];

  return normalizeStringArray(fallback).slice(0, 3);
}

function extractActions(data) {
  if (!data || typeof data !== "object") return [];

  if (Array.isArray(data.suggested_next_actions)) {
    return normalizeActions(data.suggested_next_actions);
  }

  if (Array.isArray(data.next_steps)) {
    return normalizeActions(data.next_steps);
  }

  return [];
}

export default function AICopilotCard({
  title = "AI Copilot",
  description = "Get AI guidance based on your current NorthBridgeAI context.",
  buttonLabel = "Ask AI",
  prompt = "",
  language = "en",
  className = "",
}) {
  const navigate = useNavigate();
  const lang = normalizeLanguage(language);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [actions, setActions] = useState([]);
  const [insights, setInsights] = useState([]);

  const text = useMemo(() => {
    if (lang === "fr") {
      return {
        eyebrow: "Copilote IA",
        thinking: "Analyse en cours...",
        error: "Impossible de charger la réponse IA pour le moment.",
        keyInsights: "Points clés",
        suggestedActions: "Actions suggérées",
        empty:
          "Cliquez pour obtenir une guidance IA adaptée à cette page.",
      };
    }

    return {
      eyebrow: "AI Copilot",
      thinking: "Thinking...",
      error: "Unable to load AI response right now.",
      keyInsights: "Key insights",
      suggestedActions: "Suggested actions",
      empty: "Click to get AI guidance tailored to this page.",
    };
  }, [lang]);

  const hasContent = Boolean(reply) || insights.length > 0 || actions.length > 0;

  const handleAsk = async () => {
    const safePrompt = String(prompt || "").trim();

    if (!safePrompt) {
      setError(text.error);
      return;
    }

    setLoading(true);
    setError("");
    setReply("");
    setActions([]);
    setInsights([]);

    try {
      const response = await sendAIMessage({
        message: safePrompt,
        chat_history: [],
        language: lang,
      });

      const data = response?.data || {};
      const nextReply = extractReply(data);
      const nextInsights = extractInsights(data);
      const nextActions = extractActions(data);

      setReply(nextReply);
      setInsights(nextInsights);
      setActions(nextActions);

      if (!nextReply && nextInsights.length === 0 && nextActions.length === 0) {
        setError(text.error);
      }
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          text.error
      );
    } finally {
      setLoading(false);
    }
  };

  function handleActionClick(action) {
    if (!action?.route) return;
    navigate(action.route);
  }

  return (
    <Card
      variant="glass"
      className={`border border-blue-100 p-6 ${className}`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              {text.eyebrow}
            </p>

            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>

          <Button onClick={handleAsk} disabled={loading}>
            {loading ? text.thinking : buttonLabel}
          </Button>
        </div>

        {(loading || error || reply) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            {loading ? (
              <p className="text-sm text-slate-500">{text.thinking}</p>
            ) : null}

            {!loading && error ? (
              <div className="text-sm text-red-600">{error}</div>
            ) : null}

            {!loading && !error && reply ? (
              <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
                {reply}
              </p>
            ) : null}
          </div>
        )}

        {!loading && insights.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {text.keyInsights}
            </p>

            <div className="mt-3 space-y-2">
              {insights.map((item, idx) => (
                <div
                  key={`${item}-${idx}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && actions.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {text.suggestedActions}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((action, idx) => (
                <button
                  key={`${action.label}-${idx}`}
                  type="button"
                  onClick={() => handleActionClick(action)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    action.route
                      ? "border-slate-300 bg-white hover:bg-slate-50 hover:shadow-sm"
                      : "cursor-default border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && !hasContent && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            {text.empty}
          </div>
        )}
      </div>
    </Card>
  );
}