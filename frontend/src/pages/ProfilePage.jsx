import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import {
  createProfile,
  getMyProfile,
  updateMyProfile,
  logoutUser,
  getToken,
  refreshCurrentUser,
} from "../api";

import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import AICopilotCard from "../components/AICopilotCard";

const defaultForm = {
  first_name: "",
  last_name: "",
  nationality: "",
  current_country: "",
  current_city: "",
  phone_number: "",
  date_of_birth: "",
  marital_status: "",
  preferred_language: "en",

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

export default function ProfilePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = getToken();

      if (!token) {
        navigate("/auth");
        return;
      }

      try {
        const response = await getMyProfile();
        const data = response.data;

        setForm({
          ...defaultForm,
          ...data,
        });

        setProfileExists(true);
      } catch (err) {
        console.error(err);

        if (err.response?.status === 404) {
          setProfileExists(false);
        } else if (err.response?.status === 401) {
          logoutUser();
          navigate("/auth");
          return;
        } else {
          setMessage(
            language === "fr"
              ? "Impossible de charger le profil."
              : "Could not load profile."
          );
        }
      } finally {
        setPageLoading(false);
      }
    };

    fetchProfile();
  }, [navigate, language]);

  const pageText = useMemo(() => {
    if (language === "fr") {
      return {
        loading: "Chargement du profil...",
        title: "Votre profil",
        subtitle:
          "Complétez votre profil pour améliorer votre stratégie d’immigration et personnaliser votre expérience.",
        personalInfo: "Informations personnelles",
        immigrationProfile: "Profil d’immigration",
        firstName: "Prénom",
        lastName: "Nom",
        nationality: "Nationalité",
        country: "Pays",
        city: "Ville",
        phone: "Téléphone",
        dateOfBirth: "Date de naissance",
        maritalStatus: "État civil",
        preferredLanguage: "Langue préférée",
        select: "Sélectionner",
        single: "Célibataire",
        married: "Marié(e)",
        commonLaw: "Conjoint(e) de fait",
        divorced: "Divorcé(e)",
        widowed: "Veuf / veuve",
        english: "Anglais",
        french: "Français",
        age: "Âge",
        education: "Études",
        languageScore: "Score linguistique",
        experienceYears: "Années d’expérience",
        occupation: "Profession",
        nocCode: "Code CNP",
        preferredProvince: "Province préférée",
        selectProvince: "Choisissez une province",
        highSchool: "École secondaire",
        diploma: "Diplôme",
        bachelor: "Baccalauréat",
        master: "Maîtrise",
        phd: "Doctorat",
        hasJobOffer: "A une offre d’emploi",
        hasCanadianExperience: "A de l’expérience canadienne",
        studiedInCanada: "A étudié au Canada",
        saveProfile: "Enregistrer le profil",
        saving: "Enregistrement...",
        continue: "Continuer",
        quickFill: "Remplissage rapide",
        quickFillHelp:
          "Utilisez ces points de départ pour aller plus vite, puis ajustez selon votre situation réelle.",
        guidanceTitle: "Ce qui améliore le plus votre stratégie",
        guidanceBody:
          "Les champs les plus utiles sont généralement le score linguistique, l’expérience, la profession, le code CNP, la province visée et les indicateurs comme l’offre d’emploi ou l’expérience canadienne.",
        openStrategy: "Voir ma stratégie",
        openApplication: "Ouvrir ma demande",
        copilotTitle: "Copilote IA du profil",
        copilotDesc:
          "Comprenez quelles informations sont les plus importantes à compléter pour améliorer votre stratégie.",
        copilotButton: "Que devrais-je compléter ?",
      };
    }

    return {
      loading: "Loading profile...",
      title: "Your Profile",
      subtitle:
        "Complete your profile to improve your immigration strategy and personalize your experience.",
      personalInfo: "Personal Information",
      immigrationProfile: "Immigration Profile",
      firstName: "First Name",
      lastName: "Last Name",
      nationality: "Nationality",
      country: "Country",
      city: "City",
      phone: "Phone",
      dateOfBirth: "Date of Birth",
      maritalStatus: "Marital Status",
      preferredLanguage: "Preferred Language",
      select: "Select",
      single: "Single",
      married: "Married",
      commonLaw: "Common-law",
      divorced: "Divorced",
      widowed: "Widowed",
      english: "English",
      french: "French",
      age: "Age",
      education: "Education",
      languageScore: "Language Score",
      experienceYears: "Experience Years",
      occupation: "Occupation",
      nocCode: "NOC Code",
      preferredProvince: "Preferred Province",
      selectProvince: "Select a province",
      highSchool: "High School",
      diploma: "Diploma",
      bachelor: "Bachelor",
      master: "Master",
      phd: "PhD",
      hasJobOffer: "Has job offer",
      hasCanadianExperience: "Has Canadian experience",
      studiedInCanada: "Studied in Canada",
      saveProfile: "Save Profile",
      saving: "Saving...",
      continue: "Continue",
      quickFill: "Quick fill",
      quickFillHelp:
        "Use these starting points to move faster, then adjust them to match your real situation.",
      guidanceTitle: "What improves your strategy most",
      guidanceBody:
        "The most useful fields are usually language score, work experience, occupation, NOC code, target province, and signals like a job offer or Canadian experience.",
      openStrategy: "View my strategy",
      openApplication: "Open my application",
      copilotTitle: "Profile AI Copilot",
      copilotDesc:
        "Understand which profile details matter most for improving your strategy.",
      copilotButton: "What should I complete?",
    };
  }, [language]);

  const quickFillPresets = useMemo(() => {
    if (language === "fr") {
      return [
        {
          label: "Profil Entrée express fort",
          values: {
            education: "master",
            language_score: 9,
            experience_years: 5,
            has_job_offer: false,
            has_canadian_experience: true,
            studied_in_canada: true,
          },
        },
        {
          label: "Profil international standard",
          values: {
            education: "bachelor",
            language_score: 7,
            experience_years: 3,
            has_job_offer: false,
            has_canadian_experience: false,
            studied_in_canada: false,
          },
        },
        {
          label: "Profil avec offre d’emploi",
          values: {
            education: "bachelor",
            language_score: 8,
            experience_years: 4,
            has_job_offer: true,
            has_canadian_experience: false,
            studied_in_canada: false,
          },
        },
      ];
    }

    return [
      {
        label: "Strong Express Entry profile",
        values: {
          education: "master",
          language_score: 9,
          experience_years: 5,
          has_job_offer: false,
          has_canadian_experience: true,
          studied_in_canada: true,
        },
      },
      {
        label: "Standard international profile",
        values: {
          education: "bachelor",
          language_score: 7,
          experience_years: 3,
          has_job_offer: false,
          has_canadian_experience: false,
          studied_in_canada: false,
        },
      },
      {
        label: "Job-offer profile",
        values: {
          education: "bachelor",
          language_score: 8,
          experience_years: 4,
          has_job_offer: true,
          has_canadian_experience: false,
          studied_in_canada: false,
        },
      },
    ];
  }, [language]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const applyQuickFill = (values) => {
    setForm((prev) => ({
      ...prev,
      ...values,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const payload = {
        ...form,
        age: Number(form.age),
        language_score: Number(form.language_score),
        experience_years: Number(form.experience_years),
        first_name: form.first_name?.trim() || null,
        last_name: form.last_name?.trim() || null,
        nationality: form.nationality?.trim() || null,
        current_country: form.current_country?.trim() || null,
        current_city: form.current_city?.trim() || null,
        phone_number: form.phone_number?.trim() || null,
        date_of_birth: form.date_of_birth || null,
        marital_status: form.marital_status || null,
        preferred_language: form.preferred_language || "en",
        occupation: form.occupation?.trim() || null,
        noc_code: form.noc_code?.trim() || null,
        preferred_province: form.preferred_province || null,
      };

      if (profileExists) {
        await updateMyProfile(payload);
      } else {
        await createProfile(payload);
        setProfileExists(true);
      }

      const currentUser =
        JSON.parse(localStorage.getItem("current_user") || "null") ||
        JSON.parse(localStorage.getItem("user") || "null") ||
        {};

      const patchedUser = {
        ...currentUser,
        first_name: payload.first_name,
        last_name: payload.last_name,
      };

      localStorage.setItem("current_user", JSON.stringify(patchedUser));
      localStorage.setItem("user", JSON.stringify(patchedUser));

      window.dispatchEvent(new Event("userUpdated"));

      await refreshCurrentUser();
      navigate("/strategy");
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      setMessage(
        err.response?.data?.detail ||
          (language === "fr"
            ? "Échec de l’enregistrement du profil."
            : "Failed to save profile.")
      );
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-10">
          <p className="text-slate-600">{pageText.loading}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-3xl font-bold">{pageText.title}</h1>
          <p className="text-slate-600">{pageText.subtitle}</p>
        </div>

        <AICopilotCard
          title={pageText.copilotTitle}
          description={pageText.copilotDesc}
          buttonLabel={pageText.copilotButton}
          language={language}
          prompt={
            language === "fr"
              ? `Agis comme un copilote de profil d’immigration.

Explique:
1. quelles informations de profil ont le plus d’impact sur ma stratégie
2. quels champs je devrais compléter ou clarifier en priorité
3. quels éléments peuvent améliorer ma compétitivité
4. retourne 3 suggested_next_actions courtes et concrètes`
              : `Act as an immigration profile copilot.

Explain:
1. which profile details have the biggest impact on my strategy
2. which fields I should complete or clarify first
3. what factors can improve my competitiveness
4. return 3 short concrete suggested_next_actions`
          }
        />

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="space-y-4 p-6">
            <h2 className="text-xl font-semibold">{pageText.personalInfo}</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                name="first_name"
                label={pageText.firstName}
                value={form.first_name}
                onChange={handleChange}
              />
              <Input
                name="last_name"
                label={pageText.lastName}
                value={form.last_name}
                onChange={handleChange}
              />

              <Input
                name="nationality"
                label={pageText.nationality}
                value={form.nationality}
                onChange={handleChange}
              />
              <Input
                name="current_country"
                label={pageText.country}
                value={form.current_country}
                onChange={handleChange}
              />

              <Input
                name="current_city"
                label={pageText.city}
                value={form.current_city}
                onChange={handleChange}
              />
              <Input
                name="phone_number"
                label={pageText.phone}
                value={form.phone_number}
                onChange={handleChange}
              />

              <Input
                name="date_of_birth"
                label={pageText.dateOfBirth}
                type="date"
                value={form.date_of_birth}
                onChange={handleChange}
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {pageText.maritalStatus}
                </label>
                <select
                  name="marital_status"
                  value={form.marital_status}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">{pageText.select}</option>
                  <option value="single">{pageText.single}</option>
                  <option value="married">{pageText.married}</option>
                  <option value="common-law">{pageText.commonLaw}</option>
                  <option value="divorced">{pageText.divorced}</option>
                  <option value="widowed">{pageText.widowed}</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {pageText.preferredLanguage}
                </label>
                <select
                  name="preferred_language"
                  value={form.preferred_language}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="en">{pageText.english}</option>
                  <option value="fr">{pageText.french}</option>
                </select>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-xl font-semibold">{pageText.immigrationProfile}</h2>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {pageText.quickFill}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {pageText.quickFillHelp}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {quickFillPresets.map((preset, index) => (
                  <button
                    key={`${preset.label}-${index}`}
                    type="button"
                    onClick={() => applyQuickFill(preset.values)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                name="age"
                type="number"
                label={pageText.age}
                value={form.age}
                onChange={handleChange}
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {pageText.education}
                </label>
                <select
                  name="education"
                  value={form.education}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="high school">{pageText.highSchool}</option>
                  <option value="diploma">{pageText.diploma}</option>
                  <option value="bachelor">{pageText.bachelor}</option>
                  <option value="master">{pageText.master}</option>
                  <option value="phd">{pageText.phd}</option>
                </select>
              </div>

              <Input
                name="language_score"
                type="number"
                label={pageText.languageScore}
                value={form.language_score}
                onChange={handleChange}
              />

              <Input
                name="experience_years"
                type="number"
                label={pageText.experienceYears}
                value={form.experience_years}
                onChange={handleChange}
              />

              <Input
                name="occupation"
                label={pageText.occupation}
                value={form.occupation}
                onChange={handleChange}
              />

              <Input
                name="noc_code"
                label={pageText.nocCode}
                value={form.noc_code}
                onChange={handleChange}
              />

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {pageText.preferredProvince}
                </label>
                <select
                  name="preferred_province"
                  value={form.preferred_province}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">{pageText.selectProvince}</option>
                  {PROVINCES.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="has_job_offer"
                  checked={form.has_job_offer}
                  onChange={handleChange}
                />
                {pageText.hasJobOffer}
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="has_canadian_experience"
                  checked={form.has_canadian_experience}
                  onChange={handleChange}
                />
                {pageText.hasCanadianExperience}
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="studied_in_canada"
                  checked={form.studied_in_canada}
                  onChange={handleChange}
                />
                {pageText.studiedInCanada}
              </label>
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {pageText.guidanceTitle}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {pageText.guidanceBody}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => navigate("/strategy")}>
                {pageText.openStrategy}
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate("/self/application")}
              >
                {pageText.openApplication}
              </Button>
            </div>
          </Card>

          <div className="flex gap-4">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? pageText.saving : pageText.saveProfile}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/strategy")}
            >
              {pageText.continue}
            </Button>
          </div>

          {message && <div className="text-red-500">{message}</div>}
        </form>
      </div>
    </Layout>
  );
}