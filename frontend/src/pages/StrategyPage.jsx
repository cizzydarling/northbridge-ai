import StrategyProgressCard from "../components/StrategyProgressCard";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import LockBadge from "../components/ui/LockBadge";
import UpgradePrompt from "../components/UpgradePrompt";
import { translateStrategySummary } from "../utils/frenchLocalization";
import {
  exportMyStrategyPdf,
  getBillingAccess,
  getCachedBillingAccess,
  getImmigrationIntelligence,
  getMyStrategy,
  getMyStrategyLite,
  sendAIMessage,
} from "../api";

const COMPLETION_STORAGE_KEY = "nbai_document_completion_engine_v1";
const LIVE_INTELLIGENCE_REFRESH_MS = 15 * 60 * 1000;
const LIVE_INTELLIGENCE_RETURN_REFRESH_MS = 5 * 60 * 1000;

function readCompletionEngine() {
  try {
    return JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function buildProPricingPath(source = "strategy", intent = "execute") {
  return `/pricing?plan=pro&source=${source}&intent=${intent}`;
}

function buildPremiumPricingPath(source = "strategy", intent = "export") {
  return `/pricing?plan=premium&source=${source}&intent=${intent}`;
}

function readTabFromSearch(searchParams) {
  const allowed = ["overview", "execution", "pathways", "risks"];
  const raw = String(searchParams.get("tab") || "").toLowerCase();
  return allowed.includes(raw) ? raw : "overview";
}

function getScoreBand(score, language) {
  const safeScore = Number(score || 0);
  if (!safeScore) return language === "fr" ? "À préciser" : "Needs context";
  if (safeScore >= 500) return language === "fr" ? "Très fort" : "Very strong";
  if (safeScore >= 470) return language === "fr" ? "Fort" : "Strong";
  if (safeScore >= 430) return language === "fr" ? "Compétitif" : "Competitive";
  return language === "fr" ? "À renforcer" : "Needs improvement";
}

function getConfidenceLabel(confidence, language) {
  const value = String(confidence || "").trim().toLowerCase();
  if (!value) return "--";

  if (language === "fr") {
    if (value.includes("high") || value.includes("elevee")) return "Élevée";
    if (value.includes("medium") || value.includes("moder")) return "Modérée";
    if (value.includes("low")) return "Faible";
  }

  return confidence;
}

function formatProbabilityValue(probabilityEstimate) {
  const raw =
    probabilityEstimate?.overall_probability ??
    probabilityEstimate?.chance_of_pr_within_12_months ??
    probabilityEstimate?.score ??
    probabilityEstimate?.probability;

  if (raw === null || typeof raw === "undefined" || raw === "") return "--";

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return `${Math.round(raw)}%`;
  }

  const normalized = String(raw).trim();
  if (!normalized) return "--";
  if (normalized.endsWith("%")) return normalized;

  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) return `${Math.round(numeric)}%`;

  return normalized;
}

function getTimelineLabel(timeline, language) {
  if (!timeline) return "--";

  if (typeof timeline === "string") return timeline;

  const min = timeline?.estimated_pr_timeline_min_months;
  const max = timeline?.estimated_pr_timeline_max_months;

  if (typeof min !== "undefined" && typeof max !== "undefined") {
    return language === "fr" ? `${min} à ${max} mois` : `${min} to ${max} months`;
  }

  return timeline?.readiness || "--";
}

function buildPriorityRecommendation(strategyData, documentStats, language) {
  const nextSteps = Array.isArray(strategyData?.next_steps)
    ? strategyData.next_steps
    : [];
  const weaknesses = Array.isArray(strategyData?.weaknesses)
    ? strategyData.weaknesses
    : [];
  const recommendedPrograms = Array.isArray(strategyData?.recommended_programs)
    ? strategyData.recommended_programs
    : [];
  const provinceRecommendations = Array.isArray(
    strategyData?.province_recommendations
  )
    ? strategyData.province_recommendations
    : [];
  const nocSummary = strategyData?.noc_summary || {};
  const nocAdvantage = strategyData?.noc_advantage || {};
  const crsScore = Number(strategyData?.crs_score || 0);
  const frenchAdvantage = strategyData?.french_advantage || {};

  const reviewed = documentStats.reviewed || 0;
  const completed = documentStats.completed || 0;
  const tracked = documentStats.total || 0;

  const weaknessBlob = weaknesses.join(" ").toLowerCase();
  const nextStepBlob = nextSteps.join(" ").toLowerCase();
  const programBlob = recommendedPrograms.join(" ").toLowerCase();
  const provinceBlob = provinceRecommendations
    .map((item) =>
      [item?.province, item?.program, item?.chance, item?.reason]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ")
    .toLowerCase();
  const nocBlob = `${nocSummary?.occupation || ""} ${
    nocSummary?.noc_code || ""
  } ${nocAdvantage?.noc_code || ""} ${
    Array.isArray(nocAdvantage?.signals) ? nocAdvantage.signals.join(" ") : ""
  }`.toLowerCase();

  const en = {
    workEvidence: {
      title: "Prioritize work experience evidence",
      reason:
        "Your strategy signals suggest that employment proof may have the biggest impact on credibility and pathway strength right now.",
      actions: [
        "Prepare a reference-letter draft aligned with your NOC.",
        "Review duties, dates, hours, and salary for consistency.",
        "Add supporting proof like contracts, pay slips, or tax records.",
      ],
      route: "/documents",
    },
    language: {
      title: "Prioritize language-supporting evidence and planning",
      reason:
        "Language competitiveness appears to be one of the strongest levers in your strategy right now.",
      actions: [
        "Confirm current test validity and score strength.",
        "Prepare explanation material if retesting is planned.",
        "Review strategy recommendations tied to language gains.",
      ],
      route: "/strategy",
    },
    funds: {
      title: "Prioritize proof of funds preparation",
      reason:
        "Financial evidence is likely to matter soon, and preparing it early reduces downstream delays.",
      actions: [
        "Gather recent bank statements and letters.",
        "Check consistency of balances and ownership.",
        "Generate a proof-of-funds explanation if needed.",
      ],
      route: "/documents",
    },
    incompleteDocs: {
      title: "Prioritize unfinished document execution",
      reason:
        "You have strategy direction in place, but your document workflow still has unfinished items that could slow execution.",
      actions: [
        "Finish a first draft for the highest-priority checklist item.",
        "Send at least one draft through AI review.",
        "Mark completed items once they are submission-ready.",
      ],
      route: "/documents",
    },
    review: {
      title: "Prioritize document review and quality control",
      reason:
        "You already have draft momentum. The next highest-value step is improving document quality before submission.",
      actions: [
        "Run AI review on your strongest draft.",
        "Resolve gaps, inconsistencies, or missing support.",
        "Mark reviewed items and finalize the strongest documents.",
      ],
      route: "/documents/review",
    },
    pnp: {
      title: "Prioritize province-targeted evidence",
      reason:
        "Your strategy suggests a province-focused route may be valuable, so your document package should support that direction.",
      actions: [
        "Review province-related requirements carefully.",
        "Prepare documents that reinforce settlement and occupation fit.",
        "Keep your strategy and document wording consistent.",
      ],
      route: "/strategy",
    },
    general: {
      title: "Prioritize your next strongest document",
      reason:
        "Your strategy is active, but the biggest gain now comes from converting guidance into concrete document execution.",
      actions: [
        "Open the document workspace.",
        "Generate the highest-priority missing document.",
        "Review and complete it before moving to the next one.",
      ],
      route: "/documents",
    },
  };

  const fr = {
    workEvidence: {
      title: "Prioriser les preuves d’expérience de travail",
      reason:
        "Votre stratégie suggère que les preuves d’emploi peuvent avoir le plus grand impact sur la crédibilité et la solidité de votre parcours en ce moment.",
      actions: [
        "Préparez un brouillon de lettre de référence aligné sur votre CNP.",
        "Vérifiez la cohérence des tâches, dates, heures et salaire.",
        "Ajoutez des preuves de soutien comme contrats, fiches de paie ou relevés fiscaux.",
      ],
      route: "/documents",
    },
    language: {
      title: "Prioriser les preuves et la planification linguistiques",
      reason:
        "La compétitivité linguistique semble être l’un des leviers les plus importants dans votre stratégie actuelle.",
      actions: [
        "Confirmez la validité et la force de vos résultats linguistiques.",
        "Préparez une explication si une reprise de test est envisagée.",
        "Revoyez les recommandations stratégiques liées aux gains linguistiques.",
      ],
      route: "/strategy",
    },
    funds: {
      title: "Prioriser la préparation de la preuve de fonds",
      reason:
        "Les preuves financières risquent d’être importantes bientôt, et les préparer tôt réduit les retards par la suite.",
      actions: [
        "Rassemblez des relevés bancaires et lettres récents.",
        "Vérifiez la cohérence des soldes et de la propriété des fonds.",
        "Générez une explication de preuve de fonds si nécessaire.",
      ],
      route: "/documents",
    },
    incompleteDocs: {
      title: "Prioriser l’exécution des documents inachevés",
      reason:
        "Votre stratégie est en place, mais votre flux documentaire comporte encore des éléments inachevés qui peuvent ralentir l’exécution.",
      actions: [
        "Terminez un premier brouillon pour l’élément checklist le plus prioritaire.",
        "Passez au moins un brouillon par la révision IA.",
        "Marquez les éléments comme complétés lorsqu’ils sont prêts à être soumis.",
      ],
      route: "/documents",
    },
    review: {
      title: "Prioriser la révision documentaire et le contrôle qualité",
      reason:
        "Vous avez déjà une bonne dynamique de brouillons. La prochaine étape à forte valeur est d’améliorer la qualité documentaire avant la soumission.",
      actions: [
        "Lancez la révision IA sur votre meilleur brouillon.",
        "Corrigez les écarts, incohérences ou pièces manquantes.",
        "Marquez les éléments révisés et finalisez les documents les plus solides.",
      ],
      route: "/documents/review",
    },
    pnp: {
      title: "Prioriser les preuves ciblées pour une province",
      reason:
        "Votre stratégie indique qu’une voie provinciale pourrait être précieuse, donc votre dossier doit soutenir cette direction.",
      actions: [
        "Revoyez attentivement les exigences liées à la province.",
        "Préparez des documents qui renforcent votre établissement et l’adéquation de votre profession.",
        "Gardez une cohérence entre la stratégie et la formulation des documents.",
      ],
      route: "/strategy",
    },
    general: {
      title: "Prioriser votre prochain document le plus fort",
      reason:
        "Votre stratégie est active, mais le plus grand gain maintenant vient de la conversion de la guidance en exécution documentaire concrète.",
      actions: [
        "Ouvrez l’espace documentaire.",
        "Générez le document prioritaire manquant.",
        "Révisez-le et complétez-le avant de passer au suivant.",
      ],
      route: "/documents",
    },
  };

  const copy = language === "fr" ? fr : en;

  if (
    programBlob.includes("provincial") ||
    programBlob.includes("province") ||
    provinceBlob
  ) {
    return copy.pnp;
  }

  if (
    weaknessBlob.includes("work") ||
    weaknessBlob.includes("emploi") ||
    weaknessBlob.includes("experience") ||
    weaknessBlob.includes("expérience") ||
    nextStepBlob.includes("job offer") ||
    nextStepBlob.includes("work") ||
    nocBlob
  ) {
    return copy.workEvidence;
  }

  if (
    weaknessBlob.includes("language") ||
    weaknessBlob.includes("french") ||
    weaknessBlob.includes("français") ||
    nextStepBlob.includes("language") ||
    nextStepBlob.includes("french") ||
    frenchAdvantage?.strategic_value === "high" ||
    crsScore < 470
  ) {
    return copy.language;
  }

  if (
    weaknessBlob.includes("fund") ||
    weaknessBlob.includes("financial") ||
    weaknessBlob.includes("banque") ||
    weaknessBlob.includes("fonds")
  ) {
    return copy.funds;
  }

  if (tracked > 0 && completed < tracked && reviewed === 0) {
    return copy.incompleteDocs;
  }

  if (reviewed > 0 && completed < tracked) {
    return copy.review;
  }

  return copy.general;
}

function PageHeaderBlock({ brand, title, subtitle }) {
  return (
    <div className="mb-6 rounded-[26px] border border-stone-200 bg-stone-50 p-5 shadow-[0_12px_38px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
            {brand}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">{subtitle}</p>
        </div>

        <div className="hidden h-px min-w-[180px] bg-slate-300 lg:block" />
      </div>
    </div>
  );
}

function HeroMetric({ label, value, subvalue, dark = false }) {
  const safeValue = typeof value === "object" ? "--" : value;
  const safeSubvalue = typeof subvalue === "object" ? "" : subvalue;

  return (
    <div
      className={`rounded-[24px] border p-5 ${
        dark
          ? "border-white/10 bg-white/10 backdrop-blur-sm"
          : "border-slate-200 bg-white"
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
          dark ? "text-stone-200" : "text-slate-500"
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-2 break-words text-3xl font-semibold tracking-tight ${
          dark ? "text-white" : "text-slate-900"
        }`}
      >
        {safeValue || "--"}
      </p>

      {safeSubvalue ? (
        <p
          className={`mt-2 text-sm leading-6 ${
            dark ? "text-stone-200" : "text-slate-600"
          }`}
        >
          {safeSubvalue}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ConfidencePill({ value }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-200/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
      {value || "--"}
    </span>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-xl font-semibold tracking-tight text-slate-900">
      {children}
    </h3>
  );
}

function ListCard({ title, items, emptyLabel }) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <Card padding="lg" className="rounded-lg">
      {title ? <SectionTitle>{title}</SectionTitle> : null}

      {safeItems.length > 0 ? (
        <ul className={title ? "mt-4 space-y-3" : "space-y-3"}>
          {safeItems.map((item, i) => (
            <li
              key={i}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700 shadow-sm"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      )}
    </Card>
  );
}

function RiskCard({ title, items, emptyLabel, language, onAnalyzeRisk, }) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <Card padding="lg" className="rounded-lg">
      <SectionTitle>{title}</SectionTitle>

      {safeItems.length > 0 ? (
        <div className="mt-4 space-y-3">
          {safeItems.map((item, i) => (
            <div
              key={`${item?.risk || "risk"}-${i}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-sm font-semibold text-slate-900">
                {item?.risk || "--"}
              </p>
              {item?.impact ? (
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  <span className="font-medium text-slate-900">
                    {language === "fr" ? "Impact : " : "Impact: "}
                  </span>
                  {item.impact}
                </p>
              ) : null}
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="subtle"
                  onClick={() => onAnalyzeRisk?.(item)}
                >
                  {language === "fr" ? "Analyser" : "Analyze"}
                </Button>
              </div>
              {item?.mitigation ? (
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  <span className="font-medium text-slate-900">
                    {language === "fr" ? "Atténuation : " : "Mitigation: "}
                  </span>
                  {item.mitigation}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      )}
    </Card>
  );
}

function RoadmapCard({ title, items, emptyLabel, language }) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <Card padding="lg" className="rounded-lg">
      <SectionTitle>{title}</SectionTitle>

      {safeItems.length > 0 ? (
        <div className="mt-6 space-y-4">
          {safeItems.map((item, index) => (
            <div key={`${item?.title || "roadmap"}-${index}`} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-800">
                  {index + 1}
                </div>
                {index < safeItems.length - 1 ? (
                  <div className="mt-2 h-full min-h-[52px] w-px bg-slate-200" />
                ) : null}
              </div>

              <div className="flex-1 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {item?.title || "--"}
                    </p>
                    {item?.reason ? (
                      <p className="mt-2 text-sm leading-7 text-slate-700">
                        {item.reason}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {typeof item?.estimated_crs_gain !== "undefined" ? (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                        {item.estimated_crs_gain > 0
                          ? `+${item.estimated_crs_gain} CRS`
                          : language === "fr"
                          ? "Impact stratégique"
                          : "Strategic step"}
                      </span>
                    ) : null}

                    {item?.difficulty ? (
                      <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {item.difficulty}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      )}
    </Card>
  );
}

function ProvinceCard({ title, items, emptyLabel }) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <Card padding="lg" className="rounded-lg">
      <SectionTitle>{title}</SectionTitle>

      {safeItems.length > 0 ? (
        <div className="mt-4 space-y-3">
          {safeItems.map((item, index) => (
            <div
              key={`${item?.province || "province"}-${item?.program || index}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item?.province || "--"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {item?.program || "--"}
                  </p>
                </div>

                <div className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  {item?.chance || "--"}
                </div>
              </div>

              {typeof item?.score !== "undefined" ? (
                <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-500">
                  Score: {item.score}
                </p>
              ) : null}

              {item?.reason ? (
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  {item.reason}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">{emptyLabel}</p>
      )}
    </Card>
  );
}

function ExternalResourceLink({ href, children }) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
    >
      {children}
    </a>
  );
}

function ImmigrationIntelligencePanel({ intelligence, text, language }) {
  const data = intelligence || {};
  const latestDraws = data.latest_draws || {};
  const draws = Array.isArray(latestDraws.draws) ? latestDraws.draws : [];
  const processing = data.processing_times || {};
  const applications = Array.isArray(processing.applications)
    ? processing.applications
    : [];
  const profileRelevant = Array.isArray(processing.profile_relevant)
    ? processing.profile_relevant
    : [];
  const categorySelection = data.category_selection || {};
  const categoryFit = Array.isArray(categorySelection.profile_fit)
    ? categorySelection.profile_fit
    : [];
  const jobs = data.job_opportunities || {};
  const jobLinks = Array.isArray(jobs.links) ? jobs.links : [];
  const notes = Array.isArray(jobs.notes) ? jobs.notes : [];

  if (data.locked) {
    const teasers = Array.isArray(data.teaser_cards) ? data.teaser_cards : [];

    return (
      <Card padding="lg" className="space-y-5 rounded-lg">
        <SectionTitle>{text.immigrationIntelligence}</SectionTitle>
        <p className="text-sm leading-7 text-slate-600">
          {data.upgrade_reason || text.blurIntelligenceBody}
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {teasers.map((item, index) => (
            <div
              key={`${item.title || "teaser"}-${index}`}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-sm font-semibold text-slate-900">
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card padding="lg" className="rounded-lg border-slate-200 bg-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
              {text.premiumSignal}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {text.immigrationIntelligence}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              {data.ai_summary || text.intelligenceSummary}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {text.dataStatus}
            </span>
            <span className="mt-1 block font-semibold text-slate-900">
              {data.source_status || latestDraws.status || "--"}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card padding="lg" className="space-y-4 rounded-lg">
          <SectionTitle>{text.latestDraws}</SectionTitle>
          <p className="text-sm leading-7 text-slate-600">
            {latestDraws.summary || text.noLiveDraws}
          </p>

          {draws.length > 0 ? (
            <div className="space-y-3">
              {draws.slice(0, 4).map((draw, index) => (
                <div
                  key={`${draw.round || "draw"}-${index}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {draw.round_type || text.latestDraws}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {draw.date || "--"}
                      </p>
                    </div>
                    {draw.crs_cutoff ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                        CRS {draw.crs_cutoff}
                      </span>
                    ) : null}
                  </div>
                  {draw.invitations_issued ? (
                    <p className="mt-3 text-sm text-slate-600">
                      {language === "fr" ? "Invitations" : "Invitations"}:{" "}
                      {draw.invitations_issued}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <ExternalResourceLink
            href={latestDraws.source_url || latestDraws.official_fallback_url}
          >
            {text.openOfficialSource}
          </ExternalResourceLink>
        </Card>

        <Card padding="lg" className="space-y-4 rounded-lg">
          <SectionTitle>{text.processingTimes}</SectionTitle>
          <p className="text-sm leading-7 text-slate-600">
            {processing.summary || text.processingTimesBody}
          </p>

          <div className="space-y-2">
            {(profileRelevant.length ? profileRelevant : applications.slice(0, 4)).map(
              (item, index) => (
                <div
                  key={`${item.application_type || item.key || "time"}-${index}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.application_label || item.label || "--"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.country || item.category || text.officialChecker}
                      </p>
                    </div>
                    {item.processing_time ? (
                      <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        {item.processing_time}
                      </span>
                    ) : null}
                  </div>
                  {item.last_updated ? (
                    <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-slate-400">
                      {language === "fr" ? "Mis à jour" : "Updated"}{" "}
                      {item.last_updated}
                    </p>
                  ) : null}
                </div>
              )
            )}
          </div>

          <ExternalResourceLink href={processing.source_url}>
            {text.openProcessingChecker}
          </ExternalResourceLink>
        </Card>

        <Card padding="lg" className="space-y-4 rounded-lg">
          <SectionTitle>{text.jobOpportunities}</SectionTitle>
          <p className="text-sm leading-7 text-slate-600">
            {jobs.profile_occupation
              ? `${text.profileOccupation}: ${jobs.profile_occupation}`
              : text.jobOpportunitiesBody}
          </p>

          <div className="space-y-2">
            {jobLinks.slice(0, 4).map((item, index) => (
              <a
                key={`${item.label || "job"}-${index}`}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-white"
              >
                {item.label}
              </a>
            ))}
          </div>

          {notes.length > 0 ? (
            <div className="space-y-2">
              {notes.slice(0, 2).map((note, index) => (
                <p
                  key={`${note}-${index}`}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
                >
                  {note}
                </p>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      <Card padding="lg" className="rounded-lg">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div>
            <SectionTitle>{text.categorySelection}</SectionTitle>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {data.profile_draw_fit?.summary || text.categoryBody}
            </p>
            <div className="mt-4">
              <ExternalResourceLink href={categorySelection.source_url}>
                {text.openOfficialSource}
              </ExternalResourceLink>
            </div>
          </div>

          <div className="space-y-2">
            {(categoryFit.length
              ? categoryFit
              : categorySelection.current_categories || []
            )
              .slice(0, 5)
              .map((item, index) => (
                <div
                  key={`${item.key || item.label || "category"}-${index}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {item.label}
                  </p>
                  {item.reason ? (
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {item.reason}
                    </p>
                  ) : null}
                </div>
              ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function InsightCard({ eyebrow, title, body, chips = [], actions = null }) {
  return (
    <Card padding="lg" className="h-full rounded-lg">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
        {title || "--"}
      </h3>

      {body ? (
        <p className="mt-3 text-sm leading-7 text-slate-700">{body}</p>
      ) : null}

      {chips.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip, index) => (
            <span
              key={`${chip}-${index}`}
              className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      {actions ? <div className="mt-5">{actions}</div> : null}
    </Card>
  );
}

function NocSignalCard({
  language,
  nocProfile,
  nocAdvantage,
  onReviewProfile,
  onUpgrade,
  locked = false,
}) {
  const resolvedCode =
    nocProfile?.resolved_noc_code || nocAdvantage?.noc_code || "";
  const resolvedTitle =
    nocProfile?.resolved_title || nocAdvantage?.resolved_title || "";
  const confidenceRaw =
    nocProfile?.suggested_confidence ??
    nocAdvantage?.suggested_confidence ??
    0;
  const confidence =
    typeof confidenceRaw === "number"
      ? `${Math.round(confidenceRaw * 100)}%`
      : "--";

  const strategicValue = nocAdvantage?.strategic_value || "--";

  const chips = [
    resolvedCode ? `${language === "fr" ? "CNP" : "NOC"} ${resolvedCode}` : null,
    typeof nocAdvantage?.teer === "number" && nocAdvantage.teer >= 0
      ? `TEER ${nocAdvantage.teer}`
      : null,
    confidenceRaw
      ? `${language === "fr" ? "Confiance" : "Confidence"} ${confidence}`
      : null,
    strategicValue !== "--"
      ? `${
          language === "fr" ? "Valeur stratégique" : "Strategic value"
        } ${strategicValue}`
      : null,
    typeof nocAdvantage?.is_high_demand === "boolean"
      ? `${
          language === "fr" ? "En demande" : "High demand"
        } ${
          nocAdvantage.is_high_demand
            ? language === "fr"
              ? "Oui"
              : "Yes"
            : language === "fr"
            ? "Non"
            : "No"
        }`
      : null,
  ].filter(Boolean);

  const reasons = Array.isArray(nocAdvantage?.signals)
    ? nocAdvantage.signals
    : [];

  const body =
    reasons[0] ||
    (language === "fr"
      ? "Ajoutez ou confirmez les détails de votre rôle pour améliorer la précision des parcours ciblés."
      : "Add or confirm your role details to improve targeted pathway accuracy.");

  const card = (
    <InsightCard
      eyebrow={language === "fr" ? "Signal CNP" : "NOC Signal"}
      title={
        resolvedTitle
          ? `${resolvedCode ? `${resolvedCode} — ` : ""}${resolvedTitle}`
          : resolvedCode || "--"
      }
      body={body}
      chips={chips}
      actions={
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onReviewProfile}>
            {language === "fr" ? "Vérifier mon profil" : "Review my profile"}
          </Button>
        </div>
      }
    />
  );

  if (!locked) return card;

  return (
    <BlurredSection
      title={language === "fr" ? "Débloquez l’analyse CNP" : "Unlock NOC analysis"}
      body={
        language === "fr"
          ? "Voyez comment votre profession et votre CNP influencent réellement vos meilleures voies."
          : "See how your occupation and detected NOC are influencing your strongest pathways."
      }
      onUpgrade={onUpgrade}
      buttonLabel={language === "fr" ? "Débloquer" : "Unlock"}
    >
      {card}
    </BlurredSection>
  );
}

function BestPathwayCard({ language, bestPathway, onOpenDocuments, onAnalyzePathway }) {
  const reasons = Array.isArray(bestPathway?.reasons)
    ? bestPathway.reasons
    : [];

  return (
    <Card
      variant="soft"
      padding="lg"
      className="rounded-lg border-stone-200 bg-stone-50"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
        {language === "fr" ? "Meilleur parcours" : "Best pathway"}
      </p>

      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
            {bestPathway?.name || "--"}
          </h3>
          {reasons[0] ? (
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {reasons[0]}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {bestPathway?.confidence ? (
            <span className="inline-flex rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-800">
              {language === "fr" ? "Confiance" : "Confidence"}:{" "}
              {bestPathway.confidence}
            </span>
          ) : null}
          {typeof bestPathway?.score !== "undefined" ? (
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              Score: {bestPathway.score}
            </span>
          ) : null}
        </div>
      </div>

      {Array.isArray(reasons) && reasons.length > 0 ? (
        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {language === "fr"
              ? "Pourquoi cette voie fonctionne"
              : "Why this pathway works"}
          </p>

          {reasons.slice(0, 3).map((reason, index) => (
            <div
              key={`${reason}-${index}`}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700"
            >
              • {reason}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5 flex gap-3">
        <Button onClick={onOpenDocuments}>
          {language === "fr" ? "Préparer mes documents" : "Prepare my documents"}
        </Button>

        <Button
          variant="subtle"
          onClick={onAnalyzePathway}
        >
          {language === "fr" ? "Pourquoi ?" : "Why this?"}
        </Button>
      </div>
    </Card>
  );
}

function TimelineCard({ timeline, language, title, noItemsLabel }) {
  if (!timeline) {
    return (
      <Card padding="lg" className="rounded-lg">
        <SectionTitle>{title}</SectionTitle>
        <p className="mt-4 text-sm text-slate-500">{noItemsLabel}</p>
      </Card>
    );
  }

  if (typeof timeline === "string") {
    return (
      <Card padding="lg" className="rounded-lg">
        <SectionTitle>{title}</SectionTitle>
        <p className="mt-4 text-sm leading-7 text-slate-700">{timeline}</p>
      </Card>
    );
  }

  const steps = Array.isArray(timeline?.timeline_steps)
    ? timeline.timeline_steps
    : [];

  return (
    <Card padding="lg" className="rounded-lg">
      <SectionTitle>{title}</SectionTitle>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Stat
          label={language === "fr" ? "Préparation" : "Readiness"}
          value={timeline?.readiness || "--"}
        />
        <Stat
          label={language === "fr" ? "Minimum" : "Minimum"}
          value={
            typeof timeline?.estimated_pr_timeline_min_months !== "undefined"
              ? `${timeline.estimated_pr_timeline_min_months}m`
              : "--"
          }
        />
        <Stat
          label={language === "fr" ? "Maximum" : "Maximum"}
          value={
            typeof timeline?.estimated_pr_timeline_max_months !== "undefined"
              ? `${timeline.estimated_pr_timeline_max_months}m`
              : "--"
          }
        />
      </div>

      {steps.length > 0 ? (
        <div className="mt-5 space-y-3">
          {steps.map((step, index) => (
            <div
              key={`${step?.title || "step"}-${index}`}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  {step?.title || "--"}
                </p>
                <span className="inline-flex w-fit rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {step?.estimated_time_min_months ?? "--"}–
                  {step?.estimated_time_max_months ?? "--"}{" "}
                  {language === "fr" ? "mois" : "months"}
                </span>
              </div>
              {step?.reason ? (
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {step.reason}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function PlanChip({ active = false, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-semibold ${
        active
          ? "border-white bg-white text-slate-950"
          : "border-white/20 bg-white/5 text-stone-200"
      }`}
    >
      {children}
    </span>
  );
}

function TopTabButton({ active, label, onClick, locked = false, lockedLabel = "Access required" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-sm transition-all duration-200 ${
        active
          ? "border-slate-950 bg-slate-950 text-white shadow-[0_10px_28px_rgba(15,23,42,0.16)]"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span className={active ? "font-semibold" : "font-medium"}>{label}</span>

      {locked ? (
        <LockBadge locked active={active} label={lockedLabel} className="h-6 w-6" />
      ) : null}
    </button>
  );
}

function SidebarButton({ active, label, onClick, locked = false, lockedLabel = "Access required" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition ${
        active
          ? "bg-slate-950 text-white"
          : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span className={active ? "font-semibold" : "font-medium"}>{label}</span>
      {locked ? (
        <LockBadge locked active={active} label={lockedLabel} className="h-6 w-6" />
      ) : null}
    </button>
  );
}

function BlurredSection({
  children,
  title,
  body,
  onUpgrade,
  buttonLabel = "Unlock Now",
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[5px] opacity-70">
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
        <div className="max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center shadow-sm">
          <p className="text-base font-semibold text-amber-900">{title}</p>
          <p className="mt-2 text-sm text-amber-800">{body}</p>

          <button
            type="button"
            onClick={onUpgrade}
            className="mt-4 rounded-xl bg-amber-600 px-5 py-2 text-sm text-white"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreSimulatorTeaser({
  language,
  currentScore,
  hasFullStrategy,
  onUpgrade,
}) {
  const safeScore = Number(currentScore || 0);
  const teaserGain = safeScore < 430 ? 65 : safeScore < 470 ? 48 : 32;
  const simulatedScore = safeScore ? safeScore + teaserGain : null;

  const copy =
    language === "fr"
      ? {
          eyebrow: "Simulateur de score",
          title: "Voyez votre potentiel avant même d’optimiser votre dossier",
          body:
            "Débloquez le simulateur avancé pour tester des scénarios comme de meilleurs résultats linguistiques, plus d’expérience, une offre d’emploi ou une voie provinciale.",
          current: "Score actuel",
          possible: "Potentiel simulé",
          gain: "Hausse possible",
          cta: "Débloquer le simulateur",
          footer:
            "Le simulateur complet aide à prioriser les améliorations qui peuvent créer le plus d’impact.",
        }
      : {
          eyebrow: "Score simulator",
          title: "See your upside before you optimize your case",
          body:
            "Unlock the advanced simulator to test scenarios like higher language scores, more experience, a job offer, or a provincial pathway.",
          current: "Current score",
          possible: "Simulated potential",
          gain: "Possible gain",
          cta: "Unlock simulator",
          footer:
            "The full simulator helps prioritize the improvements most likely to move your result.",
        };

  if (hasFullStrategy) {
    return (
      <Card padding="lg" className="rounded-lg">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {copy.eyebrow}
        </p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {copy.title}
        </h3>
        <p className="mt-3 text-sm leading-7 text-slate-600">{copy.body}</p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Stat label={copy.current} value={safeScore || "--"} />
          <Stat label={copy.possible} value={simulatedScore || "--"} />
          <Stat label={copy.gain} value={safeScore ? `+${teaserGain}` : "--"} />
        </div>
      </Card>
    );
  }

  return (
    <Card variant="premium" padding="lg" className="rounded-lg">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {copy.eyebrow}
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {copy.title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{copy.body}</p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Stat label={copy.current} value={safeScore || "--"} />
        <Stat label={copy.possible} value={simulatedScore || "--"} />
        <Stat label={copy.gain} value={safeScore ? `+${teaserGain}` : "--"} />
      </div>

      <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm leading-7 text-amber-900">{copy.footer}</p>
        <div className="mt-4">
          <Button onClick={onUpgrade}>{copy.cta}</Button>
        </div>
      </div>
    </Card>
  );
}

function StrategyPaywallHero({
  language,
  currentPlanLabel,
  onUpgradePro,
  onUpgradePremium,
  source,
  intent,
}) {
  const copy =
    language === "fr"
      ? {
          eyebrow:
            source === "onboarding"
              ? "Stratégie prête"
              : "Débloquez votre stratégie",
          title:
            source === "onboarding"
              ? "Votre profil est configuré. Votre stratégie détaillée est prête à être débloquée."
              : "Passez à Pro pour voir votre stratégie complète et agir avec plus de clarté.",
          body:
            intent === "execute"
              ? "Vous avez déjà fait le plus dur: compléter votre profil. L’étape suivante est de débloquer les programmes recommandés, les risques, la feuille de route et les prochaines actions."
              : "Débloquez vos meilleures voies d’immigration, vos risques, vos provinces cibles et votre plan d’action complet.",
          proCta: "Débloquer avec Pro",
          premiumCta: "Voir Premium",
          currentPlan: "Plan actuel",
          whatUnlocks: "Avec Pro, vous débloquez",
          bullets: [
            "vos programmes recommandés",
            "vos faiblesses et prochaines étapes complètes",
            "vos provinces cibles et votre feuille de route",
          ],
        }
      : {
          eyebrow:
            source === "onboarding"
              ? "Strategy ready"
              : "Unlock your strategy",
          title:
            source === "onboarding"
              ? "Your profile is set up. Your detailed strategy is ready to unlock."
              : "Upgrade to Pro to see your full strategy and move forward with more clarity.",
          body:
            intent === "execute"
              ? "You already did the hard part: completing your profile. The next step is unlocking your recommended programs, risks, roadmap, and next actions."
              : "Unlock your best-fit immigration pathways, risks, target provinces, and full action plan.",
          proCta: "Unlock with Pro",
          premiumCta: "See Premium",
          currentPlan: "Current plan",
          whatUnlocks: "With Pro, you unlock",
          bullets: [
            "your recommended programs",
            "your full weaknesses and next steps",
            "your target provinces and roadmap",
          ],
        };

  return (
    <Card
      variant="soft"
      padding="lg"
      className="mb-6 rounded-lg border-amber-200 bg-stone-50"
    >
      <div className="grid items-start gap-6 xl:grid-cols-[280px_1fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            {copy.eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {copy.title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">{copy.body}</p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={onUpgradePro}>{copy.proCta}</Button>
            <Button variant="secondary" onClick={onUpgradePremium}>
              {copy.premiumCta}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {copy.currentPlan}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {currentPlanLabel}
          </p>

          <p className="mt-5 text-sm font-semibold text-slate-900">
            {copy.whatUnlocks}
          </p>
          <div className="mt-3 space-y-2.5">
            {copy.bullets.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SectionChrome({ activeTab, activeSectionLabel, lockedLabel, text }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {activeTab === "execution"
            ? text.execution
            : activeTab === "pathways"
            ? text.pathways
            : text.risksTab}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {activeSectionLabel}
        </h2>
      </div>

      {lockedLabel ? (
        <LockBadge locked label={lockedLabel} />
      ) : null}
    </div>
  );
}

function HeroSignalChip({ label, value, tone = "default" }) {
  const tones = {
    default: "border-white/10 bg-white/[0.06] text-white",
    strong: "border-emerald-300/25 bg-emerald-400/10 text-emerald-50",
    medium: "border-amber-300/25 bg-amber-400/10 text-amber-50",
    info: "border-emerald-300/25 bg-emerald-400/10 text-emerald-50",
  };

  return (
    <div
      className={`rounded-[22px] border p-4 ${
        tones[tone] || tones.default
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">
        {label}
      </p>
      <p className="mt-3 break-words text-lg font-semibold">{value || "--"}</p>
    </div>
  );
}

function StrategyActionBar({
  language,
  canExportPdf,
  exportingPdf,
  onOpenDocuments,
  onExportPdf,
  onAnalyzeStrategy,
  onUpgrade,
}) {
  const text =
    language === "fr"
      ? {
          label: "Actions rapides",
          openDocuments: "Gérer mes documents",
          exportPdf: "Télécharger le PDF",
          exporting: "Téléchargement...",
          analyze: "Analyser avec l’IA",
          upgrade: "Voir les tarifs",
        }
      : {
          label: "Quick actions",
          openDocuments: "Manage my documents",
          exportPdf: "Download PDF",
          exporting: "Downloading...",
          analyze: "Analyze with AI",
          upgrade: "View pricing",
        };

  return (
    <div className="sticky top-[72px] z-20 mb-6">
      <div className="rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {text.label}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onOpenDocuments}>
              {text.openDocuments}
            </Button>

            {canExportPdf ? (
              <Button size="sm" onClick={onExportPdf} loading={exportingPdf}>
                {exportingPdf ? text.exporting : text.exportPdf}
              </Button>
            ) : (
              <Button variant="premium" size="sm" onClick={onUpgrade}>
                {text.upgrade}
              </Button>
            )}

            <Button variant="subtle" size="sm" onClick={onAnalyzeStrategy}>
              {text.analyze}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStatusCluster({ language, strategy, confidenceValue, timelineValue }) {
  const text =
    language === "fr"
      ? {
          title: "Statut du dossier",
          score: "Score",
          confidence: "Confiance",
          timeline: "Délai",
          profile: "Profil",
        }
      : {
          title: "Case status",
          score: "Score",
          confidence: "Confidence",
          timeline: "Timeline",
          profile: "Profile",
        };

  const score = Number(strategy?.crs_score || 0);
  const profileLabel =
    score >= 500
      ? language === "fr"
        ? "Très fort"
        : "Very strong"
      : score >= 470
      ? language === "fr"
        ? "Fort"
        : "Strong"
      : score >= 430
      ? language === "fr"
        ? "Compétitif"
        : "Competitive"
      : language === "fr"
      ? "À renforcer"
      : "Needs improvement";

  const timelineLabel = getTimelineLabel(timelineValue, language);

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
        {text.title}
      </p>

      <div className="mt-4 grid gap-3">
        <div className="rounded-[22px] border border-white/10 bg-white/[0.07] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/55">
            {text.score}
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {strategy?.crs_score ?? "--"}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.07] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/55">
              {text.confidence}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {confidenceValue || "--"}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.07] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/55">
              {text.timeline}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              {timelineLabel}
            </p>
          </div>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-white/[0.07] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/55">
            {text.profile}
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {profileLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

function StrategySectionState({
  language,
  title,
  body,
  actionLabel,
  onAction,
  tone = "default",
}) {
  const toneClasses = {
    default: "border-slate-200 bg-white text-slate-900",
    locked: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };

  return (
    <Card
      padding="lg"
      className={`rounded-lg ${toneClasses[tone] || toneClasses.default}`}
    >
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {language === "fr" ? "État de section" : "Section status"}
        </p>

        <h3 className="mt-3 text-2xl font-semibold tracking-tight">
          {title}
        </h3>

        {body ? (
          <p className="mt-3 text-sm leading-7 text-slate-700">{body}</p>
        ) : null}

        {actionLabel && onAction ? (
          <div className="mt-5">
            <Button onClick={onAction}>{actionLabel}</Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function StrategyAICard({ language, hasAdvancedCopilot, onAnalyze }) {
  return (
    <Card
      variant="premium"
      padding="lg"
      className="rounded-lg border-stone-200 bg-stone-50"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
        {language === "fr" ? "Copilote IA stratégie" : "AI Strategy Copilot"}
      </p>

      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {language === "fr"
          ? "Demandez à l’IA d’expliquer votre stratégie"
          : "Ask AI to explain your strategy"}
      </h3>

      <p className="mt-3 text-sm leading-7 text-slate-600">
        {hasAdvancedCopilot
          ? language === "fr"
            ? "Obtenez une lecture ciblée de vos voies, risques, documents et prochaines actions."
            : "Get a focused read on your pathways, risks, documents, and next actions."
          : language === "fr"
          ? "Obtenez une première lecture stratégique. Les analyses avancées peuvent être débloquées avec Pro ou Premium."
          : "Get an initial strategic read. Advanced analysis can be unlocked with Pro or Premium."}
      </p>

      <div className="mt-5">
        <Button variant="premium" onClick={onAnalyze}>
          {language === "fr" ? "Ouvrir le copilote IA" : "Open AI copilot"}
        </Button>
      </div>
    </Card>
  );
}

function StrategyAIDrawer({
  open,
  navigate,
  onClose,
  language,
  onAsk,
  loading,
  error,
  messages = [],
  input,
  setInput,
  promptSuggestions = [],
  aiMode,
  setAiMode,
}) {
  const text =
    language === "fr"
      ? {
          title: "Assistant stratégique IA",
          subtitle:
            "Posez une question sur votre stratégie, vos risques ou vos prochaines actions.",
          close: "Fermer",
          ask: "Analyser ma stratégie",
          loading: "Analyse en cours...",
          suggestions: "Questions suggérées",
          empty:
            "Ouvrez le tiroir pour obtenir une lecture IA plus approfondie.",
        }
      : {
          title: "AI Strategy Assistant",
          subtitle:
            "Ask for help about your strategy, risks, or next best actions.",
          close: "Close",
          ask: "Analyze my strategy",
          loading: "Analyzing...",
          suggestions: "Suggested questions",
          empty: "Open the drawer to get a deeper AI reading.",
          
        };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/35 transition-opacity duration-300 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-xl transform flex-col border-l border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                NorthBridgeAI
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {text.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {text.subtitle}
              </p>
            </div>

            <Button variant="ghost" size="sm" onClick={onClose}>
              {text.close}
            </Button>
          </div>

          <div className="mt-4">
            <Button variant="premium" onClick={onAsk} loading={loading}>
              {loading ? text.loading : text.ask}
            </Button>
          </div>
        </div>
        
        <div className="px-6 pb-4 flex gap-2 flex-wrap">
          {[
            { key: "general", label: language === "fr" ? "Vue globale" : "Overview" },
            { key: "pathway", label: language === "fr" ? "Parcours" : "Pathway" },
            { key: "risk", label: language === "fr" ? "Risques" : "Risks" },
            { key: "documents", label: language === "fr" ? "Documents" : "Documents" },
            { key: "optimization", label: language === "fr" ? "Optimisation" : "Optimize" },
          ].map((mode) => (
            <button
              key={mode.key}
              onClick={() => setAiMode(mode.key)}
              className={`px-3 py-1.5 text-xs rounded-full border ${
                aiMode === mode.key
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "bg-white text-slate-600 border-slate-200"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!loading && !error && messages.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
              {text.empty}
            </div>
          ) : null}

          {promptSuggestions.length > 0 ? (
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-900">
                {text.suggestions}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {promptSuggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.intent}-${index}`}
                    type="button"
                    onClick={() => onAsk(suggestion)}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:shadow-sm"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[90%] rounded-[24px] px-4 py-3 text-sm leading-7 ${
                  message.role === "user"
                    ? "ml-auto bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-700 shadow-sm"
                }`}
              >
                <div className="space-y-3">
                  <p className="whitespace-pre-line">{message.content}</p>

                  {message.role === "assistant" && message.reasons?.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {language === "fr" ? "Raisons principales" : "Key reasons"}
                      </p>

                      <div className="mt-2 space-y-2">
                        {message.reasons.map((reason, reasonIndex) => (
                          <div
                            key={`${reason}-${reasonIndex}`}
                            className="rounded-xl bg-white px-3 py-2 text-xs leading-5 text-slate-700"
                          >
                            {reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {message.role === "assistant" && message.actions?.length > 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-800">
                        {language === "fr" ? "Prochaines actions" : "Next actions"}
                      </p>

                      <div className="mt-2 space-y-2">
                        {message.actions.map((action, actionIndex) => (
                          <button
                            key={`${action}-${actionIndex}`}
                            type="button"
                            onClick={() => {
                              const label =
                                typeof action === "string"
                                  ? action
                                  : action?.label || action?.text || action?.title || "";

                              const route =
                                typeof action === "object" && action?.route ? action.route : "";

                              if (route && navigate) {
                                navigate(route);
                                onClose?.();
                                return;
                              }

                              onAsk(label);
                            }}
                            className="w-full rounded-xl bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-slate-800 transition hover:bg-amber-100"
                          >
                            {typeof action === "string"
                              ? action
                              : action?.label || action?.text || action?.title || ""}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="mt-3 max-w-[90%] rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              {text.loading}
            </div>
          ) : null}

          {!loading && error ? (
            <div className="mt-3 rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
        <div className="border-t border-slate-200 px-6 py-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onAsk(input);
                }
              }}
              placeholder={
                language === "fr"
                  ? "Posez une question sur votre stratégie..."
                  : "Ask a question about your strategy..."
              }
              className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
            />

            <Button
              variant="premium"
              onClick={() => onAsk(input)}
              disabled={!String(input || "").trim() || loading}
            >
              {language === "fr" ? "Envoyer" : "Send"}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

function buildStrategyDrawerContext({
  strategy,
  language,
  confidenceValue,
  timelineValue,
  priority,
}) {
  const safeList = (items) =>
    Array.isArray(items) && items.length ? items.slice(0, 8).join(" | ") : "";

  const safeRisks = Array.isArray(strategy?.risk_analysis)
    ? strategy.risk_analysis
        .slice(0, 5)
        .map((item) =>
          [
            item?.risk ? `Risk: ${item.risk}` : "",
            item?.impact ? `Impact: ${item.impact}` : "",
            item?.mitigation ? `Mitigation: ${item.mitigation}` : "",
          ]
            .filter(Boolean)
            .join(" — ")
        )
        .filter(Boolean)
        .join(" | ")
    : "";

  const safeRoadmap = Array.isArray(strategy?.roadmap)
    ? strategy.roadmap
        .slice(0, 5)
        .map((item) =>
          [
            item?.title,
            item?.estimated_crs_gain
              ? `CRS gain: ${item.estimated_crs_gain}`
              : "",
            item?.difficulty ? `Difficulty: ${item.difficulty}` : "",
            item?.reason,
          ]
            .filter(Boolean)
            .join(" — ")
        )
        .filter(Boolean)
        .join(" | ")
    : "";

  const safeProvinces = Array.isArray(strategy?.province_recommendations)
    ? strategy.province_recommendations
        .slice(0, 5)
        .map((item) =>
          [
            item?.province,
            item?.program,
            item?.chance ? `Chance: ${item.chance}` : "",
            item?.score ? `Score: ${item.score}` : "",
            item?.reason,
          ]
            .filter(Boolean)
            .join(" — ")
        )
        .filter(Boolean)
        .join(" | ")
    : "";

  const intelligence = strategy?.immigration_intelligence || {};
  const intelligenceLines = [
    intelligence?.profile_draw_fit?.summary,
    intelligence?.latest_draws?.summary,
    intelligence?.processing_times?.summary,
    intelligence?.job_opportunities?.notes?.[0],
  ]
    .filter(Boolean)
    .join(" | ");

  return `
${language === "fr" ? "CONTEXTE STRATÉGIQUE" : "STRATEGY CONTEXT"}

CRS score: ${strategy?.crs_score ?? "--"}
Best pathway: ${strategy?.best_pathway?.name || "--"}
Best pathway confidence: ${strategy?.best_pathway?.confidence || confidenceValue || "--"}
Estimated timeline: ${getTimelineLabel(timelineValue, language)}

Recommended programs:
${safeList(strategy?.recommended_programs) || "--"}

Strengths:
${safeList(strategy?.strengths) || "--"}

Weaknesses:
${safeList(strategy?.weaknesses) || "--"}

Risks:
${safeRisks || "--"}

Roadmap:
${safeRoadmap || "--"}

Province recommendations:
${safeProvinces || "--"}

Immigration intelligence:
${intelligenceLines || "--"}

NOC:
Code: ${strategy?.noc_profile?.resolved_noc_code || strategy?.noc_summary?.noc_code || strategy?.noc_advantage?.noc_code || "--"}
Title: ${strategy?.noc_profile?.resolved_title || strategy?.noc_summary?.noc_title || strategy?.noc_summary?.occupation || "--"}
TEER: ${strategy?.noc_advantage?.teer ?? strategy?.noc_summary?.teer ?? "--"}
Strategic value: ${strategy?.noc_advantage?.strategic_value || "--"}

Current priority:
${priority?.title || "--"}
Reason:
${priority?.reason || "--"}
Actions:
${safeList(priority?.actions) || "--"}
`.trim();
}

export default function StrategyPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const language = i18n.language === "fr" ? "fr" : "en";

  const source = searchParams.get("source") || "";
  const intent = searchParams.get("intent") || "";

  const [data, setData] = useState(null);
  const [access, setAccess] = useState(() => getCachedBillingAccess());
  const [message, setMessage] = useState("");
  const [engineVersion, setEngineVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState(() => readTabFromSearch(searchParams));
  const [activeSection, setActiveSection] = useState("overview");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerMessages, setDrawerMessages] = useState([]);
  const [drawerInput, setDrawerInput] = useState("");
  const [drawerError, setDrawerError] = useState("");
  const [aiMode, setAiMode] = useState("general");
  const liveIntelligenceRefreshRef = useRef(0);
  

  useEffect(() => {
    const forceRefresh = localStorage.getItem("nbai_force_refresh");

    if (forceRefresh === "true") {
      localStorage.removeItem("nbai_force_refresh");
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  useEffect(() => {
    function handleEngineUpdate() {
      setEngineVersion((prev) => prev + 1);
    }

    function handleRefresh() {
      loadPage();
    }

    window.addEventListener("nbai-document-engine-updated", handleEngineUpdate);
    window.addEventListener("nbai-strategy-refresh", handleRefresh);

    return () => {
      window.removeEventListener("nbai-document-engine-updated", handleEngineUpdate);
      window.removeEventListener("nbai-strategy-refresh", handleRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const urlTab = readTabFromSearch(searchParams);
    if (urlTab !== activeTab) setActiveTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const firstSectionByTab = {
      overview: "overview",
      execution: "steps",
      pathways: "programs",
      risks: "risks",
    };
    setActiveSection(firstSectionByTab[activeTab] || "overview");
  }, [activeTab]);

  useEffect(() => {
  function handleActiveCaseUpdate() {
    loadPage();
  }

  window.addEventListener("nbai-active-case-updated", handleActiveCaseUpdate);

  return () => {
    window.removeEventListener("nbai-active-case-updated", handleActiveCaseUpdate);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  function switchTab(tab) {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  }

  async function loadPage() {
    try {
      setLoading(true);
      setMessage("");

      const [liteRes, accessRes] = await Promise.allSettled([
        getMyStrategyLite(language),
        getBillingAccess(),
      ]);

      let strategyData = null;
      let accessData = null;

      if (liteRes.status === "fulfilled") {
        strategyData = liteRes.value?.data || null;
      } else {
        try {
          const fallback = await getMyStrategy(language);
          strategyData = fallback?.data || null;
        } catch (err) {
          const status = err?.response?.status;

          if (status !== 404) {
            console.error(err);
            setMessage(
              err?.response?.data?.detail ||
                (language === "fr"
                  ? "Impossible de charger la stratégie."
                  : "Failed to load strategy.")
            );
          }
        }
      }

      if (accessRes.status === "fulfilled") {
        accessData = accessRes.value?.data || null;
      } else {
        accessData = getCachedBillingAccess();
        const status = accessRes.reason?.response?.status;
        if (status !== 404) {
          console.error(accessRes.reason);
        }
      }

      const hasInlineIntelligence = Boolean(
        strategyData?.immigration_intelligence?.latest_draws ||
          strategyData?.immigration_intelligence?.processing_times ||
          strategyData?.immigration_intelligence?.locked
      );
      const shouldHydrateIntelligence = Boolean(
        strategyData &&
          !hasInlineIntelligence &&
          (accessData?.is_premium || strategyData?.is_premium)
      );

      if (shouldHydrateIntelligence) {
        try {
          const intelligenceRes = await getImmigrationIntelligence(language);
          const intelligenceData = intelligenceRes?.data || null;

          if (intelligenceData) {
            strategyData = {
              ...strategyData,
              immigration_intelligence: intelligenceData,
              access: {
                ...(strategyData.access || {}),
                ...(intelligenceData.access || {}),
              },
            };
          }
        } catch (err) {
          console.warn("Premium intelligence hydration failed", err);
        }
      }

      setData(strategyData);
      setAccess(accessData);
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de charger la stratégie."
          : "Failed to load strategy."
      );
    } finally {
      setLoading(false);
    }
  }

  async function extractPdfErrorDetail(err, fallback) {
    const data = err?.response?.data;

    if (data?.detail) return data.detail;

    if (data instanceof Blob) {
      try {
        const text = await data.text();
        const parsed = JSON.parse(text);
        return parsed?.detail || parsed?.message || fallback;
      } catch {
        return fallback;
      }
    }

    return err?.response?.data?.message || fallback;
  }

  async function handleExportPdf() {
    try {
      setExportingPdf(true);
      setMessage("");

      const res = await exportMyStrategyPdf(language);
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download =
        language === "fr"
          ? "rapport_strategie_northbridgeai.pdf"
          : "northbridgeai_strategy_report.pdf";

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessage(
        language === "fr"
          ? "Rapport PDF téléchargé."
          : "PDF report downloaded."
      );
    } catch (err) {
      console.error(err);
      setMessage(
        await extractPdfErrorDetail(
          err,
          language === "fr"
            ? "Impossible d’exporter le PDF."
            : "Unable to export PDF."
        )
      );
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleAnalyzeStrategyDrawer(customMessage) {
    const isObjectPrompt =
      customMessage && typeof customMessage === "object" && !Array.isArray(customMessage);

    const promptLabel = isObjectPrompt
      ? String(customMessage.label || "").trim()
      : String(customMessage || drawerInput || "").trim();

    const promptIntent = isObjectPrompt
      ? String(customMessage.intent || "").trim().toLowerCase()
      : "";

    const defaultPrompt =
      language === "fr"
        ? "Analyse ma stratégie actuelle."
        : "Analyze my current strategy.";

    const userQuestion = promptLabel || defaultPrompt;

    const activeIntent = promptIntent || aiMode || "general";

    const intentInstruction =
      language === "fr"
        ? {
            pathway:
              "Concentre-toi sur le meilleur parcours, pourquoi il est le plus fort, et ce qui le rend crédible.",
            risk:
              "Concentre-toi uniquement sur les principaux risques, blocages ou faiblesses les plus importants.",
            optimization:
              "Concentre-toi sur les améliorations qui auraient le plus grand impact sur le dossier.",
            documents:
              "Concentre-toi sur les documents à préparer ou à renforcer ensuite.",
          }[activeIntent] || "Réponds de façon directe et ciblée."
        : {
            pathway:
              "Focus on the strongest pathway, why it is strongest, and what makes it credible.",
            risk:
              "Focus only on the biggest risks, blockers, or weaknesses.",
            optimization:
              "Focus on the improvements that would have the greatest impact on the case.",
            documents:
              "Focus on which documents should be prepared or strengthened next.",
          }[activeIntent] || "Answer directly and stay focused.";

    const formatInstruction =
      language === "fr"
        ? `
    FORMAT DE RÉPONSE (JSON STRICT) :

    {
      "answer": "réponse directe",
      "reasons": ["raison 1", "raison 2"],
      "actions": [
        { "label": "action 1", "route": "/documents" }
      ]
    }

    ROUTES AUTORISÉES :
    - /strategy
    - /profile
    - /documents
    - /documents/review
    - /pricing

    Utilise ces routes quand c’est pertinent.
    Réponds UNIQUEMENT en JSON valide.
    `
    : `
    RESPONSE FORMAT (STRICT JSON):

    {
      "answer": "direct answer",
      "reasons": ["reason 1", "reason 2"],
      "actions": [
        { "label": "action 1", "route": "/documents" }
      ]
    }

    ALLOWED ROUTES:
    - /strategy
    - /profile
    - /documents
    - /documents/review
    - /pricing

    Use these routes when relevant.
    Respond ONLY with valid JSON.
    `;

    try {
      setDrawerOpen(true);
      setDrawerLoading(true);
      setDrawerError("");

      const nextUserMessage = {
        role: "user",
        content: userQuestion,
      };

      const nextHistory = [...drawerMessages, nextUserMessage];
      setDrawerMessages(nextHistory);
      setDrawerInput("");

      const contextualMessage =
        language === "fr"
          ? `
  Tu es l'assistant stratégique de NorthBridgeAI.

  Utilise le contexte stratégique ci-dessous comme source de vérité. N’invente pas de faits qui ne sont pas dans le contexte.
  Ne répète pas toujours le même résumé global.
  Réponds directement à la question posée.
  Sois spécifique, concret et actionnable.

  Instruction d’intention:
  ${intentInstruction}

  ${formatInstruction}

  ${strategyDrawerContext}

  Question utilisateur:
  ${userQuestion}
          `.trim()
          : `
  You are NorthBridgeAI's strategy assistant.

  Use the strategy context below as the source of truth. Do not invent facts that are not in the context.
  Do not keep repeating the same overall summary.
  Answer the specific question being asked.
  Be concrete, specific, and actionable.

  Intent instruction:
  ${intentInstruction}

  ${formatInstruction}

  ${strategyDrawerContext}

  User question:
  ${userQuestion}
          `.trim();

      const response = await sendAIMessage({
        message: contextualMessage,
        chat_history: nextHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        language,
      });

      const data = response?.data || {};

      let parsedReply = null;

      const rawReply =
        data.reply || data.summary || data.overall_assessment || data.message || "";

      try {
        const firstParse = JSON.parse(rawReply);

        if (typeof firstParse?.reply === "string") {
          try {
            parsedReply = JSON.parse(firstParse.reply);
          } catch {
            parsedReply = {
              answer: firstParse.reply,
              reasons: firstParse.insights || [],
              actions: firstParse.suggested_next_actions || [],
            };
          }
        } else {
          parsedReply = firstParse;
        }
      } catch {
        parsedReply = {
          answer: rawReply,
          reasons: [],
          actions: [],
        };
      }

      const finalReply =
        parsedReply?.answer ||
        parsedReply?.reply ||
        rawReply ||
        "";

      if (!finalReply) {
        setDrawerError(
          language === "fr"
            ? "Impossible de générer une analyse pour le moment."
            : "Unable to generate an analysis right now."
        );
        return;
      }

      setDrawerMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: finalReply,
          reasons: Array.isArray(parsedReply?.reasons)
            ? parsedReply.reasons
            : Array.isArray(parsedReply?.insights)
            ? parsedReply.insights
            : [],
          actions: Array.isArray(parsedReply?.actions)
            ? parsedReply.actions
            : Array.isArray(parsedReply?.suggested_next_actions)
            ? parsedReply.suggested_next_actions
            : [],
        },
      ]);
    } catch (err) {
      console.error(err);
      setDrawerError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          (language === "fr"
            ? "Impossible de charger l’analyse IA."
            : "Unable to load AI analysis.")
      );
    } finally {
      setDrawerLoading(false);
    }
  }

  function openDrawerWithIntent(intent, label) {
    setAiMode(intent || "general");

    handleAnalyzeStrategyDrawer({
      intent,
      label,
    });
  }

  const strategy = data || null;
  const timelineValue =
    strategy?.estimated_timeline ||
    strategy?.timeline_estimate ||
    strategy?.timeline_summary ||
    null;

  const probabilityEstimate = strategy?.probability_estimate || {};
  const confidenceValue =
    getConfidenceLabel(
      strategy?.best_pathway?.confidence || probabilityEstimate?.confidence,
      language
    ) || "--";

  const probabilityValue = formatProbabilityValue(probabilityEstimate);

  const noc = strategy?.noc_summary || {};
  const nocAdvantage = useMemo(
    () => strategy?.noc_advantage || {},
    [strategy?.noc_advantage]
  );
  const provinceRecommendations = Array.isArray(strategy?.province_recommendations)
    ? strategy.province_recommendations
    : [];

  const documentStats = useMemo(() => {
    void engineVersion;
    const engine = readCompletionEngine();
    const values = Object.values(engine || {});

    return {
      total: values.length,
      reviewed: values.filter((v) => v?.reviewed).length,
      completed: values.filter((v) => v?.completed).length,
    };
  }, [engineVersion]);

  const progress = useMemo(() => {
      if (!documentStats.total) return 0;
      return Math.round(
        ((documentStats.completed + documentStats.reviewed * 0.5) /
          documentStats.total) *
          100
      );
    }, [documentStats]);

  const priority = useMemo(() => {
    return buildPriorityRecommendation(strategy || {}, documentStats, language);
  }, [strategy, documentStats, language]);

  const strategyDrawerContext = useMemo(() => {
  return buildStrategyDrawerContext({
    strategy,
    language,
    confidenceValue,
    timelineValue,
    priority,
  });
}, [strategy, language, confidenceValue, timelineValue, priority]);

  const hasFullStrategy = Boolean(access?.can_view_full_strategy);
  const hasDecisionEngine =
    Boolean(access?.features?.decision_engine) ||
    Boolean(access?.is_pro) ||
    Boolean(access?.is_premium);
  const hasAdvancedCopilot = Boolean(access?.can_use_advanced_ai);
  const canExportPdf = Boolean(access?.can_export_pdf);
  const hasSimulatorAccess =
    Boolean(access?.features?.decision_engine) ||
    Boolean(access?.is_pro) ||
    Boolean(access?.is_premium);

  const currentPlanLabel = useMemo(() => {
    if (access?.is_premium || access?.plan === "premium") return "Premium";
    if (access?.is_pro || access?.plan === "pro") return "Pro";
    return language === "fr" ? "Gratuit" : "Free";
  }, [access, language]);

  const showTopPaywallHero = !hasFullStrategy;
  const proPath = buildProPricingPath("strategy", intent || "execute");
  const premiumPath = buildPremiumPricingPath("strategy", "export");
  const premiumIntelligencePath = buildPremiumPricingPath(
    "strategy",
    "ircc-intelligence"
  );
  const immigrationIntelligence = strategy?.immigration_intelligence || null;
  const hasPremiumIntelligence = Boolean(
    access?.can_use_live_ircc_draws ||
      access?.can_view_processing_times ||
      access?.can_use_job_opportunity_matching ||
      access?.is_premium ||
      immigrationIntelligence?.locked === false
  );

  useEffect(() => {
    if (!hasPremiumIntelligence) return undefined;

    let cancelled = false;

    async function refreshLiveIntelligence({ force = false } = {}) {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      const now = Date.now();
      if (
        !force &&
        now - liveIntelligenceRefreshRef.current < LIVE_INTELLIGENCE_RETURN_REFRESH_MS
      ) {
        return;
      }

      liveIntelligenceRefreshRef.current = now;

      try {
        const res = await getImmigrationIntelligence(language);
        if (cancelled || !res?.data) return;

        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            immigration_intelligence: res.data,
            access: {
              ...(prev.access || {}),
              ...(res.data.access || {}),
            },
          };
        });
      } catch (err) {
        console.warn("Live immigration intelligence refresh failed", err);
      }
    }

    const intervalId = window.setInterval(
      () => refreshLiveIntelligence(),
      LIVE_INTELLIGENCE_REFRESH_MS
    );

    function handleVisibleRefresh() {
      if (document.visibilityState === "visible") {
        refreshLiveIntelligence();
      }
    }

    window.addEventListener("focus", refreshLiveIntelligence);
    document.addEventListener("visibilitychange", handleVisibleRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshLiveIntelligence);
      document.removeEventListener("visibilitychange", handleVisibleRefresh);
    };
  }, [hasPremiumIntelligence, language]);

  const bestPathwayName =
    strategy?.best_pathway?.name ||
    strategy?.top_recommendation?.name ||
    (Array.isArray(strategy?.recommended_programs) &&
    strategy.recommended_programs.length > 0
      ? strategy.recommended_programs[0]
      : "--");

  const topImprovement =
    Array.isArray(strategy?.next_steps) && strategy.next_steps.length > 0
      ? strategy.next_steps[0]
      : language === "fr"
      ? "Aucune optimisation prioritaire détectée"
      : "No priority improvement detected";

  const profileStrengthTone =
  Number(strategy?.crs_score || 0) >= 500
    ? "strong"
    : Number(strategy?.crs_score || 0) >= 430
    ? "info"
    : "medium";

const confidenceTone =
  String(confidenceValue || "").toLowerCase().includes("high") ||
  String(confidenceValue || "").toLowerCase().includes("élev")
    ? "strong"
    : String(confidenceValue || "").toLowerCase().includes("mod") ||
      String(confidenceValue || "").toLowerCase().includes("medium")
    ? "medium"
    : "info";

const heroTimelinePreview = getTimelineLabel(timelineValue, language);

  const heroSummary =
    translateStrategySummary(
      strategy?.strategy_headline || strategy?.advisor_summary,
      language
    ) ||
    (language === "fr"
      ? "Votre stratégie est basée sur votre profil et vos opportunités actuelles."
      : "Your strategy is built from your profile and current opportunities.");

  const bestPathway = strategy?.best_pathway || null;
  const nocProfile = useMemo(
    () => strategy?.noc_profile || {},
    [strategy?.noc_profile]
  );
  const previewProvince =
    Array.isArray(strategy?.province_recommendations) &&
    strategy.province_recommendations.length > 0
      ? strategy.province_recommendations[0]
      : null;

  const overviewCards = [
      {
        key: "best-pathway",
        node: (
          <BestPathwayCard
            language={language}
            bestPathway={
              bestPathway || {
                name: bestPathwayName,
                confidence: confidenceValue,
                reasons: heroSummary ? [heroSummary] : [],
              }
            }
            onOpenDocuments={() =>
              navigate(
                `/documents?pathway=${encodeURIComponent(
                  bestPathway?.name || ""
                )}`
              )
            }
            onAnalyzePathway={() =>
              openDrawerWithIntent(
                "pathway",
                language === "fr"
                  ? "Explique pourquoi ce parcours est le meilleur."
                  : "Explain why this pathway is the strongest."
              )
            }
          />
        ),
      },
      {
        key: "noc-signal",
        node: (
          <NocSignalCard
            language={language}
            nocProfile={nocProfile}
            nocAdvantage={nocAdvantage}
            locked={!hasFullStrategy}
            onReviewProfile={() => navigate("/profile")}
            onUpgrade={() => navigate(proPath)}
          />
        ),
      },
      {
        key: "province-preview",
        node: hasFullStrategy ? (
          <InsightCard
            eyebrow={
              language === "fr"
                ? "Province recommandée"
                : "Recommended province"
            }
            title={
              previewProvince
                ? `${previewProvince.province || "--"}${
                    previewProvince.program ? ` — ${previewProvince.program}` : ""
                  }`
                : "--"
            }
            body={
              previewProvince?.reason ||
              (language === "fr"
                ? "Une recommandation provinciale apparaîtra ici lorsqu’elle sera disponible."
                : "A provincial recommendation will appear here when available.")
            }
            chips={[
              previewProvince?.chance
                ? `${language === "fr" ? "Chance" : "Chance"}: ${
                    previewProvince.chance
                  }`
                : null,
              typeof previewProvince?.score !== "undefined"
                ? `Score: ${previewProvince.score}`
                : null,
            ].filter(Boolean)}
            actions={
              <Button variant="secondary" onClick={() => switchTab("pathways")}>
                {language === "fr" ? "Voir les provinces" : "View provinces"}
              </Button>
            }
          />
        ) : (
          <BlurredSection
            title={
              language === "fr"
                ? "Débloquez vos provinces cibles"
                : "Unlock your target provinces"
            }
            body={
              language === "fr"
                ? "Voyez quelles provinces et quels volets semblent les plus adaptés à votre profil."
                : "See which provinces and streams appear to fit your profile best."
            }
            onUpgrade={() => navigate(proPath)}
            buttonLabel={language === "fr" ? "Débloquer" : "Unlock Now"}
          >
            <InsightCard
              eyebrow={
                language === "fr"
                  ? "Province recommandée"
                  : "Recommended province"
              }
              title={
                previewProvince
                  ? `${previewProvince.province || "--"}${
                      previewProvince.program ? ` — ${previewProvince.program}` : ""
                    }`
                  : language === "fr"
                  ? "Province cible"
                  : "Target province"
              }
              body={
                previewProvince?.reason ||
                (language === "fr"
                  ? "Débloquez la recommandation provinciale complète."
                  : "Unlock the full province recommendation.")
              }
              chips={[
                previewProvince?.chance
                  ? `${language === "fr" ? "Chance" : "Chance"}: ${
                      previewProvince.chance
                    }`
                  : null,
              ].filter(Boolean)}
            />
          </BlurredSection>
        ),
      },
  ];

  const emptyStateCopy =
  language === "fr"
    ? {
        noProgramsTitle: "Aucun programme recommandé pour le moment",
        noProgramsBody:
          "Complétez davantage votre profil ou améliorez vos données stratégiques pour obtenir une lecture plus précise.",
        noProvinceTitle: "Aucune province cible affichée pour le moment",
        noProvinceBody:
          "Les recommandations provinciales apparaîtront ici lorsqu’un meilleur alignement sera détecté.",
        noRiskTitle: "Aucun risque majeur affiché pour le moment",
        noRiskBody:
          "Les risques détectés dans votre dossier apparaîtront ici avec leurs stratégies d’atténuation.",
        noStepsTitle: "Aucune prochaine étape disponible",
        noStepsBody:
          "Lorsque votre stratégie aura plus de profondeur, vos prochaines actions apparaîtront ici.",
        completeProfile: "Compléter mon profil",
        upgrade: "Voir les tarifs",
      }
    : {
        noProgramsTitle: "No recommended programs yet",
        noProgramsBody:
          "Complete more of your profile or improve your strategic inputs to unlock a more precise read.",
        noProvinceTitle: "No province targets shown yet",
        noProvinceBody:
          "Provincial recommendations will appear here when a stronger fit is detected.",
        noRiskTitle: "No major risks shown yet",
        noRiskBody:
          "Detected risks in your case will appear here along with mitigation strategies.",
        noStepsTitle: "No next steps available yet",
        noStepsBody:
          "As your strategy gains more depth, your next actions will appear here.",
        completeProfile: "Complete my profile",
        upgrade: "View pricing",
      };

  const text = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Votre stratégie",
        subtitle:
          "Votre lecture stratégique premium, structurée autour de vos meilleures voies, de vos risques et des actions qui ont le plus d’impact.",
        overview: "Aperçu",
        execution: "Exécution",
        pathways: "Parcours",
        risksTab: "Risques",
        crs: "Score CRS",
        crsBand: "Force du profil",
        strategyHeadline: "Lecture stratégique",
        bestPathway: "Meilleur parcours",
        topImprovement: "Priorité d’amélioration",
        confidence: "Confiance",
        probability: "Probabilité",
        timeline: "Délai estimé",
        programs: "Programmes recommandés",
        strengths: "Forces",
        weaknesses: "Faiblesses",
        nextSteps: "Prochaines étapes",
        roadmap: "Feuille de route",
        riskAnalysis: "Risques à surveiller",
        noc: "Signal CNP",
        nocInsights: "Analyse CNP",
        immigrationIntelligence: "Veille IRCC Premium",
        premiumSignal: "Signal officiel",
        latestDraws: "Dernières rondes IRCC",
        processingTimes: "Délais IRCC",
        jobOpportunities: "Emplois et provinces",
        categorySelection: "Catégories Entrée express",
        dataStatus: "Statut des données",
        openOfficialSource: "Ouvrir la source officielle",
        openProcessingChecker: "Ouvrir le verificateur IRCC",
        officialChecker: "Verificateur officiel",
        profileOccupation: "Profession du profil",
        intelligenceSummary:
          "Surveillez les rondes IRCC, les délais, les catégories et les signaux d’emploi pour guider la prochaine action.",
        processingTimesBody:
          "Les délais sont vérifiés dans l’outil officiel IRCC selon le type de demande et le pays.",
        jobOpportunitiesBody:
          "Comparez la demande d’emploi et les provinces recommandées pour choisir un parcours pratique.",
        categoryBody:
          "Comparez votre profil aux catégories officielles avant de prioriser une voie.",
        noLiveDraws:
          "La liste en direct n’est pas disponible dans cette réponse. Utilisez la source officielle.",
        provinceRecommendations: "Provinces recommandées",
        completed: "Complétés",
        reviewed: "Révisés",
        total: "Suivis",
        openDocuments: "Gérer mes documents",
        priorityTitle: "Priorité intelligente",
        priorityReason: "Pourquoi maintenant",
        recommendedActions: "Actions recommandées",
        openPriorityRoute: "Ouvrir l’étape prioritaire",
        noData: "Aucune stratégie n’est encore disponible.",
        noItems: "Aucun élément disponible pour le moment.",
        emptyBody:
          "Commencez par compléter votre profil pour générer une stratégie exploitable.",
        openProfile: "Compléter mon profil",
        launchEyebrow: "Forfaits",
        launchTitle: "Votre stratégie devient plus puissante à mesure que vous avancez",
        launchBody:
          "Le mode Gratuit aide à comprendre votre position. Pro débloque la stratégie complète et le moteur de décision. Premium ajoute la finition et l’export PDF.",
        freeTitle: "Gratuit",
        proTitle: "Pro — 39 $ / 30 jours",
        premiumTitle: "Premium — 99 $ / 90 jours",
        freeLabel: "Explorer",
        proLabel: "Agir",
        premiumLabel: "Finaliser",
        fullStrategyPromptTitle: "Débloquez la stratégie complète",
        fullStrategyPromptBody:
          "Passez à Pro pour débloquer les recommandations détaillées, la feuille de route et les risques.",
        decisionPromptTitle: "Débloquez le moteur de décision",
        decisionPromptBody:
          "Passez à Pro pour débloquer des priorités plus intelligentes et une guidance plus exploitable.",
        premiumPromptTitle: "Débloquez l’export PDF",
        premiumPromptBody:
          "Passez à Premium pour exporter votre stratégie et finaliser votre dossier.",
        currentPlan: "Plan actuel",
        exportPdf: "Télécharger le PDF",
        exportingPdf: "Téléchargement...",
        blurProgramsTitle: "Débloquez vos meilleures voies d’immigration",
        blurProgramsBody:
          "Voyez exactement quels programmes correspondent le mieux à votre profil et pourquoi.",
        blurWeaknessesTitle: "Voyez ce qui freine vraiment votre dossier",
        blurWeaknessesBody:
          "Identifiez vos points faibles les plus critiques et comment les corriger.",
        blurStepsTitle: "Débloquez votre plan d’action complet",
        blurStepsBody:
          "Obtenez les prochaines étapes les plus importantes, adaptées à votre profil.",
        blurProvinceTitle: "Débloquez vos meilleures provinces cibles",
        blurProvinceBody:
          "Voyez quelles provinces et quels programmes semblent les plus adaptés à votre profil.",
        blurRoadmapTitle: "Débloquez votre feuille de route complète",
        blurRoadmapBody:
          "Voyez les actions à plus fort impact, leur difficulté et leur potentiel stratégique.",
        blurRiskTitle: "Débloquez l’analyse des risques",
        blurRiskBody:
          "Comprenez ce qui peut ralentir votre dossier et comment réduire ces risques.",
        unlockNow: "Débloquer maintenant",
        blurIntelligenceTitle: "Débloquez la veille immigration Premium",
        blurIntelligenceBody:
          "Suivez les rondes IRCC, les délais de traitement, les catégories et les signaux Guichet-Emplois/PCP.",
        teer: "TEER",
        strategicValue: "Valeur stratégique",
        highDemandOccupation: "Profession en demande",
        yes: "Oui",
        no: "Non",
        whyThisMatters: "Pourquoi c’est important",
        recommendedNocActions: "Actions liées au CNP",
        premiumExportPrimary: "Passer à Premium",
        navTitle: "Navigation",
        lockedShort: "Accès requis",
        bestPathwayPreview: "Aperçu du meilleur parcours",
        recommendedProvince: "Province recommandée",
        reviewMyProfile: "Vérifier mon profil",
        prepareDocuments: "Préparer mes documents",
        unlockNocAnalysis: "Débloquez l’analyse CNP",
        unlockProvinceTargets: "Débloquez vos provinces cibles",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "Your Strategy",
      subtitle:
        "Your premium strategic read, organized around your strongest pathways, risks, and the actions that create the most impact.",
      overview: "Overview",
      execution: "Execution",
      pathways: "Pathways",
      risksTab: "Risks",
      crs: "CRS Score",
      crsBand: "Profile strength",
      strategyHeadline: "Strategic read",
      bestPathway: "Best pathway",
      topImprovement: "Top improvement",
      confidence: "Confidence",
      probability: "Probability",
      timeline: "Estimated timeline",
      programs: "Recommended Programs",
      strengths: "Strengths",
      weaknesses: "Weaknesses",
      nextSteps: "Next Steps",
      roadmap: "Roadmap",
      riskAnalysis: "Risks to watch",
        noc: "NOC Signal",
        nocInsights: "NOC analysis",
        immigrationIntelligence: "Premium IRCC Intelligence",
        premiumSignal: "Official signal",
        latestDraws: "Latest IRCC draws",
        processingTimes: "IRCC processing times",
        jobOpportunities: "Jobs and provinces",
        categorySelection: "Express Entry categories",
        dataStatus: "Data status",
        openOfficialSource: "Open official source",
        openProcessingChecker: "Open IRCC checker",
        officialChecker: "Official checker",
        profileOccupation: "Profile occupation",
        intelligenceSummary:
          "Monitor IRCC rounds, processing times, categories, and job-market signals to guide the next move.",
        processingTimesBody:
          "Processing times are checked in the official IRCC tool by application type and country.",
        jobOpportunitiesBody:
          "Compare job demand and recommended provinces before choosing a practical pathway.",
        categoryBody:
          "Compare your profile to official categories before prioritizing a pathway.",
        noLiveDraws:
          "The live list is not available in this response. Use the official source.",
        provinceRecommendations: "Recommended Provinces",
      completed: "Completed",
      reviewed: "Reviewed",
      total: "Tracked",
      openDocuments: "Manage my documents",
      priorityTitle: "Smart Priority",
      priorityReason: "Why now",
      recommendedActions: "Recommended actions",
      openPriorityRoute: "Open priority step",
      noData: "No strategy is available yet.",
      noItems: "No items available yet.",
      emptyBody:
        "Start by completing your profile to generate a usable strategy.",
      openProfile: "Complete my profile",
      launchEyebrow: "Packages",
      launchTitle: "Your strategy gets stronger as you move forward",
      launchBody:
        "Free helps you understand where you stand. Pro unlocks the full strategy and decision engine. Premium adds finishing value and PDF export.",
      freeTitle: "Free",
      proTitle: "Pro — $39 / 30 days",
      premiumTitle: "Premium — $99 / 90 days",
      freeLabel: "Explore",
      proLabel: "Act",
      premiumLabel: "Finish",
      fullStrategyPromptTitle: "Unlock full strategy",
      fullStrategyPromptBody:
        "Upgrade to Pro to unlock detailed recommendations, roadmap, and risk analysis.",
      decisionPromptTitle: "Unlock the decision engine",
      decisionPromptBody:
        "Upgrade to Pro to unlock smarter priorities and more actionable guidance.",
      premiumPromptTitle: "Unlock PDF export",
      premiumPromptBody:
        "Upgrade to Premium to export your strategy and finish your case package.",
      currentPlan: "Current plan",
      exportPdf: "Download PDF",
      exportingPdf: "Downloading...",
      blurProgramsTitle: "Unlock your best immigration pathways",
      blurProgramsBody:
        "See exactly which programs fit your profile best and why.",
      blurWeaknessesTitle: "See what’s really holding your case back",
      blurWeaknessesBody:
        "Identify your most important weaknesses and how to improve them.",
      blurStepsTitle: "Unlock your full action plan",
      blurStepsBody:
        "Get the most important next steps tailored to your profile.",
      blurProvinceTitle: "Unlock your best province targets",
        blurProvinceBody:
          "See which provinces and provincial programs appear to fit your profile best.",
        blurIntelligenceTitle: "Unlock Premium immigration intelligence",
        blurIntelligenceBody:
          "Track IRCC draws, processing times, Express Entry categories, and Job Bank/PNP signals.",
        blurRoadmapTitle: "Unlock your full roadmap",
      blurRoadmapBody:
        "See the highest-impact actions, their difficulty, and their strategic upside.",
      blurRiskTitle: "Unlock risk analysis",
      blurRiskBody:
        "Understand what may slow your case down and how to reduce those risks.",
      unlockNow: "Unlock Now",
      teer: "TEER",
      strategicValue: "Strategic value",
      highDemandOccupation: "High-demand occupation",
      yes: "Yes",
      no: "No",
      whyThisMatters: "Why this matters",
      recommendedNocActions: "NOC-related actions",
      premiumExportPrimary: "Upgrade to Premium",
      navTitle: "Navigation",
      lockedShort: "Access required",
      bestPathwayPreview: "Best pathway preview",
      recommendedProvince: "Recommended province",
      reviewMyProfile: "Review my profile",
      prepareDocuments: "Prepare my documents",
      unlockNocAnalysis: "Unlock NOC analysis",
      unlockProvinceTargets: "Unlock your target provinces",
    };
  }, [language]);

  const topTabs = useMemo(
    () => [
      { key: "overview", label: text.overview, locked: false },
      { key: "execution", label: text.execution, locked: !hasFullStrategy },
      { key: "pathways", label: text.pathways, locked: !hasFullStrategy },
      { key: "risks", label: text.risksTab, locked: !hasFullStrategy },
    ],
    [text, hasFullStrategy]
  );

  const sectionsByTab = useMemo(
    () => ({
      overview: [{ key: "overview", label: text.overview, locked: false }],
      execution: [
        { key: "steps", label: text.nextSteps, locked: !hasFullStrategy },
        { key: "roadmap", label: text.roadmap, locked: !hasFullStrategy },
        { key: "strengths", label: text.strengths, locked: false },
        { key: "weaknesses", label: text.weaknesses, locked: !hasFullStrategy },
      ],
      pathways: [
        { key: "programs", label: text.programs, locked: !hasFullStrategy },
        {
          key: "province",
          label: text.provinceRecommendations,
          locked: !hasFullStrategy,
        },
        {
          key: "intelligence",
          label: text.immigrationIntelligence,
          locked: !hasFullStrategy || !hasPremiumIntelligence,
        },
      ],
      risks: [{ key: "risks", label: text.riskAnalysis, locked: !hasFullStrategy }],
    }),
    [text, hasFullStrategy, hasPremiumIntelligence]
  );

  const visibleSections = sectionsByTab[activeTab] || sectionsByTab.overview;
  const activeSectionLabel =
    visibleSections.find((section) => section.key === activeSection)?.label ||
    text.overview;

  const activeLockedLabel = visibleSections.find(
    (section) => section.key === activeSection
  )?.locked
    ? text.lockedShort
    : "";

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <div className="rounded-lg border border-slate-200 bg-white px-10 py-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <p className="text-lg font-medium text-slate-700">
              {language === "fr" ? "Chargement..." : "Loading..."}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!strategy) {
    return (
      <Layout>
        {message && (
          <div className="mb-6 rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        <PageHeaderBlock
          brand={text.brand}
          title={text.title}
          subtitle={text.subtitle}
        />

        <Card variant="soft" padding="lg" className="max-w-2xl rounded-lg">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {text.noData}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {text.emptyBody}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => navigate("/profile")}>
              {text.openProfile}
            </Button>
            <Button variant="secondary" onClick={() => navigate("/documents")}>
              {text.openDocuments}
            </Button>
          </div>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      {message && (
        <div className="mb-6 rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {message}
        </div>
      )}

      <PageHeaderBlock
        brand={text.brand}
        title={text.title}
        subtitle={text.subtitle}
      />

      {showTopPaywallHero && (
        <StrategyPaywallHero
          language={language}
          currentPlanLabel={currentPlanLabel}
          source={source}
          intent={intent}
          onUpgradePro={() => navigate(proPath)}
          onUpgradePremium={() => navigate(premiumPath)}
        />
      )}

      <section className="mb-6 overflow-hidden rounded-[30px] border border-slate-900/10 bg-[#172033] p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
              {text.strategyHeadline}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
              {bestPathwayName}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68 md:text-base">
              {heroSummary}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <PlanChip active={!access?.is_pro && !access?.is_premium}>
                {text.freeTitle}
              </PlanChip>
              <PlanChip active={access?.is_pro && !access?.is_premium}>
                Pro
              </PlanChip>
              <PlanChip active={access?.is_premium}>Premium</PlanChip>
              <ConfidencePill value={confidenceValue} />
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <HeroSignalChip
                label={text.crsBand}
                value={getScoreBand(strategy?.crs_score, language)}
                tone={profileStrengthTone}
              />
              <HeroSignalChip
                label={text.confidence}
                value={confidenceValue}
                tone={confidenceTone}
              />
              <HeroSignalChip
                label={text.timeline}
                value={heroTimelinePreview}
                tone="info"
              />
              <HeroSignalChip
                label={text.topImprovement}
                value={topImprovement}
                tone="default"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant="white"
                onClick={() => navigate("/documents")}
                className="h-11 px-5"
              >
                {text.openDocuments}
              </Button>
              {canExportPdf ? (
                <Button
                  variant="outlineLight"
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="h-11 px-5"
                >
                  {exportingPdf ? text.exportingPdf : text.exportPdf}
                </Button>
              ) : (
                <Button
                  variant="outlineLight"
                  onClick={() => navigate(premiumPath)}
                  className="h-11 px-5"
                >
                  {text.exportPdf}
                </Button>
              )}
            </div>
          </div>

          <div className="xl:max-w-sm xl:justify-self-end">
            <HeroStatusCluster
              language={language}
              strategy={strategy}
              confidenceValue={confidenceValue}
              timelineValue={timelineValue}
            />
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label={text.bestPathway} value={bestPathwayName || "--"} />
        <Stat label={text.topImprovement} value={topImprovement || "--"} />
        <Stat label={text.confidence} value={confidenceValue} />
        <Stat label={text.probability} value={probabilityValue} />
      </div>

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {topTabs.map((tab) => (
          <TopTabButton
            key={tab.key}
            active={activeTab === tab.key}
            label={tab.label}
            locked={tab.locked}
            lockedLabel={language === "fr" ? "Accès requis" : "Access required"}
            onClick={() => switchTab(tab.key)}
          />
        ))}
      </div>
      <StrategyActionBar
        language={language}
        canExportPdf={canExportPdf}
        exportingPdf={exportingPdf}
        onOpenDocuments={() => navigate("/documents")}
        onExportPdf={handleExportPdf}
        onAnalyzeStrategy={() =>
          handleAnalyzeStrategyDrawer({
            label:
              language === "fr"
                ? "Analyse ma stratégie actuelle."
                : "Analyze my current strategy.",
            intent: "optimization",
          })
        }
        onUpgrade={() => navigate(premiumPath)}
      />

      {activeTab === "overview" && (
        <div className="space-y-6">
          <ScoreSimulatorTeaser
            language={language}
            currentScore={strategy?.crs_score}
            hasFullStrategy={hasFullStrategy}
            onUpgrade={() =>
              navigate(hasSimulatorAccess ? "/strategy/simulator" : proPath)
            }
          />

          <div className="grid gap-5 xl:grid-cols-3">
            {overviewCards.map((card) => (
              <div key={card.key}>{card.node}</div>
            ))}
          </div>

          {!hasFullStrategy && (
            <UpgradePrompt
              className="mb-0"
              title={text.fullStrategyPromptTitle}
              body={text.fullStrategyPromptBody}
              buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
            />
          )}

          <StrategyAICard
            language={language}
            hasAdvancedCopilot={hasAdvancedCopilot}
            onAnalyze={() =>
              handleAnalyzeStrategyDrawer({
                label:
                  language === "fr"
                    ? "Analyse ma stratégie d'immigration et propose les meilleures améliorations possibles."
                    : "Analyze my immigration strategy and suggest the best improvements possible.",
                intent: "optimization",
              })
            }
          />

          {!hasAdvancedCopilot && (
            <UpgradePrompt
              className="mb-0"
              title={
                language === "fr"
                  ? "Débloquez le copilote avancé"
                  : "Unlock advanced AI copilot"
              }
              body={
                language === "fr"
                  ? "Passez à Pro ou Premium pour une guidance plus profonde et plus exploitable."
                  : "Upgrade to Pro or Premium for deeper, more actionable guidance."
              }
              buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
            />
          )}
        </div>
      )}

      {activeTab !== "overview" && (
        <div className="grid items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="xl:sticky xl:top-24 xl:self-start">
            <div className="flex flex-col gap-5">
              <Card padding="md" className="overflow-hidden rounded-lg">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {text.navTitle}
                </p>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 xl:hidden">
                  {visibleSections.map((section) => (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => setActiveSection(section.key)}
                      className={`shrink-0 rounded-full border px-3 py-2 text-sm ${
                        activeSection === section.key
                          ? "border-slate-950 bg-slate-950 font-semibold text-white"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 hidden space-y-1.5 xl:block">
                  {visibleSections.map((section) => (
                    <SidebarButton
                      key={section.key}
                      active={activeSection === section.key}
                      label={section.label}
                      locked={section.locked}
                      lockedLabel={language === "fr" ? "Accès requis" : "Access required"}
                      onClick={() => setActiveSection(section.key)}
                    />
                  ))}
                </div>
              </Card>

              <StrategyProgressCard
                language={language}
                progress={progress}
                documentStats={documentStats}
                priority={priority}
                onOpenPriority={() => navigate(priority.route)}
                onAnalyzePriority={() =>
                  openDrawerWithIntent(
                    "documents",
                    language === "fr"
                      ? "Quels documents dois-je prioriser maintenant ?"
                      : "Which documents should I prioritize next?"
                  )
                }
              />
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <SectionChrome
              activeTab={activeTab}
              activeSectionLabel={activeSectionLabel}
              lockedLabel={activeLockedLabel}
              text={text}
            />

            {activeTab === "execution" && activeSection === "steps" &&
              (hasFullStrategy ? (
                (
                  Array.isArray(strategy?.next_steps) && strategy.next_steps.length > 0
                    ? (
                      <ListCard
                        title={text.nextSteps}
                        items={strategy?.next_steps}
                        emptyLabel={text.noItems}
                      />
                    )
                    : (
                      <StrategySectionState
                        language={language}
                        title={emptyStateCopy.noStepsTitle}
                        body={emptyStateCopy.noStepsBody}
                        actionLabel={emptyStateCopy.completeProfile}
                        onAction={() => navigate("/profile")}
                        tone="info"
                      />
                    )
                )
              ) : (
                <BlurredSection
                  title={text.blurStepsTitle}
                  body={text.blurStepsBody}
                  buttonLabel={language === "fr" ? "Débloquer" : "Unlock Now"}
                  onUpgrade={() => navigate(proPath)}
                >
                  <ListCard
                    title={text.nextSteps}
                    items={
                      language === "fr"
                        ? [
                            "Améliorer le score linguistique",
                            "Préparer les documents clés",
                            "Exécuter la meilleure voie stratégique",
                          ]
                        : [
                            "Improve language score",
                            "Prepare key documents",
                            "Execute the best-fit pathway",
                          ]
                    }
                    emptyLabel={text.noItems}
                  />
                </BlurredSection>
              ))}

            {activeTab === "execution" && activeSection === "roadmap" &&
              (hasFullStrategy ? (
                <RoadmapCard
                  title={text.roadmap}
                  items={strategy?.roadmap}
                  emptyLabel={text.noItems}
                  language={language}
                />
              ) : (
                <BlurredSection
                  title={text.blurRoadmapTitle}
                  body={text.blurRoadmapBody}
                  buttonLabel={text.unlockNow}
                  onUpgrade={() => navigate(proPath)}
                >
                  <RoadmapCard
                    title={text.roadmap}
                    items={
                      Array.isArray(strategy?.roadmap) && strategy.roadmap.length
                        ? strategy.roadmap
                        : [
                            language === "fr"
                              ? {
                                  title: "Améliorer le score linguistique",
                                  estimated_crs_gain: 28,
                                  difficulty: "Moyen",
                                  reason:
                                    "L’amélioration linguistique est l’un des leviers les plus rapides.",
                                }
                              : {
                                  title: "Improve language score",
                                  estimated_crs_gain: 28,
                                  difficulty: "Medium",
                                  reason:
                                    "Language improvement is one of the fastest levers.",
                                },
                          ]
                    }
                    emptyLabel={text.noItems}
                    language={language}
                  />
                </BlurredSection>
              ))}

            {activeTab === "execution" && activeSection === "strengths" && (
              <div className="space-y-5">
                <ListCard
                  title={text.strengths}
                  items={strategy?.strengths}
                  emptyLabel={text.noItems}
                />

                <TimelineCard
                  timeline={timelineValue}
                  language={language}
                  title={text.timeline}
                  noItemsLabel={text.noItems}
                />

                <Card
                  variant="premium"
                  padding="lg"
                  className="space-y-5 rounded-lg border-stone-200 bg-stone-50"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {text.priorityTitle}
                  </p>
                  <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
                    {priority.title}
                  </h2>

                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
                      {text.priorityReason}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-amber-900">
                      {priority.reason}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {text.recommendedActions}
                    </p>
                    <div className="mt-3 space-y-2.5">
                      {priority.actions.map((action, index) => (
                        <div
                          key={`${action}-${index}`}
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-700 shadow-sm"
                        >
                          {action}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-1">
                    <Button onClick={() => navigate(priority.route)}>
                      {text.openPriorityRoute}
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "execution" && activeSection === "weaknesses" &&
              (hasFullStrategy ? (
                <ListCard
                  title={text.weaknesses}
                  items={strategy?.weaknesses}
                  emptyLabel={text.noItems}
                />
              ) : (
                <BlurredSection
                  title={text.blurWeaknessesTitle}
                  body={text.blurWeaknessesBody}
                  buttonLabel={text.unlockNow}
                  onUpgrade={() => navigate(proPath)}
                >
                  <ListCard
                    title={text.weaknesses}
                    items={
                      strategy?.weaknesses?.length
                        ? strategy.weaknesses
                        : [
                            language === "fr"
                              ? "Écart potentiel de score linguistique"
                              : "Potential language score gap",
                            language === "fr"
                              ? "Preuves de travail à renforcer"
                              : "Work evidence may need strengthening",
                          ]
                    }
                    emptyLabel={text.noItems}
                  />
                </BlurredSection>
              ))}

            {activeTab === "pathways" && activeSection === "programs" &&
              (hasFullStrategy ? (
                Array.isArray(strategy?.recommended_programs) &&
                strategy.recommended_programs.length > 0 ? (
                  <div className="space-y-5">
                    <ListCard
                      title={text.programs}
                      items={strategy?.recommended_programs}
                      emptyLabel={text.noItems}
                    />

                    {(noc?.noc_code ||
                      noc?.occupation ||
                      nocAdvantage?.has_noc ||
                      typeof nocAdvantage?.teer === "number") && (
                      <Card padding="lg" className="space-y-5 rounded-lg">
                        <SectionTitle>{text.nocInsights}</SectionTitle>

                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {text.noc}
                          </p>
                          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
                            {nocProfile?.resolved_noc_code
                              ? `${nocProfile.resolved_noc_code} — ${
                                  nocProfile.resolved_title || ""
                                }`
                              : noc?.noc_code
                              ? `${noc.noc_code} — ${noc.noc_title || noc.occupation || ""}`
                              : nocAdvantage?.noc_code
                              ? `${nocAdvantage.noc_code}`
                              : noc?.occupation || "--"}
                          </h2>

                          {typeof noc?.teer === "number" ? (
                            <p className="mt-2 text-sm text-slate-600">TEER {noc.teer}</p>
                          ) : typeof nocAdvantage?.teer === "number" &&
                            nocAdvantage.teer >= 0 ? (
                            <p className="mt-2 text-sm text-slate-600">
                              {text.teer} {nocAdvantage.teer}
                            </p>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {typeof nocProfile?.suggested_confidence === "number" ? (
                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              {text.confidence}:{" "}
                              {Math.round(nocProfile.suggested_confidence * 100)}%
                            </span>
                          ) : null}

                          {Array.isArray(nocAdvantage?.category_tags) &&
                          nocAdvantage.category_tags.length > 0
                            ? nocAdvantage.category_tags.slice(0, 3).map((tag, index) => (
                                <span
                                  key={`${tag}-${index}`}
                                  className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                                >
                                  {tag}
                                </span>
                              ))
                            : null}
                        </div>

                        {(typeof nocAdvantage?.teer === "number" &&
                          nocAdvantage.teer >= 0) ||
                        typeof nocAdvantage?.strategic_value === "string" ||
                        typeof nocAdvantage?.is_high_demand === "boolean" ? (
                          <div className="grid gap-4 md:grid-cols-3">
                            <Stat
                              label={text.teer}
                              value={
                                typeof nocAdvantage?.teer === "number" &&
                                nocAdvantage.teer >= 0
                                  ? nocAdvantage.teer
                                  : "--"
                              }
                            />
                            <Stat
                              label={text.strategicValue}
                              value={nocAdvantage?.strategic_value || "--"}
                            />
                            <Stat
                              label={text.highDemandOccupation}
                              value={
                                typeof nocAdvantage?.is_high_demand === "boolean"
                                  ? nocAdvantage.is_high_demand
                                    ? text.yes
                                    : text.no
                                  : "--"
                              }
                            />
                          </div>
                        ) : null}

                        {Array.isArray(nocAdvantage?.signals) &&
                        nocAdvantage.signals.length > 0 ? (
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {text.whyThisMatters}
                            </p>
                            <div className="mt-3 space-y-2">
                              {nocAdvantage.signals.map((item, index) => (
                                <div
                                  key={`${item}-${index}`}
                                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700"
                                >
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {Array.isArray(nocAdvantage?.recommendations) &&
                        nocAdvantage.recommendations.length > 0 ? (
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {text.recommendedNocActions}
                            </p>
                            <div className="mt-3 space-y-2">
                              {nocAdvantage.recommendations.map((item, index) => (
                                <div
                                  key={`${item}-${index}`}
                                  className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-950"
                                >
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </Card>
                    )}
                  </div>
                ) : (
                  <StrategySectionState
                    language={language}
                    title={emptyStateCopy.noProgramsTitle}
                    body={emptyStateCopy.noProgramsBody}
                    actionLabel={emptyStateCopy.completeProfile}
                    onAction={() => navigate("/profile")}
                    tone="info"
                  />
                )
              ) : (
                <BlurredSection
                  title={text.blurProgramsTitle}
                  body={text.blurProgramsBody}
                  buttonLabel={text.unlockNow}
                  onUpgrade={() => navigate(proPath)}
                >
                  <ListCard
                    title={text.programs}
                    items={
                      strategy?.recommended_programs?.length
                        ? strategy.recommended_programs
                        : ["Express Entry", "Provincial Nominee Program", "Work Permit"]
                    }
                    emptyLabel={text.noItems}
                  />
                </BlurredSection>
              ))}

            {activeTab === "pathways" && activeSection === "province" &&
              (hasFullStrategy ? (
                provinceRecommendations.length > 0 ? (
                  <ProvinceCard
                    title={text.provinceRecommendations}
                    items={provinceRecommendations}
                    emptyLabel={text.noItems}
                  />
                ) : (
                  <StrategySectionState
                    language={language}
                    title={emptyStateCopy.noProvinceTitle}
                    body={emptyStateCopy.noProvinceBody}
                    actionLabel={emptyStateCopy.completeProfile}
                    onAction={() => navigate("/profile")}
                    tone="info"
                  />
                )
              ) : (
                <BlurredSection
                  title={text.blurProvinceTitle}
                  body={text.blurProvinceBody}
                  buttonLabel={text.unlockNow}
                  onUpgrade={() => navigate(proPath)}
                >
                  <ProvinceCard
                    title={text.provinceRecommendations}
                    items={
                      provinceRecommendations.length
                        ? provinceRecommendations
                        : [
                            language === "fr"
                              ? {
                                  province: "Ontario",
                                  program: "Volet Tech de l’OINP",
                                  chance: "Élevée",
                                  reason:
                                    "Cette province pourrait bien correspondre à votre profil.",
                                }
                              : {
                                  province: "Ontario",
                                  program: "OINP Tech Draw",
                                  chance: "High",
                                  reason:
                                    "This province may align well with your profile.",
                                },
                          ]
                    }
                    emptyLabel={text.noItems}
                  />
                </BlurredSection>
              ))}

            {activeTab === "pathways" && activeSection === "intelligence" &&
              (hasFullStrategy && hasPremiumIntelligence ? (
                <ImmigrationIntelligencePanel
                  intelligence={immigrationIntelligence}
                  text={text}
                  language={language}
                />
              ) : (
                <BlurredSection
                  title={text.blurIntelligenceTitle}
                  body={text.blurIntelligenceBody}
                  buttonLabel={text.premiumExportPrimary}
                  onUpgrade={() => navigate(premiumIntelligencePath)}
                >
                  <ImmigrationIntelligencePanel
                    intelligence={immigrationIntelligence}
                    text={text}
                    language={language}
                  />
                </BlurredSection>
              ))}

            {activeTab === "risks" && activeSection === "risks" &&
              (hasFullStrategy ? (
                Array.isArray(strategy?.risk_analysis) && strategy.risk_analysis.length > 0 ? (
                <RiskCard
                  title={text.riskAnalysis}
                  items={strategy?.risk_analysis}
                  emptyLabel={text.noItems}
                  language={language}
                  onAnalyzeRisk={(item) =>
                    openDrawerWithIntent(
                      "risk",
                      item?.risk || "Explain this risk"
                    )
                  }
                />
              ) : (
                <StrategySectionState
                  language={language}
                  title={emptyStateCopy.noRiskTitle}
                  body={emptyStateCopy.noRiskBody}
                  actionLabel={emptyStateCopy.completeProfile}
                  onAction={() => navigate("/profile")}
                  tone="info"
                />
              )
            ) : (
                <BlurredSection
                  title={text.blurRiskTitle}
                  body={text.blurRiskBody}
                  buttonLabel={text.unlockNow}
                  onUpgrade={() => navigate(proPath)}
                >
                  <RiskCard
                    title={text.riskAnalysis}
                    items={
                      Array.isArray(strategy?.risk_analysis) &&
                      strategy.risk_analysis.length
                        ? strategy.risk_analysis
                        : [
                            language === "fr"
                              ? {
                                  risk: "Plafond du score linguistique",
                                  impact:
                                    "Un score linguistique insuffisant peut limiter votre compétitivité.",
                                  mitigation:
                                    "Viser un score CLB/NCLC 9+ au prochain test.",
                                }
                              : {
                                  risk: "Language score ceiling",
                                  impact:
                                    "A lower language result can limit overall competitiveness.",
                                  mitigation: "Target CLB 9+ on a retake.",
                                },
                          ]
                    }
                    emptyLabel={text.noItems}
                    language={language}
                    onAnalyzeRisk={(item) =>
                      openDrawerWithIntent(
                        "risk",
                        item?.risk || "Explain this risk"
                      )
                    }
                  />
                </BlurredSection>
              ))}

            {!hasDecisionEngine && activeTab === "execution" && (
              <UpgradePrompt
                title={text.decisionPromptTitle}
                body={text.decisionPromptBody}
                buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
              />
            )}

            {!canExportPdf && activeTab !== "overview" && (
              <UpgradePrompt
                title={text.premiumPromptTitle}
                body={text.premiumPromptBody}
                buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
              />
            )}
          </div>
        </div>
      )}
      <StrategyAIDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        language={language}
        onAsk={handleAnalyzeStrategyDrawer}
        loading={drawerLoading}
        error={drawerError}
        messages={drawerMessages}
        input={drawerInput}
        setInput={setDrawerInput}
        navigate={navigate}
        promptSuggestions={[
          {
            label:
              language === "fr"
                ? "Quelle est ma meilleure voie d’immigration ?"
                : "What is my strongest immigration pathway?",
            intent: "pathway",
          },
          {
            label:
              language === "fr"
                ? "Quel est mon plus grand risque actuellement ?"
                : "What is my biggest risk right now?",
            intent: "risk",
          },
          {
            label:
              language === "fr"
                ? "Quelle amélioration aurait le plus grand impact ?"
                : "Which improvement would have the biggest impact?",
            intent: "optimization",
          },
          {
            label:
              language === "fr"
                ? "Quels documents devrais-je préparer ensuite ?"
                : "Which documents should I prepare next?",
            intent: "documents",
          },
        ]}
        aiMode={aiMode}
        setAiMode={setAiMode}
      />
    </Layout>
  );
}
