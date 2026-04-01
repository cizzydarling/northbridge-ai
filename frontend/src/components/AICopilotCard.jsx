import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendAIMessage } from "../api";
import Button from "./ui/Button";
import Card from "./ui/Card";

function normalizeLanguage(language) {
  return (language || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

function normalizeAction(action, language) {
  const lang = normalizeLanguage(language);

  if (!action) return null;

  if (typeof action === "string") {
    return {
      label: action,
      route: null,
    };
  }

  if (typeof action !== "object") return null;

  const rawLabel =
    action.label ||
    action.title ||
    action.name ||
    action.text ||
    action.action ||
    (lang === "fr" ? "Action suggérée" : "Suggested action");

  const rawRoute =
    action.route ||
    action.path ||
    action.href ||
    action.url ||
    null;

  return {
    label: String(rawLabel),
    route: rawRoute ? String(rawRoute) : null,
  };
}

function normalizeActions(actions, language) {
  if (!Array.isArray(actions)) return [];
  return actions
    .map((item) => normalizeAction(item, language))
    .filter(Boolean)
    .slice(0, 3);
}

function fallbackActions(language) {
  const lang = normalizeLanguage(language);

  if (lang === "fr") {
    return [
      { label: "Voir ma stratégie", route: "/strategy" },
      { label: "Mettre à jour mon profil", route: "/profile" },
      { label: "Ouvrir mes documents", route: "/self/documents" },
    ];
  }

  return [
    { label: "View my strategy", route: "/strategy" },
    { label: "Update my profile", route: "/profile" },
    { label: "Open my documents", route: "/self/documents" },
  ];
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

  const ui = useMemo(() => {
    if (lang === "fr") {
      return {
        badge: "Copilote IA",
        loading: "Analyse en cours...",
        error: "Impossible de charger la réponse IA pour le moment.",
        suggestedActions: "Actions suggérées",
        noReply: "Aucune réponse IA disponible.",
        tryAgain: "Réessayer",
      };
    }

    return {
      badge: "AI Copilot",
      loading: "Thinking...",
      error: "Unable to load the AI response right now.",
      suggestedActions: "Suggested actions",
      noReply: "No AI response available.",
      tryAgain: "Try again",
    };
  }, [lang]);

  const handleAsk = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await sendAIMessage({
        message: prompt,
        chat_history: [],
        language: lang,
      });

      const data = response?.data || {};
      const nextReply = (data.reply || "").trim();
      const nextActions =
        normalizeActions(data.suggested_next_actions, lang) ||
        fallbackActions(lang);

      setReply(nextReply);
      setActions(nextActions.length ? nextActions : fallbackActions(lang));
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || ui.error);
      setReply("");
      setActions(fallbackActions(lang));
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (action) => {
    if (!action?.route) return;
    navigate(action.route);
  };

  return (
    <Card
      className={`overflow-hidden border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-6 ${className}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
              {ui.badge}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {title}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>

          <div className="shrink-0">
            <Button onClick={handleAsk} disabled={loading}>
              {loading ? ui.loading : buttonLabel}
            </Button>
          </div>
        </div>

        {(reply || error || loading || actions.length > 0) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {loading && (
              <p className="text-sm text-slate-600">{ui.loading}</p>
            )}

            {!loading && error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="whitespace-pre-line text-sm leading-7 text-slate-700">
                    {reply || ui.noReply}
                  </p>
                </div>

                {actions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {ui.suggestedActions}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-3">
                      {actions.map((action, index) => (
                        <button
                          key={`${action.label}-${index}`}
                          type="button"
                          onClick={() => handleActionClick(action)}
                          disabled={!action.route}
                          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                            action.route
                              ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                              : "cursor-default border border-slate-200 bg-slate-100 text-slate-500"
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!loading && !reply && !error && actions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-4">
            <p className="text-sm text-slate-500">
              {lang === "fr"
                ? "Cliquez pour obtenir une explication intelligente liée à cette page."
                : "Click to get smart guidance tailored to this page."}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}