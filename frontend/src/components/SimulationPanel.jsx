import { useEffect, useMemo, useState } from "react";
import {
  getMyProfile,
  getSavedSimulationScenarios,
  saveSimulationScenario,
  deleteSimulationScenario,
} from "../api";

const fallbackSimulation = {
  language_score: 8,
  experience_years: 5,
  has_job_offer: false,
  has_canadian_experience: false,
  studied_in_canada: false,
};

export default function SimulationPanel() {
  const [baseProfile, setBaseProfile] = useState(null);
  const [form, setForm] = useState(fallbackSimulation);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [selectedScenarioIds, setSelectedScenarioIds] = useState([]);

  useEffect(() => {
    const loadProfileAndScenarios = async () => {
      try {
        const [profileRes, scenariosRes] = await Promise.all([
          getMyProfile(),
          getSavedSimulationScenarios(),
        ]);

        const profile = profileRes?.data ?? profileRes ?? {};
        const scenarios = scenariosRes?.data ?? scenariosRes ?? [];

        setBaseProfile(profile);

        setForm({
          language_score: profile.language_score ?? 8,
          experience_years: profile.experience_years ?? 5,
          has_job_offer: profile.has_job_offer ?? false,
          has_canadian_experience: profile.has_canadian_experience ?? false,
          studied_in_canada: profile.studied_in_canada ?? false,
        });

        setSavedScenarios(Array.isArray(scenarios) ? scenarios : []);
      } catch (err) {
        setMessage("Could not load profile values or saved scenarios.");
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfileAndScenarios();
  }, []);

  const presetScenarios = useMemo(() => {
    const currentLanguage = baseProfile?.language_score ?? 8;
    const currentExperience = baseProfile?.experience_years ?? 5;

    return [
      {
        label: `Improve language to ${Math.max(currentLanguage, 9)}`,
        values: {
          language_score: Math.max(currentLanguage, 9),
        },
      },
      {
        label: "Add 1 year experience",
        values: {
          experience_years: currentExperience + 1,
        },
      },
      {
        label: "Add Canadian experience",
        values: {
          has_canadian_experience: true,
        },
      },
      {
        label: "Add study in Canada",
        values: {
          studied_in_canada: true,
        },
      },
      {
        label: "Add job offer",
        values: {
          has_job_offer: true,
        },
      },
    ];
  }, [baseProfile]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const buildSimulationResult = (profile, simulationValues) => {
    const currentLanguage = Number(profile?.language_score ?? 0);
    const currentExperience = Number(profile?.experience_years ?? 0);
    const currentJobOffer = Boolean(profile?.has_job_offer);
    const currentCanadianExp = Boolean(profile?.has_canadian_experience);
    const currentStudyCanada = Boolean(profile?.studied_in_canada);

    const newLanguage = Number(simulationValues.language_score ?? currentLanguage);
    const newExperience = Number(
      simulationValues.experience_years ?? currentExperience
    );
    const newJobOffer = Boolean(simulationValues.has_job_offer);
    const newCanadianExp = Boolean(simulationValues.has_canadian_experience);
    const newStudyCanada = Boolean(simulationValues.studied_in_canada);

    const calculateCrs = (
      language,
      experience,
      jobOffer,
      canadianExp,
      studyCanada
    ) => {
      let score = 0;
      score += language * 20;
      score += experience * 15;
      if (jobOffer) score += 50;
      if (canadianExp) score += 40;
      if (studyCanada) score += 30;
      return score;
    };

    const currentCrs = calculateCrs(
      currentLanguage,
      currentExperience,
      currentJobOffer,
      currentCanadianExp,
      currentStudyCanada
    );

    const simulatedCrs = calculateCrs(
      newLanguage,
      newExperience,
      newJobOffer,
      newCanadianExp,
      newStudyCanada
    );

    const currentPathways = [];
    const simulatedPathways = [];

    if (currentCrs >= 470) currentPathways.push("Express Entry");
    if (currentCanadianExp) currentPathways.push("Canadian Experience Class");
    if (currentJobOffer) currentPathways.push("Provincial Nominee Program");
    if (currentStudyCanada) currentPathways.push("Graduate Pathway");

    if (simulatedCrs >= 470) simulatedPathways.push("Express Entry");
    if (newCanadianExp) simulatedPathways.push("Canadian Experience Class");
    if (newJobOffer) simulatedPathways.push("Provincial Nominee Program");
    if (newStudyCanada) simulatedPathways.push("Graduate Pathway");

    const unlockedPathways = simulatedPathways.filter(
      (pathway) => !currentPathways.includes(pathway)
    );
    const lostPathways = currentPathways.filter(
      (pathway) => !simulatedPathways.includes(pathway)
    );

    const strengths = [];
    const weaknesses = [];
    const nextSteps = [];

    if (newLanguage >= 9) {
      strengths.push("High language score improves competitiveness.");
    } else {
      weaknesses.push("Language score still has room for improvement.");
      nextSteps.push("Consider improving language test results.");
    }

    if (newExperience >= 3) {
      strengths.push("Solid work experience supports multiple pathways.");
    }

    if (newJobOffer) {
      strengths.push("A job offer can improve eligibility and CRS score.");
    } else {
      weaknesses.push("No job offer currently limits some pathway options.");
      nextSteps.push("Explore employer-supported opportunities.");
    }

    if (newCanadianExp) {
      strengths.push("Canadian work experience strengthens the profile.");
    } else {
      weaknesses.push("No Canadian experience reduces eligibility strength.");
      nextSteps.push("Consider options that build Canadian experience.");
    }

    if (!newStudyCanada) {
      nextSteps.push("Canadian study may unlock additional pathways.");
    }

    if (simulatedCrs >= 470) {
      nextSteps.push("Profile appears competitive for Express Entry.");
    } else {
      nextSteps.push("Focus on factors that increase CRS score further.");
    }

    return {
      current_profile: {
        age: profile?.age ?? null,
        education: profile?.education ?? null,
        language_score: currentLanguage,
        experience_years: currentExperience,
        has_job_offer: currentJobOffer,
        has_canadian_experience: currentCanadianExp,
        studied_in_canada: currentStudyCanada,
        occupation: profile?.occupation ?? null,
        noc_code: profile?.noc_code ?? null,
        preferred_province: profile?.preferred_province ?? null,
      },
      simulated_changes: {
        language_score: newLanguage,
        experience_years: newExperience,
        has_job_offer: newJobOffer,
        has_canadian_experience: newCanadianExp,
        studied_in_canada: newStudyCanada,
      },
      crs_comparison: {
        current_crs_score: currentCrs,
        simulated_crs_score: simulatedCrs,
        difference: simulatedCrs - currentCrs,
      },
      pathway_comparison: {
        current_eligible_pathways: currentPathways,
        simulated_eligible_pathways: simulatedPathways,
        newly_unlocked_pathways: unlockedPathways,
        no_longer_eligible_pathways: lostPathways,
      },
      simulated_result: {
        strengths,
        weaknesses,
        next_steps: nextSteps,
      },
    };
  };

  const runSimulation = async (simulationValues) => {
    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const payload = {
        ...simulationValues,
        language_score: Number(simulationValues.language_score),
        experience_years: Number(simulationValues.experience_years),
      };

      const computedResult = buildSimulationResult(baseProfile || {}, payload);
      setResult(computedResult);
    } catch (err) {
      setMessage(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          err.message ||
          "Failed to run simulation."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async (e) => {
    e.preventDefault();
    await runSimulation(form);
  };

  const applyPresetToForm = (presetValues) => {
    setForm((prev) => ({
      ...prev,
      ...presetValues,
    }));
    setMessage("");
  };

  const runPresetNow = async (presetValues) => {
    const updatedForm = {
      ...form,
      ...presetValues,
    };

    setForm(updatedForm);
    await runSimulation(updatedForm);
  };

  const resetSimulation = () => {
    setForm({
      language_score: baseProfile?.language_score ?? 8,
      experience_years: baseProfile?.experience_years ?? 5,
      has_job_offer: baseProfile?.has_job_offer ?? false,
      has_canadian_experience: baseProfile?.has_canadian_experience ?? false,
      studied_in_canada: baseProfile?.studied_in_canada ?? false,
    });
    setResult(null);
    setMessage("");
  };

  const saveScenario = async () => {
    if (!result) return;

    try {
      const payload = {
        label: `Scenario ${savedScenarios.length + 1}`,
        language_score: Number(form.language_score),
        experience_years: Number(form.experience_years),
        has_job_offer: form.has_job_offer,
        has_canadian_experience: form.has_canadian_experience,
        studied_in_canada: form.studied_in_canada,
        current_crs: result?.crs_comparison?.current_crs_score ?? null,
        simulated_crs: result?.crs_comparison?.simulated_crs_score ?? null,
        difference: result?.crs_comparison?.difference ?? null,
        pathways:
          result?.pathway_comparison?.simulated_eligible_pathways || [],
        result,
      };

      const savedRes = await saveSimulationScenario(payload);
      const saved = savedRes?.data ?? savedRes;

      setSavedScenarios((prev) => [saved, ...prev]);
      setMessage("");
    } catch (err) {
      setMessage(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Failed to save scenario."
      );
    }
  };

  const loadSavedScenario = (scenario) => {
    const scenarioValues = scenario?.simulated_changes
      ? {
          language_score: scenario.simulated_changes.language_score ?? 8,
          experience_years: scenario.simulated_changes.experience_years ?? 5,
          has_job_offer: scenario.simulated_changes.has_job_offer ?? false,
          has_canadian_experience:
            scenario.simulated_changes.has_canadian_experience ?? false,
          studied_in_canada:
            scenario.simulated_changes.studied_in_canada ?? false,
        }
      : {
          language_score: scenario.language_score ?? 8,
          experience_years: scenario.experience_years ?? 5,
          has_job_offer: scenario.has_job_offer ?? false,
          has_canadian_experience: scenario.has_canadian_experience ?? false,
          studied_in_canada: scenario.studied_in_canada ?? false,
        };

    setForm(scenarioValues);

    if (scenario.result_payload) {
      setResult({
        current_profile: scenario.current_profile_snapshot ?? {},
        simulated_changes: scenario.simulated_changes ?? {},
        ...(scenario.result_payload || {}),
      });
    } else if (scenario.result) {
      setResult(scenario.result);
    } else {
      setResult(null);
    }

    setMessage("");
  };

  const handleDeleteSavedScenario = async (id) => {
    try {
      await deleteSimulationScenario(id);
      setSavedScenarios((prev) => prev.filter((item) => item.id !== id));
      setSelectedScenarioIds((prev) => prev.filter((item) => item !== id));
      setMessage("");
    } catch (err) {
      setMessage(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Failed to delete scenario."
      );
    }
  };

  const toggleScenarioSelection = (id) => {
    setSelectedScenarioIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }

      if (prev.length >= 3) {
        return prev;
      }

      return [...prev, id];
    });
  };

  const clearScenarioSelection = () => {
    setSelectedScenarioIds([]);
  };

  const selectedScenarios = savedScenarios.filter((scenario) =>
    selectedScenarioIds.includes(scenario.id)
  );

  const getScenarioSimulatedCrs = (scenario) =>
    scenario?.simulated_crs ??
    scenario?.result_payload?.crs_comparison?.simulated_crs_score ??
    scenario?.result?.crs_comparison?.simulated_crs_score ??
    -Infinity;

  const getScenarioPathwayCount = (scenario) =>
    scenario?.pathways?.length ??
    scenario?.result_payload?.pathway_comparison?.simulated_eligible_pathways
      ?.length ??
    scenario?.result?.pathway_comparison?.simulated_eligible_pathways?.length ??
    0;

  const bestScenarioId =
    selectedScenarios.length > 0
      ? selectedScenarios.reduce((bestId, currentScenario) => {
          const bestScenario = selectedScenarios.find(
            (scenario) => scenario.id === bestId
          );

          if (!bestScenario) return currentScenario.id;

          return getScenarioSimulatedCrs(currentScenario) >
            getScenarioSimulatedCrs(bestScenario)
            ? currentScenario.id
            : bestId;
        }, selectedScenarios[0].id)
      : null;

  const mostPathwaysScenarioId =
    selectedScenarios.length > 0
      ? selectedScenarios.reduce((bestId, currentScenario) => {
          const bestScenario = selectedScenarios.find(
            (scenario) => scenario.id === bestId
          );

          return getScenarioPathwayCount(currentScenario) >
            getScenarioPathwayCount(bestScenario)
            ? currentScenario.id
            : bestId;
        }, selectedScenarios[0].id)
      : null;

  const currentCrs = result?.crs_comparison?.current_crs_score ?? null;
  const newCrs = result?.crs_comparison?.simulated_crs_score ?? null;
  const improvement = result?.crs_comparison?.difference ?? null;

  const improvementClass =
    typeof improvement === "number"
      ? improvement >= 0
        ? "text-green-600"
        : "text-red-600"
      : "text-blue-600";

  const currentPathways =
    result?.pathway_comparison?.current_eligible_pathways || [];
  const simulatedPathways =
    result?.pathway_comparison?.simulated_eligible_pathways || [];
  const unlockedPathways =
    result?.pathway_comparison?.newly_unlocked_pathways || [];
  const lostPathways =
    result?.pathway_comparison?.no_longer_eligible_pathways || [];
  const strengths = result?.simulated_result?.strengths || [];
  const weaknesses = result?.simulated_result?.weaknesses || [];
  const nextSteps = result?.simulated_result?.next_steps || [];

  if (profileLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <p className="text-slate-600">Loading simulation tools...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-slate-900">
            Simulation Panel
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Test profile improvements and see how they could affect your CRS
            score.
          </p>
        </div>

        <div className="mb-6">
          <h4 className="mb-3 text-sm font-semibold text-slate-800">
            Quick Scenarios
          </h4>

          <div className="grid gap-3">
            {presetScenarios.map((preset, index) => (
              <div
                key={index}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">{preset.label}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => applyPresetToForm(preset.values)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Apply to Form
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => runPresetNow(preset.values)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Run Now
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              disabled={loading}
              onClick={resetSimulation}
              className="mt-1 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset
            </button>
          </div>
        </div>

        <form onSubmit={handleSimulate} className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Language Score
              </label>
              <input
                name="language_score"
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={form.language_score}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Years of Experience
              </label>
              <input
                name="experience_years"
                type="number"
                min="0"
                max="50"
                value={form.experience_years}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-800">
              Test additional factors
            </h4>

            <div className="grid gap-3">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-slate-700">
                <input
                  type="checkbox"
                  name="has_job_offer"
                  checked={form.has_job_offer}
                  onChange={handleChange}
                  className="h-4 w-4"
                />
                <span>Has job offer</span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-slate-700">
                <input
                  type="checkbox"
                  name="has_canadian_experience"
                  checked={form.has_canadian_experience}
                  onChange={handleChange}
                  className="h-4 w-4"
                />
                <span>Has Canadian experience</span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-slate-700">
                <input
                  type="checkbox"
                  name="studied_in_canada"
                  checked={form.studied_in_canada}
                  onChange={handleChange}
                  className="h-4 w-4"
                />
                <span>Studied in Canada</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Running Simulation..." : "Run Custom Simulation"}
          </button>

          {message && <p className="text-sm text-red-600">{message}</p>}
        </form>

        {result && (
          <div className="mt-6 space-y-6 border-t border-slate-200 pt-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h4 className="text-lg font-semibold text-slate-900">
                Simulation Result
              </h4>

              <button
                type="button"
                onClick={saveScenario}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Save This Scenario
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">
                  Current CRS
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {currentCrs ?? "--"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">
                  Simulated CRS
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {newCrs ?? "--"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-500">Change</p>
                <p className={`mt-2 text-3xl font-bold ${improvementClass}`}>
                  {typeof improvement === "number"
                    ? `${improvement >= 0 ? "+" : ""}${improvement}`
                    : "--"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h5 className="text-base font-semibold text-slate-900">
                  Pathway Comparison
                </h5>

                <div className="mt-4 space-y-4">
                  <InfoList
                    title="Current Eligible Pathways"
                    items={currentPathways}
                    emptyText="None"
                  />
                  <InfoList
                    title="Simulated Eligible Pathways"
                    items={simulatedPathways}
                    emptyText="None"
                  />
                  <InfoList
                    title="Newly Unlocked"
                    items={unlockedPathways}
                    emptyText="None"
                  />
                  <InfoList
                    title="No Longer Eligible"
                    items={lostPathways}
                    emptyText="None"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-base font-semibold text-slate-900">
                    Strengths
                  </h5>
                  <SimpleList
                    items={strengths}
                    emptyText="No strengths listed."
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-base font-semibold text-slate-900">
                    Weaknesses
                  </h5>
                  <SimpleList
                    items={weaknesses}
                    emptyText="No weaknesses listed."
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h5 className="text-base font-semibold text-slate-900">
                    Suggested Next Steps
                  </h5>
                  <SimpleList
                    items={nextSteps}
                    emptyText="No next steps listed."
                  />
                </div>
              </div>
            </div>

            {result?.simulated_result?.advisor_summary && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h5 className="text-base font-semibold text-slate-900">
                  Simulation Summary
                </h5>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  {result.simulated_result.advisor_summary}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {savedScenarios.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Saved Scenarios
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Revisit and compare your saved simulation ideas.
              </p>
            </div>

            {selectedScenarioIds.length > 0 && (
              <button
                type="button"
                onClick={clearScenarioSelection}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Clear Selection
              </button>
            )}
          </div>

          <div className="mt-5 space-y-3">
            {savedScenarios.map((scenario) => {
              const isSelected = selectedScenarioIds.includes(scenario.id);

              const scenarioLabel = scenario.label || scenario.name || "Saved Scenario";
              const scenarioCurrentCrs =
                scenario.current_crs ??
                scenario.result_payload?.crs_comparison?.current_crs_score ??
                scenario.result?.crs_comparison?.current_crs_score ??
                "--";
              const scenarioSimulatedCrs =
                scenario.simulated_crs ??
                scenario.result_payload?.crs_comparison?.simulated_crs_score ??
                scenario.result?.crs_comparison?.simulated_crs_score ??
                "--";
              const scenarioDifference =
                scenario.difference ??
                scenario.result_payload?.crs_comparison?.difference ??
                scenario.result?.crs_comparison?.difference;
              const scenarioPathways =
                scenario.pathways ||
                scenario.result_payload?.pathway_comparison
                  ?.simulated_eligible_pathways ||
                scenario.result?.pathway_comparison?.simulated_eligible_pathways ||
                [];

              return (
                <div
                  key={scenario.id}
                  className={`flex flex-col gap-4 rounded-xl border p-4 md:flex-row md:items-center md:justify-between ${
                    isSelected
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleScenarioSelection(scenario.id)}
                      className="mt-1 h-4 w-4"
                    />

                    <div>
                      <p className="font-medium text-slate-900">
                        {scenarioLabel}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        CRS: {scenarioCurrentCrs} → {scenarioSimulatedCrs} (
                        {typeof scenarioDifference === "number"
                          ? `${scenarioDifference >= 0 ? "+" : ""}${scenarioDifference}`
                          : "--"}
                        )
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {scenarioPathways?.length > 0
                          ? scenarioPathways.join(", ")
                          : "No pathways listed"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => loadSavedScenario(scenario)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Load
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSavedScenario(scenario.id)}
                      className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedScenarios.length >= 2 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Scenario Comparison Dashboard
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Compare up to three saved scenarios side by side.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {bestScenarioId && (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Best CRS highlighted
                </span>
              )}
              {mostPathwaysScenarioId && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  Most pathways highlighted
                </span>
              )}
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {selectedScenarios.map((scenario) => {
              const isBestCrs = scenario.id === bestScenarioId;
              const hasMostPathways = scenario.id === mostPathwaysScenarioId;

              const scenarioResultPayload =
                scenario.result_payload || scenario.result || {};
              const scenarioStrengths =
                scenarioResultPayload?.simulated_result?.strengths || [];
              const scenarioWeaknesses =
                scenarioResultPayload?.simulated_result?.weaknesses || [];
              const scenarioNextSteps =
                scenarioResultPayload?.simulated_result?.next_steps || [];
              const scenarioPathways =
                scenario.pathways ||
                scenarioResultPayload?.pathway_comparison
                  ?.simulated_eligible_pathways ||
                [];

              const scenarioLabel = scenario.label || scenario.name || "Saved Scenario";
              const scenarioSimulatedCrs =
                scenario.simulated_crs ??
                scenarioResultPayload?.crs_comparison?.simulated_crs_score ??
                "--";
              const scenarioDifference =
                scenario.difference ??
                scenarioResultPayload?.crs_comparison?.difference;
              const scenarioChanges = scenario.simulated_changes || {};

              return (
                <div
                  key={scenario.id}
                  className={`rounded-2xl border p-5 ${
                    isBestCrs
                      ? "border-green-300 bg-green-50"
                      : hasMostPathways
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">
                        {scenarioLabel}
                      </h4>
                      <p className="mt-1 text-sm text-slate-500">
                        Saved comparison scenario
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      {isBestCrs && (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                          Best CRS
                        </span>
                      )}
                      {hasMostPathways && (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                          Most Pathways
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <MetricCard
                      label="Simulated CRS"
                      value={scenarioSimulatedCrs}
                    />
                    <MetricCard
                      label="Change"
                      value={
                        typeof scenarioDifference === "number"
                          ? `${scenarioDifference >= 0 ? "+" : ""}${scenarioDifference}`
                          : "--"
                      }
                      valueClass={
                        typeof scenarioDifference === "number"
                          ? scenarioDifference >= 0
                            ? "text-green-600"
                            : "text-red-600"
                          : "text-slate-900"
                      }
                    />
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Profile Factors
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Tag
                          label={`Language ${
                            scenarioChanges.language_score ??
                            scenario.language_score ??
                            "--"
                          }`}
                        />
                        <Tag
                          label={`${
                            scenarioChanges.experience_years ??
                            scenario.experience_years ??
                            "--"
                          } yrs exp`}
                        />
                        <Tag
                          label={
                            (scenarioChanges.has_job_offer ??
                              scenario.has_job_offer)
                              ? "Job Offer"
                              : "No Job Offer"
                          }
                        />
                        <Tag
                          label={
                            (scenarioChanges.has_canadian_experience ??
                              scenario.has_canadian_experience)
                              ? "Canadian Exp"
                              : "No Canadian Exp"
                          }
                        />
                        <Tag
                          label={
                            (scenarioChanges.studied_in_canada ??
                              scenario.studied_in_canada)
                              ? "Studied in Canada"
                              : "No Canadian Study"
                          }
                        />
                      </div>
                    </div>

                    <InfoList
                      title="Eligible Pathways"
                      items={scenarioPathways}
                      emptyText="No pathways listed"
                    />

                    <InfoList
                      title="Strengths"
                      items={scenarioStrengths}
                      emptyText="No strengths listed"
                    />

                    <InfoList
                      title="Weaknesses"
                      items={scenarioWeaknesses}
                      emptyText="No weaknesses listed"
                    />

                    <InfoList
                      title="Next Steps"
                      items={scenarioNextSteps}
                      emptyText="No next steps listed"
                    />

                    {scenarioResultPayload?.simulated_result?.advisor_summary && (
                      <div>
                        <p className="text-sm font-medium text-slate-500">
                          Summary
                        </p>
                        <p className="mt-2 rounded-lg bg-white px-3 py-3 text-sm leading-6 text-slate-700">
                          {scenarioResultPayload.simulated_result.advisor_summary}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="text-base font-semibold text-slate-900">
              Comparison Insight
            </h4>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {buildComparisonSummary(
                selectedScenarios,
                bestScenarioId,
                mostPathwaysScenarioId
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, valueClass = "text-slate-900" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function Tag({ label }) {
  return (
    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
      {label}
    </span>
  );
}

function SimpleList({ items, emptyText }) {
  return (
    <ul className="mt-3 space-y-2 text-sm text-slate-700">
      {items.length > 0 ? (
        items.map((item, index) => (
          <li key={index} className="rounded-lg bg-white px-3 py-2">
            {item}
          </li>
        ))
      ) : (
        <li className="text-slate-500">{emptyText}</li>
      )}
    </ul>
  );
}

function InfoList({ title, items, emptyText }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <ul className="mt-2 space-y-2 text-sm text-slate-700">
        {items.length > 0 ? (
          items.map((item, index) => (
            <li key={index} className="rounded-lg bg-white px-3 py-2">
              {item}
            </li>
          ))
        ) : (
          <li className="text-slate-500">{emptyText}</li>
        )}
      </ul>
    </div>
  );
}

function buildComparisonSummary(
  selectedScenarios,
  bestScenarioId,
  mostPathwaysScenarioId
) {
  if (selectedScenarios.length < 2) {
    return "Select at least two saved scenarios to compare them side by side.";
  }

  const bestScenario = selectedScenarios.find(
    (scenario) => scenario.id === bestScenarioId
  );
  const pathwayScenario = selectedScenarios.find(
    (scenario) => scenario.id === mostPathwaysScenarioId
  );

  const bestScenarioLabel =
    bestScenario?.label || bestScenario?.name || "This scenario";
  const pathwayScenarioLabel =
    pathwayScenario?.label || pathwayScenario?.name || "This scenario";

  const bestScenarioScore =
    bestScenario?.simulated_crs ??
    bestScenario?.result_payload?.crs_comparison?.simulated_crs_score ??
    bestScenario?.result?.crs_comparison?.simulated_crs_score ??
    "--";

  const pathwayCount =
    pathwayScenario?.pathways?.length ??
    pathwayScenario?.result_payload?.pathway_comparison
      ?.simulated_eligible_pathways?.length ??
    pathwayScenario?.result?.pathway_comparison?.simulated_eligible_pathways
      ?.length ??
    0;

  const bestText = bestScenario
    ? `${bestScenarioLabel} has the highest simulated CRS score at ${bestScenarioScore}.`
    : "";

  const pathwayText =
    pathwayScenario && pathwayScenario.id !== bestScenario?.id
      ? ` ${pathwayScenarioLabel} offers the widest pathway coverage with ${pathwayCount} listed pathway${
          pathwayCount === 1 ? "" : "s"
        }.`
      : pathwayScenario
      ? ` It also leads in pathway coverage with ${pathwayCount} listed pathway${
          pathwayCount === 1 ? "" : "s"
        }.`
      : "";

  return `${bestText}${pathwayText} Use this view to decide whether your best option is maximizing CRS, unlocking more pathways, or balancing both.`;
}