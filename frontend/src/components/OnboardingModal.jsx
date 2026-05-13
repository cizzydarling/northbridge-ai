import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Input from "./ui/Input";
import {
  getToken,
  getCurrentUserLocal,
  getMyProfile,
  suggestNOC,
  updateMyProfile,
  refreshCurrentUser,
  runSelfWorkspace,
} from "../api";
import { getCountrySelectOptions } from "../utils/countries";

const DISMISS_KEY = "nbai_onboarding_modal_dismissed_until_v3";

const DEFAULT_FORM = {
  first_name: "",
  last_name: "",
  nationality: "",
  current_country: "",
  current_city: "",
  marital_status: "",
  preferred_language: "en",
  age: "",
  education: "",
  language_score: "",
  experience_years: "",
  occupation: "",
  noc_code: "",
  preferred_province: "",
};

const MARITAL_STATUSES = [
  { value: "single", en: "Single", fr: "Célibataire" },
  { value: "married", en: "Married", fr: "Marié(e)" },
  { value: "common_law", en: "Common-law", fr: "Union de fait" },
  { value: "divorced", en: "Divorced", fr: "Divorcé(e)" },
  { value: "widowed", en: "Widowed", fr: "Veuf / Veuve" },
];

const EDUCATION_LEVELS = [
  {
    value: "secondary",
    en: "Secondary / High school",
    fr: "Secondaire / Lycée",
  },
  {
    value: "one_year",
    en: "One-year post-secondary",
    fr: "Postsecondaire d’un an",
  },
  {
    value: "two_year",
    en: "Two-year post-secondary",
    fr: "Postsecondaire de deux ans",
  },
  {
    value: "bachelor",
    en: "Bachelor’s degree",
    fr: "Baccalauréat / Licence",
  },
  {
    value: "two_or_more",
    en: "Two or more credentials",
    fr: "Deux diplômes ou plus",
  },
  {
    value: "masters",
    en: "Master’s degree",
    fr: "Maîtrise / Master",
  },
  {
    value: "doctorate",
    en: "Doctorate",
    fr: "Doctorat",
  },
];

const PROVINCES = [
  "Ontario",
  "Quebec",
  "British Columbia",
  "Alberta",
  "Manitoba",
  "Saskatchewan",
  "Nova Scotia",
  "New Brunswick",
  "Prince Edward Island",
  "Newfoundland and Labrador",
];

function computeProfileCompletion(profile) {
  if (!profile) return 0;

  const fields = [
    profile.first_name,
    profile.last_name,
    profile.nationality,
    profile.current_country,
    profile.current_city,
    profile.marital_status,
    profile.preferred_language,
    profile.age,
    profile.education,
    profile.language_score,
    profile.experience_years,
    profile.occupation,
    profile.noc_code,
    profile.preferred_province,
  ];

  const completed = fields.filter((value) => {
    if (typeof value === "boolean") return true;
    if (typeof value === "number") return !Number.isNaN(value);
    return Boolean(String(value || "").trim());
  }).length;

  return Math.round((completed / fields.length) * 100);
}

function shouldSuppressModal() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() < Number(raw);
  } catch {
    return false;
  }
}

function suppressModalForHours(hours = 12) {
  const until = Date.now() + hours * 60 * 60 * 1000;
  localStorage.setItem(DISMISS_KEY, String(until));
}

function normalizeNumber(value) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function FieldGroup({ children }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function SelectField({ label, name, value, onChange, options, placeholder }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;

          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function normalizeNocMatches(data) {
  if (Array.isArray(data?.matches) && data.matches.length > 0) {
    return data.matches;
  }

  if (data?.suggested_noc || data?.suggested_title) {
    return [
      {
        noc: data.suggested_noc,
        title: data.suggested_title,
        teer: data.teer,
        confidence: data.confidence,
      },
      ...(Array.isArray(data?.alternatives) ? data.alternatives : []),
    ].filter((item) => item.noc || item.title);
  }

  if (Array.isArray(data?.alternatives)) {
    return data.alternatives;
  }

  return [];
}

function getNocCode(match) {
  return match?.noc || match?.noc_code || match?.code || "";
}

function getNocTitle(match) {
  return match?.title || match?.name || match?.occupation || "";
}

export default function OnboardingModal() {
  const location = useLocation();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [nocSuggestions, setNocSuggestions] = useState([]);
  const [nocLoading, setNocLoading] = useState(false);
  const [nocStatus, setNocStatus] = useState("");
  const nocRequestIdRef = useRef(0);
  const latestOccupationRef = useRef("");

  const currentUser = getCurrentUserLocal();

  const blockedRoutes = useMemo(
    () =>
      ["/auth", "/pricing"].some(
        (path) =>
          location.pathname === path || location.pathname.startsWith(path + "/")
      ),
    [location.pathname]
  );

  const translatedCountries = useMemo(
    () => getCountrySelectOptions(),
    []
  );

  const translatedEducation = useMemo(
    () =>
      EDUCATION_LEVELS.map((item) => ({
        value: item.value,
        label: language === "fr" ? item.fr : item.en,
      })),
    [language]
  );

  const translatedStatuses = useMemo(
    () =>
      MARITAL_STATUSES.map((item) => ({
        value: item.value,
        label: language === "fr" ? item.fr : item.en,
      })),
    [language]
  );

  const translatedProvinces = useMemo(
    () =>
      PROVINCES.map((province) => ({
        value: province,
        label: province,
      })),
    []
  );

  useEffect(() => {
    let mounted = true;

    async function checkProfile() {
      if (!getToken() || blockedRoutes) {
        if (mounted) {
          setOpen(false);
          setChecking(false);
        }
        return;
      }

      if (currentUser?.role === "agent" || currentUser?.role === "admin") {
        if (mounted) {
          setOpen(false);
          setChecking(false);
        }
        return;
      }

      if (shouldSuppressModal()) {
        if (mounted) {
          setOpen(false);
          setChecking(false);
        }
        return;
      }

      try {
        const res = await getMyProfile();
        const profile = res.data || {};

        if (!mounted) return;

        setForm({
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
          nationality: profile.nationality || "",
          current_country: profile.current_country || "",
          current_city: profile.current_city || "",
          marital_status: profile.marital_status || "",
          preferred_language: profile.preferred_language || language,
          age:
            profile.age === null || typeof profile.age === "undefined"
              ? ""
              : String(profile.age),
          education: profile.education || "",
          language_score:
            profile.language_score === null ||
            typeof profile.language_score === "undefined"
              ? ""
              : String(profile.language_score),
          experience_years:
            profile.experience_years === null ||
            typeof profile.experience_years === "undefined"
              ? ""
              : String(profile.experience_years),
          occupation: profile.occupation || "",
          noc_code: profile.noc_code || "",
          preferred_province: profile.preferred_province || "",
        });

        const completion = computeProfileCompletion(profile);

        setTimeout(() => {
          if (mounted) setOpen(completion < 65);
        }, 350);
      } catch (err) {
        if (!mounted) return;

        if (err?.response?.status === 404) {
          setTimeout(() => {
            if (mounted) setOpen(true);
          }, 350);
        } else {
          console.error(err);
          setOpen(false);
        }
      } finally {
        if (mounted) setChecking(false);
      }
    }

    checkProfile();

    return () => {
      mounted = false;
    };
  }, [blockedRoutes, currentUser?.role, language]);

  function handleChange(e) {
    const { name, value } = e.target;

    if (name === "occupation") {
      latestOccupationRef.current = value.trim();
      nocRequestIdRef.current += 1;
      setNocSuggestions([]);
      setNocStatus("");
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "occupation" ? { noc_code: "" } : {}),
    }));
  }

  const requestNocSuggestions = useCallback(async ({ quiet = false } = {}) => {
    const occupation = form.occupation.trim();

    if (!occupation) return;

    const requestId = nocRequestIdRef.current + 1;
    nocRequestIdRef.current = requestId;

    try {
      setNocLoading(true);
      if (!quiet) setNocStatus("");

      const res = await suggestNOC({
        occupation,
        top_k: 3,
      });

      const matches = normalizeNocMatches(res?.data);

      if (
        requestId !== nocRequestIdRef.current ||
        latestOccupationRef.current !== occupation
      ) {
        return;
      }

      setNocSuggestions(matches);
      setNocStatus(
        matches.length
          ? language === "fr"
            ? "Suggestions CNP pretes. Choisissez celle qui correspond le mieux."
            : "NOC suggestions ready. Choose the closest match."
          : language === "fr"
          ? "Aucune suggestion CNP trouvee pour cette profession."
          : "No NOC suggestion found for this occupation."
      );
    } catch (err) {
      console.error("Starter onboarding NOC suggestion failed:", err);
      if (
        requestId !== nocRequestIdRef.current ||
        latestOccupationRef.current !== occupation
      ) {
        return;
      }
      if (!quiet) {
        setNocStatus(
          language === "fr"
            ? "Impossible de suggerer un CNP pour le moment."
            : "Unable to suggest a NOC right now."
        );
      }
    } finally {
      if (requestId === nocRequestIdRef.current) {
        setNocLoading(false);
      }
    }
  }, [form.occupation, language]);

  function applyNocSuggestion(match) {
    const code = getNocCode(match);
    const title = getNocTitle(match);

    setForm((prev) => ({
      ...prev,
      noc_code: code || prev.noc_code,
      occupation: prev.occupation || title || "",
    }));
    setNocStatus(
      language === "fr" ? "CNP applique au profil." : "NOC applied to profile."
    );
  }

  useEffect(() => {
    latestOccupationRef.current = form.occupation.trim();
  }, [form.occupation]);

  useEffect(() => {
    if (step !== 3 || form.noc_code.trim()) return undefined;

    const occupation = form.occupation.trim();
    if (occupation.length < 3) {
      setNocSuggestions([]);
      setNocStatus("");
      return undefined;
    }

    const timer = window.setTimeout(() => {
      requestNocSuggestions({ quiet: true });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [step, form.occupation, form.noc_code, requestNocSuggestions]);

  function canGoStep2() {
    return Boolean(
      form.first_name.trim() &&
        form.last_name.trim() &&
        form.nationality &&
        form.current_country &&
        form.current_city.trim() &&
        form.marital_status
    );
  }

  function canGoStep3() {
    return Boolean(
      form.preferred_language &&
        form.age !== "" &&
        form.education &&
        form.language_score !== "" &&
        form.experience_years !== ""
    );
  }

  function canSubmit() {
    return Boolean(
      form.occupation.trim() &&
        form.noc_code.trim() &&
        form.preferred_province
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const payload = {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        nationality: form.nationality || null,
        current_country: form.current_country || null,
        current_city: form.current_city.trim() || null,
        marital_status: form.marital_status || null,
        preferred_language: form.preferred_language || language,
        age: normalizeNumber(form.age),
        education: form.education || null,
        language_score: normalizeNumber(form.language_score),
        experience_years: normalizeNumber(form.experience_years),
        occupation: form.occupation.trim() || null,
        noc_code: form.noc_code.trim() || null,
        preferred_province: form.preferred_province || null,
      };

      await updateMyProfile(payload);
      await refreshCurrentUser();

      const workspacePayload = {
        matter_type: "permanent_residence",
        intake: {
          ...payload,
          application_type: "pr_pathway",
        },
      };

      try {
        await runSelfWorkspace(workspacePayload, payload.preferred_language || language);
      } catch (strategyErr) {
        console.error("Strategy workspace run failed:", strategyErr);
      }

      localStorage.removeItem(DISMISS_KEY);

      window.dispatchEvent(new Event("userUpdated"));
      window.dispatchEvent(new Event("nbai-profile-completed"));
      window.dispatchEvent(new Event("nbai-strategy-refresh"));
      window.dispatchEvent(new Event("nbai-document-engine-updated"));

      setOpen(false);
      setMessage("");

      navigate("/strategy?source=onboarding&intent=execute&tab=overview");
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Impossible d’enregistrer l’onboarding."
            : "Unable to save onboarding.")
      );
    } finally {
      setLoading(false);
    }
  }

  function handleCloseForNow() {
    suppressModalForHours(12);
    setOpen(false);
  }

  if (checking || !open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-slate-950/45 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <Card className="max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_20px_80px_rgba(15,23,42,0.18)] sm:rounded-[32px]">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
            NorthBridgeAI
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {language === "fr"
              ? "Complétez votre profil de départ"
              : "Complete your starter profile"}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {language === "fr"
              ? "Quelques étapes suffisent pour débloquer automatiquement votre stratégie et votre tableau de bord."
              : "A few steps are enough to automatically unlock your strategy and dashboard."}
          </p>

          <div className="mt-4 flex gap-2">
            {[1, 2, 3].map((item) => (
              <span
                key={item}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  step === item
                    ? "bg-amber-50 text-amber-800"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {language === "fr" ? `Étape ${item}` : `Step ${item}`}
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={handleSave} className="px-4 py-5 sm:px-6 sm:py-6">
          {step === 1 && (
            <div className="space-y-4">
              <FieldGroup>
                <Input
                  name="first_name"
                  label={language === "fr" ? "Prénom" : "First name"}
                  value={form.first_name}
                  onChange={handleChange}
                  required
                />
                <Input
                  name="last_name"
                  label={language === "fr" ? "Nom" : "Last name"}
                  value={form.last_name}
                  onChange={handleChange}
                  required
                />
                <SelectField
                  name="nationality"
                  label={language === "fr" ? "Nationalité" : "Nationality"}
                  value={form.nationality}
                  onChange={handleChange}
                  options={translatedCountries}
                  placeholder={language === "fr" ? "Choisissez" : "Choose"}
                />
                <SelectField
                  name="current_country"
                  label={language === "fr" ? "Pays actuel" : "Current country"}
                  value={form.current_country}
                  onChange={handleChange}
                  options={translatedCountries}
                  placeholder={language === "fr" ? "Choisissez" : "Choose"}
                />
                <Input
                  name="current_city"
                  label={language === "fr" ? "Ville actuelle" : "Current city"}
                  value={form.current_city}
                  onChange={handleChange}
                  required
                />
                <SelectField
                  name="marital_status"
                  label={language === "fr" ? "Statut matrimonial" : "Marital status"}
                  value={form.marital_status}
                  onChange={handleChange}
                  options={translatedStatuses}
                  placeholder={language === "fr" ? "Choisissez" : "Choose"}
                />
              </FieldGroup>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <FieldGroup>
                <SelectField
                  name="preferred_language"
                  label={language === "fr" ? "Langue préférée" : "Preferred language"}
                  value={form.preferred_language}
                  onChange={handleChange}
                  options={[
                    { value: "en", label: "English" },
                    { value: "fr", label: "Français" },
                  ]}
                  placeholder={language === "fr" ? "Choisissez" : "Choose"}
                />
                <Input
                  name="age"
                  type="number"
                  label={language === "fr" ? "Âge" : "Age"}
                  value={form.age}
                  onChange={handleChange}
                  required
                />
                <SelectField
                  name="education"
                  label={language === "fr" ? "Niveau d’études" : "Education level"}
                  value={form.education}
                  onChange={handleChange}
                  options={translatedEducation}
                  placeholder={language === "fr" ? "Choisissez" : "Choose"}
                />
                <Input
                  name="language_score"
                  type="number"
                  label={language === "fr" ? "Score linguistique" : "Language score"}
                  value={form.language_score}
                  onChange={handleChange}
                  required
                />
                <Input
                  name="experience_years"
                  type="number"
                  label={
                    language === "fr"
                      ? "Années d’expérience"
                      : "Years of experience"
                  }
                  value={form.experience_years}
                  onChange={handleChange}
                  required
                />
              </FieldGroup>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <FieldGroup>
                <Input
                  name="occupation"
                  label={language === "fr" ? "Profession" : "Occupation"}
                  value={form.occupation}
                  onChange={handleChange}
                  required
                />
                <div className="space-y-2">
                  <Input
                    name="noc_code"
                    label={language === "fr" ? "Code CNP" : "NOC code"}
                    value={form.noc_code}
                    onChange={handleChange}
                    required
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => requestNocSuggestions()}
                    disabled={nocLoading || !form.occupation.trim()}
                    loading={nocLoading}
                  >
                    {language === "fr" ? "Suggérer un CNP" : "Suggest NOC"}
                  </Button>
                </div>
                <div className="md:col-span-2">
                  <SelectField
                    name="preferred_province"
                    label={language === "fr" ? "Province préférée" : "Preferred province"}
                    value={form.preferred_province}
                    onChange={handleChange}
                    options={translatedProvinces}
                    placeholder={
                      language === "fr"
                        ? "Choisissez une province"
                        : "Choose a province"
                    }
                  />
                </div>
              </FieldGroup>

              {(nocSuggestions.length > 0 || nocStatus) && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                    {language === "fr" ? "Suggestion CNP" : "NOC suggestion"}
                  </p>

                  {nocStatus ? (
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {nocStatus}
                    </p>
                  ) : null}

                  {nocSuggestions.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {nocSuggestions.slice(0, 3).map((match, index) => {
                        const code = getNocCode(match);
                        const title = getNocTitle(match);
                        const confidence =
                          typeof match?.confidence === "number"
                            ? `${Math.round(match.confidence * 100)}%`
                            : null;

                        return (
                          <button
                            key={`${code}-${title}-${index}`}
                            type="button"
                            onClick={() => applyNocSuggestion(match)}
                            className="rounded-xl border border-white bg-white px-3 py-3 text-left text-sm shadow-sm transition hover:border-amber-300 hover:bg-amber-50"
                          >
                            <span className="font-semibold text-slate-950">
                              {code || "--"}
                            </span>
                            {title ? (
                              <span className="text-slate-700"> - {title}</span>
                            ) : null}
                            {confidence ? (
                              <span className="ml-2 text-xs text-slate-500">
                                {confidence}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                {language === "fr"
                  ? "Une fois enregistré, NorthBridgeAI générera automatiquement votre stratégie puis vous redirigera vers la page stratégie."
                  : "Once saved, NorthBridgeAI will automatically generate your strategy and redirect you to the strategy page."}
              </div>
            </div>
          )}

          {message ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleCloseForNow}
              className="text-sm text-slate-500 transition hover:text-slate-800"
            >
              {language === "fr" ? "Continuer plus tard" : "Continue later"}
            </button>

            <div className="flex flex-wrap justify-end gap-3">
              {step > 1 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep((prev) => Math.max(1, prev - 1))}
                >
                  {language === "fr" ? "Retour" : "Back"}
                </Button>
              ) : null}

              {step === 1 ? (
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canGoStep2()}
                >
                  {language === "fr" ? "Suivant" : "Next"}
                </Button>
              ) : null}

              {step === 2 ? (
                <Button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!canGoStep3()}
                >
                  {language === "fr" ? "Suivant" : "Next"}
                </Button>
              ) : null}

              {step === 3 ? (
                <Button type="submit" disabled={loading || !canSubmit()}>
                  {loading
                    ? language === "fr"
                      ? "Génération..."
                      : "Generating..."
                    : language === "fr"
                    ? "Générer ma stratégie"
                    : "Generate my strategy"}
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
