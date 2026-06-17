import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  getMyProfile,
  suggestNOC,
  updateMyProfile,
} from "../api";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import AICopilotCard from "../components/AICopilotCard";
import { getCountryOptions } from "../utils/countries";

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
  english_language_score: "",
  french_language_score: "",
  experience_years: "",
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

const EMPTY_CITY_OPTIONS = [];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSearchText(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getCountryMatches(countries, query) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) return countries;

  return countries.filter((country) =>
    normalizeSearchText(country.name).includes(normalizedQuery)
  );
}

function isFilled(value) {
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return !Number.isNaN(value);
  return Boolean(normalizeText(value));
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

  if (!merged.english_language_score && merged.language_score) {
    merged.english_language_score = merged.language_score;
  }

  return merged;
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
        broad_category: data.broad_category,
        immigration_category_tags: data?.immigration_flags?.category_tags || [],
        express_entry_skilled_work:
          data?.immigration_flags?.express_entry_skilled_work || false,
      },
      ...(Array.isArray(data?.alternatives) ? data.alternatives : []),
    ].filter((item) => item?.noc || item?.title);
  }

  if (Array.isArray(data?.alternatives) && data.alternatives.length > 0) {
    return data.alternatives;
  }

  return [];
}

function getStepOneRequiredKeys() {
  return [
    "first_name",
    "last_name",
    "nationality",
    "current_country",
    "current_city",
    "marital_status",
    "preferred_language",
  ];
}

function getStepTwoRequiredKeys() {
  return [
    "age",
    "education",
    "experience_years",
    "occupation",
    "noc_code",
    "preferred_province",
  ];
}

function getProfileReadinessScore(form) {
  const fields = [
    form.first_name,
    form.last_name,
    form.nationality,
    form.current_country,
    form.current_city,
    form.marital_status,
    form.preferred_language,
    form.age,
    form.education,
    form.english_language_score || form.language_score,
    form.french_language_score,
    form.experience_years,
    form.occupation,
    form.noc_code,
    form.preferred_province,
  ];

  const completed = fields.filter((value) => isFilled(value)).length;
  return Math.round((completed / fields.length) * 100);
}

function FieldHint({ children, error = false }) {
  if (!children) return null;

  return (
    <p
      className={`mt-1 text-xs ${
        error ? "text-red-600" : "text-slate-500"
      }`}
    >
      {children}
    </p>
  );
}

function RequiredLabel({ children }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{children}</span>
      <span className="text-red-500">*</span>
    </span>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [form, setForm] = useState(defaultForm);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState(false);

  const [suggestedNocs, setSuggestedNocs] = useState([]);
  const [suggestingNoc, setSuggestingNoc] = useState(false);

  const [nationalityQuery, setNationalityQuery] = useState("");
  const [showNationalitySuggestions, setShowNationalitySuggestions] =
    useState(false);

  const [countryQuery, setCountryQuery] = useState("");
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);

  const [cityQuery, setCityQuery] = useState("");
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const availableCities = EMPTY_CITY_OPTIONS;

  const [fieldErrors, setFieldErrors] = useState({});

  const nationalityFieldRef = useRef(null);
  const countryFieldRef = useRef(null);
  const cityFieldRef = useRef(null);
  const nocRequestIdRef = useRef(0);
  const latestOccupationRef = useRef("");

  const countries = useMemo(() => {
    return getCountryOptions();
  }, []);

  const filteredNationalityCountries = useMemo(() => {
    return getCountryMatches(countries, nationalityQuery);
  }, [countries, nationalityQuery]);

  const filteredCountries = useMemo(() => {
    return getCountryMatches(countries, countryQuery);
  }, [countries, countryQuery]);

  const filteredCities = useMemo(() => {
    if (!availableCities.length) return [];
    const query = normalizeSearchText(cityQuery);

    if (!query) return availableCities.slice(0, 10);

    return availableCities
      .filter((city) => normalizeSearchText(city).includes(query))
      .slice(0, 10);
  }, [availableCities, cityQuery]);

  const showManualCityInput = useMemo(() => {
    return !form.current_country || availableCities.length === 0;
  }, [form.current_country, availableCities]);

  const progress = useMemo(() => {
    return step === 1 ? 50 : 100;
  }, [step]);

  const readinessScore = useMemo(() => {
    return getProfileReadinessScore(form);
  }, [form]);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const res = await getMyProfile();
        if (!mounted) return;

        const merged = hydrateProfileForm(res.data);

        setForm(merged);
        setNationalityQuery(merged.nationality || "");
        setCountryQuery(merged.current_country || "");
        setCityQuery(merged.current_city || "");
      } catch (err) {
        console.error("Onboarding profile load failed:", err);
        if (!mounted) return;

        setMessage(
          err?.response?.data?.detail ||
            (language === "fr"
              ? "Impossible de charger les informations d’onboarding."
              : "Unable to load onboarding information.")
        );
      } finally {
        if (mounted) {
          setPageLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [language]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        nationalityFieldRef.current &&
        !nationalityFieldRef.current.contains(event.target)
      ) {
        setShowNationalitySuggestions(false);
      }

      if (
        countryFieldRef.current &&
        !countryFieldRef.current.contains(event.target)
      ) {
        setShowCountrySuggestions(false);
      }

      if (
        cityFieldRef.current &&
        !cityFieldRef.current.contains(event.target)
      ) {
        setShowCitySuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    latestOccupationRef.current = normalizeText(form.occupation);
  }, [form.occupation]);

  const pageText = useMemo(() => {
    if (language === "fr") {
      return {
        loading: "Chargement de l’onboarding...",
        brand: "NorthBridgeAI",
        title: "Bienvenue — configurons votre profil",
        subtitle:
          "Complétez les informations les plus utiles pour générer une stratégie plus exploitable dès votre arrivée dans l’application.",
        stepOf: "Étape",
        of: "sur",
        personalDetails: "Informations personnelles",
        personalDetailsBody:
          "Cette étape construit votre identité de base dans l’application et améliore la cohérence de vos documents.",
        immigrationProfile: "Profil d’immigration",
        immigrationProfileBody:
          "Cette étape alimente votre moteur de stratégie et aide à calculer un meilleur score, un meilleur parcours et de meilleures améliorations.",
        firstName: "Prénom",
        lastName: "Nom",
        nationality: "Nationalité",
        countryOfResidence: "Pays de résidence",
        city: "Ville",
        phoneNumber: "Numéro de téléphone",
        dateOfBirth: "Date de naissance",
        maritalStatus: "État civil",
        preferredLanguage: "Langue préférée",
        searchNationality: "Recherchez ou entrez votre nationalite",
        searchCountry: "Recherchez ou entrez votre pays",
        searchCity: "Recherchez ou entrez votre ville",
        typeCity: "Entrez votre ville",
        noNationalityMatch:
          "Aucune suggestion exacte - vous pouvez entrer votre nationalite manuellement.",
        noCountryMatch:
          "Aucune suggestion exacte — vous pouvez entrer votre pays manuellement.",
        noCityMatch:
          "Aucune suggestion exacte — vous pouvez entrer votre ville manuellement.",
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
        highSchool: "École secondaire",
        diploma: "Diplôme",
        bachelor: "Baccalauréat",
        master: "Maîtrise",
        phd: "Doctorat",
        languageScore: "Score linguistique",
        englishLanguageScore: "Score anglais CLB",
        frenchLanguageScore: "Score francais NCLC",
        experienceYears: "Années d’expérience",
        occupation: "Profession",
        nocCode: "Code CNP",
        preferredProvince: "Province préférée",
        selectProvince: "Choisissez une province",
        hasJobOffer: "A une offre d’emploi",
        hasCanadianExperience: "A de l’expérience canadienne",
        studiedInCanada: "A étudié au Canada",
        continue: "Continuer",
        back: "Retour",
        finish: "Terminer la configuration",
        saving: "Enregistrement...",
        copilotTitle: "Copilote IA d’onboarding",
        copilotDesc:
          "Comprenez quelles informations ont le plus d’impact sur la qualité de votre stratégie.",
        copilotButton: "Que dois-je remplir ?",
        quickFill: "Remplissage rapide",
        quickFillBody:
          "Choisissez un point de départ proche de votre situation pour accélérer la configuration.",
        helperTitle: "Pourquoi cela compte",
        helperBody:
          "Un profil plus complet réduit les zones vides sur le tableau de bord et améliore la qualité du score, du meilleur parcours et des recommandations.",
        suggestNoc: "Suggérer le code CNP",
        suggestingNoc: "Suggestion...",
        suggestedNocs: "Suggestions de CNP",
        noNocFound: "Aucune suggestion CNP trouvée pour cette profession.",
        nocHelper:
          "Choisissez la suggestion la plus proche pour améliorer immédiatement la qualité de votre stratégie.",
        onboardingSaveError:
          "Échec de l’enregistrement des informations d’onboarding.",
        nocSuggestionError:
          "Impossible de suggérer un code CNP pour le moment.",
        completedTitle: "Profil complété avec succès",
        completedBody:
          "Votre profil contient maintenant les informations clés pour afficher un meilleur tableau de bord et une stratégie plus utile.",
        completedPrimary: "Débloquer ma stratégie complète",
        completedSecondary: "Retour au tableau de bord",
        readiness: "Préparation du profil",
        readinessBody:
          "Essayez d’atteindre un profil solide avant de terminer cette configuration.",
        coreFieldsTitle: "Champs les plus importants",
        coreFieldsBody:
          "Âge, études, score linguistique, expérience, profession, code CNP et province préférée ont le plus d’impact.",
        requiredField: "Ce champ est requis.",
        invalidAge: "Veuillez entrer un âge valide.",
        invalidLanguageScore: "Veuillez entrer un score linguistique valide.",
        missingLanguageScore:
          "Entrez au moins un score linguistique: anglais ou francais.",
        invalidExperience: "Veuillez entrer un nombre d’années valide.",
        completeMore:
          "Complétez davantage votre profil avant de terminer.",
      };
    }

    return {
      loading: "Loading onboarding...",
      brand: "NorthBridgeAI",
      title: "Welcome — let’s set up your profile",
      subtitle:
        "Complete the most useful details first so your strategy can be more reliable from the moment you enter the app.",
      stepOf: "Step",
      of: "of",
      personalDetails: "Personal details",
      personalDetailsBody:
        "This step builds your base identity in the app and improves document consistency.",
      immigrationProfile: "Immigration profile",
      immigrationProfileBody:
        "This step powers your strategy engine and helps produce a better score, better pathway, and better improvement suggestions.",
      firstName: "First Name",
      lastName: "Last Name",
      nationality: "Nationality",
      countryOfResidence: "Country of Residence",
      city: "City",
      phoneNumber: "Phone Number",
      dateOfBirth: "Date of Birth",
      maritalStatus: "Marital Status",
      preferredLanguage: "Preferred Language",
      searchNationality: "Search nationality or country",
      searchCountry: "Search or enter your country",
      searchCity: "Search or enter your city",
      typeCity: "Enter your city",
      noNationalityMatch:
        "No exact match - you can still enter your nationality manually.",
      noCountryMatch:
        "No exact match — you can still enter your country manually.",
      noCityMatch:
        "No exact match — you can still enter your city manually.",
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
      highSchool: "High School",
      diploma: "Diploma",
      bachelor: "Bachelor",
      master: "Master",
      phd: "PhD",
      languageScore: "Language Score",
      englishLanguageScore: "English CLB Score",
      frenchLanguageScore: "French NCLC Score",
      experienceYears: "Experience Years",
      occupation: "Occupation",
      nocCode: "NOC Code",
      preferredProvince: "Preferred Province",
      selectProvince: "Select a province",
      hasJobOffer: "Has job offer",
      hasCanadianExperience: "Has Canadian experience",
      studiedInCanada: "Studied in Canada",
      continue: "Continue",
      back: "Back",
      finish: "Finish Setup",
      saving: "Saving...",
      copilotTitle: "Onboarding AI Copilot",
      copilotDesc:
        "Understand which details have the biggest impact on strategy quality.",
      copilotButton: "What should I fill in?",
      quickFill: "Quick fill",
      quickFillBody:
        "Choose a starting point close to your situation to speed things up.",
      helperTitle: "Why this matters",
      helperBody:
        "A fuller profile reduces empty dashboard states and improves score, best pathway, and recommendation quality.",
      suggestNoc: "Suggest NOC code",
      suggestingNoc: "Suggesting...",
      suggestedNocs: "Suggested NOCs",
      noNocFound: "No NOC suggestions found for this occupation.",
      nocHelper:
        "Choose the closest suggestion to immediately improve strategy quality.",
      onboardingSaveError: "Failed to save onboarding details.",
      nocSuggestionError: "Unable to suggest a NOC code right now.",
      completedTitle: "Profile successfully completed",
      completedBody:
        "Your profile now contains the key information needed for a stronger dashboard and more useful strategy results.",
      completedPrimary: "Unlock my full strategy",
      completedSecondary: "Back to dashboard",
      readiness: "Profile readiness",
      readinessBody:
        "Aim for a strong profile before finishing setup.",
      coreFieldsTitle: "Most important fields",
      coreFieldsBody:
        "Age, education, language score, experience, occupation, NOC code, and preferred province have the biggest impact.",
      requiredField: "This field is required.",
      invalidAge: "Please enter a valid age.",
      invalidLanguageScore: "Please enter a valid language score.",
      missingLanguageScore:
        "Enter at least one language score: English or French.",
      invalidExperience: "Please enter a valid number of years.",
      completeMore: "Complete more of your profile before finishing.",
    };
  }, [language]);

  const quickFillPresets = useMemo(() => {
    if (language === "fr") {
      return [
        {
          label: "Profil Entrée express fort",
          values: {
            education: "master",
            english_language_score: 9,
            french_language_score: 7,
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
            english_language_score: 7,
            french_language_score: "",
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
            english_language_score: 8,
            french_language_score: "",
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
          english_language_score: 9,
          french_language_score: 7,
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
          english_language_score: 7,
          french_language_score: "",
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
          english_language_score: 8,
          french_language_score: "",
          experience_years: 4,
          has_job_offer: true,
          has_canadian_experience: false,
          studied_in_canada: false,
        },
      },
    ];
  }, [language]);

  function clearFieldError(name) {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    if (name === "occupation") {
      latestOccupationRef.current = normalizeText(value);
      nocRequestIdRef.current += 1;
      setSuggestedNocs([]);
      if (message === pageText.noNocFound) {
        setMessage("");
      }
    }

    clearFieldError(name);

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "occupation" ? { noc_code: "" } : {}),
    }));
  }

  function handleNationalityInputChange(e) {
    const value = e.target.value;

    clearFieldError("nationality");

    setNationalityQuery(value);
    setForm((prev) => ({
      ...prev,
      nationality: value,
    }));
    setShowNationalitySuggestions(true);
  }

  function handleSelectNationality(countryName) {
    clearFieldError("nationality");

    setNationalityQuery(countryName);
    setForm((prev) => ({
      ...prev,
      nationality: countryName,
    }));
    setShowNationalitySuggestions(false);
  }

  function handleCountryInputChange(e) {
    const value = e.target.value;

    clearFieldError("current_country");

    setCountryQuery(value);
    setForm((prev) => ({
      ...prev,
      current_country: value,
      current_city: "",
    }));
    setCityQuery("");
    setShowCountrySuggestions(true);
    setShowCitySuggestions(false);
  }

  function handleSelectCountry(countryName) {
    clearFieldError("current_country");
    clearFieldError("current_city");

    setCountryQuery(countryName);
    setForm((prev) => ({
      ...prev,
      current_country: countryName,
      current_city: "",
    }));
    setCityQuery("");
    setShowCountrySuggestions(false);
    setShowCitySuggestions(false);
  }

  function handleCityInputChange(e) {
    const value = e.target.value;

    clearFieldError("current_city");

    setCityQuery(value);
    setForm((prev) => ({
      ...prev,
      current_city: value,
    }));
    setShowCitySuggestions(true);
  }

  function handleSelectCity(city) {
    clearFieldError("current_city");

    setCityQuery(city);
    setForm((prev) => ({
      ...prev,
      current_city: city,
    }));
    setShowCitySuggestions(false);
  }

  function applyQuickFill(values) {
    setForm((prev) => ({
      ...prev,
      ...values,
    }));
  }

  function validateStepOne() {
    const errors = {};

    for (const key of getStepOneRequiredKeys()) {
      if (!isFilled(form[key])) {
        errors[key] = pageText.requiredField;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateStepTwo() {
    const errors = {};

    for (const key of getStepTwoRequiredKeys()) {
      if (!isFilled(form[key])) {
        errors[key] = pageText.requiredField;
      }
    }

    const age = Number(form.age);
    const englishLanguageScore = Number(form.english_language_score || 0);
    const frenchLanguageScore = Number(form.french_language_score || 0);
    const experienceYears = Number(form.experience_years);

    if (!Number.isFinite(age) || age <= 0) {
      errors.age = pageText.invalidAge;
    }

    if (!isFilled(form.english_language_score) && !isFilled(form.french_language_score)) {
      errors.english_language_score = pageText.missingLanguageScore;
      errors.french_language_score = pageText.missingLanguageScore;
    }

    if (!Number.isFinite(englishLanguageScore) || englishLanguageScore < 0) {
      errors.english_language_score = pageText.invalidLanguageScore;
    }

    if (!Number.isFinite(frenchLanguageScore) || frenchLanguageScore < 0) {
      errors.french_language_score = pageText.invalidLanguageScore;
    }

    if (!Number.isFinite(experienceYears) || experienceYears < 0) {
      errors.experience_years = pageText.invalidExperience;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function nextStep() {
    if (!validateStepOne()) {
      setMessage("");
      return;
    }

    setStep(2);
    setMessage("");
  }

  function previousStep() {
    setStep(1);
    setMessage("");
  }

  const handleSuggestNOC = useCallback(async (options = {}) => {
    const quiet = Boolean(options?.quiet);
    const occupation = normalizeText(options?.occupation || form.occupation);

    if (!occupation) {
      return;
    }

    const requestId = nocRequestIdRef.current + 1;
    nocRequestIdRef.current = requestId;

    try {
      setSuggestingNoc(true);
      if (!quiet) setMessage("");
      setSuggestedNocs([]);

      const payload = {
        occupation,
        top_k: 3,
      };

      const res = await suggestNOC(payload);
      const normalizedMatches = normalizeNocMatches(res?.data);

      if (
        requestId !== nocRequestIdRef.current ||
        latestOccupationRef.current !== occupation
      ) {
        return;
      }

      setSuggestedNocs(normalizedMatches);

      if (!quiet && normalizedMatches.length === 0) {
        setMessage(pageText.noNocFound);
      }
    } catch (err) {
      console.error("Suggest NOC failed:", err);

      if (
        requestId !== nocRequestIdRef.current ||
        latestOccupationRef.current !== occupation
      ) {
        return;
      }

      if (!quiet) {
        setMessage(
          err?.response?.data?.detail || pageText.nocSuggestionError
        );
      }
      setSuggestedNocs([]);
    } finally {
      if (requestId === nocRequestIdRef.current) {
        setSuggestingNoc(false);
      }
    }
  }, [form.occupation, pageText.noNocFound, pageText.nocSuggestionError]);

  useEffect(() => {
    if (step !== 2 || form.noc_code.trim()) return undefined;

    const occupation = normalizeText(form.occupation);
    if (occupation.length < 3) return undefined;

    const timer = window.setTimeout(() => {
      handleSuggestNOC({ quiet: true, occupation });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [step, form.occupation, form.noc_code, handleSuggestNOC]);

  function handleSelectNoc(noc) {
    const selectedCode =
      noc?.noc || noc?.noc_code || noc?.code || noc?.id || "";
    const selectedTitle =
      noc?.title || noc?.name || noc?.occupation || "";

    clearFieldError("noc_code");
    clearFieldError("occupation");

    setForm((prev) => ({
      ...prev,
      noc_code: selectedCode || prev.noc_code,
      occupation: selectedTitle || prev.occupation,
    }));
    setMessage("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!validateStepTwo()) {
      setLoading(false);
      setMessage(pageText.completeMore);
      return;
    }

    try {
      const payload = {
        ...form,
        age: Number(form.age),
        english_language_score: isFilled(form.english_language_score)
          ? Number(form.english_language_score)
          : null,
        french_language_score: isFilled(form.french_language_score)
          ? Number(form.french_language_score)
          : null,
        language_score: Math.max(
          isFilled(form.english_language_score)
            ? Number(form.english_language_score)
            : 0,
          isFilled(form.french_language_score)
            ? Number(form.french_language_score)
            : 0
        ) || null,
        experience_years: Number(form.experience_years),
        occupation: normalizeText(form.occupation) || null,
        noc_code: normalizeText(form.noc_code) || null,
        preferred_province: form.preferred_province || null,
        first_name: normalizeText(form.first_name) || null,
        last_name: normalizeText(form.last_name) || null,
        nationality: normalizeText(form.nationality) || null,
        current_country: normalizeText(form.current_country) || null,
        current_city: normalizeText(form.current_city) || null,
        phone_number: normalizeText(form.phone_number) || null,
        date_of_birth: form.date_of_birth || null,
        marital_status: form.marital_status || null,
        preferred_language: form.preferred_language || "en",
      };

      await updateMyProfile(payload);
      localStorage.setItem("nbai_force_refresh", "true");
      window.dispatchEvent(new Event("nbai-bootstrap-refresh"));
      setCompleted(true);
    } catch (err) {
      console.error("Onboarding save failed:", err);

      setMessage(
        err?.response?.data?.detail || pageText.onboardingSaveError
      );
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">{pageText.loading}</p>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-xl rounded-3xl border border-green-200 bg-white p-8 text-center shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-green-700">
            {pageText.brand}
          </p>

          <h2 className="mt-3 text-2xl font-semibold text-slate-900">
            {pageText.completedTitle}
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            {pageText.completedBody}
          </p>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {pageText.readiness}: <span className="font-semibold">{readinessScore}%</span>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() =>
                navigate(
                  "/legal/disclosure?redirect=/pricing%3Fplan%3Dpro%26source%3Donboarding%26intent%3Dexecute"
                )
              }
              className="w-full rounded-2xl"
            >
              {pageText.completedPrimary}
            </Button>

            <Button
              variant="secondary"
              onClick={() =>
                navigate("/legal/disclosure?redirect=/dashboard")
              }
              className="w-full rounded-2xl"
            >
              {pageText.completedSecondary}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="mb-8">
          <p className="text-sm font-semibold text-amber-700">{pageText.brand}</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            {pageText.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            {pageText.subtitle}
          </p>
        </div>

        <AICopilotCard
          title={pageText.copilotTitle}
          description={pageText.copilotDesc}
          buttonLabel={pageText.copilotButton}
          language={language}
          prompt={
            language === "fr"
              ? `Agis comme un copilote d’onboarding en immigration.

Explique :
1. quelles informations de profil sont les plus importantes à compléter d’abord
2. quels champs ont le plus d’impact sur la stratégie
3. ce que je peux compléter plus tard
4. retourne 3 suggested_next_actions courtes et concrètes`
              : `Act as an immigration onboarding copilot.

Explain:
1. which profile details are most important to complete first
2. which fields have the biggest impact on strategy
3. what I can complete later
4. return 3 short concrete suggested_next_actions`
          }
        />

        <Card className="p-6">
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>
                {pageText.stepOf} {step} {pageText.of} 2
              </span>
              <span>{progress}%</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold">{pageText.readiness}:</span> {readinessScore}%
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {pageText.personalDetails}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {pageText.personalDetailsBody}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Input
                      label={<RequiredLabel>{pageText.firstName}</RequiredLabel>}
                      name="first_name"
                      value={form.first_name}
                      onChange={handleChange}
                    />
                    <FieldHint error={Boolean(fieldErrors.first_name)}>
                      {fieldErrors.first_name}
                    </FieldHint>
                  </div>

                  <div>
                    <Input
                      label={<RequiredLabel>{pageText.lastName}</RequiredLabel>}
                      name="last_name"
                      value={form.last_name}
                      onChange={handleChange}
                    />
                    <FieldHint error={Boolean(fieldErrors.last_name)}>
                      {fieldErrors.last_name}
                    </FieldHint>
                  </div>

                  <div className="relative" ref={nationalityFieldRef}>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      <RequiredLabel>{pageText.nationality}</RequiredLabel>
                    </label>
                    <input
                      type="text"
                      value={nationalityQuery}
                      onChange={handleNationalityInputChange}
                      onFocus={() => setShowNationalitySuggestions(true)}
                      className="input"
                      placeholder={pageText.searchNationality}
                      autoComplete="off"
                    />

                    {showNationalitySuggestions &&
                      filteredNationalityCountries.length > 0 && (
                        <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
                          {filteredNationalityCountries.map((country) => (
                            <button
                              key={country.isoCode}
                              type="button"
                              onClick={() =>
                                handleSelectNationality(country.name)
                              }
                              className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-amber-50 hover:text-slate-950 last:border-b-0"
                            >
                              {country.name}
                            </button>
                          ))}
                        </div>
                      )}

                    {showNationalitySuggestions &&
                      nationalityQuery.trim() &&
                      filteredNationalityCountries.length === 0 && (
                        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                          {pageText.noNationalityMatch}
                        </div>
                      )}

                    <FieldHint error={Boolean(fieldErrors.nationality)}>
                      {fieldErrors.nationality}
                    </FieldHint>
                  </div>

                  <div className="relative" ref={countryFieldRef}>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      <RequiredLabel>{pageText.countryOfResidence}</RequiredLabel>
                    </label>
                    <input
                      type="text"
                      value={countryQuery}
                      onChange={handleCountryInputChange}
                      onFocus={() => setShowCountrySuggestions(true)}
                      className="input"
                      placeholder={pageText.searchCountry}
                      autoComplete="off"
                    />

                    {showCountrySuggestions && filteredCountries.length > 0 && (
                      <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
                        {filteredCountries.map((country) => (
                          <button
                            key={country.isoCode}
                            type="button"
                            onClick={() => handleSelectCountry(country.name)}
                            className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-amber-50 hover:text-slate-950 last:border-b-0"
                          >
                            {country.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {showCountrySuggestions &&
                      countryQuery.trim() &&
                      filteredCountries.length === 0 && (
                        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                          {pageText.noCountryMatch}
                        </div>
                      )}

                    <FieldHint error={Boolean(fieldErrors.current_country)}>
                      {fieldErrors.current_country}
                    </FieldHint>
                  </div>

                  {showManualCityInput ? (
                    <div>
                      <Input
                        label={<RequiredLabel>{pageText.city}</RequiredLabel>}
                        name="current_city"
                        value={form.current_city}
                        onChange={handleChange}
                        placeholder={pageText.typeCity}
                      />
                      <FieldHint error={Boolean(fieldErrors.current_city)}>
                        {fieldErrors.current_city}
                      </FieldHint>
                    </div>
                  ) : (
                    <div className="relative" ref={cityFieldRef}>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        <RequiredLabel>{pageText.city}</RequiredLabel>
                      </label>
                      <input
                        type="text"
                        value={cityQuery}
                        onChange={handleCityInputChange}
                        onFocus={() => setShowCitySuggestions(true)}
                        className="input"
                        placeholder={pageText.searchCity}
                        autoComplete="off"
                      />

                      {showCitySuggestions && filteredCities.length > 0 && (
                        <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg">
                          {filteredCities.map((city) => (
                            <button
                              key={city}
                              type="button"
                              onClick={() => handleSelectCity(city)}
                              className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-amber-50 hover:text-slate-950 last:border-b-0"
                            >
                              {city}
                            </button>
                          ))}
                        </div>
                      )}

                      {showCitySuggestions &&
                        cityQuery.trim() &&
                        filteredCities.length === 0 && (
                          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                            {pageText.noCityMatch}
                          </div>
                        )}

                      <FieldHint error={Boolean(fieldErrors.current_city)}>
                        {fieldErrors.current_city}
                      </FieldHint>
                    </div>
                  )}

                  <Input
                    label={pageText.phoneNumber}
                    name="phone_number"
                    value={form.phone_number}
                    onChange={handleChange}
                  />

                  <Input
                    label={pageText.dateOfBirth}
                    name="date_of_birth"
                    type="date"
                    value={form.date_of_birth}
                    onChange={handleChange}
                  />

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      <RequiredLabel>{pageText.maritalStatus}</RequiredLabel>
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
                    <FieldHint error={Boolean(fieldErrors.marital_status)}>
                      {fieldErrors.marital_status}
                    </FieldHint>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      <RequiredLabel>{pageText.preferredLanguage}</RequiredLabel>
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
                    <FieldHint error={Boolean(fieldErrors.preferred_language)}>
                      {fieldErrors.preferred_language}
                    </FieldHint>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {pageText.helperTitle}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {pageText.helperBody}
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button type="button" onClick={nextStep}>
                    {pageText.continue}
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {pageText.immigrationProfile}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {pageText.immigrationProfileBody}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {pageText.quickFill}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {pageText.quickFillBody}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {quickFillPresets.map((preset, index) => (
                      <button
                        key={`${preset.label}-${index}`}
                        type="button"
                        onClick={() => applyQuickFill(preset.values)}
                        className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-slate-950"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">
                    {pageText.coreFieldsTitle}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {pageText.coreFieldsBody}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Input
                      label={<RequiredLabel>{pageText.age}</RequiredLabel>}
                      name="age"
                      type="number"
                      value={form.age}
                      onChange={handleChange}
                    />
                    <FieldHint error={Boolean(fieldErrors.age)}>
                      {fieldErrors.age}
                    </FieldHint>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      <RequiredLabel>{pageText.education}</RequiredLabel>
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
                    <FieldHint error={Boolean(fieldErrors.education)}>
                      {fieldErrors.education}
                    </FieldHint>
                  </div>

                  <div>
                    <Input
                      label={pageText.englishLanguageScore}
                      name="english_language_score"
                      type="number"
                      value={form.english_language_score}
                      onChange={handleChange}
                    />
                    <FieldHint error={Boolean(fieldErrors.english_language_score)}>
                      {fieldErrors.english_language_score}
                    </FieldHint>
                  </div>

                  <div>
                    <Input
                      label={pageText.frenchLanguageScore}
                      name="french_language_score"
                      type="number"
                      value={form.french_language_score}
                      onChange={handleChange}
                    />
                    <FieldHint error={Boolean(fieldErrors.french_language_score)}>
                      {fieldErrors.french_language_score}
                    </FieldHint>
                  </div>

                  <div>
                    <Input
                      label={
                        <RequiredLabel>{pageText.experienceYears}</RequiredLabel>
                      }
                      name="experience_years"
                      type="number"
                      value={form.experience_years}
                      onChange={handleChange}
                    />
                    <FieldHint error={Boolean(fieldErrors.experience_years)}>
                      {fieldErrors.experience_years}
                    </FieldHint>
                  </div>

                  <div>
                    <Input
                      label={<RequiredLabel>{pageText.occupation}</RequiredLabel>}
                      name="occupation"
                      value={form.occupation}
                      onChange={handleChange}
                    />
                    <FieldHint error={Boolean(fieldErrors.occupation)}>
                      {fieldErrors.occupation}
                    </FieldHint>

                    <button
                      type="button"
                      onClick={() => handleSuggestNOC()}
                      disabled={suggestingNoc || !normalizeText(form.occupation)}
                      className="mt-2 text-xs font-medium text-amber-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {suggestingNoc
                        ? pageText.suggestingNoc
                        : pageText.suggestNoc}
                    </button>

                    {suggestedNocs.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {pageText.suggestedNocs}
                        </p>

                        {suggestedNocs.map((noc, index) => {
                          const code =
                            noc?.noc || noc?.noc_code || noc?.code || noc?.id || "";
                          const title =
                            noc?.title || noc?.name || noc?.occupation || "";

                          return (
                            <button
                              key={`${code}-${index}`}
                              type="button"
                              onClick={() => handleSelectNoc(noc)}
                              className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm transition hover:border-amber-300 hover:bg-amber-50"
                            >
                              <span className="font-semibold text-slate-900">
                                {code}
                              </span>
                              {title ? (
                                <span className="text-slate-700"> — {title}</span>
                              ) : null}
                            </button>
                          );
                        })}

                        <p className="text-xs text-slate-500">
                          {pageText.nocHelper}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <Input
                      label={<RequiredLabel>{pageText.nocCode}</RequiredLabel>}
                      name="noc_code"
                      value={form.noc_code}
                      onChange={handleChange}
                    />
                    <FieldHint error={Boolean(fieldErrors.noc_code)}>
                      {fieldErrors.noc_code}
                    </FieldHint>
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      <RequiredLabel>{pageText.preferredProvince}</RequiredLabel>
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
                    <FieldHint error={Boolean(fieldErrors.preferred_province)}>
                      {fieldErrors.preferred_province}
                    </FieldHint>
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

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button type="button" variant="secondary" onClick={previousStep}>
                    {pageText.back}
                  </Button>

                  <Button type="submit" disabled={loading}>
                    {loading ? pageText.saving : pageText.finish}
                  </Button>
                </div>
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {message}
              </div>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
