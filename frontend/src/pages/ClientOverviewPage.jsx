import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import {
  getClientOverview,
  downloadClientStrategyReport,
  getToken,
  logoutUser,
} from "../api";

export default function ClientOverviewPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [exportingStrategy, setExportingStrategy] = useState(false);

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true);
      setMessage("");

      try {
        const token = getToken();

        if (!token) {
          navigate("/auth");
          return;
        }

        const response = await getClientOverview(clientId);
        setData(response.data);
      } catch (err) {
        console.error(err);

        if (err.response?.status === 401) {
          logoutUser();
          navigate("/auth");
          return;
        }

        setMessage(
          err.response?.data?.detail || "Failed to load client overview."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, [clientId, navigate]);

  const buildDownload = (response, fallbackName) => {
    const blob = response?.data;

    if (!(blob instanceof Blob)) {
      throw new Error("Invalid download response.");
    }

    const contentType =
      response?.headers?.["content-type"] || "application/octet-stream";

    let extension = "html";
    if (contentType.includes("pdf")) extension = "pdf";
    else if (contentType.includes("json")) extension = "json";
    else if (contentType.includes("text/plain")) extension = "txt";

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fallbackName}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExportStrategy = async () => {
    try {
      setExportingStrategy(true);

      const response = await downloadClientStrategyReport(clientId);
      const clientName =
        data?.client?.full_name?.trim().replace(/\s+/g, "_").toLowerCase() ||
        "client";

      buildDownload(response, `${clientName}_strategy_report`);
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.detail ||
          err.message ||
          "Failed to export strategy report."
      );
    } finally {
      setExportingStrategy(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          Loading client overview...
        </div>
      </Layout>
    );
  }

  const client = data?.client;
  const profileSnapshot = data?.profile_snapshot;
  const strategySummary = data?.strategy_summary;
  const latestSimulation = data?.latest_simulation;

  const latestSimulationName =
    latestSimulation?.name || "Latest Saved Simulation";

  const latestCurrentCrs =
    latestSimulation?.result_payload?.crs_comparison?.current_crs_score ?? "--";

  const latestSimulatedCrs =
    latestSimulation?.result_payload?.crs_comparison?.simulated_crs_score ?? "--";

  const latestDifference =
    latestSimulation?.result_payload?.crs_comparison?.difference;

  const latestPathways =
    latestSimulation?.result_payload?.pathway_comparison
      ?.simulated_eligible_pathways || [];

  return (
    <Layout>
      {message && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {message}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {client?.full_name || "Client"} — Overview
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Central planning hub for this client. Guidance and planning support
            only.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate(`/clients/${clientId}/profile`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Profile
          </button>

          <button
            onClick={() => navigate(`/clients/${clientId}/strategy`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Strategy
          </button>

          <button
            onClick={() => navigate(`/clients/${clientId}/matters`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Matters
          </button>

          <button
            onClick={() => navigate(`/clients/${clientId}/simulations`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Simulations
          </button>

          <button
            onClick={() => navigate(`/clients/${clientId}/documents`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Documents
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <OverviewCard
          label="Profile Completion"
          value={`${data?.profile_completion ?? 0}%`}
        />
        <OverviewCard
          label="Current CRS"
          value={strategySummary?.crs_score ?? "--"}
        />
        <OverviewCard
          label="Top Program"
          value={strategySummary?.top_program || "Not available"}
          small
        />
        <OverviewCard
          label="Saved Scenarios"
          value={data?.saved_scenarios_count ?? 0}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl xl:col-span-2">
          <h2 className="text-xl font-semibold text-slate-900">
            Client Summary
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoCard
              title="Email"
              value={client?.email || "No email provided"}
            />
            <InfoCard title="Status" value={client?.status || "Not set"} />
            <InfoCard
              title="Top Province"
              value={strategySummary?.top_province || "Not available"}
            />
            <InfoCard
              title="Latest Simulation"
              value={
                latestSimulation
                  ? `${latestCurrentCrs} → ${latestSimulatedCrs}`
                  : "No simulation yet"
              }
            />
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-semibold text-slate-900">Notes</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {client?.notes || "No notes added yet."}
            </p>
          </div>

          {strategySummary?.advisor_summary && (
            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-base font-semibold text-slate-900">
                Strategy Summary
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {strategySummary.advisor_summary}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            Quick Actions
          </h2>

          <div className="mt-5 space-y-3">
            <ActionButton
              label="Edit Client Profile"
              onClick={() => navigate(`/clients/${clientId}/profile`)}
            />
            <ActionButton
              label="View Client Strategy"
              onClick={() => navigate(`/clients/${clientId}/strategy`)}
            />
            <ActionButton
              label="Open Client Matters"
              onClick={() => navigate(`/clients/${clientId}/matters`)}
            />
            <ActionButton
              label="Open Simulation Workspace"
              onClick={() => navigate(`/clients/${clientId}/simulations`)}
            />
            <ActionButton
              label="Open Document Checklist"
              onClick={() => navigate(`/clients/${clientId}/documents`)}
            />
            <ActionButton
              label={
                exportingStrategy ? "Exporting..." : "Export Strategy Report"
              }
              onClick={handleExportStrategy}
              disabled={exportingStrategy}
              primary
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            Profile Snapshot
          </h2>

          {data?.profile_exists ? (
            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoCard title="Age" value={profileSnapshot?.age ?? "--"} />
              <InfoCard
                title="Education"
                value={profileSnapshot?.education || "--"}
              />
              <InfoCard
                title="Language Score"
                value={profileSnapshot?.language_score ?? "--"}
              />
              <InfoCard
                title="Experience"
                value={
                  profileSnapshot?.experience_years != null
                    ? `${profileSnapshot.experience_years} years`
                    : "--"
                }
              />
              <InfoCard
                title="Occupation"
                value={profileSnapshot?.occupation || "--"}
              />
              <InfoCard
                title="Preferred Province"
                value={profileSnapshot?.preferred_province || "--"}
              />
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-slate-700">No profile created yet.</p>
              <button
                onClick={() => navigate(`/clients/${clientId}/profile`)}
                className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Create Profile
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            Latest Simulation Snapshot
          </h2>

          {latestSimulation ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Scenario</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {latestSimulationName}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <OverviewCard label="Current CRS" value={latestCurrentCrs} />
                <OverviewCard label="Simulated CRS" value={latestSimulatedCrs} />
                <OverviewCard
                  label="Difference"
                  value={
                    typeof latestDifference === "number"
                      ? `${latestDifference >= 0 ? "+" : ""}${latestDifference}`
                      : "--"
                  }
                />
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500">Pathways</p>
                <ul className="mt-2 space-y-2">
                  {latestPathways.length > 0 ? (
                    latestPathways.map((item, index) => (
                      <li
                        key={index}
                        className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        {item}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-slate-500">
                      No pathways listed.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-slate-700">No simulation saved yet.</p>
              <button
                onClick={() => navigate(`/clients/${clientId}/simulations`)}
                className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Run Simulation
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function OverviewCard({ label, value, small = false }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p
        className={`mt-2 font-bold text-slate-900 ${
          small ? "text-xl" : "text-3xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function InfoCard({ title, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function ActionButton({ label, onClick, disabled = false, primary = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
        primary
          ? "bg-slate-900 text-white hover:bg-slate-800"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}