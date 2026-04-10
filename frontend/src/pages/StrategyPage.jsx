import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import AICopilotCard from "../components/AICopilotCard";
import UpgradePrompt from "../components/UpgradePrompt";
import {
  exportMyStrategyPdf,
  getBillingAccess,
  getMyStrategy,
  getMyStrategyLite,
} from "../api";

/* ===============================
   DOCUMENT COMPLETION ENGINE (READ ONLY)
================================ */
const COMPLETION_STORAGE_KEY = "nbai_document_completion_engine_v1";

function readCompletionEngine() {
  try {
    return JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

/* ===============================
   SMART PRIORITY ENGINE
================================ */
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
      route: "/self/documents",
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
      route: "/self/documents",
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
      route: "/self/documents",
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
      route: "/self/documents",
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
      route: "/self/documents",
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
      route: "/self/documents",
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
      route: "/self/documents",
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
      route: "/self/documents",
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
    <div className="mb-8 max-w-3xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
        {brand}
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{subtitle}</p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-blue-900">
        {value}
      </p>
    </div>
  );
}

function ListCard({ title, items, emptyLabel }) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <Card padding="lg">
      {title ? (
        <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h3>
      ) : null}

      {safeItems.length > 0 ? (
        <ul className={title ? "mt-4 space-y-3" : "space-y-3"}>
          {safeItems.map((item, i) => (
            <li
              key={i}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm leading-7 text-slate-700"
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

function PlanChip({ active = false, children }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {children}
    </span>
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
      <div className="pointer-events-none select-none blur-[3px]">
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
        <div className="max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center shadow-sm">
          <p className="text-base font-semibold text-amber-900">{title}</p>
          <p className="mt-2 text-sm text-amber-800">{body}</p>

          <button
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
      <Card padding="lg">
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
    <Card variant="premium" padding="lg">
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

function ProvinceCard({ title, items, emptyLabel }) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <Card padding="lg">
      <h3 className="text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h3>

      {safeItems.length > 0 ? (
        <div className="mt-4 space-y-3">
          {safeItems.map((item, index) => (
            <div
              key={`${item?.province || "province"}-${item?.program || index}`}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
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

                <div className="inline-flex w-fit rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
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

export default function StrategyPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [data, setData] = useState(null);
  const [access, setAccess] = useState(null);
  const [message, setMessage] = useState("");
  const [engineVersion, setEngineVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

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

    window.addEventListener("nbai-document-engine-updated", handleEngineUpdate);
    return () => {
      window.removeEventListener(
        "nbai-document-engine-updated",
        handleEngineUpdate
      );
    };
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      setMessage("");

      const [liteRes, accessRes] = await Promise.allSettled([
        getMyStrategyLite(language),
        getBillingAccess(),
      ]);

      let strategyData = null;

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

      setData(strategyData);

      if (accessRes.status === "fulfilled") {
        setAccess(accessRes.value?.data || null);
      } else {
        const status = accessRes.reason?.response?.status;

        if (status !== 404) {
          console.error(accessRes.reason);
        }

        setAccess(null);
      }
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
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Impossible d’exporter le PDF."
            : "Unable to export PDF.")
      );
    } finally {
      setExportingPdf(false);
    }
  }

  const strategy = data || null;
  const noc = strategy?.noc_summary || {};
  const nocAdvantage = strategy?.noc_advantage || {};
  const provinceRecommendations = Array.isArray(
    strategy?.province_recommendations
  )
    ? strategy.province_recommendations
    : [];

  const documentStats = useMemo(() => {
    const engine = readCompletionEngine();
    const values = Object.values(engine || {});

    return {
      total: values.length,
      reviewed: values.filter((v) => v?.reviewed).length,
      completed: values.filter((v) => v?.completed).length,
    };
  }, [engineVersion]);

  const priority = useMemo(() => {
    return buildPriorityRecommendation(strategy || {}, documentStats, language);
  }, [strategy, documentStats, language]);

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

  const text = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Votre stratégie",
        subtitle:
          "Votre stratégie personnalisée basée sur votre profil, votre admissibilité et votre progression documentaire.",
        crs: "Score CRS",
        programs: "Programmes recommandés",
        strengths: "Forces",
        weaknesses: "Faiblesses",
        nextSteps: "Prochaines étapes",
        noc: "Signal CNP",
        nocInsights: "Analyse CNP",
        provinceRecommendations: "Provinces recommandées",
        documentsProgress: "Progression des documents",
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
          "Commencez par compléter votre profil ou continuez vers l’espace de documents pour construire votre dossier.",
        openProfile: "Compléter mon profil",
        launchEyebrow: "Forfaits",
        launchTitle: "Votre stratégie devient plus puissante à mesure que vous avancez",
        launchBody:
          "Le mode Gratuit vous aide à comprendre votre position. Pro débloque la stratégie complète et le moteur de décision. Premium devient la couche de finition pour un flux plus complet avec export PDF.",
        freeTitle: "Gratuit",
        proTitle: "Pro — 39 $ / 30 jours",
        premiumTitle: "Premium — 99 $ / 90 jours",
        freeLabel: "Explorer",
        proLabel: "Agir",
        premiumLabel: "Finaliser",
        fullStrategyPromptTitle: "Débloquez la stratégie complète",
        fullStrategyPromptBody:
          "Passez à Pro pour débloquer la stratégie complète, des recommandations plus profondes et une meilleure orientation d’exécution.",
        decisionPromptTitle: "Débloquez le moteur de décision",
        decisionPromptBody:
          "Passez à Pro pour débloquer les recommandations prioritaires, les prochaines actions avancées et une guidance plus exploitable.",
        premiumPromptTitle: "Débloquez l’export PDF",
        premiumPromptBody:
          "Passez à Premium pour ajouter l’export PDF et une couche de finalisation plus forte à votre préparation.",
        currentPlan: "Plan actuel",
        currentPlanValue: "Votre accès",
        strategyVisibility: "Visibilité de la stratégie",
        basicView: "Vue de base",
        fullView: "Vue complète",
        exportValue: "Export PDF",
        locked: "Verrouillé",
        unlocked: "Débloqué",
        loadingMessage: "Chargement...",
        exportHint:
          "Premium est le niveau de finition pour les utilisateurs qui veulent sortir du mode exploration et produire un dossier plus partageable.",
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
        unlockNow: "Débloquer maintenant",
        scoreImproveTitle: "Découvrez jusqu’où votre score pourrait monter",
        scoreImproveBody:
          "Débloquez le simulateur avancé pour tester différents scénarios d’amélioration avant d’agir.",
        simulatorTitle: "Simulateur de score",
        simulatorButton: "Ouvrir le simulateur",
        simulatorLockedButton: "Débloquer le simulateur",
        teer: "TEER",
        strategicValue: "Valeur stratégique",
        highDemandOccupation: "Profession en demande",
        yes: "Oui",
        no: "Non",
        whyThisMatters: "Pourquoi c’est important",
        recommendedNocActions: "Actions liées au CNP",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "Your Strategy",
      subtitle:
        "Your personalized strategy based on your profile, eligibility, and document progress.",
      crs: "CRS Score",
      programs: "Recommended Programs",
      strengths: "Strengths",
      weaknesses: "Weaknesses",
      nextSteps: "Next Steps",
      noc: "NOC Signal",
      nocInsights: "NOC Insight",
      provinceRecommendations: "Recommended Provinces",
      documentsProgress: "Document Progress",
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
        "Start by completing your profile or continue to the documents workspace to begin building your case.",
      openProfile: "Complete my profile",
      launchEyebrow: "Packages",
      launchTitle: "Your strategy gets stronger as you move forward",
      launchBody:
        "Free helps you understand where you stand. Pro unlocks the full strategy and decision engine. Premium becomes the finishing layer for a fuller preparation flow with PDF export.",
      freeTitle: "Free",
      proTitle: "Pro — $39 / 30 days",
      premiumTitle: "Premium — $99 / 90 days",
      freeLabel: "Explore",
      proLabel: "Act",
      premiumLabel: "Finish",
      fullStrategyPromptTitle: "Unlock full strategy",
      fullStrategyPromptBody:
        "Upgrade to Pro to unlock the full strategy, deeper recommendations, and stronger execution guidance.",
      decisionPromptTitle: "Unlock the decision engine",
      decisionPromptBody:
        "Upgrade to Pro to unlock smarter priorities, advanced next steps, and more actionable guidance.",
      premiumPromptTitle: "Unlock PDF export",
      premiumPromptBody:
        "Upgrade to Premium to add PDF export and a stronger finishing layer to your preparation workflow.",
      currentPlan: "Current plan",
      currentPlanValue: "Your access",
      strategyVisibility: "Strategy visibility",
      basicView: "Basic view",
      fullView: "Full view",
      exportValue: "PDF export",
      locked: "Locked",
      unlocked: "Unlocked",
      loadingMessage: "Loading...",
      exportHint:
        "Premium is the finishing tier for users who want to move beyond exploration and produce a more shareable case package.",
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
      unlockNow: "Unlock Now",
      scoreImproveTitle: "See how far your score could move",
      scoreImproveBody:
        "Unlock the advanced simulator to test improvement scenarios before you act.",
      simulatorTitle: "Score simulator",
      simulatorButton: "Open simulator",
      simulatorLockedButton: "Unlock simulator",
      teer: "TEER",
      strategicValue: "Strategic value",
      highDemandOccupation: "High-demand occupation",
      yes: "Yes",
      no: "No",
      whyThisMatters: "Why this matters",
      recommendedNocActions: "NOC-related actions",
    };
  }, [language]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <div className="rounded-[28px] border border-slate-200 bg-white px-10 py-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            <p className="text-lg font-medium text-slate-700">
              {text.loadingMessage}
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

        <Card variant="soft" padding="lg" className="max-w-2xl">
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
            <Button
              variant="secondary"
              onClick={() => navigate("/self/documents")}
            >
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
        <div className="mb-6 rounded-[24px] border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          {message}
        </div>
      )}

      <PageHeaderBlock
        brand={text.brand}
        title={text.title}
        subtitle={text.subtitle}
      />

      <Card variant="soft" padding="lg" className="mb-6">
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
              {text.launchEyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {text.launchTitle}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {text.launchBody}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <PlanChip active={!access?.is_pro && !access?.is_premium}>
                {text.freeTitle}
              </PlanChip>
              <PlanChip active={access?.is_pro && !access?.is_premium}>
                Pro
              </PlanChip>
              <PlanChip active={access?.is_premium}>
                Premium
              </PlanChip>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {text.freeLabel}
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                {text.freeTitle}
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {language === "fr"
                  ? "Comprenez votre position et explorez vos premières priorités."
                  : "Understand where you stand and explore your first priorities."}
              </p>
            </div>

            <div className="rounded-[24px] border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                {text.proLabel}
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                {text.proTitle}
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {language === "fr"
                  ? "Débloquez la stratégie complète et exécutez plus vite."
                  : "Unlock the full strategy and move into execution faster."}
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {text.premiumLabel}
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                {text.premiumTitle}
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {language === "fr"
                  ? "Ajoutez la finition, l’export et une préparation plus complète."
                  : "Add finishing value, export, and a more complete preparation layer."}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <ScoreSimulatorTeaser
        language={language}
        currentScore={strategy?.crs_score}
        hasFullStrategy={hasFullStrategy}
        onUpgrade={() =>
          navigate(hasSimulatorAccess ? "/strategy/simulator" : "/pricing")
        }
      />

      <div className="mt-6" />

      {!hasFullStrategy && (
        <UpgradePrompt
          className="mb-6"
          title={text.fullStrategyPromptTitle}
          body={text.fullStrategyPromptBody}
          buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
        />
      )}

      <AICopilotCard
        title={language === "fr" ? "Copilote IA stratégie" : "AI Strategy Copilot"}
        description={
          language === "fr"
            ? "Comprenez votre stratégie plus en profondeur et optimisez vos prochaines actions."
            : "Understand your strategy more deeply and optimize your next actions."
        }
        buttonLabel={
          language === "fr" ? "Analyser ma stratégie" : "Analyze my strategy"
        }
        language={language}
        prompt={
          language === "fr"
            ? "Analyse ma stratégie d'immigration et propose les meilleures améliorations possibles."
            : "Analyze my immigration strategy and suggest the best improvements possible."
        }
        premiumLocked={!hasAdvancedCopilot}
        premiumTitle={
          language === "fr"
            ? "Débloquez le copilote avancé"
            : "Unlock advanced AI copilot"
        }
        premiumBody={
          language === "fr"
            ? "Passez à Pro ou Premium pour une guidance plus profonde."
            : "Upgrade to Pro or Premium for deeper guidance."
        }
        className="mb-6"
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card variant="premium" padding="lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {text.crs}
            </p>
            <p className="mt-3 text-5xl font-semibold tracking-tight text-blue-900">
              {strategy?.crs_score ?? "--"}
            </p>

            {!hasFullStrategy && (
              <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                {text.scoreImproveTitle}
                <button
                  onClick={() => navigate("/pricing")}
                  className="ml-2 font-semibold underline"
                >
                  {text.unlockNow}
                </button>
              </div>
            )}

            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={() =>
                  navigate(hasSimulatorAccess ? "/strategy/simulator" : "/pricing")
                }
              >
                {hasSimulatorAccess
                  ? text.simulatorButton
                  : text.simulatorLockedButton}
              </Button>
            </div>
          </Card>

          <Card padding="lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {text.currentPlan}
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  {text.currentPlanValue}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {currentPlanLabel}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  {text.strategyVisibility}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {hasFullStrategy ? text.fullView : text.basicView}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  {text.exportValue}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {canExportPdf ? text.unlocked : text.locked}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {canExportPdf ? (
                <Button onClick={handleExportPdf} disabled={exportingPdf}>
                  {exportingPdf ? text.exportingPdf : text.exportPdf}
                </Button>
              ) : null}

              <Button variant="secondary" onClick={() => navigate("/self/documents")}>
                {text.openDocuments}
              </Button>
            </div>

            {!canExportPdf && (
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/70 px-4 py-4 text-sm leading-7 text-slate-700">
                {text.exportHint}
              </div>
            )}
          </Card>

          <Card padding="lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {text.documentsProgress}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-4">
              <Stat label={text.completed} value={documentStats.completed} />
              <Stat label={text.reviewed} value={documentStats.reviewed} />
              <Stat label={text.total} value={documentStats.total} />
            </div>
          </Card>

          {!hasDecisionEngine && (
            <UpgradePrompt
              title={text.decisionPromptTitle}
              body={text.decisionPromptBody}
              buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
            />
          )}

          {!canExportPdf && (
            <UpgradePrompt
              title={text.premiumPromptTitle}
              body={text.premiumPromptBody}
              buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
            />
          )}

          <Card variant="premium" padding="lg" className="space-y-5">
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
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-7 text-slate-700"
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

          {(noc?.noc_code ||
            noc?.occupation ||
            nocAdvantage?.has_noc ||
            typeof nocAdvantage?.teer === "number") && (
            <Card padding="lg" className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {text.noc}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  {noc?.noc_code
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

              {(typeof nocAdvantage?.teer === "number" && nocAdvantage.teer >= 0) ||
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
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm leading-7 text-slate-700"
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
                        className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-7 text-blue-900"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          )}

          {hasFullStrategy ? (
            <ProvinceCard
              title={text.provinceRecommendations}
              items={provinceRecommendations}
              emptyLabel={text.noItems}
            />
          ) : (
            <BlurredSection
              title={text.blurProvinceTitle}
              body={text.blurProvinceBody}
              buttonLabel={text.unlockNow}
              onUpgrade={() => navigate("/pricing")}
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
          )}
        </div>

        <div className="space-y-6">
          {hasFullStrategy ? (
            <ListCard
              title={text.programs}
              items={strategy?.recommended_programs}
              emptyLabel={text.noItems}
            />
          ) : (
            <BlurredSection
              title={text.blurProgramsTitle}
              body={text.blurProgramsBody}
              buttonLabel={text.unlockNow}
              onUpgrade={() => navigate("/pricing")}
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
          )}

          <ListCard
            title={text.strengths}
            items={strategy?.strengths}
            emptyLabel={text.noItems}
          />

          {hasFullStrategy ? (
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
              onUpgrade={() => navigate("/pricing")}
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
          )}

          {hasFullStrategy ? (
            <ListCard
              title={text.nextSteps}
              items={strategy?.next_steps}
              emptyLabel={text.noItems}
            />
          ) : (
            <div>
              <ListCard
                title={text.nextSteps}
                items={Array.isArray(strategy?.next_steps) ? strategy.next_steps.slice(0, 1) : []}
                emptyLabel={text.noItems}
              />

              <div className="mt-4">
                <BlurredSection
                  title={text.blurStepsTitle}
                  body={text.blurStepsBody}
                  buttonLabel={text.unlockNow}
                  onUpgrade={() => navigate("/pricing")}
                >
                  <ListCard
                    title=""
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
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}