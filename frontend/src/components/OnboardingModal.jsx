import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getToken,
  getCurrentUserLocal,
  getMyProfile,
  updateMyProfile,
  refreshCurrentUser,
} from "../api";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Card from "./ui/Card";

const DISMISS_KEY = "nbai_onboarding_modal_dismissed_until";

const DEFAULT_FORM = {
  first_name: "",
  last_name: "",
  preferred_language: "en",
  occupation: "",
  noc_code: "",
  preferred_province: "",
};

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

function isProfileComplete(profile) {
  if (!profile) return false;

  return Boolean(
    String(profile.first_name || "").trim() &&
      String(profile.occupation || "").trim() &&
      String(profile.noc_code || "").trim() &&
      String(profile.preferred_province || "").trim()
  );
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

export default function OnboardingModal() {
  const location = useLocation();
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);

  const currentUser = getCurrentUserLocal();

  const blockedRoutes = useMemo(
    () =>
      ["/auth", "/pricing"].some(
        (path) =>
          location.pathname === path || location.pathname.startsWith(path + "/")
      ),
    [location.pathname]
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
          preferred_language: profile.preferred_language || language,
          occupation: profile.occupation || "",
          noc_code: profile.noc_code || "",
          preferred_province: profile.preferred_province || "",
        });

        setTimeout(() => {
            setOpen(!isProfileComplete(profile));
        }, 500);
      } catch (err) {
        if (!mounted) return;

        if (err?.response?.status === 404) {
          setOpen(true);
          setForm((prev) => ({
            ...prev,
            preferred_language: language,
          }));
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
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const payload = {
        first_name: form.first_name?.trim() || null,
        last_name: form.last_name?.trim() || null,
        preferred_language: form.preferred_language || language,
        occupation: form.occupation?.trim() || null,
        noc_code: form.noc_code?.trim() || null,
        preferred_province: form.preferred_province || null,
      };

      await updateMyProfile(payload);
      await refreshCurrentUser();

      window.dispatchEvent(new Event("userUpdated"));
      localStorage.removeItem(DISMISS_KEY);

      setOpen(false);
      setMessage("");
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl rounded-[32px] border border-slate-200 bg-white p-0 shadow-[0_20px_80px_rgba(15,23,42,0.18)]">
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            NorthBridgeAI
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {language === "fr"
              ? "Complétez votre profil de départ"
              : "Complete your starter profile"}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {language === "fr"
              ? "Quelques informations suffisent pour débloquer une expérience plus guidée, une meilleure stratégie et des recommandations plus utiles."
              : "A few details unlock a more guided experience, a better strategy, and more useful recommendations."}
          </p>

          <div className="mt-4 flex gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                step === 1
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {language === "fr" ? "Étape 1" : "Step 1"}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                step === 2
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {language === "fr" ? "Étape 2" : "Step 2"}
            </span>
          </div>
        </div>

        <form onSubmit={handleSave} className="px-6 py-6">
          {step === 1 && (
            <div className="grid gap-4 md:grid-cols-2">
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
              />

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {language === "fr" ? "Langue préférée" : "Preferred language"}
                </label>
                <select
                  name="preferred_language"
                  value={form.preferred_language}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                name="occupation"
                label={language === "fr" ? "Profession" : "Occupation"}
                value={form.occupation}
                onChange={handleChange}
                required
              />

              <Input
                name="noc_code"
                label={language === "fr" ? "Code CNP" : "NOC code"}
                value={form.noc_code}
                onChange={handleChange}
                required
              />

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {language === "fr"
                    ? "Province préférée"
                    : "Preferred province"}
                </label>
                <select
                  name="preferred_province"
                  value={form.preferred_province}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                >
                  <option value="">
                    {language === "fr"
                      ? "Choisissez une province"
                      : "Select a province"}
                  </option>
                  {PROVINCES.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
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
              {language === "fr"
                ? "Continuer plus tard"
                : "Continue later"}
            </button>

            <div className="flex gap-3">
              {step === 2 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep(1)}
                >
                  {language === "fr" ? "Retour" : "Back"}
                </Button>
              ) : null}

              {step === 1 ? (
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!form.first_name?.trim()}
                >
                  {language === "fr" ? "Suivant" : "Next"}
                </Button>
              ) : (
                <Button type="submit" disabled={loading}>
                  {loading
                    ? language === "fr"
                      ? "Enregistrement..."
                      : "Saving..."
                    : language === "fr"
                    ? "Enregistrer et continuer"
                    : "Save and continue"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}