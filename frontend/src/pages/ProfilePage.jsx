import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import {
  getMyProfile,
  updateMyProfile,
  logoutUser,
  getToken,
  refreshCurrentUser,
  suggestNOC,
} from "../api";

import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import AICopilotCard from "../components/AICopilotCard";
import { getCountryNames } from "../utils/countries";

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

  age: "",
  education: "",
  language_score: "",
  experience_years: "",
  has_job_offer: false,
  has_canadian_experience: false,
  studied_in_canada: false,
  occupation: "",
  noc_code: "",
  job_description: "",
  job_duties: "",
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

function SectionIntro({ eyebrow, title, body }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
        {eyebrow}
      </p>
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        {title}
      </h2>
      {body ? (
        <p className="max-w-2xl text-sm leading-6 text-slate-600">{body}</p>
      ) : null}
    </div>
  );
}

function hydrateProfileForm(data) {
  const merged = {
    ...defaultForm,
    ...(data || {}),
  };

  Object.entries(defaultForm).forEach(([key, fallback]) => {
    if (merged[key] === null || typeof merged[key] === "undefined") {
      merged[key] = fallback;
    }
  });

  return merged;
}

function normalizeNumber(value) {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("personal");

  const [nocDescription, setNocDescription] = useState("");
  const [nocDutyInput, setNocDutyInput] = useState("");
  const [nocResult, setNocResult] = useState(null);
  const [nocLoading, setNocLoading] = useState(false);
  const countryNames = useMemo(() => getCountryNames(), []);

  const isOnboarding = useMemo(() => {
    return (
      !form.first_name ||
      !form.occupation ||
      !form.noc_code ||
      !form.preferred_province
    );
  }, [form]);

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

        const hydrated = hydrateProfileForm(data);

        setForm(hydrated);
        setNocDescription(hydrated.job_description || "");
        setNocDutyInput(hydrated.job_duties || "");
      } catch (err) {
        console.error(err);

        if (err.response?.status === 404) {
          setMessage(
            language === "fr"
              ? "Votre profil n’est pas encore prêt. Veuillez finaliser votre configuration."
              : "Your profile is not ready yet. Please complete your setup."
          );
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
        title: isOnboarding ? "Complétez votre profil" : "Votre profil",
        subtitle: isOnboarding
          ? "Complétez votre profil pour débloquer votre stratégie d’immigration personnalisée, vos recommandations IA et votre espace de demande."
          : "Mettez à jour votre profil pour améliorer votre stratégie d’immigration, vos recommandations IA et votre espace de demande.",
        personalInfo: "Informations personnelles",
        immigrationProfile: "Profil d’immigration",
        sections: "Sections",
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
        finishSetup: "Terminer la configuration",
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
        openAssistant: "Ouvrir l’assistant IA",
        openDocuments: "Voir mes documents",
        copilotTitle: "Copilote IA du profil",
        copilotDesc:
          "Comprenez quelles informations sont les plus importantes à compléter pour améliorer votre stratégie.",
        copilotButton: "Que devrais-je compléter ?",
        decisionCopilotTitle: "Quel champ aura le plus d’impact ?",
        decisionCopilotDesc:
          "Obtenez une recommandation pratique sur l’élément de profil à améliorer en priorité.",
        decisionCopilotButton: "Prioriser mon profil",
        nocTitle: "Assistant CNP",
        nocDesc:
          "Décrivez brièvement votre travail pour obtenir une suggestion de code CNP plus précise.",
        nocDescription: "Description du poste",
        nocDescriptionPlaceholder:
          "Ex.: Je développe des applications web, j’écris du code, je corrige des bogues et je collabore avec l’équipe produit.",
        nocDuties: "Responsabilités clés",
        nocDutiesPlaceholder:
          "Une responsabilité par ligne. Ex.: Développer des API\nCorriger des bogues\nÉcrire des tests",
        suggestNoc: "Suggérer un CNP",
        suggestingNoc: "Analyse du CNP...",
        suggestedNoc: "CNP suggéré",
        confidence: "Confiance",
        teer: "TEER",
        category: "Catégorie",
        whyMatched: "Pourquoi ce CNP correspond",
        alternatives: "Autres options",
        useThisNoc: "Utiliser ce CNP",
        applyDetailsToo: "Appliquer aussi la description",
        noAlternatives: "Aucune autre option disponible.",
        onboardingBanner:
          "Complétez votre profil pour débloquer votre stratégie personnalisée.",
        navTitle: "Navigation",
        detectedNocCard: "Détection CNP",
        detectedNocCardBody:
          "Décrivez votre vrai rôle pour améliorer la précision du CNP détecté et des recommandations d’immigration.",
        jobDetails: "Détails du poste",
        jobDetailsBody:
          "Ces détails renforcent la détection CNP et aident l’IA à comprendre votre rôle réel.",
        saveJobDetailsHint:
          "La description du poste et les responsabilités seront enregistrées dans votre profil.",
      };
    }

    return {
      loading: "Loading profile...",
      title: isOnboarding ? "Complete your profile" : "Your Profile",
      subtitle: isOnboarding
        ? "Complete your profile to unlock your personalized immigration strategy, AI guidance, and application workspace."
        : "Update your profile to improve your immigration strategy, AI guidance, and application workspace.",
      personalInfo: "Personal Information",
      immigrationProfile: "Immigration Profile",
      sections: "Sections",
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
      finishSetup: "Finish setup",
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
      openAssistant: "Open AI assistant",
      openDocuments: "View my documents",
      copilotTitle: "Profile AI Copilot",
      copilotDesc:
        "Understand which profile details matter most for improving your strategy.",
      copilotButton: "What should I complete?",
      decisionCopilotTitle: "Which field will move the needle most?",
      decisionCopilotDesc:
        "Get a practical recommendation on the single profile element to improve first.",
      decisionCopilotButton: "Prioritize my profile",
      nocTitle: "NOC Assistant",
      nocDesc:
        "Briefly describe your real job so the system can suggest a more accurate NOC code.",
      nocDescription: "Job description",
      nocDescriptionPlaceholder:
        "Example: I build web applications, write code, fix bugs, and work with the product team.",
      nocDuties: "Key responsibilities",
      nocDutiesPlaceholder:
        "One responsibility per line. Example: Build APIs\nFix bugs\nWrite tests",
      suggestNoc: "Suggest NOC",
      suggestingNoc: "Analyzing NOC...",
      suggestedNoc: "Suggested NOC",
      confidence: "Confidence",
      teer: "TEER",
      category: "Category",
      whyMatched: "Why this matched",
      alternatives: "Other likely options",
      useThisNoc: "Use this NOC",
      applyDetailsToo: "Apply details too",
      noAlternatives: "No alternative options available.",
      onboardingBanner:
        "Complete your profile to unlock your personalized strategy.",
      navTitle: "Navigation",
      detectedNocCard: "NOC detection",
      detectedNocCardBody:
        "Describe your real role to improve detected NOC accuracy and immigration recommendations.",
      jobDetails: "Job details",
      jobDetailsBody:
        "These details strengthen NOC detection and help the AI understand your real role.",
      saveJobDetailsHint:
        "Job description and responsibilities will be saved in your profile.",
    };
  }, [language, isOnboarding]);

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

  const sections = useMemo(
    () => [
      { id: "personal", label: pageText.personalInfo },
      { id: "immigration", label: pageText.immigrationProfile },
      { id: "noc", label: pageText.nocTitle },
      { id: "guidance", label: pageText.guidanceTitle },
    ],
    [pageText]
  );

  const normalizedConfidence = useMemo(() => {
    const raw = nocResult?.confidence || 0;
    return Math.round(raw * 100);
  }, [nocResult]);

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

  const handleSuggestNoc = async () => {
    const duties = nocDutyInput
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!form.occupation?.trim()) {
      setMessage(
        language === "fr"
          ? "Ajoutez d’abord votre profession avant de suggérer un CNP."
          : "Add your occupation first before suggesting a NOC."
      );
      return;
    }

    try {
      setNocLoading(true);
      setMessage("");
      setNocResult(null);

      const res = await suggestNOC({
        occupation: form.occupation,
        job_description: nocDescription,
        duties,
        top_k: 3,
      });

      setNocResult(res.data);
      setMessage(
        language === "fr"
          ? "Suggestion de CNP générée."
          : "NOC suggestion generated."
      );
      setActiveSection("noc");
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Impossible de suggérer un CNP."
            : "Unable to suggest a NOC.")
      );
    } finally {
      setNocLoading(false);
    }
  };

  const applySuggestedNoc = (noc, options = {}) => {
    if (!noc) return;

    const shouldApplyDetails = Boolean(options.applyDetails);

    setForm((prev) => ({
      ...prev,
      noc_code: noc,
      job_description: shouldApplyDetails ? nocDescription : prev.job_description,
      job_duties: shouldApplyDetails ? nocDutyInput : prev.job_duties,
    }));

    if (shouldApplyDetails) {
      setMessage(
        language === "fr"
          ? "CNP et détails du poste appliqués au profil."
          : "NOC and job details applied to profile."
      );
    } else {
      setMessage(
        language === "fr" ? "CNP appliqué au profil." : "NOC applied to profile."
      );
    }

    setActiveSection("immigration");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const payload = {
        ...form,
        age: normalizeNumber(form.age),
        language_score: normalizeNumber(form.language_score),
        experience_years: normalizeNumber(form.experience_years),
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
        job_description: nocDescription?.trim() || null,
        job_duties: nocDutyInput?.trim() || null,
        preferred_province: form.preferred_province || null,
      };

      await updateMyProfile(payload);

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

      setForm((prev) => ({
        ...prev,
        job_description: payload.job_description || "",
        job_duties: payload.job_duties || "",
      }));

      setMessage(
        language === "fr"
          ? "Profil enregistré avec succès."
          : "Profile saved successfully."
      );

      if (isOnboarding) {
        navigate("/dashboard");
      } else {
        navigate("/strategy");
      }
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
        <div className="flex justify-center py-24">
          <div className="rounded-[28px] border border-slate-200 bg-white px-10 py-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <p className="text-lg font-medium text-slate-700">{pageText.loading}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        {isOnboarding && (
          <div className="rounded-[24px] border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-indigo-800">
            {pageText.onboardingBanner}
          </div>
        )}

        {message && (
          <div className="rounded-[24px] border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800">
            {message}
          </div>
        )}

        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            NorthBridgeAI
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            {pageText.title}
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            {pageText.subtitle}
          </p>
        </div>

        <div className="grid gap-6">
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
4. retourne 3 suggested_next_actions courtes et concrètes
5. retourne 2 ou 3 insights courts`
                : `Act as an immigration profile copilot.

Explain:
1. which profile details have the biggest impact on my strategy
2. which fields I should complete or clarify first
3. what factors can improve my competitiveness
4. return 3 short concrete suggested_next_actions
5. return 2 or 3 short insights`
            }
          />

          <AICopilotCard
            title={pageText.decisionCopilotTitle}
            description={pageText.decisionCopilotDesc}
            buttonLabel={pageText.decisionCopilotButton}
            language={language}
            prompt={
              language === "fr"
                ? `À partir de mon profil d’immigration, dis-moi quel champ aura probablement le plus d’impact si je l’améliore maintenant.

Retourne:
1. une recommandation principale
2. une explication courte
3. 3 suggested_next_actions correspondant si possible à:
   /profile
   /strategy
   /chat
4. 2 insights courts`
                : `Based on my immigration profile, tell me which field is most likely to have the biggest impact if I improve it now.

Return:
1. one main recommendation
2. a short explanation
3. 3 suggested_next_actions matching if possible:
   /profile
   /strategy
   /chat
4. 2 short insights`
            }
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
            <Card padding="lg" className="xl:sticky xl:top-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {pageText.navTitle}
              </p>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 xl:hidden">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`shrink-0 rounded-full border px-3 py-2 text-sm transition ${
                      activeSection === section.id
                        ? "border-blue-200 bg-blue-50 text-blue-700 font-semibold"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 hidden space-y-1.5 xl:block">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      activeSection === section.id
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </Card>

            <div
              key={activeSection}
              className="space-y-6 animate-[fadeIn_.18s_ease-out]"
            >
              {activeSection === "personal" && (
                <Card padding="lg" className="space-y-6">
                  <SectionIntro
                    eyebrow={pageText.personalInfo}
                    title={pageText.personalInfo}
                  />
                  <datalist id="profile-country-options">
                    {countryNames.map((country) => (
                      <option key={country} value={country} />
                    ))}
                  </datalist>

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
                      list="profile-country-options"
                    />
                    <Input
                      name="current_country"
                      label={pageText.country}
                      value={form.current_country}
                      onChange={handleChange}
                      list="profile-country-options"
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
              )}

              {activeSection === "immigration" && (
                <Card padding="lg" className="space-y-6">
                  <SectionIntro
                    eyebrow={pageText.immigrationProfile}
                    title={pageText.immigrationProfile}
                  />

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                    <p className="text-sm font-semibold text-slate-900">
                      {pageText.quickFill}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {pageText.quickFillHelp}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {quickFillPresets.map((preset, index) => (
                        <Button
                          key={`${preset.label}-${index}`}
                          type="button"
                          size="sm"
                          variant="subtle"
                          onClick={() => applyQuickFill(preset.values)}
                        >
                          {preset.label}
                        </Button>
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
                        <option value="">{pageText.select}</option>
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

                    <div className="md:col-span-2 rounded-[24px] border border-blue-200 bg-blue-50 p-4">
                      <p className="text-sm font-semibold text-blue-900">
                        {pageText.detectedNocCard}
                      </p>
                      <p className="mt-1 text-sm text-blue-800">
                        {pageText.detectedNocCardBody}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setActiveSection("noc")}
                        >
                          {pageText.suggestNoc}
                        </Button>

                        {nocResult?.suggested_noc ? (
                          <div className="inline-flex items-center rounded-full border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700">
                            {nocResult.suggested_noc} — {nocResult.suggested_title} ·{" "}
                            {pageText.confidence}: {normalizedConfidence}%
                          </div>
                        ) : null}
                      </div>
                    </div>

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

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                    <p className="text-sm font-semibold text-slate-900">
                      {pageText.jobDetails}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {pageText.jobDetailsBody}
                    </p>

                    <div className="mt-4 grid gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          {pageText.nocDescription}
                        </label>
                        <textarea
                          rows={4}
                          value={nocDescription}
                          onChange={(e) => {
                            setNocDescription(e.target.value);
                            setForm((prev) => ({
                              ...prev,
                              job_description: e.target.value,
                            }));
                          }}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          placeholder={pageText.nocDescriptionPlaceholder}
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          {pageText.nocDuties}
                        </label>
                        <textarea
                          rows={5}
                          value={nocDutyInput}
                          onChange={(e) => {
                            setNocDutyInput(e.target.value);
                            setForm((prev) => ({
                              ...prev,
                              job_duties: e.target.value,
                            }));
                          }}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                          placeholder={pageText.nocDutiesPlaceholder}
                        />
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      {pageText.saveJobDetailsHint}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="has_job_offer"
                        checked={form.has_job_offer}
                        onChange={handleChange}
                      />
                      {pageText.hasJobOffer}
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="has_canadian_experience"
                        checked={form.has_canadian_experience}
                        onChange={handleChange}
                      />
                      {pageText.hasCanadianExperience}
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
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
              )}

              {activeSection === "noc" && (
                <Card variant="premium" padding="lg" className="space-y-6">
                  <SectionIntro
                    eyebrow={pageText.nocTitle}
                    title={pageText.nocTitle}
                    body={pageText.nocDesc}
                  />

                  <div className="grid gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        {pageText.nocDescription}
                      </label>
                      <textarea
                        rows={5}
                        value={nocDescription}
                        onChange={(e) => {
                          setNocDescription(e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            job_description: e.target.value,
                          }));
                        }}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        placeholder={pageText.nocDescriptionPlaceholder}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        {pageText.nocDuties}
                      </label>
                      <textarea
                        rows={5}
                        value={nocDutyInput}
                        onChange={(e) => {
                          setNocDutyInput(e.target.value);
                          setForm((prev) => ({
                            ...prev,
                            job_duties: e.target.value,
                          }));
                        }}
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        placeholder={pageText.nocDutiesPlaceholder}
                      />
                    </div>

                    <div>
                      <Button
                        type="button"
                        variant="premium"
                        onClick={handleSuggestNoc}
                        disabled={nocLoading}
                        loading={nocLoading}
                      >
                        {nocLoading ? pageText.suggestingNoc : pageText.suggestNoc}
                      </Button>
                    </div>
                  </div>

                  {nocResult && (
                    <div className="space-y-5 rounded-[24px] border border-blue-200 bg-blue-50 p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {pageText.suggestedNoc}
                          </p>
                          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-blue-900">
                            {nocResult.suggested_noc} — {nocResult.suggested_title}
                          </h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {pageText.teer}: {nocResult.teer}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {pageText.confidence}: {normalizedConfidence}%
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {pageText.category}: {nocResult.broad_category}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            onClick={() =>
                              applySuggestedNoc(nocResult.suggested_noc)
                            }
                          >
                            {pageText.useThisNoc}
                          </Button>

                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              applySuggestedNoc(nocResult.suggested_noc, {
                                applyDetails: true,
                              })
                            }
                          >
                            {pageText.applyDetailsToo}
                          </Button>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {pageText.whyMatched}
                        </p>
                        <div className="mt-3 space-y-2">
                          {(nocResult.why_matched || []).map((item, index) => (
                            <div
                              key={`${item}-${index}`}
                              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {pageText.alternatives}
                        </p>

                        {Array.isArray(nocResult.alternatives) &&
                        nocResult.alternatives.length > 0 ? (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {nocResult.alternatives.map((alt) => (
                              <div
                                key={alt.noc}
                                className="rounded-2xl border border-slate-200 bg-white p-4"
                              >
                                <p className="text-sm font-semibold text-slate-900">
                                  {alt.noc} — {alt.title}
                                </p>
                                <p className="mt-2 text-xs text-slate-500">
                                  {pageText.teer}: {alt.teer} · {pageText.confidence}:{" "}
                                  {Math.round((alt.confidence || 0) * 100)}%
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => applySuggestedNoc(alt.noc)}
                                  >
                                    {pageText.useThisNoc}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="subtle"
                                    onClick={() =>
                                      applySuggestedNoc(alt.noc, {
                                        applyDetails: true,
                                      })
                                    }
                                  >
                                    {pageText.applyDetailsToo}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">
                            {pageText.noAlternatives}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {activeSection === "guidance" && (
                <Card variant="soft" padding="lg" className="space-y-6">
                  <SectionIntro
                    eyebrow={pageText.guidanceTitle}
                    title={pageText.guidanceTitle}
                    body={pageText.guidanceBody}
                  />

                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={() => navigate("/strategy")}>
                      {pageText.openStrategy}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => navigate("/self/application")}
                    >
                      {pageText.openApplication}
                    </Button>
                    <Button variant="secondary" onClick={() => navigate("/chat")}>
                      {pageText.openAssistant}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => navigate("/documents")}
                    >
                      {pageText.openDocuments}
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="submit"
              variant="premium"
              className="flex-1"
              disabled={loading}
              loading={loading}
            >
              {loading
                ? pageText.saving
                : isOnboarding
                ? pageText.finishSetup
                : pageText.saveProfile}
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="sm:min-w-[180px]"
              onClick={() => navigate("/strategy")}
            >
              {pageText.continue}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
