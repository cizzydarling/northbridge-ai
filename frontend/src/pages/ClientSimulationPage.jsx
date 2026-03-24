import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import {
  compareClientSimulations,
  createClientSimulation,
  deleteClientSimulation,
  downloadClientSimulationReport,
  downloadSimulationComparisonReport,
  getClientById,
  getClientProfile,
  getClientSimulations,
  getToken,
  logoutUser,
  updateClientSimulation,
} from "../api";

const initialForm = {
  name: "",
  notes: "",
  language_score: "",
  experience_years: "",
  has_job_offer: false,
  has_canadian_experience: false,
  studied_in_canada: false,
  occupation: "",
  noc_code: "",
  preferred_province: "",
};

function toScenarioPayload(form) {
  const simulatedChanges = {};

  if (form.language_score !== "") {
    simulatedChanges.language_score = Number(form.language_score);
  }

  if (form.experience_years !== "") {
    simulatedChanges.experience_years = Number(form.experience_years);
  }

  if (form.occupation.trim()) {
    simulatedChanges.occupation = form.occupation.trim();
  }

  if (form.noc_code.trim()) {
    simulatedChanges.noc_code = form.noc_code.trim();
  }

  if (form.preferred_province.trim()) {
    simulatedChanges.preferred_province = form.preferred_province.trim();
  }

  simulatedChanges.has_job_offer = Boolean(form.has_job_offer);
  simulatedChanges.has_canadian_experience = Boolean(form.has_canadian_experience);
  simulatedChanges.studied_in_canada = Boolean(form.studied_in_canada);

  return {
    name: form.name.trim(),
    notes: form.notes.trim() || null,
    simulated_changes: simulatedChanges,
  };
}

function buildDownload(response, fallbackName) {
  const blob = response?.data;

  if (!(blob instanceof Blob)) {
    throw new Error("Invalid download response.");
  }

  const contentType =
    response?.headers?.["content-type"] || "application/octet-stream";

  let extension = "pdf";
  if (contentType.includes("html")) extension = "html";
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
}

export default function ClientSimulationPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [profile, setProfile] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState([]);
  const [editingScenarioId, setEditingScenarioId] = useState(null);

  const [form, setForm] = useState(initialForm);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingScenarioId, setExportingScenarioId] = useState(null);
  const [exportingComparison, setExportingComparison] = useState(false);
  const [comparing, setComparing] = useState(false);

  const [comparisonResult, setComparisonResult] = useState(null);

  const loadPage = async ({ isRefresh = false } = {}) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setMessage("");

    try {
      const token = getToken();

      if (!token) {
        navigate("/auth");
        return;
      }

      const [clientRes, profileRes, scenariosRes] = await Promise.all([
        getClientById(clientId),
        getClientProfile(clientId),
        getClientSimulations(clientId),
      ]);

      setClient(clientRes.data);
      setProfile(profileRes.data);
      setScenarios(Array.isArray(scenariosRes.data) ? scenariosRes.data : []);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      if (err.response?.status === 404) {
        setMessage(
          err.response?.data?.detail ||
            "Client profile is required before using simulations."
        );
      } else {
        setMessage(
          err.response?.data?.detail || "Failed to load client simulations."
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [clientId]);

  const scenarioCount = scenarios.length;

  const currentProfileSummary = useMemo(() => {
    if (!profile) return [];
    return [
      { label: "Language Score", value: profile.language_score ?? "--" },
      {
        label: "Experience",
        value:
          profile.experience_years != null
            ? `${profile.experience_years} years`
            : "--",
      },
      { label: "Occupation", value: profile.occupation || "--" },
      { label: "Province", value: profile.preferred_province || "--" },
      { label: "Job Offer", value: profile.has_job_offer ? "Yes" : "No" },
      {
        label: "Canadian Experience",
        value: profile.has_canadian_experience ? "Yes" : "No",
      },
      {
        label: "Studied in Canada",
        value: profile.studied_in_canada ? "Yes" : "No",
      },
    ];
  }, [profile]);

  const resetForm = () => {
    setForm(initialForm);
    setEditingScenarioId(null);
    setComparisonResult(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEditScenario = (scenario) => {
    const changes = scenario?.simulated_changes || {};

    setEditingScenarioId(scenario.id);
    setForm({
      name: scenario.name || "",
      notes: scenario.notes || "",
      language_score:
        changes.language_score != null ? String(changes.language_score) : "",
      experience_years:
        changes.experience_years != null ? String(changes.experience_years) : "",
      has_job_offer: Boolean(changes.has_job_offer),
      has_canadian_experience: Boolean(changes.has_canadian_experience),
      studied_in_canada: Boolean(changes.studied_in_canada),
      occupation: changes.occupation || "",
      noc_code: changes.noc_code || "",
      preferred_province: changes.preferred_province || "",
    });

    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleScenarioSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const payload = toScenarioPayload(form);

      let response;
      if (editingScenarioId) {
        response = await updateClientSimulation(clientId, editingScenarioId, payload);
        const updated = response.data;

        setScenarios((prev) =>
          prev.map((item) => (item.id === editingScenarioId ? updated : item))
        );
        setMessage("Simulation scenario updated successfully.");
      } else {
        response = await createClientSimulation(clientId, payload);
        const created = response.data;

        setScenarios((prev) => [created, ...prev]);
        setMessage("Simulation scenario created successfully.");
      }

      resetForm();
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      setMessage(
        err.response?.data?.detail || "Failed to save simulation scenario."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteScenario = async (scenarioId) => {
    try {
      setMessage("");
      await deleteClientSimulation(clientId, scenarioId);

      setScenarios((prev) => prev.filter((item) => item.id !== scenarioId));
      setSelectedScenarioIds((prev) => prev.filter((id) => id !== scenarioId));

      if (editingScenarioId === scenarioId) {
        resetForm();
      }

      setMessage("Simulation scenario deleted successfully.");
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.detail || "Failed to delete simulation scenario."
      );
    }
  };

  const handleToggleScenarioSelection = (scenarioId) => {
    setSelectedScenarioIds((prev) => {
      if (prev.includes(scenarioId)) {
        return prev.filter((id) => id !== scenarioId);
      }
      if (prev.length >= 2) {
        return [prev[1], scenarioId];
      }
      return [...prev, scenarioId];
    });
  };

  const handleCompare = async () => {
    if (selectedScenarioIds.length !== 2) {
      setMessage("Select exactly 2 scenarios to compare.");
      return;
    }

    try {
      setComparing(true);
      setMessage("");

      const response = await compareClientSimulations(clientId, {
        simulation_ids: selectedScenarioIds,
      });

      setComparisonResult(response.data);
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.detail || "Failed to compare simulation scenarios."
      );
    } finally {
      setComparing(false);
    }
  };

  const handleExportScenario = async (scenario) => {
    try {
      setExportingScenarioId(scenario.id);
      setMessage("");

      const response = await downloadClientSimulationReport(clientId, scenario.id);
      const safeName =
        scenario?.name?.trim().replace(/\s+/g, "_").toLowerCase() || "simulation";

      buildDownload(response, `${safeName}_report`);
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.detail ||
          err.message ||
          "Failed to export simulation report."
      );
    } finally {
      setExportingScenarioId(null);
    }
  };

  const handleExportComparison = async () => {
    if (selectedScenarioIds.length !== 2) {
      setMessage("Select exactly 2 scenarios to export a comparison report.");
      return;
    }

    try {
      setExportingComparison(true);
      setMessage("");

      const response = await downloadSimulationComparisonReport(clientId, {
        simulation_ids: selectedScenarioIds,
      });

      const safeClientName =
        client?.full_name?.trim().replace(/\s+/g, "_").toLowerCase() || "client";

      buildDownload(response, `${safeClientName}_simulation_comparison`);
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.detail ||
          err.message ||
          "Failed to export comparison report."
      );
    } finally {
      setExportingComparison(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-xl">
            <p className="text-lg font-medium text-slate-700">
              Loading client simulations...
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Preparing scenario workspace and saved comparisons.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {message && (
        <div
          className={`mb-6 rounded-2xl px-4 py-3 ${
            message.toLowerCase().includes("success")
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {client?.full_name || "Client"} — Simulations
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Create scenario-based simulations to test how profile changes may
            affect CRS and pathway outcomes.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate(`/clients/${clientId}`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Overview
          </button>

          <button
            onClick={() => navigate(`/clients/${clientId}/profile`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit Profile
          </button>

          <button
            onClick={() => loadPage({ isRefresh: true })}
            disabled={refreshing}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {!profile && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <h2 className="text-2xl font-semibold text-slate-900">
            Client profile required
          </h2>
          <p className="mt-3 text-slate-600">
            Create the client profile first before using simulations.
          </p>
          <button
            onClick={() => navigate(`/clients/${clientId}/profile`)}
            className="mt-6 rounded-xl bg-slate-900 px-5 py-3 font-medium text-white"
          >
            Open Client Profile
          </button>
        </div>
      )}

      {profile && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {editingScenarioId ? "Edit Scenario" : "Create Scenario"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Save a what-if scenario using targeted profile changes.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Saved scenarios: <span className="font-semibold">{scenarioCount}</span>
                </div>
              </div>

              <form
                onSubmit={handleScenarioSubmit}
                className="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                <Field label="Scenario Name" required>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder="e.g. IELTS 9 + Ontario target"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </Field>

                <Field label="Preferred Province">
                  <input
                    name="preferred_province"
                    value={form.preferred_province}
                    onChange={handleChange}
                    placeholder="e.g. Ontario"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </Field>

                <Field label="Language Score">
                  <input
                    name="language_score"
                    type="number"
                    min="0"
                    max="12"
                    value={form.language_score}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </Field>

                <Field label="Years of Experience">
                  <input
                    name="experience_years"
                    type="number"
                    min="0"
                    value={form.experience_years}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </Field>

                <Field label="Occupation">
                  <input
                    name="occupation"
                    value={form.occupation}
                    onChange={handleChange}
                    placeholder="e.g. Software Developer"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </Field>

                <Field label="NOC Code">
                  <input
                    name="noc_code"
                    value={form.noc_code}
                    onChange={handleChange}
                    placeholder="e.g. 21232"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Notes">
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      rows="4"
                      placeholder="Document assumptions or rationale for this scenario."
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <p className="mb-3 text-sm font-medium text-slate-700">
                    Toggle factors
                  </p>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <CheckboxCard
                      label="Has Job Offer"
                      name="has_job_offer"
                      checked={form.has_job_offer}
                      onChange={handleChange}
                    />
                    <CheckboxCard
                      label="Has Canadian Experience"
                      name="has_canadian_experience"
                      checked={form.has_canadian_experience}
                      onChange={handleChange}
                    />
                    <CheckboxCard
                      label="Studied in Canada"
                      name="studied_in_canada"
                      checked={form.studied_in_canada}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="md:col-span-2 mt-2 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? editingScenarioId
                        ? "Updating..."
                        : "Saving..."
                      : editingScenarioId
                      ? "Update Scenario"
                      : "Save Scenario"}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Saved Scenarios
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Select 2 scenarios to compare, export, or review.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleCompare}
                    disabled={selectedScenarioIds.length !== 2 || comparing}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60 hover:bg-slate-50"
                  >
                    {comparing ? "Comparing..." : "Compare Selected"}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportComparison}
                    disabled={selectedScenarioIds.length !== 2 || exportingComparison}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {exportingComparison ? "Exporting..." : "Export Comparison"}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {scenarios.length > 0 ? (
                  scenarios.map((scenario) => {
                    const isSelected = selectedScenarioIds.includes(scenario.id);
                    const crsComparison = scenario?.result_payload?.crs_comparison || {};
                    const pathwayComparison =
                      scenario?.result_payload?.pathway_comparison || {};
                    const simulatedPathways =
                      pathwayComparison?.simulated_eligible_pathways || [];

                    return (
                      <div
                        key={scenario.id}
                        className={`rounded-xl border p-4 ${
                          isSelected
                            ? "border-blue-300 bg-blue-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleScenarioSelection(scenario.id)}
                              />
                              <h3 className="text-lg font-semibold text-slate-900">
                                {scenario.name}
                              </h3>
                            </div>

                            <p className="mt-2 text-sm text-slate-600">
                              {scenario.notes || "No notes provided."}
                            </p>

                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                              <MiniStat
                                label="Current CRS"
                                value={crsComparison?.current_crs_score ?? "--"}
                              />
                              <MiniStat
                                label="Simulated CRS"
                                value={crsComparison?.simulated_crs_score ?? "--"}
                              />
                              <MiniStat
                                label="Difference"
                                value={
                                  typeof crsComparison?.difference === "number"
                                    ? `${crsComparison.difference >= 0 ? "+" : ""}${crsComparison.difference}`
                                    : "--"
                                }
                              />
                            </div>

                            <div className="mt-4">
                              <p className="text-sm font-medium text-slate-500">
                                Pathways
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {simulatedPathways.length > 0 ? (
                                  simulatedPathways.map((item, index) => (
                                    <span
                                      key={index}
                                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                                    >
                                      {item}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-slate-500">
                                    No pathways listed.
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditScenario(scenario)}
                              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleExportScenario(scenario)}
                              disabled={exportingScenarioId === scenario.id}
                              className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-60"
                            >
                              {exportingScenarioId === scenario.id
                                ? "Exporting..."
                                : "Export"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteScenario(scenario.id)}
                              className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="text-slate-700">No simulation scenarios yet.</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Create your first scenario to test changes against the
                      current client profile.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {comparisonResult && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-slate-900">
                  Comparison Result
                </h2>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <MiniStat
                    label="Best CRS"
                    value={comparisonResult?.best_crs_score ?? "--"}
                  />
                  <MiniStat
                    label="Best Scenario"
                    value={comparisonResult?.best_scenario_name || "--"}
                  />
                  <MiniStat
                    label="Recommendation"
                    value={comparisonResult?.recommended_choice || "--"}
                  />
                </div>

                {comparisonResult?.summary && (
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm leading-6 text-slate-700">
                      {comparisonResult.summary}
                    </p>
                  </div>
                )}

                {Array.isArray(comparisonResult?.scenarios) &&
                  comparisonResult.scenarios.length > 0 && (
                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                      {comparisonResult.scenarios.map((scenario, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-base font-semibold text-slate-900">
                            {scenario.name || `Scenario ${index + 1}`}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            CRS: {scenario.crs_score ?? "--"}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(scenario.pathways || []).map((pathway, pIndex) => (
                              <span
                                key={pIndex}
                                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                              >
                                {pathway}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-slate-900">
                Current Profile Snapshot
              </h2>

              <div className="mt-5 space-y-3">
                {currentProfileSummary.map((item) => (
                  <InfoRow key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-slate-900">
                Simulation Tips
              </h2>

              <div className="mt-5 space-y-3 text-sm text-slate-700">
                <TipCard text="Use scenario names that clearly describe the change, such as 'Language 9 + Ontario'." />
                <TipCard text="Compare only 2 scenarios at a time for the clearest recommendation." />
                <TipCard text="Try one-factor and multi-factor scenarios to see which changes create the biggest impact." />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-slate-900">
                Quick Actions
              </h2>

              <div className="mt-5 space-y-3">
                <SidebarButton
                  label="Back to Client Overview"
                  onClick={() => navigate(`/clients/${clientId}`)}
                />
                <SidebarButton
                  label="Open Client Strategy"
                  onClick={() => navigate(`/clients/${clientId}/strategy`)}
                />
                <SidebarButton
                  label="Open Client Profile"
                  onClick={() => navigate(`/clients/${clientId}/profile`)}
                />
                <SidebarButton
                  label="Open Documents"
                  onClick={() => navigate(`/clients/${clientId}/documents`)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function Field({ label, required = false, children }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function CheckboxCard({ label, name, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4"
      />
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </label>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function TipCard({ text }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p>{text}</p>
    </div>
  );
}

function SidebarButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      {label}
    </button>
  );
}