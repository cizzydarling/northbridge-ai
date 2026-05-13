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

  return data.reply || data.summary || data.overall_assessment || data.message || "";
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

function SparkBadge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-800">
      {children}
    </span>
  );
}

function InsightItem({ item }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700 shadow-sm">
      {item}
    </div>
  );
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
        badge: "Guidance live",
        thinking: "Analyse en cours...",
        error: "Impossible de charger la réponse IA pour le moment.",
        keyInsights: "Points clés",
        suggestedActions: "Actions suggérées",
        empty:
          "Cliquez pour obtenir une guidance IA adaptée à cette page.",
        readyTitle: "Lecture stratégique instantanée",
        readyBody:
          "Le copilote transforme le contexte de cette page en recommandations plus claires, plus ciblées et plus exploitables.",
        resultTitle: "Réponse IA",
      };
    }

    return {
      eyebrow: "AI Copilot",
      badge: "Live guidance",
      thinking: "Thinking...",
      error: "Unable to load AI response right now.",
      keyInsights: "Key insights",
      suggestedActions: "Suggested actions",
      empty: "Click to get AI guidance tailored to this page.",
      readyTitle: "Instant strategic read",
      readyBody:
        "The copilot turns this page context into clearer, more targeted, more actionable recommendations.",
      resultTitle: "AI response",
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
        err?.response?.data?.detail || err?.response?.data?.message || text.error
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
      className={`overflow-hidden border border-amber-100/80 bg-stone-50/80 ${className}`}
      padding="lg"
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <SparkBadge>{text.eyebrow}</SparkBadge>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                {text.badge}
              </span>
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h2>

            <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">
                {text.readyTitle}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {text.readyBody}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <Button onClick={handleAsk} loading={loading} variant="premium">
              {loading ? text.thinking : buttonLabel}
            </Button>
          </div>
        </div>

        {(loading || error || reply) && (
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {text.resultTitle}
            </p>

            {loading ? (
              <p className="mt-3 text-sm text-slate-500">{text.thinking}</p>
            ) : null}

            {!loading && error ? (
              <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {!loading && !error && reply ? (
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
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
                <InsightItem key={`${item}-${idx}`} item={item} />
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
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
                    action.route
                      ? "border-slate-300 bg-white text-slate-900 hover:bg-slate-50 hover:shadow-sm"
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
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-slate-500">
            {text.empty}
          </div>
        )}
      </div>
    </Card>
  );
}
