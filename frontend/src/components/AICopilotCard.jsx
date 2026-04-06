// based on your file :contentReference[oaicite:0]{index=0}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendAIMessage } from "../api";
import Button from "./ui/Button";
import Card from "./ui/Card";

export default function AICopilotCard({
  title = "AI Copilot",
  description = "Get AI guidance based on your current NorthBridgeAI context.",
  buttonLabel = "Ask AI",
  prompt = "",
  language = "en",
  className = "",
}) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [actions, setActions] = useState([]);
  const [insights, setInsights] = useState([]);

  const handleAsk = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await sendAIMessage({
        message: prompt,
        chat_history: [],
        language,
      });

      const data = response?.data || {};
      setReply(data.reply || "");
      setActions(data.suggested_next_actions || []);
      setInsights(data.insights || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load AI response.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      variant="glass"
      className={`p-6 border border-blue-100 ${className}`}
    >
      <div className="flex flex-col gap-5">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              AI Copilot
            </p>

            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {title}
            </h2>

            <p className="mt-2 text-sm text-slate-600 leading-6">
              {description}
            </p>
          </div>

          <Button onClick={handleAsk} disabled={loading}>
            {loading ? "Thinking..." : buttonLabel}
          </Button>
        </div>

        {/* RESPONSE */}
        {(reply || loading || error) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            {loading && (
              <p className="text-sm text-slate-500">Thinking...</p>
            )}

            {error && (
              <div className="text-sm text-red-600">{error}</div>
            )}

            {reply && (
              <p className="text-sm text-slate-700 leading-7 whitespace-pre-line">
                {reply}
              </p>
            )}
          </div>
        )}

        {/* INSIGHTS */}
        {insights.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Key insights
            </p>

            <div className="mt-3 space-y-2">
              {insights.map((i, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700"
                >
                  {i}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIONS */}
        {actions.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Suggested actions
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {actions.map((a, idx) => (
                <button
                  key={idx}
                  onClick={() => a.route && navigate(a.route)}
                  className="
                    rounded-full px-4 py-2 text-sm font-medium
                    bg-white border border-slate-300
                    hover:bg-slate-50 hover:shadow-sm
                    transition
                  "
                >
                  {a.label || a}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* EMPTY STATE */}
        {!reply && !loading && !error && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            Click to get AI guidance tailored to this page.
          </div>
        )}
      </div>
    </Card>
  );
}