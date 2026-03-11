import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../api";

export default function StrategyPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchStrategy = async () => {
      try {
        const res = await api.get("/strategy/me");
        setData(res.data);
      } catch (err) {
        setMessage(err.response?.data?.detail || "Failed to load strategy.");
      }
    };

    fetchStrategy();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm font-semibold text-blue-600">NorthBridgeAI</p>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">
              Your Strategy Dashboard
            </h1>
          </div>
          <button
            onClick={() => navigate("/profile")}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Back to Profile
          </button>
        </div>

        {message && <p className="text-red-600">{message}</p>}

        {data && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white shadow-xl border border-slate-200 p-6">
              <p className="text-sm text-slate-500">CRS Score</p>
              <h2 className="text-5xl font-bold text-slate-900 mt-2">
                {data.crs_score}
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl bg-white shadow-xl border border-slate-200 p-6">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">
                  Recommended Programs
                </h3>
                <ul className="space-y-3">
                  {data.recommended_programs.map((program, index) => (
                    <li
                      key={index}
                      className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3"
                    >
                      {program}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl bg-white shadow-xl border border-slate-200 p-6">
                <h3 className="text-xl font-semibold text-slate-900 mb-4">
                  Improvement Scenarios
                </h3>
                <ul className="space-y-3">
                  {data.improvement_scenarios.map((item, index) => (
                    <li
                      key={index}
                      className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3"
                    >
                      <div className="text-slate-700">{item.change}</div>
                      <div className="text-sm text-blue-600 font-semibold mt-1">
                        New CRS: {item.new_crs}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl bg-white shadow-xl border border-slate-200 p-6">
              <h3 className="text-xl font-semibold text-slate-900 mb-4">
                AI Strategy
              </h3>

              <div className="prose prose-slate max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {data.ai_strategy}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}