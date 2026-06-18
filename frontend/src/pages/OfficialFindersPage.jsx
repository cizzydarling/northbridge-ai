import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import { getMyProfile } from "../api";

const IRCC_LANGUAGE_URL =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html";
const IRCC_DLI_URL =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/prepare/designated-learning-institutions-list.html";
const IRCC_PGWP_URL =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation/eligibility.html";

const TESTS = [
  {
    id: "celpip",
    language: "english",
    name: "CELPIP-General",
    organization: "Paragon Testing Enterprises",
    directoryUrl: "https://www.celpip.ca/take-celpip/where-do-we-test/",
    acceptedVersion: "CELPIP-General",
    delivery: "Computer-based at an official test centre",
    remoteAccepted: false,
  },
  {
    id: "ielts",
    language: "english",
    name: "IELTS General Training",
    organization: "IELTS",
    directoryUrl: "https://ielts.org/test-centres",
    acceptedVersion: "General Training",
    delivery: "Paper or computer at an official test centre",
    remoteAccepted: false,
    note: "IELTS Academic and IELTS Online are not the Express Entry test version.",
  },
  {
    id: "pte",
    language: "english",
    name: "PTE Core",
    organization: "Pearson",
    directoryUrl: "https://www.pearsonpte.com/pte-core",
    acceptedVersion: "PTE Core",
    delivery: "Computer-based at an authorized PTE test centre",
    remoteAccepted: false,
    note: "Pearson states that PTE Core cannot be taken at home.",
  },
  {
    id: "tef",
    language: "french",
    name: "TEF Canada",
    organization: "CCI Paris Ile-de-France",
    directoryUrl:
      "https://www.lefrancaisdesaffaires.fr/candidat/trouver-un-centre-agree/",
    acceptedVersion: "TEF Canada",
    delivery: "At an approved examination centre",
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
    delivery: "At an approved examination centre",
    remoteAccepted: false,
  },
];

const PROVINCES = [
  ["AB", "Alberta"],
  ["BC", "British Columbia"],
  ["MB", "Manitoba"],
  ["NB", "New Brunswick"],
  ["NL", "Newfoundland and Labrador"],
  ["NT", "Northwest Territories"],
  ["NS", "Nova Scotia"],
  ["NU", "Nunavut"],
  ["ON", "Ontario"],
  ["PE", "Prince Edward Island"],
  ["QC", "Quebec"],
  ["SK", "Saskatchewan"],
  ["YT", "Yukon"],
];

function normalizeScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeProvince(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";

  const match = PROVINCES.find(
    ([code, name]) =>
      code.toLowerCase() === normalized || name.toLowerCase() === normalized
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
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [testLanguage, setTestLanguage] = useState("all");
  const [delivery, setDelivery] = useState("all");
  const [province, setProvince] = useState("");
  const [schoolQuery, setSchoolQuery] = useState("");
  const [pgwpPriority, setPgwpPriority] = useState(true);

  useEffect(() => {
    let mounted = true;

    getMyProfile()
      .then((response) => {
        if (!mounted) return;
        const nextProfile = response?.data || null;
        setProfile(nextProfile);
        setCountry(nextProfile?.current_country || "");
        setCity(nextProfile?.current_city || "");
        setProvince(normalizeProvince(nextProfile?.preferred_province));
      })
      .catch((error) => {
        console.error("Unable to load profile for official finders", error);
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
          schools: "Établissements DLI",
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
            "Une DLI est un établissement autorisé par une province ou un territoire à accueillir des étudiants internationaux.",
          province: "Province ou territoire",
          keyword: "Ville ou nom de l’établissement",
          pgwp: "Prioriser les programmes admissibles au permis de travail postdiplôme",
          searchPlan: "Votre recherche recommandée",
          searchOfficial: "Ouvrir la liste officielle des DLI",
          pgwpRules: "Vérifier les règles du PGWP",
          dliWarning:
            "Le statut DLI ne garantit pas qu’un programme précis est admissible au PGWP. Vérifiez l’établissement et le programme avant de payer des frais.",
          profileProvince: "Province préférée du profil",
          noProvince: "Aucune province sélectionnée",
          queryLabel: "Terme à rechercher",
          allInstitutions: "Tous les établissements postsecondaires",
          verified: "Sources vérifiées le 18 juin 2026",
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
        };

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
    PROVINCES.find(([code, name]) => code === province || name === province)?.[1] ||
    province ||
    copy.noProvince;

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
                  English: {englishScore ?? "--"}
                </StatusPill>
                <StatusPill tone="success">
                  Français: {frenchScore ?? "--"}
                </StatusPill>
              </div>
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
                onClick={() => openOfficial(IRCC_LANGUAGE_URL)}
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
                          {test.name}
                        </h2>
                      </div>
                      <StatusPill tone={test.remoteAccepted ? "success" : "warning"}>
                        {test.remoteAccepted ? copy.remote : copy.inPerson}
                      </StatusPill>
                    </div>
                    <dl className="mt-5 space-y-3 text-sm">
                      <div>
                        <dt className="font-medium text-slate-500">{copy.accepted}</dt>
                        <dd className="mt-1 text-slate-900">{test.acceptedVersion}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-slate-500">{copy.deliveryFilter}</dt>
                        <dd className="mt-1 text-slate-900">{test.delivery}</dd>
                      </div>
                    </dl>
                    {test.note ? (
                      <p className="mt-4 text-sm leading-6 text-amber-800">
                        {test.note}
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
                    {PROVINCES.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
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
                  PGWP {pgwpPriority ? "priority" : "optional"}
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
            <Button onClick={() => openOfficial(IRCC_DLI_URL)}>
              {copy.searchOfficial}
            </Button>
            <Button
              variant="secondary"
              onClick={() => openOfficial(IRCC_PGWP_URL)}
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
