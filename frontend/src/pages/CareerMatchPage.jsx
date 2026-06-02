import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import UpgradePrompt from "../components/UpgradePrompt";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import {
  buildPremiumPricingPath,
  buildProPricingPath,
  getMyAccess,
  getMyProfile,
  runCareerMatch,
  saveCareerJob,
} from "../api";

const PROVINCES = [
  ["ON", "Ontario"],
  ["BC", "British Columbia"],
  ["AB", "Alberta"],
  ["QC", "Quebec"],
  ["MB", "Manitoba"],
  ["SK", "Saskatchewan"],
  ["NS", "Nova Scotia"],
  ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"],
  ["PE", "Prince Edward Island"],
];

const PROVINCE_DETAILS = {
  ON: { base: 80, strengths: ["business", "administration", "technology", "finance", "health"], pathways: ["OINP", "Express Entry"], wage: [25, 48] },
  BC: { base: 76, strengths: ["technology", "health", "trades", "tourism", "education"], pathways: ["BC PNP", "Express Entry BC"], wage: [24, 46] },
  AB: { base: 74, strengths: ["trades", "construction", "energy", "health", "transport"], pathways: ["AAIP", "Express Entry"], wage: [25, 50] },
  QC: { base: 72, strengths: ["french", "health", "education", "manufacturing", "technology"], pathways: ["Quebec Skilled Worker", "PEQ"], wage: [23, 43] },
  MB: { base: 69, strengths: ["transport", "manufacturing", "health", "agriculture", "trades"], pathways: ["MPNP", "Skilled Worker in Manitoba"], wage: [22, 40] },
  SK: { base: 68, strengths: ["agriculture", "health", "trades", "transport", "construction"], pathways: ["SINP", "Occupation In-Demand"], wage: [22, 41] },
  NS: { base: 66, strengths: ["health", "education", "administration", "hospitality", "technology"], pathways: ["NSNP", "Atlantic Immigration Program"], wage: [21, 39] },
  NB: { base: 64, strengths: ["bilingual", "french", "health", "customer service", "manufacturing"], pathways: ["NBPNP", "Atlantic Immigration Program"], wage: [20, 38] },
  NL: { base: 61, strengths: ["health", "trades", "energy", "hospitality", "transport"], pathways: ["NLPNP", "Atlantic Immigration Program"], wage: [21, 40] },
  PE: { base: 59, strengths: ["hospitality", "health", "agriculture", "food", "customer service"], pathways: ["PEI PNP", "Atlantic Immigration Program"], wage: [19, 35] },
};

const OCCUPATION_SIGNALS = {
  technology: ["software", "developer", "programmer", "data", "it", "analyst", "cyber", "system"],
  business: ["business", "coordinator", "project", "manager", "consultant", "operations"],
  administration: ["admin", "administrative", "office", "coordinator", "assistant", "clerk"],
  finance: ["accountant", "bookkeeper", "finance", "payroll", "auditor"],
  health: ["nurse", "doctor", "care", "health", "medical", "personal support"],
  trades: ["mechanic", "electrician", "welder", "plumber", "carpenter", "technician"],
  construction: ["construction", "builder", "site", "foreman", "civil"],
  education: ["teacher", "instructor", "professor", "education", "trainer"],
  transport: ["driver", "truck", "logistics", "warehouse", "dispatcher", "transport"],
  hospitality: ["cook", "food", "hotel", "restaurant", "server", "hospitality"],
  agriculture: ["farm", "agriculture", "harvest", "greenhouse"],
  manufacturing: ["manufacturing", "production", "machine", "assembler", "operator"],
  "customer service": ["customer", "service", "sales", "retail", "call centre"],
  french: ["french", "bilingual", "francais", "français"],
};

function occupationCategories(occupation) {
  const text = String(occupation || "").toLowerCase();
  const categories = Object.entries(OCCUPATION_SIGNALS)
    .filter(([, terms]) => terms.some((term) => text.includes(term)))
    .map(([category]) => category);
  return categories.length ? categories : ["business"];
}

function jobBankUrl(occupation, provinceCode, language) {
  const base =
    language === "fr"
      ? "https://www.guichetemplois.gc.ca/rechercheemplois"
      : "https://www.jobbank.gc.ca/jobsearch/jobsearch";
  const province = PROVINCES.find(([code]) => code === provinceCode)?.[1] || "Canada";
  const params = new URLSearchParams({
    searchstring: occupation || "",
    locationstring: province,
  });
  return `${base}?${params.toString()}`;
}

function occupationUrl(nocCode, occupation, language) {
  const base =
    language === "fr"
      ? "https://www.guichetemplois.gc.ca/rapportmarche"
      : "https://www.jobbank.gc.ca/marketreport";
  const params = new URLSearchParams({ occupation: nocCode || occupation || "" });
  return `${base}?${params.toString()}`;
}

function demandLabel(score, language) {
  if (score >= 82) return language === "fr" ? "Élevée" : "High";
  if (score >= 70) return language === "fr" ? "Modérée" : "Moderate";
  return language === "fr" ? "Émergente" : "Emerging";
}

function buildLocalCareerMatch(form, language, access = {}) {
  const occupation = form.occupation || "Project Coordinator";
  const nocCode = form.noc_code || "";
  const experience = Number(form.years_of_experience || 0);
  const languageLevel = Number(form.language_level || 0);
  const preferred = new Set(form.preferred_provinces || []);
  const categories = occupationCategories(occupation);
  const ordered = [
    ...PROVINCES.filter(([code]) => preferred.has(code)),
    ...PROVINCES.filter(([code]) => !preferred.has(code)),
  ];

  const matches = ordered
    .map(([code, name]) => {
      const details = PROVINCE_DETAILS[code];
      const categoryHits = categories.filter((item) => details.strengths.includes(item));
      let score = details.base;
      const why = [];
      if (categoryHits.length) {
        score += 8 + Math.min(categoryHits.length * 3, 9);
        why.push(`Occupation signals align with ${categoryHits.join(", ")}.`);
      }
      if (preferred.has(code)) {
        score += 8;
        why.push("This province is in your preferred locations.");
      }
      if (languageLevel >= 7) {
        score += 6;
        why.push("Your language score strengthens employability and pathway fit.");
      } else if (languageLevel >= 4) {
        score += 3;
        why.push("Your language level gives a workable baseline for many roles.");
      }
      if (experience >= 5) {
        score += 6;
        why.push("Your experience level supports stronger job-market credibility.");
      } else if (experience >= 2) {
        score += 3;
        why.push("Your experience is relevant for entry-to-intermediate opportunities.");
      }
      const auth = String(form.work_authorization_status || "").toLowerCase();
      if (auth.includes("authorized") || auth.includes("permit") || auth.includes("resident")) {
        score += 5;
        why.push("Work authorization can reduce hiring friction.");
      }
      const finalScore = Math.max(35, Math.min(score, 98));
      const wageBump = Math.min(experience, 8);
      return {
        province: name,
        province_code: code,
        occupation,
        noc_code: nocCode,
        match_score: finalScore,
        demand_level: demandLabel(finalScore, language),
        estimated_wage_range: `$${details.wage[0] + wageBump}-${details.wage[1] + wageBump}/hr`,
        related_pathway: details.pathways.join(" / "),
        why: why.length ? why : ["This province has a broad labour market and related immigration pathways."],
        suggested_next_action:
          finalScore >= 82
            ? `Prioritize ${name}: tailor your resume and review ${details.pathways[0]}.`
            : `Compare active roles in ${name} and strengthen weaker profile signals.`,
        available_jobs_count: 0,
        live_data_status: "local_fallback",
        job_links: [
          {
            title: language === "fr" ? "Recherche Guichet-Emplois" : "Job Bank search",
            province: name,
            source: "Job Bank",
            url: jobBankUrl(occupation, code, language),
            description:
              language === "fr"
                ? "Recherche officielle par profession et province."
                : "Official Canadian job search by occupation and province.",
          },
          {
            title: language === "fr" ? "Explorer la profession" : "Explore occupation",
            province: name,
            source: "Job Bank",
            url: occupationUrl(nocCode, occupation, language),
            description:
              language === "fr"
                ? "Information officielle sur le marché du travail, salaires, perspectives et exigences."
                : "Official labour-market information, wages, prospects, and requirements.",
          },
        ],
      };
    })
    .sort((left, right) => right.match_score - left.match_score)
    .slice(0, access.can_use_full_career_match ? 6 : 2);

  return {
    occupation,
    noc_code: nocCode,
    noc_title: "",
    profile_used: {
      education: form.education,
      years_of_experience: experience,
      language_level: languageLevel,
      preferred_provinces: form.preferred_provinces,
      current_location: form.current_location,
      work_authorization_status: form.work_authorization_status,
      occupation_categories: categories,
    },
    official_sources: [
      {
        name: "Job Bank",
        url: "https://www.jobbank.gc.ca/",
        description: "Official Government of Canada job search and labour-market information.",
      },
    ],
    matches,
    access: {
      preview: true,
      full: Boolean(access.can_use_full_career_match),
      saved_jobs: Boolean(access.can_save_career_jobs),
      advanced_intelligence: Boolean(access.can_use_career_advanced_intelligence),
      limited: !access.can_use_full_career_match,
      minimum_plan_for_full: "pro",
      minimum_plan_for_advanced: "premium",
    },
  };
}

function getApiErrorDetail(err) {
  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.message ||
    ""
  );
}

function normalizeProfile(profile = {}) {
  return {
    occupation: profile.occupation || "",
    noc_code: profile.noc_code || "",
    education: profile.education || "",
    years_of_experience: profile.experience_years ?? "",
    language_level: profile.language_score ?? "",
    preferred_provinces: profile.preferred_province ? [profile.preferred_province] : [],
    current_location: [profile.current_city, profile.current_country].filter(Boolean).join(", "),
    work_authorization_status: profile.has_job_offer ? "job offer or work pathway in progress" : "",
    use_profile_defaults: true,
  };
}

function ScoreRing({ score }) {
  const value = Math.max(0, Math.min(Number(score || 0), 100));
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-xl font-semibold text-slate-950">
      {value}
    </div>
  );
}

export default function CareerMatchPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";
  const [form, setForm] = useState({
    occupation: "",
    noc_code: "",
    education: "",
    years_of_experience: "",
    language_level: "",
    preferred_provinces: [],
    current_location: "",
    work_authorization_status: "",
    use_profile_defaults: true,
  });
  const [result, setResult] = useState(null);
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingUrl, setSavingUrl] = useState("");
  const [message, setMessage] = useState("");
  const preferredProvinceKey = form.preferred_provinces.join(",");

  const text = useMemo(
    () =>
      language === "fr"
        ? {
            eyebrow: "Carrière",
            title: "NorthBridgeAI Career Match",
            subtitle:
              "Comparez votre profil aux provinces, aux emplois et aux voies d'immigration.",
            occupation: "Profession",
            noc: "Code CNP",
            education: "Éducation",
            experience: "Années d'expérience",
            language: "Niveau linguistique",
            location: "Localisation actuelle",
            workAuth: "Autorisation de travail",
            provinces: "Provinces préférées",
            run: "Trouver les meilleures provinces",
            saved: "Emplois sauvegardés",
            source: "Sources officielles",
            why: "Pourquoi",
            pathway: "Voie suggérée",
            next: "Prochaine action",
            wage: "Salaire estimé",
            demand: "Demande",
            jobs: "Offres et données",
            liveJobs: "Emplois en direct",
            liveStatus: "Données",
            save: "Sauvegarder",
            open: "Ouvrir",
            details: "Voir les emplois",
            savedMessage: "Recherche sauvegardée.",
            error: "Impossible de générer les correspondances.",
          }
        : {
            eyebrow: "Career",
            title: "NorthBridgeAI Career Match",
            subtitle:
              "Match your profile with provinces, job openings, wages, and immigration pathways.",
            occupation: "Occupation",
            noc: "NOC code",
            education: "Education",
            experience: "Years of experience",
            language: "Language level",
            location: "Current location",
            workAuth: "Work authorization",
            provinces: "Preferred provinces",
            run: "Find best provinces",
            saved: "Saved jobs",
            source: "Official sources",
            why: "Why",
            pathway: "Suggested pathway",
            next: "Next action",
            wage: "Estimated wage",
            demand: "Demand",
            jobs: "Jobs and data",
            liveJobs: "Live jobs",
            liveStatus: "Data",
            save: "Save",
            open: "Open",
            details: "View jobs",
            savedMessage: "Search saved.",
            error: "Unable to generate matches.",
          },
    [language]
  );
  const previewTitle = language === "fr" ? "Aperçu gratuit" : "Free preview";
  const previewBody =
    language === "fr"
      ? "Passez à Pro pour voir toutes les provinces recommandées et sauvegarder vos recherches Job Bank."
      : "Upgrade to Pro to see all recommended provinces and save Job Bank searches.";
  const premiumTitle =
    language === "fr"
      ? "Intelligence carrière Premium"
      : "Premium career intelligence";
  const premiumBody =
    language === "fr"
      ? "Premium débloque l'enrichissement Job Bank XML en direct lorsqu'il est configuré, avec une analyse provinciale plus avancée."
      : "Premium unlocks live Job Bank XML enrichment when configured, plus deeper provincial pathway analysis.";
  const proPath = buildProPricingPath("career-match", "full");
  const premiumPath = buildPremiumPricingPath("career-match", "advanced-intelligence");

  useEffect(() => {
    let mounted = true;
    getMyProfile()
      .then((res) => {
        if (!mounted) return;
        const next = normalizeProfile(res.data);
        setForm((current) => ({ ...current, ...next }));
      })
      .catch(() => {
        if (mounted) {
          setForm((current) => ({
            ...current,
            occupation: current.occupation || "Project Coordinator",
            noc_code: current.noc_code || "13100",
          }));
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getMyAccess()
      .then((res) => {
        if (mounted) setAccess(res.data);
      })
      .catch(() => {
        if (mounted) setAccess(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!form.occupation && !form.noc_code) return;
    const timer = window.setTimeout(() => {
      handleRun();
    }, 650);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.occupation,
    form.noc_code,
    form.years_of_experience,
    form.language_level,
    form.current_location,
    form.work_authorization_status,
    preferredProvinceKey,
    language,
  ]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleProvince(code) {
    setForm((current) => {
      const selected = new Set(current.preferred_provinces || []);
      if (selected.has(code)) selected.delete(code);
      else selected.add(code);
      return { ...current, preferred_provinces: Array.from(selected) };
    });
  }

  async function handleRun() {
    try {
      setLoading(true);
      setMessage("");
      const res = await runCareerMatch({
        ...form,
        years_of_experience:
          form.years_of_experience === "" ? null : Number(form.years_of_experience),
        language_level: form.language_level === "" ? null : Number(form.language_level),
        language,
      });
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setResult(buildLocalCareerMatch(form, language, access || {}));
      const detail = getApiErrorDetail(err);
      setMessage(
        language === "fr"
          ? `Le service backend Career Match n'est pas disponible pour le moment. Résultat dynamique local affiché.${detail ? ` (${detail})` : ""}`
          : `Career Match backend is not available right now. Showing a dynamic local result.${detail ? ` (${detail})` : ""}`
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(match, link) {
    if (!access?.can_save_career_jobs) {
      navigate(buildProPricingPath("career-match", "saved-jobs"));
      return;
    }

    try {
      setSavingUrl(link.url);
      await saveCareerJob({
        title: `${match.occupation} - ${match.province}`,
        province: match.province,
        noc_code: match.noc_code,
        occupation: match.occupation,
        job_url: link.url,
        source: link.source,
        notes: match.suggested_next_action,
      });
      setMessage(text.savedMessage);
    } catch (err) {
      console.error(err);
      const detail = getApiErrorDetail(err);
      setMessage(
        language === "fr"
          ? `Impossible de sauvegarder cette recherche tant que le backend Career Match n'est pas déployé.${detail ? ` (${detail})` : ""}`
          : `This search cannot be saved until the Career Match backend is deployed.${detail ? ` (${detail})` : ""}`
      );
    } finally {
      setSavingUrl("");
    }
  }

  return (
    <Layout>
      <section className="rounded-[30px] border border-slate-900/10 bg-[#172033] p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
          {text.eyebrow}
        </p>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight">
              {text.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70">
              {text.subtitle}
            </p>
          </div>
          <Button variant="white" onClick={() => navigate("/career-match/saved")}>
            {text.saved}
          </Button>
        </div>
      </section>

      {message ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {message}
        </div>
      ) : null}

      <Card className="mt-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{text.occupation}</span>
            <input
              className="input mt-2"
              value={form.occupation}
              onChange={(event) => updateField("occupation", event.target.value)}
              placeholder="Project Coordinator"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{text.noc}</span>
            <input
              className="input mt-2"
              value={form.noc_code}
              onChange={(event) => updateField("noc_code", event.target.value)}
              placeholder="13100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{text.experience}</span>
            <input
              className="input mt-2"
              type="number"
              min="0"
              value={form.years_of_experience}
              onChange={(event) => updateField("years_of_experience", event.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{text.language}</span>
            <input
              className="input mt-2"
              type="number"
              min="0"
              max="10"
              value={form.language_level}
              onChange={(event) => updateField("language_level", event.target.value)}
            />
          </label>
          <label className="block xl:col-span-2">
            <span className="text-sm font-medium text-slate-700">{text.education}</span>
            <input
              className="input mt-2"
              value={form.education}
              onChange={(event) => updateField("education", event.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{text.location}</span>
            <input
              className="input mt-2"
              value={form.current_location}
              onChange={(event) => updateField("current_location", event.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{text.workAuth}</span>
            <select
              className="input mt-2"
              value={form.work_authorization_status}
              onChange={(event) => updateField("work_authorization_status", event.target.value)}
            >
              <option value=""></option>
              <option value="authorized">Authorized to work</option>
              <option value="work permit">Work permit</option>
              <option value="permanent resident">Permanent resident</option>
              <option value="need sponsorship">Need sponsorship</option>
              <option value="outside canada">Outside Canada</option>
            </select>
          </label>
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-slate-700">{text.provinces}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PROVINCES.map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => toggleProvince(code)}
                className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                  form.preferred_provinces.includes(code)
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-amber-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={handleRun} loading={loading}>
            {loading ? "..." : text.run}
          </Button>
        </div>
      </Card>

      {!access?.can_use_full_career_match || result?.access?.limited ? (
        <UpgradePrompt
          className="mt-5"
          title={previewTitle}
          body={previewBody}
          buttonLabel={language === "fr" ? "Voir Pro" : "See Pro"}
          pricingPath={proPath}
          compact
        />
      ) : null}

      {!access?.can_use_career_advanced_intelligence ? (
        <UpgradePrompt
          className="mt-5"
          title={premiumTitle}
          body={premiumBody}
          buttonLabel={language === "fr" ? "Voir Premium" : "See Premium"}
          pricingPath={premiumPath}
          compact
        />
      ) : null}

      {result?.official_sources?.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {result.official_sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-amber-300"
            >
              {text.source}: {source.name}
            </a>
          ))}
        </div>
      ) : null}

      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        {(result?.matches || []).map((match) => (
          <Card key={match.province_code}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                  {match.province_code}
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {match.province}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {match.occupation} {match.noc_code ? `- ${match.noc_code}` : ""}
                </p>
              </div>
              <ScoreRing score={match.match_score} />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {text.demand}
                </p>
                <p className="mt-2 font-semibold text-slate-950">{match.demand_level}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {text.wage}
                </p>
                <p className="mt-2 font-semibold text-slate-950">
                  {match.estimated_wage_range}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {text.pathway}
                </p>
                <p className="mt-2 font-semibold text-slate-950">{match.related_pathway}</p>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-950">{text.liveJobs}: </span>
              {match.available_jobs_count || 0}
              <span className="mx-2 text-slate-300">|</span>
              <span className="font-semibold text-slate-950">{text.liveStatus}: </span>
              {match.live_data_status || "not_configured"}
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-950">{text.why}</p>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
                {match.why.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              <span className="font-semibold">{text.next}: </span>
              {match.suggested_next_action}
            </div>

            <div className="mt-5">
              <p className="text-sm font-semibold text-slate-950">{text.jobs}</p>
              <div className="mt-3 grid gap-2">
                {match.job_links.map((link) => (
                  <div
                    key={link.url}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-950">{link.title}</p>
                      <p className="text-sm text-slate-500">{link.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSave(match, link)}
                        loading={savingUrl === link.url}
                      >
                        {access?.can_save_career_jobs
                          ? text.save
                          : language === "fr"
                          ? "Pro"
                          : "Pro"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/career-match/province?province=${encodeURIComponent(
                              match.province_code
                            )}&occupation=${encodeURIComponent(match.occupation)}&noc=${encodeURIComponent(
                              match.noc_code || ""
                            )}`
                          )
                        }
                      >
                        {text.details}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </section>
    </Layout>
  );
}
