import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import UpgradePrompt from "../components/UpgradePrompt";
import {
  getBillingAccess,
  getMyProfile,
  getToken,
} from "../api";

const defaultProfile = {
  age: 30,
  education: "master",
  language_score: 8,
  experience_years: 5,
  has_job_offer: false,
  has_canadian_experience: false,
  studied_in_canada: false,
  occupation: "",
  noc_code: "",
  preferred_province: "",
};

function estimateScore(profile) {
  if (!profile) return 0;

  let score = 0;

  const age = Number(profile.age || 0);
  const language = Number(profile.language_score || 0);
  const exp = Number(profile.experience_years || 0);

  if (age >= 18 && age <= 29) score += 110;
  else if (age <= 35) score += 95;
  else if (age <= 40) score += 75;
  else if (age <= 45) score += 45;
  else score += 15;

  const educationMap = {
    "high school": 30,
    diploma: 65,
    bachelor: 100,
    master: 126,
    phd: 140,
  };
  score += educationMap[profile.education] || 0;

  score += Math.min(language * 16, 160);

  if (exp >= 5) score += 80;
  else if (exp === 4) score += 72;
  else if (exp === 3) score += 64;
  else if (exp === 2) score += 50;
  else if (exp === 1) score += 35;

  if (profile.has_job_offer) score += 50;
  if (profile.has_canadian_experience) score += 45;
  if (profile.studied_in_canada) score += 30;

  return Math.round(score);
}

function buildScenarioOptions(baseProfile) {
  if (!baseProfile) return [];

  const currentScore = estimateScore(baseProfile);
  const scenarios = [];

  const pushScenario = (id, title, description, patch) => {
    const updated = { ...baseProfile, ...patch };
    const projectedScore = estimateScore(updated);
    const delta = projectedScore - currentScore;

    scenarios.push({
      id,
      title,
      description,
      patch,
      projectedScore,
      delta,
    });
  };

  const nextLanguage = Math.min(Number(baseProfile.language_score || 0) + 1, 10);
  if (nextLanguage > Number(baseProfile.language_score || 0)) {
    pushScenario(
      "language_plus_1",
      "Improve language score by +1",
      "Model the impact of stronger language test results.",
      { language_score: nextLanguage }
    );
  }

  const nextExperience = Math.min(Number(baseProfile.experience_years || 0) + 1, 10);
  if (nextExperience > Number(baseProfile.experience_years || 0)) {
    pushScenario(
      "experience_plus_1",
      "Add 1 year of work experience",
      "Estimate the gain from additional qualifying experience.",
      { experience_years: nextExperience }
    );
  }

  if (!baseProfile.has_job_offer) {
    pushScenario(
      "job_offer",
      "Add a valid job offer",
      "See the impact of securing an eligible job offer.",
      { has_job_offer: true }
    );
  }

  if (!baseProfile.has_canadian_experience) {
    pushScenario(
      "canadian_experience",
      "Add Canadian experience",
      "Model the effect of qualifying Canadian work experience.",
      { has_canadian_experience: true }
    );
  }

  if (!baseProfile.studied_in_canada) {
    pushScenario(
      "canadian_study",
      "Add Canadian study history",
      "See how study in Canada can strengthen the profile.",
      { studied_in_canada: true }
    );
  }

  const educationOrder = ["high school", "diploma", "bachelor", "master", "phd"];
  const currentEduIndex = educationOrder.indexOf(baseProfile.education);
  if (currentEduIndex >= 0 && currentEduIndex < educationOrder.length - 1) {
    const nextEducation = educationOrder[currentEduIndex + 1];
    pushScenario(
      "education_upgrade",
      `Upgrade education to ${nextEducation}`,
      "Estimate the impact of a stronger education credential.",
      { education: nextEducation }
    );
  }

  return scenarios
    .filter((item) => item.delta > 0)
    .sort((a, b) => b.delta - a.delta);
}

function formatBool(value) {
  return value ? "Yes" : "No";
}

export default function StrategySimulatorPage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(defaultProfile);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedScenarioId, setSelectedScenarioId] = useState(null);

  useEffect(() => {
    async function load() {
      const token = getToken();
      if (!token) {
        navigate("/auth");
        return;
      }

      try {
        setLoading(true);
        setMessage("");

        const [profileRes, accessRes] = await Promise.allSettled([
          getMyProfile(),
          getBillingAccess(),
        ]);

        if (profileRes.status === "fulfilled") {
          setProfile({
            ...defaultProfile,
            ...(profileRes.value?.data || {}),
          });
        } else {
          setMessage(
            profileRes.reason?.response?.data?.detail ||
              "Unable to load your profile for simulation."
          );
        }

        if (accessRes.status === "fulfilled") {
          setAccess(accessRes.value?.data || null);
        } else {
          setAccess(null);
        }
      } catch (err) {
        console.error(err);
        setMessage("Unable to load the simulator.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [navigate]);

  const hasSimulatorAccess = Boolean(
    access?.is_pro || access?.is_premium || access?.features?.decision_engine
  );

  const currentScore = useMemo(() => estimateScore(profile), [profile]);

  const scenarios = useMemo(() => buildScenarioOptions(profile), [profile]);

  const selectedScenario = useMemo(() => {
    return scenarios.find((item) => item.id === selectedScenarioId) || null;
  }, [scenarios, selectedScenarioId]);

  const projectedProfile = useMemo(() => {
    if (!selectedScenario) return profile;
    return { ...profile, ...selectedScenario.patch };
  }, [profile, selectedScenario]);

  const bestScenario = scenarios[0] || null;

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <p className="text-lg">Loading simulator...</p>
        </div>
      </Layout>
    );
  }

  if (!hasSimulatorAccess) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="max-w-3xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              NorthBridgeAI
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
              Strategy Simulator
            </h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Test improvement scenarios and see which changes are most likely to
              move your score.
            </p>
          </div>

          <Card variant="premium" padding="lg">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Your simulator preview
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Current score
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-blue-900">
                  {currentScore}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Best visible gain
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-blue-900">
                  {bestScenario ? `+${bestScenario.delta}` : "--"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Best projected score
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-blue-900">
                  {bestScenario ? bestScenario.projectedScore : "--"}
                </p>
              </div>
            </div>
          </Card>

          <UpgradePrompt
            title="Unlock the Strategy Simulator"
            body="Upgrade to Pro or Premium to test score scenarios, compare outcomes, and identify the highest-ROI improvement path."
            buttonLabel="View pricing"
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {message && (
          <div className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            NorthBridgeAI
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Strategy Simulator
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Compare likely score scenarios and identify the strongest improvement
            opportunity before you act.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card padding="lg">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              Current score
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-blue-900">
              {currentScore}
            </p>
          </Card>

          <Card padding="lg">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              Best improvement
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-blue-900">
              {bestScenario ? `+${bestScenario.delta}` : "--"}
            </p>
          </Card>

          <Card padding="lg">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              Best projected score
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-blue-900">
              {bestScenario ? bestScenario.projectedScore : "--"}
            </p>
          </Card>

          <Card padding="lg">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              Best ROI move
            </p>
            <p className="mt-2 text-base font-semibold tracking-tight text-slate-900">
              {bestScenario ? bestScenario.title : "No suggestion yet"}
            </p>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <Card padding="lg">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Improvement scenarios
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Select a scenario to compare its likely impact.
              </p>

              <div className="mt-5 space-y-3">
                {scenarios.length > 0 ? (
                  scenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => setSelectedScenarioId(scenario.id)}
                      className={`block w-full rounded-2xl border px-4 py-4 text-left transition ${
                        selectedScenarioId === scenario.id
                          ? "border-blue-300 bg-blue-50"
                          : "border-slate-200 bg-slate-50/70 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {scenario.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {scenario.description}
                          </p>
                        </div>

                        <div className="shrink-0 rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-semibold text-blue-700">
                          +{scenario.delta}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    Your profile already reflects the strongest visible baseline,
                    or more profile detail is needed to simulate meaningful gains.
                  </p>
                )}
              </div>
            </Card>

            <Card padding="lg">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Current profile inputs
              </h2>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                  Age: <span className="font-semibold text-slate-900">{profile.age}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                  Education: <span className="font-semibold text-slate-900">{profile.education}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                  Language score: <span className="font-semibold text-slate-900">{profile.language_score}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                  Experience years: <span className="font-semibold text-slate-900">{profile.experience_years}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                  Job offer: <span className="font-semibold text-slate-900">{formatBool(profile.has_job_offer)}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                  Canadian experience: <span className="font-semibold text-slate-900">{formatBool(profile.has_canadian_experience)}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                  Studied in Canada: <span className="font-semibold text-slate-900">{formatBool(profile.studied_in_canada)}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
                  Preferred province: <span className="font-semibold text-slate-900">{profile.preferred_province || "--"}</span>
                </div>
              </div>

              <div className="mt-5">
                <Button variant="secondary" onClick={() => navigate("/profile")}>
                  Update profile inputs
                </Button>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card variant="premium" padding="lg">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Scenario comparison
              </h2>

              {selectedScenario ? (
                <>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                        Current
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                        {currentScore}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-blue-700">
                        Projected
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-blue-900">
                        {selectedScenario.projectedScore}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-emerald-700">
                        Gain
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-800">
                        +{selectedScenario.delta}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <p className="text-sm font-semibold text-slate-900">
                      Selected scenario
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {selectedScenario.description}
                    </p>
                  </div>

                  <div className="mt-5">
                    <h3 className="text-lg font-semibold text-slate-900">
                      What changes in this simulation
                    </h3>

                    <div className="mt-4 grid gap-3">
                      {Object.entries(selectedScenario.patch).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                        >
                          <span className="font-semibold text-slate-900">{key}</span>
                          {" → "}
                          {String(value)}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button onClick={() => navigate("/profile")}>
                      Apply this improvement manually
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => navigate("/strategy")}
                    >
                      Return to strategy
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Select a scenario on the left to compare projected score impact.
                </p>
              )}
            </Card>

            <Card padding="lg">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Best ROI summary
              </h2>

              {bestScenario ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <p className="text-sm font-semibold text-amber-900">
                    Best improvement right now
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {bestScenario.title}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {bestScenario.description}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-amber-800">
                    Estimated gain: +{bestScenario.delta}
                  </p>

                  <div className="mt-4">
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedScenarioId(bestScenario.id)}
                    >
                      Compare this scenario
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  No strong improvement scenario is available yet.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}