import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import UpgradePrompt from "../components/UpgradePrompt";
import {
  getBillingAccess,
  getCachedBillingAccess,
  getMyProfile,
} from "../api";

const OFFICIAL_URLS = {
  en: {
    language:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html",
    dli:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/prepare/designated-learning-institutions-list.html",
    pgwp:
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation/eligibility.html",
  },
  fr: {
    language:
      "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/entree-express/documents/examen-langue.html",
    dli:
      "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/etudier-canada/permis-etudes/preparer/liste-etablissements-enseignement-designes.html",
    pgwp:
      "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/etudier-canada/travail/apres-obtention-diplome/admissibilite.html",
  },
};

const TESTS = [
  {
    id: "celpip",
    language: "english",
    name: "CELPIP-General",
    organization: "Paragon Testing Enterprises",
    directoryUrl: "https://www.celpip.ca/take-celpip/where-do-we-test/",
    acceptedVersion: "CELPIP-General",
    delivery: {
      en: "Computer-based at an official test centre",
      fr: "Sur ordinateur dans un centre d’examen officiel",
    },
    remoteAccepted: false,
  },
  {
    id: "ielts",
    language: "english",
    name: {
      en: "IELTS General Training",
      fr: "IELTS – formation générale",
    },
    organization: "IELTS",
    directoryUrl: "https://ielts.org/test-centres",
    acceptedVersion: {
      en: "General Training",
      fr: "Formation générale",
    },
    delivery: {
      en: "On paper or computer at an official test centre",
      fr: "Sur papier ou ordinateur dans un centre d’examen officiel",
    },
    remoteAccepted: false,
    note: {
      en: "IELTS Academic and IELTS Online are not the Express Entry test version.",
      fr: "IELTS Academic et IELTS Online ne sont pas les versions acceptées pour Entrée express.",
    },
  },
  {
    id: "pte",
    language: "english",
    name: "PTE Core",
    organization: "Pearson",
    directoryUrl: "https://www.pearsonpte.com/pte-core",
    acceptedVersion: "PTE Core",
    delivery: {
      en: "Computer-based at an authorized PTE test centre",
      fr: "Sur ordinateur dans un centre PTE autorisé",
    },
    remoteAccepted: false,
    note: {
      en: "Pearson states that PTE Core cannot be taken at home.",
      fr: "Pearson précise que le PTE Core ne peut pas être passé à domicile.",
    },
  },
  {
    id: "tef",
    language: "french",
    name: "TEF Canada",
    organization: "CCI Paris Ile-de-France",
    directoryUrl:
      "https://www.lefrancaisdesaffaires.fr/candidat/trouver-un-centre-agree/",
    acceptedVersion: "TEF Canada",
    delivery: {
      en: "At an approved examination centre",
      fr: "Dans un centre d’examen agréé",
    },
    remoteAccepted: false,
  },
  {
    id: "tcf",
    language: "french",
    name: "TCF Canada",
    organization: "France Education international",
    directoryUrl:
      "https://www.france-education-international.fr/centres-d-examen/carte",
    acceptedVersion: "TCF Canada",
    delivery: {
      en: "At an approved examination centre",
      fr: "Dans un centre d’examen agréé",
    },
    remoteAccepted: false,
  },
];

const PROVINCES = [
  ["AB", { en: "Alberta", fr: "Alberta" }],
  ["BC", { en: "British Columbia", fr: "Colombie-Britannique" }],
  ["MB", { en: "Manitoba", fr: "Manitoba" }],
  ["NB", { en: "New Brunswick", fr: "Nouveau-Brunswick" }],
  ["NL", { en: "Newfoundland and Labrador", fr: "Terre-Neuve-et-Labrador" }],
  ["NT", { en: "Northwest Territories", fr: "Territoires du Nord-Ouest" }],
  ["NS", { en: "Nova Scotia", fr: "Nouvelle-Écosse" }],
  ["NU", { en: "Nunavut", fr: "Nunavut" }],
  ["ON", { en: "Ontario", fr: "Ontario" }],
  ["PE", { en: "Prince Edward Island", fr: "Île-du-Prince-Édouard" }],
  ["QC", { en: "Quebec", fr: "Québec" }],
  ["SK", { en: "Saskatchewan", fr: "Saskatchewan" }],
  ["YT", { en: "Yukon", fr: "Yukon" }],
];

function normalizeScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeProvince(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";

  const match = PROVINCES.find(
    ([code, names]) =>
      code.toLowerCase() === normalized ||
      names.en.toLowerCase() === normalized ||
      names.fr.toLowerCase() === normalized
  );
  return match?.[0] || "";
}

function openOfficial(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function SegmentedControl({ value, onChange, options, label }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`min-h-10 whitespace-nowrap rounded-md px-4 text-sm font-medium transition ${
              value === option.value
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ children, tone = "neutral" }) {
  const styles = {
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
        styles[tone] || styles.neutral
      }`}
    >
      {children}
    </span>
  );
}

export default function OfficialFindersPage() {
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";
  const [activeTab, setActiveTab] = useState("tests");
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState(() => getCachedBillingAccess());
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [testLanguage, setTestLanguage] = useState("all");
  const [delivery, setDelivery] = useState("all");
  const [province, setProvince] = useState("");
  const [schoolQuery, setSchoolQuery] = useState("");
  const [pgwpPriority, setPgwpPriority] = useState(true);

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([getMyProfile(), getBillingAccess()])
      .then(([profileResult, accessResult]) => {
        if (!mounted) return;
        if (profileResult.status === "fulfilled") {
          const nextProfile = profileResult.value?.data || null;
          setProfile(nextProfile);
          setCountry(nextProfile?.current_country || "");
          setCity(nextProfile?.current_city || "");
          setProvince(normalizeProvince(nextProfile?.preferred_province));
        }
        if (accessResult.status === "fulfilled") {
          setAccess(accessResult.value?.data || getCachedBillingAccess());
        }
      })
      .catch((error) => {
        console.error("Unable to load official finders", error);
        if (mounted) setAccess(getCachedBillingAccess());
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const copy =
    language === "fr"
      ? {
          eyebrow: "Ressources officielles",
          title: "Centres de tests et établissements désignés",
          subtitle:
            "Trouvez les bons répertoires officiels selon votre lieu, votre profil linguistique et votre projet d’études.",
          tests: "Tests de langue",
          schools: "Établissements d’enseignement désignés",
          location: "Lieu actuel",
          country: "Pays",
          city: "Ville",
          languageFilter: "Langue du test",
          deliveryFilter: "Mode",
          all: "Tous",
          english: "Anglais",
          french: "Français",
          inPerson: "En centre",
          remote: "À distance",
          officialDirectory: "Voir les centres officiels",
          accepted: "Version acceptée",
          noRemoteTitle: "Aucun test d’immigration à domicile accepté",
          noRemoteBody:
            "Les tests acceptés par IRCC doivent actuellement être passés dans un centre autorisé. Les cours ou tests de préparation en ligne ne remplacent pas l’examen officiel.",
          profileRecommendation: "Recommandation selon votre profil",
          strongerEnglish: "Votre résultat anglais est actuellement le plus fort.",
          strongerFrench: "Votre résultat français est actuellement le plus fort.",
          bothLanguages:
            "Comparer les options anglaises et françaises peut renforcer votre stratégie bilingue.",
          noScores:
            "Ajoutez vos résultats anglais et français au profil pour obtenir une recommandation plus précise.",
          locationHint:
            "Les disponibilités et tarifs changent. Confirmez toujours la ville, la date et la version du test sur le site du fournisseur.",
          officialIrcc: "Consulter les tests acceptés par IRCC",
          dliIntro:
            "Un établissement d’enseignement désigné (EED) est autorisé par une province ou un territoire à accueillir des étudiants internationaux.",
          province: "Province ou territoire",
          keyword: "Ville ou nom de l’établissement",
          pgwp: "Prioriser les programmes admissibles au permis de travail postdiplôme (PTPD)",
          searchPlan: "Votre recherche recommandée",
          searchOfficial: "Ouvrir la liste officielle des EED",
          pgwpRules: "Vérifier les règles du PTPD",
          dliWarning:
            "Le statut d’EED ne garantit pas qu’un programme précis est admissible au PTPD. Vérifiez l’établissement et le programme avant de payer des frais.",
          profileProvince: "Province préférée du profil",
          noProvince: "Aucune province sélectionnée",
          queryLabel: "Terme à rechercher",
          allInstitutions: "Tous les établissements postsecondaires",
          verified: "Sources vérifiées le 18 juin 2026",
          englishScore: "Anglais",
          frenchScore: "Français",
          pgwpPriorityActive: "PTPD prioritaire",
          pgwpOptional: "PTPD facultatif",
          loadingProfile: "Chargement du profil...",
          premiumOnly: "Fonctionnalité Premium",
          premiumGateTitle:
            "Débloquez les centres de tests et les établissements désignés",
          premiumGateBody:
            "Premium inclut les recherches personnalisées selon votre profil, les répertoires officiels de centres de tests et le guide des EED et du PTPD.",
          premiumGateCta: "Passer à Premium",
        }
      : {
          eyebrow: "Official resources",
          title: "Test centres and designated schools",
          subtitle:
            "Use your location, language profile, and study goals to reach the correct official directories.",
          tests: "Language tests",
          schools: "DLI schools",
          location: "Current location",
          country: "Country",
          city: "City",
          languageFilter: "Test language",
          deliveryFilter: "Delivery",
          all: "All",
          english: "English",
          french: "French",
          inPerson: "At a centre",
          remote: "Online / remote",
          officialDirectory: "View official centres",
          accepted: "Accepted version",
          noRemoteTitle: "No accepted at-home immigration test",
          noRemoteBody:
            "IRCC-accepted immigration tests currently need to be taken at an authorized centre. Online courses and preparation tests do not replace the official exam.",
          profileRecommendation: "Profile-based recommendation",
          strongerEnglish: "Your English result is currently the stronger score.",
          strongerFrench: "Your French result is currently the stronger score.",
          bothLanguages:
            "Comparing English and French options may support a stronger bilingual strategy.",
          noScores:
            "Add both English and French results to your profile for a more precise recommendation.",
          locationHint:
            "Availability and prices change. Always confirm the city, date, and accepted test version on the provider’s website.",
          officialIrcc: "Review IRCC accepted tests",
          dliIntro:
            "A DLI is a school approved by a province or territory to host international students.",
          province: "Province or territory",
          keyword: "City or institution name",
          pgwp: "Prioritize programs eligible for a post-graduation work permit",
          searchPlan: "Your recommended search",
          searchOfficial: "Open official DLI list",
          pgwpRules: "Check PGWP rules",
          dliWarning:
            "DLI status does not guarantee that a specific program is PGWP-eligible. Verify both the institution and program before paying fees.",
          profileProvince: "Profile preferred province",
          noProvince: "No province selected",
          queryLabel: "Search term",
          allInstitutions: "All post-secondary institutions",
          verified: "Sources verified June 18, 2026",
          englishScore: "English",
          frenchScore: "French",
          pgwpPriorityActive: "PGWP priority",
          pgwpOptional: "PGWP optional",
          loadingProfile: "Loading profile...",
          premiumOnly: "Premium feature",
          premiumGateTitle: "Unlock test centres and designated schools",
          premiumGateBody:
            "Premium includes profile-based test-centre guidance, official provider directories, and the DLI and PGWP study-school finder.",
          premiumGateCta: "Upgrade to Premium",
        };

  const hasFinderAccess = Boolean(
    access?.can_use_official_finders || access?.is_premium
  );

  if (loading) {
    return (
      <Layout>
        <p className="text-sm text-slate-600">{copy.loadingProfile}</p>
      </Layout>
    );
  }

  if (!hasFinderAccess) {
    return (
      <Layout>
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            {copy.premiumOnly}
          </p>
          <UpgradePrompt
            className="mt-4"
            title={copy.premiumGateTitle}
            body={copy.premiumGateBody}
            buttonLabel={copy.premiumGateCta}
            pricingPath="/pricing?plan=premium&source=official_finders&intent=unlock"
          />
        </div>
      </Layout>
    );
  }

  const englishScore = normalizeScore(
    profile?.english_language_score ?? profile?.language_score
  );
  const frenchScore = normalizeScore(profile?.french_language_score);

  const recommendation = (() => {
    if (englishScore === null && frenchScore === null) return copy.noScores;
    if (englishScore !== null && frenchScore !== null) {
      if (englishScore > frenchScore) return copy.strongerEnglish;
      if (frenchScore > englishScore) return copy.strongerFrench;
      return copy.bothLanguages;
    }
    return englishScore !== null ? copy.strongerEnglish : copy.strongerFrench;
  })();

  const visibleTests = TESTS.filter((test) => {
    if (testLanguage !== "all" && test.language !== testLanguage) return false;
    if (delivery === "remote") return test.remoteAccepted;
    return true;
  });

  const provinceName =
    PROVINCES.find(([code]) => code === province)?.[1]?.[language] ||
    province ||
    copy.noProvince;

  const officialUrls = OFFICIAL_URLS[language];
  const localized = (value) =>
    typeof value === "object" && value !== null ? value[language] : value;

  return (
    <Layout>
      <header className="border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
          {copy.eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950 md:text-4xl">
          {copy.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          {copy.subtitle}
        </p>
      </header>

      <div className="mt-6">
        <SegmentedControl
          value={activeTab}
          onChange={setActiveTab}
          label={copy.eyebrow}
          options={[
            { value: "tests", label: copy.tests },
            { value: "schools", label: copy.schools },
          ]}
        />
      </div>

      {activeTab === "tests" ? (
        <div className="mt-7 space-y-7">
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                {copy.location}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input
                  label={copy.country}
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  disabled={loading}
                />
                <Input
                  label={copy.city}
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="mt-5 flex flex-wrap gap-5">
                <SegmentedControl
                  value={testLanguage}
                  onChange={setTestLanguage}
                  label={copy.languageFilter}
                  options={[
                    { value: "all", label: copy.all },
                    { value: "english", label: copy.english },
                    { value: "french", label: copy.french },
                  ]}
                />
                <SegmentedControl
                  value={delivery}
                  onChange={setDelivery}
                  label={copy.deliveryFilter}
                  options={[
                    { value: "all", label: copy.all },
                    { value: "in_person", label: copy.inPerson },
                    { value: "remote", label: copy.remote },
                  ]}
                />
              </div>
            </div>

            <Card padding="lg" className="border-emerald-200 bg-emerald-50/50">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                {copy.profileRecommendation}
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {recommendation}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill tone="success">
                  {copy.englishScore}: {englishScore ?? "--"}
                </StatusPill>
                <StatusPill tone="success">
                  {copy.frenchScore}: {frenchScore ?? "--"}
                </StatusPill>
              </div>
              {loading ? (
                <p className="mt-3 text-xs text-slate-500">
                  {copy.loadingProfile}
                </p>
              ) : null}
            </Card>
          </section>

          {delivery === "remote" ? (
            <section className="border-y border-amber-200 bg-amber-50 px-5 py-6">
              <h2 className="text-lg font-semibold text-amber-950">
                {copy.noRemoteTitle}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-amber-900">
                {copy.noRemoteBody}
              </p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => openOfficial(officialUrls.language)}
              >
                {copy.officialIrcc}
              </Button>
            </section>
          ) : (
            <section>
              <div className="grid gap-4 lg:grid-cols-2">
                {visibleTests.map((test) => (
                  <Card key={test.id} padding="lg">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          {test.organization}
                        </p>
                        <h2 className="mt-2 text-xl font-semibold text-slate-950">
                          {localized(test.name)}
                        </h2>
                      </div>
                      <StatusPill tone={test.remoteAccepted ? "success" : "warning"}>
                        {test.remoteAccepted ? copy.remote : copy.inPerson}
                      </StatusPill>
                    </div>
                    <dl className="mt-5 space-y-3 text-sm">
                      <div>
                        <dt className="font-medium text-slate-500">{copy.accepted}</dt>
                        <dd className="mt-1 text-slate-900">
                          {localized(test.acceptedVersion)}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">{copy.deliveryFilter}</dt>
                        <dd className="mt-1 text-slate-900">
                          {localized(test.delivery)}
                        </dd>
                      </div>
                    </dl>
                    {test.note ? (
                      <p className="mt-4 text-sm leading-6 text-amber-800">
                        {localized(test.note)}
                      </p>
                    ) : null}
                    <Button
                      className="mt-5"
                      onClick={() => openOfficial(test.directoryUrl)}
                    >
                      {copy.officialDirectory}
                    </Button>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <p className="text-sm leading-6 text-slate-500">
            {[city, country].filter(Boolean).join(", ") || copy.location}
            {" · "}
            {copy.locationHint}
          </p>
        </div>
      ) : (
        <div className="mt-7 space-y-7">
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                {copy.schools}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                {copy.dliIntro}
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="block text-sm font-medium text-slate-700">
                    {copy.province}
                  </span>
                  <select
                    value={province}
                    onChange={(event) => setProvince(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                  >
                    <option value="">{copy.all}</option>
                    {PROVINCES.map(([code, names]) => (
                      <option key={code} value={code}>
                        {names[language]}
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label={copy.keyword}
                  value={schoolQuery}
                  onChange={(event) => setSchoolQuery(event.target.value)}
                  placeholder={city || ""}
                />
              </div>

              <label className="mt-5 flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={pgwpPriority}
                  onChange={(event) => setPgwpPriority(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-amber-300"
                />
                <span>{copy.pgwp}</span>
              </label>
            </div>

            <Card padding="lg" className="border-blue-200 bg-blue-50/50">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
                {copy.searchPlan}
              </p>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">{copy.profileProvince}</dt>
                  <dd className="mt-1 font-semibold text-slate-950">
                    {provinceName}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{copy.queryLabel}</dt>
                  <dd className="mt-1 font-semibold text-slate-950">
                    {schoolQuery || city || copy.allInstitutions}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusPill tone={pgwpPriority ? "success" : "neutral"}>
                  {pgwpPriority
                    ? copy.pgwpPriorityActive
                    : copy.pgwpOptional}
                </StatusPill>
                <StatusPill>{provinceName}</StatusPill>
              </div>
            </Card>
          </section>

          <section className="border-y border-red-200 bg-red-50 px-5 py-6">
            <p className="max-w-4xl text-sm leading-7 text-red-900">
              {copy.dliWarning}
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => openOfficial(officialUrls.dli)}>
              {copy.searchOfficial}
            </Button>
            <Button
              variant="secondary"
              onClick={() => openOfficial(officialUrls.pgwp)}
            >
              {copy.pgwpRules}
            </Button>
          </div>
        </div>
      )}

      <footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-500">
        {copy.verified}
      </footer>
    </Layout>
  );
}
