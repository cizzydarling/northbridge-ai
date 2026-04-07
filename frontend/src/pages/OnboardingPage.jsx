import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Country, City } from "country-state-city";
import {
  createProfile,
  getMyProfile,
  suggestNOC,
  updateMyProfile,
} from "../api";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
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

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [form, setForm] = useState(defaultForm);
  const [profileExists, setProfileExists] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(1);

  const [suggestedNocs, setSuggestedNocs] = useState([]);
  const [suggestingNoc, setSuggestingNoc] = useState(false);

  const [countryQuery, setCountryQuery] = useState("");
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);

  const [cityQuery, setCityQuery] = useState("");
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  const countryFieldRef = useRef(null);
  const cityFieldRef = useRef(null);

  const countries = useMemo(() => {
    return Country.getAllCountries()
      .map((country) => ({
        name: country.name,
        isoCode: country.isoCode,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const filteredCountries = useMemo(() => {
    const query = String(countryQuery || "").trim().toLowerCase();

    if (!query) return countries.slice(0, 12);

    return countries
      .filter((country) => country.name.toLowerCase().includes(query))
      .slice(0, 12);
  }, [countries, countryQuery]);

  const selectedCountry = useMemo(() => {
    return countries.find((country) => country.name === form.current_country) || null;
  }, [countries, form.current_country]);

  const availableCities = useMemo(() => {
    if (!selectedCountry?.isoCode) return [];

    return City.getCitiesOfCountry(selectedCountry.isoCode)
      .map((city) => city.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [selectedCountry]);

  const filteredCities = useMemo(() => {
    if (!availableCities.length) return [];
    const query = String(cityQuery || "").trim().toLowerCase();

    if (!query) return availableCities.slice(0, 10);

    return availableCities
      .filter((city) => city.toLowerCase().includes(query))
      .slice(0, 10);
  }, [availableCities, cityQuery]);

  const showManualCityInput = useMemo(() => {
    return !form.current_country || availableCities.length === 0;
  }, [form.current_country, availableCities]);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const res = await getMyProfile();
        if (!mounted) return;

        const merged = {
          ...defaultForm,
          ...res.data,
        };

        setForm(merged);
        setCountryQuery(merged.current_country || "");
        setCityQuery(merged.current_city || "");
        setProfileExists(true);
      } catch (err) {
        if (err?.response?.status === 404) {
          setProfileExists(false);
        } else {
          setMessage(
            language === "fr"
              ? "Impossible de charger les informations d’onboarding."
              : "Unable to load onboarding information."
          );
        }
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
        countryFieldRef.current &&
        !countryFieldRef.current.contains(event.target)
      ) {
        setShowCountrySuggestions(false);
      }

      if (cityFieldRef.current && !cityFieldRef.current.contains(event.target)) {
        setShowCitySuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const progress = useMemo(() => {
    return step === 1 ? 50 : 100;
  }, [step]);

  const pageText = useMemo(() => {
    if (language === "fr") {
      return {
        loading: "Chargement de l’onboarding...",
        brand: "NorthBridgeAI",
        title: "Bienvenue — configurons votre profil",
        subtitle:
          "Complétez quelques informations clés pour que votre stratégie, votre guidance IA et vos documents soient personnalisés dès le départ.",
        stepOf: "Étape",
        of: "sur",
        personalDetails: "Informations personnelles",
        personalDetailsBody:
          "Ces informations nous aident à personnaliser votre expérience et vos documents générés.",
        immigrationProfile: "Profil d’immigration",
        immigrationProfileBody:
          "Ces informations alimentent votre moteur de stratégie et vos recommandations.",
        firstName: "Prénom",
        lastName: "Nom",
        nationality: "Nationalité",
        countryOfResidence: "Pays de résidence",
        city: "Ville",
        phoneNumber: "Numéro de téléphone",
        dateOfBirth: "Date de naissance",
        maritalStatus: "État civil",
        preferredLanguage: "Langue préférée",
        searchCountry: "Recherchez ou entrez votre pays",
        searchCity: "Recherchez ou entrez votre ville",
        typeCity: "Entrez votre ville",
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
          "Comprenez quelles informations sont les plus importantes à compléter pour partir sur de bonnes bases.",
        copilotButton: "Que dois-je remplir ?",
        quickFill: "Remplissage rapide",
        quickFillBody:
          "Utilisez un point de départ proche de votre situation, puis ajustez les détails.",
        helperTitle: "Pourquoi cela compte",
        helperBody:
          "Un meilleur profil donne une meilleure stratégie, une meilleure guidance, et des documents plus pertinents.",
        suggestNoc: "Suggérer le code CNP",
        suggestingNoc: "Suggestion...",
        suggestedNocs: "Suggestions de CNP",
        nocHelper:
          "Choisissez la suggestion la plus proche de votre profession pour améliorer la qualité de votre stratégie.",
        onboardingSaveError:
          "Échec de l’enregistrement des informations d’onboarding.",
        nocSuggestionError:
          "Impossible de suggérer un code CNP pour le moment.",
      };
    }

    return {
      loading: "Loading onboarding...",
      brand: "NorthBridgeAI",
      title: "Welcome — let’s set up your profile",
      subtitle:
        "Complete a few key details so your strategy, AI guidance, and documents are personalized from the start.",
      stepOf: "Step",
      of: "of",
      personalDetails: "Personal details",
      personalDetailsBody:
        "These details help us personalize your experience and your generated documents.",
      immigrationProfile: "Immigration profile",
      immigrationProfileBody:
        "These details power your strategy engine and recommendation logic.",
      firstName: "First Name",
      lastName: "Last Name",
      nationality: "Nationality",
      countryOfResidence: "Country of Residence",
      city: "City",
      phoneNumber: "Phone Number",
      dateOfBirth: "Date of Birth",
      maritalStatus: "Marital Status",
      preferredLanguage: "Preferred Language",
      searchCountry: "Search or enter your country",
      searchCity: "Search or enter your city",
      typeCity: "Enter your city",
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
        "Understand which details matter most so you can start with a stronger foundation.",
      copilotButton: "What should I fill in?",
      quickFill: "Quick fill",
      quickFillBody:
        "Use a starting point close to your situation, then adjust the details.",
      helperTitle: "Why this matters",
      helperBody:
        "A better profile leads to a better strategy, stronger guidance, and more relevant documents.",
      suggestNoc: "Suggest NOC code",
      suggestingNoc: "Suggesting...",
      suggestedNocs: "Suggested NOCs",
      nocHelper:
        "Choose the closest suggestion to improve the quality of your strategy.",
      onboardingSaveError: "Failed to save onboarding details.",
      nocSuggestionError: "Unable to suggest a NOC code right now.",
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

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    if (name === "occupation") {
      setSuggestedNocs([]);
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleCountryInputChange(e) {
    const value = e.target.value;
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
    setCityQuery(value);
    setForm((prev) => ({
      ...prev,
      current_city: value,
    }));
    setShowCitySuggestions(true);
  }

  function handleSelectCity(city) {
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

  function nextStep() {
    setStep(2);
    setMessage("");
  }

  function previousStep() {
    setStep(1);
    setMessage("");
  }

  async function handleSuggestNOC() {
    if (!form.occupation?.trim()) {
      return;
    }

    try {
      setSuggestingNoc(true);
      setMessage("");

      const res = await suggestNOC({
        occupation: form.occupation.trim(),
        language,
      });

      const matches =
        res?.data?.matches ||
        res?.data?.suggestions ||
        res?.data?.results ||
        [];

      setSuggestedNocs(Array.isArray(matches) ? matches : []);
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail || pageText.nocSuggestionError
      );
      setSuggestedNocs([]);
    } finally {
      setSuggestingNoc(false);
    }
  }

  function handleSelectNoc(noc) {
    const selectedCode =
      noc?.noc_code || noc?.code || noc?.id || "";
    const selectedTitle =
      noc?.title || noc?.name || noc?.occupation || "";

    setForm((prev) => ({
      ...prev,
      noc_code: selectedCode || prev.noc_code,
      occupation: selectedTitle || prev.occupation,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const payload = {
        ...form,
        age: Number(form.age),
        language_score: Number(form.language_score),
        experience_years: Number(form.experience_years),
        occupation: form.occupation?.trim() || null,
        noc_code: form.noc_code?.trim() || null,
        preferred_province: form.preferred_province || null,
        first_name: form.first_name?.trim() || null,
        last_name: form.last_name?.trim() || null,
        nationality: form.nationality?.trim() || null,
        current_country: form.current_country?.trim() || null,
        current_city: form.current_city?.trim() || null,
        phone_number: form.phone_number?.trim() || null,
        date_of_birth: form.date_of_birth || null,
        marital_status: form.marital_status || null,
        preferred_language: form.preferred_language || "en",
      };

      try {
        await updateMyProfile(payload);
        setProfileExists(true);
      } catch (err) {
        if (err?.response?.status === 404) {
          await createProfile(payload);
          setProfileExists(true);
        } else {
          throw err;
        }
      }

      navigate("/dashboard");
    } catch (err) {
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

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-600">{pageText.brand}</p>
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

Explique:
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
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
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
                  <Input
                    label={pageText.firstName}
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                  />

                  <Input
                    label={pageText.lastName}
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                  />

                  <Input
                    label={pageText.nationality}
                    name="nationality"
                    value={form.nationality}
                    onChange={handleChange}
                  />

                  <div className="relative" ref={countryFieldRef}>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      {pageText.countryOfResidence}
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
                            className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 hover:bg-blue-50 last:border-b-0"
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
                  </div>

                  {showManualCityInput ? (
                    <Input
                      label={pageText.city}
                      name="current_city"
                      value={form.current_city}
                      onChange={handleChange}
                      placeholder={pageText.typeCity}
                    />
                  ) : (
                    <div className="relative" ref={cityFieldRef}>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        {pageText.city}
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
                              className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 hover:bg-blue-50 last:border-b-0"
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
                        className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label={pageText.age}
                    name="age"
                    type="number"
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
                    label={pageText.languageScore}
                    name="language_score"
                    type="number"
                    value={form.language_score}
                    onChange={handleChange}
                  />

                  <Input
                    label={pageText.experienceYears}
                    name="experience_years"
                    type="number"
                    value={form.experience_years}
                    onChange={handleChange}
                  />

                  <div>
                    <Input
                      label={pageText.occupation}
                      name="occupation"
                      value={form.occupation}
                      onChange={handleChange}
                    />

                    <button
                      type="button"
                      onClick={handleSuggestNOC}
                      disabled={suggestingNoc || !form.occupation?.trim()}
                      className="mt-2 text-xs font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
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
                            noc?.noc_code || noc?.code || noc?.id || "";
                          const title =
                            noc?.title || noc?.name || noc?.occupation || "";

                          return (
                            <button
                              key={`${code}-${index}`}
                              type="button"
                              onClick={() => handleSelectNoc(noc)}
                              className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50"
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

                  <Input
                    label={pageText.nocCode}
                    name="noc_code"
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