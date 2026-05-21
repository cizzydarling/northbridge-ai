import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import {
  getClient,
  getClientSimulations,
  compareClientSimulations,
  getToken,
  logoutUser,
} from "../api";
import SimulationCard from "../components/SimulationCard";

export default function SimulationComparePage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const firstFromQuery = searchParams.get("first");

  const [client, setClient] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [selectedIds, setSelectedIds] = useState(
    firstFromQuery ? [Number(firstFromQuery)] : []
  );
  const [compareResult, setCompareResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchSimulations = async () => {
      try {
        setLoading(true);
        setMessage("");

        const token = getToken();
        if (!token) {
          navigate("/auth");
          return;
        }

        const [clientData, data] = await Promise.all([
          getClient(clientId),
          getClientSimulations(clientId),
        ]);

        setClient(clientData);
        setSimulations(data || []);
      } catch (err) {
        if (err.response?.status === 401) {
          logoutUser();
          navigate("/auth");
          return;
        }

        setMessage(
          err.response?.data?.detail || "Failed to load simulations."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSimulations();
  }, [clientId, navigate]);

  const toggleSelect = (simulationId) => {
    setSelectedIds((prev) => {
      if (prev.includes(simulationId)) {
        return prev.filter((id) => id !== simulationId);
      }
      if (prev.length === 2) {
        return [prev[1], simulationId];
      }
      return [...prev, simulationId];
    });
  };

  const runCompare = async () => {
    if (selectedIds.length !== 2) {
      alert("Please select exactly 2 simulations.");
      return;
    }

    try {
      const data = await compareClientSimulations(clientId, {
        first_simulation_id: selectedIds[0],
        second_simulation_id: selectedIds[1],
      });
      setCompareResult(data);
      setMessage("");
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (err) {
      setMessage(err.response?.data?.detail || "Failed to compare simulations.");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          Loading simulations...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {client?.full_name || "Client"} — Compare Simulations
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Select two saved scenarios to compare CRS outcomes and pathway
            differences.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/clients/${clientId}/simulations/history`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to History
          </button>

          <button
            onClick={runCompare}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Compare Selected
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {message}
        </div>
      )}

      <div className="grid gap-4">
        {simulations.map((simulation) => (
          <SimulationCard
            key={simulation.id}
            simulation={simulation}
            selectable
            selected={selectedIds.includes(simulation.id)}
            onSelect={toggleSelect}
          />
        ))}
      </div>

      {compareResult ? (
        <div className="mt-8 grid gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <SimulationSummaryPanel
              title={compareResult.first_simulation.name}
              simulation={compareResult.first_simulation}
            />
            <SimulationSummaryPanel
              title={compareResult.second_simulation.name}
              simulation={compareResult.second_simulation}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-slate-900">
              Comparison Summary
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <StatCard
                label="First CRS"
                value={compareResult.comparison?.crs?.first_score ?? "-"}
              />
              <StatCard
                label="Second CRS"
                value={compareResult.comparison?.crs?.second_score ?? "-"}
              />
              <StatCard
                label="Difference"
                value={
                  typeof compareResult.comparison?.crs?.difference === "number"
                    ? `${compareResult.comparison.crs.difference >= 0 ? "+" : ""}${compareResult.comparison.crs.difference}`
                    : "-"
                }
              />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <PathwayGroup
                title="First Only Pathways"
                items={compareResult.comparison?.pathways?.first_only || []}
                className="bg-blue-50"
                textClassName="text-blue-900"
                chipClassName="bg-white text-blue-700"
              />

              <PathwayGroup
                title="Shared Pathways"
                items={compareResult.comparison?.pathways?.shared || []}
                className="bg-emerald-50"
                textClassName="text-emerald-900"
                chipClassName="bg-white text-emerald-700"
              />

              <PathwayGroup
                title="Second Only Pathways"
                items={compareResult.comparison?.pathways?.second_only || []}
                className="bg-purple-50"
                textClassName="text-purple-900"
                chipClassName="bg-white text-purple-700"
              />
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
}

function SimulationSummaryPanel({ title, simulation }) {
  const changes = simulation?.simulated_changes || {};
  const crs = simulation?.result_payload?.crs_comparison || {};
  const pathways =
    simulation?.result_payload?.pathway_comparison?.simulated_eligible_pathways ||
    [];
  const strengths = simulation?.result_payload?.simulated_result?.strengths || [];
  const nextSteps = simulation?.result_payload?.simulated_result?.next_steps || [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Current CRS" value={crs.current_crs_score ?? "-"} />
        <StatCard label="Simulated CRS" value={crs.simulated_crs_score ?? "-"} />
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-500">Profile Factors</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Tag label={`Language ${changes.language_score ?? "--"}`} />
          <Tag label={`${changes.experience_years ?? "--"} yrs exp`} />
          <Tag label={changes.has_job_offer ? "Job Offer" : "No Job Offer"} />
          <Tag
            label={
              changes.has_canadian_experience
                ? "Canadian Exp"
                : "No Canadian Exp"
            }
          />
          <Tag
            label={
              changes.studied_in_canada
                ? "Studied in Canada"
                : "No Canadian Study"
            }
          />
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <MiniList
          title="Eligible Pathways"
          items={pathways}
          emptyText="No pathways listed"
        />
        <MiniList
          title="Strengths"
          items={strengths}
          emptyText="No strengths listed"
        />
        <MiniList
          title="Next Steps"
          items={nextSteps}
          emptyText="No next steps listed"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function PathwayGroup({
  title,
  items,
  className,
  textClassName,
  chipClassName,
}) {
  return (
    <div className={`rounded-xl p-4 ${className}`}>
      <h3 className={`font-semibold ${textClassName}`}>{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item) => (
            <span
              key={item}
              className={`rounded-full px-3 py-1 text-xs font-medium ${chipClassName}`}
            >
              {item}
            </span>
          ))
        ) : (
          <span className="text-sm text-slate-600">None</span>
        )}
      </div>
    </div>
  );
}

function MiniList({ title, items, emptyText }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.length > 0 ? (
          items.map((item, index) => (
            <li
              key={index}
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              {item}
            </li>
          ))
        ) : (
          <li className="text-sm text-slate-500">{emptyText}</li>
        )}
      </ul>
    </div>
  );
}

function Tag({ label }) {
  return (
    <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
      {label}
    </span>
  );
}
