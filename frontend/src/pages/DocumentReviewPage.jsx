import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import AICopilotCard from "../components/AICopilotCard";
import UpgradePrompt from "../components/UpgradePrompt";
import { getBillingAccess, reviewAIDocument } from "../api";

const DOCUMENT_TYPES = [
  {
    value: "letter_of_explanation",
    en: "Letter of Explanation",
    fr: "Lettre d’explication",
  },
  { value: "study_plan", en: "Study Plan", fr: "Projet d’études" },
  {
    value: "client_submission_notes",
    en: "Client Submission Notes",
    fr: "Notes de soumission du client",
  },
  {
    value: "travel_history_explanation",
    en: "Travel History Explanation",
    fr: "Explication de l’historique de voyage",
  },
  {
    value: "proof_of_funds_explanation",
    en: "Proof of Funds Explanation",
    fr: "Explication de la preuve de fonds",
  },
  {
    value: "relationship_explanation",
    en: "Relationship Explanation",
    fr: "Explication de la relation",
  },
  {
    value: "other",
    en: "Other",
    fr: "Autre",
  },
];

const COMPLETION_STORAGE_KEY = "nbai_document_completion_engine_v1";
const REVIEW_USAGE_KEY = "nbai_doc_review_usage_v1";
const FREE_REVIEW_LIMIT = 2;

function PageHeader({ brand, title, subtitle }) {
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

function SectionIntro({ eyebrow, title, body }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      {body ? <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p> : null}
    </div>
  );
}

function readCompletionEngine() {
  try {
    return JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCompletionEngine(value) {
  localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event("nbai-document-engine-updated"));
}

function buildCompletionKey({ matterType, checklistId, documentType }) {
  return `${matterType || "general"}::${checklistId || "unknown"}::${documentType || "document"}`;
}

function updateCompletionRecord({
  matterType,
  checklistId,
  documentType,
  patch,
}) {
  const all = readCompletionEngine();
  const key = buildCompletionKey({ matterType, checklistId, documentType });
  const current = all[key] || {
    matter_type: matterType || "general",
    checklist_id: checklistId || "",
    document_type: documentType || "document",
    reviewed: false,
    completed: false,
    updated_at: null,
  };

  all[key] = {
    ...current,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  writeCompletionEngine(all);
}

function readReviewUsage() {
  try {
    return Number(localStorage.getItem(REVIEW_USAGE_KEY) || 0);
  } catch {
    return 0;
  }
}

function writeReviewUsage(value) {
  localStorage.setItem(REVIEW_USAGE_KEY, String(value));
}

function buildImportedContext({ label, reason, noc, context, language }) {
  const sections = [];

  if (label) {
    sections.push(
      language === "fr" ? `Élément lié: ${label}` : `Related item: ${label}`
    );
  }

  if (reason) {
    sections.push(
      language === "fr"
        ? `Contexte de la checklist: ${reason}`
        : `Checklist context: ${reason}`
    );
  }

  if (noc) {
    sections.push(language === "fr" ? `CNP liée: ${noc}` : `Mapped NOC: ${noc}`);
  }

  if (context) {
    sections.push(context);
  }

  return sections.filter(Boolean).join("\n\n");
}

function buildFinalAdditionalContext({
  additionalContext,
  sourceContext,
  language,
}) {
  const sections = [];
  const cleanedBase = String(additionalContext || "").trim();

  if (sourceContext?.label) {
    sections.push(
      language === "fr"
        ? `Élément lié: ${sourceContext.label}`
        : `Related item: ${sourceContext.label}`
    );
  }

  if (sourceContext?.reason) {
    sections.push(
      language === "fr"
        ? `Contexte de la checklist: ${sourceContext.reason}`
        : `Checklist context: ${sourceContext.reason}`
    );
  }

  if (sourceContext?.noc) {
    sections.push(
      language === "fr"
        ? `Tenez compte de la CNP ${sourceContext.noc} lorsque cela est pertinent à la cohérence du document.`
        : `Take NOC ${sourceContext.noc} into account where relevant to document consistency.`
    );
  }

  if (sourceContext?.context) {
    sections.push(sourceContext.context);
  }

  if (cleanedBase) {
    sections.push(cleanedBase);
  }

  return sections.filter(Boolean).join("\n\n");
}

function scoreReviewedDocument({ content, language }) {
  const text = String(content || "").trim();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const paragraphCount = text
    ? text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).length
    : 0;

  let score = 0;
  const improvements = [];

  if (wordCount >= 300) score += 25;
  else if (wordCount >= 180) score += 15;
  else
    improvements.push(
      language === "fr"
        ? "Le document semble encore trop court pour une défense solide."
        : "The document still appears too short for a strong case."
    );

  if (paragraphCount >= 3) score += 20;
  else
    improvements.push(
      language === "fr"
        ? "Ajoutez une structure plus claire avec plusieurs paragraphes."
        : "Add clearer structure with multiple paragraphs."
    );

  if (/\b(20\d{2}|19\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/.test(text)) score += 10;
  else
    improvements.push(
      language === "fr"
        ? "Ajoutez des repères temporels ou dates lorsque pertinent."
        : "Add dates or time references where relevant."
    );

  if (
    /(because|therefore|however|specifically|in addition|as a result|car|donc|cependant|ainsi|de plus|par conséquent)/i.test(
      text
    )
  )
    score += 10;
  else
    improvements.push(
      language === "fr"
        ? "Renforcez la logique entre les idées."
        : "Strengthen the logic between ideas."
    );

  if (/\b(i|my|me|je|j’|j'|mon|ma|mes|moi)\b/i.test(text)) score += 10;
  else
    improvements.push(
      language === "fr"
        ? "Le document gagnerait à refléter davantage votre voix."
        : "The document would benefit from reflecting your voice more clearly."
    );

  const longSentences = text
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.split(/\s+/).length > 40).length;

  if (longSentences === 0) score += 10;
  else
    improvements.push(
      language === "fr"
        ? "Certaines phrases semblent trop longues; simplifiez-les."
        : "Some sentences seem too long; simplify them."
    );

  if (text.length > 0) score += 15;

  score = Math.min(100, Math.max(0, score));

  let rating = "";
  let ratingClassName = "";

  if (score >= 85) {
    rating = language === "fr" ? "Très fort" : "Very strong";
    ratingClassName = "border-emerald-200 bg-emerald-50 text-emerald-700";
  } else if (score >= 70) {
    rating = language === "fr" ? "Solide" : "Strong";
    ratingClassName = "border-blue-200 bg-blue-50 text-blue-700";
  } else if (score >= 55) {
    rating = language === "fr" ? "À améliorer" : "Needs improvement";
    ratingClassName = "border-amber-200 bg-amber-50 text-amber-700";
  } else {
    rating = language === "fr" ? "Faible" : "Weak";
    ratingClassName = "border-red-200 bg-red-50 text-red-700";
  }

  return {
    score,
    rating,
    ratingClassName,
    wordCount,
    paragraphCount,
    improvements: improvements.slice(0, 4),
  };
}

function ReviewListCard({ title, items, emptyText, tone = "default" }) {
  const safeItems = Array.isArray(items) ? items : [];

  const classMap = {
    default: "border-slate-200 bg-slate-50/70 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };

  const itemClass = classMap[tone] || classMap.default;

  return (
    <Card padding="lg">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>

      {safeItems.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {safeItems.map((item, index) => (
            <li
              key={index}
              className={`rounded-2xl border px-4 py-3 text-sm ${itemClass}`}
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
          {emptyText}
        </div>
      )}
    </Card>
  );
}

function ScorePanel({ scoring, language }) {
  const text =
    language === "fr"
      ? {
          eyebrow: "Score de qualité",
          title: "Évaluation du document révisé",
          score: "Score",
          words: "Mots",
          paragraphs: "Paragraphes",
        }
      : {
          eyebrow: "Quality score",
          title: "Reviewed document assessment",
          score: "Score",
          words: "Words",
          paragraphs: "Paragraphs",
        };

  return (
    <Card variant="soft" padding="lg">
      <SectionIntro eyebrow={text.eyebrow} title={text.title} />

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {text.score}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <p className="text-5xl font-semibold tracking-tight text-slate-900">
              {scoring.score}
            </p>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${scoring.ratingClassName}`}
            >
              {scoring.rating}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {text.words}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {scoring.wordCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {text.paragraphs}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {scoring.paragraphCount}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {scoring.improvements.length > 0 ? (
          scoring.improvements.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              {item}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {language === "fr"
              ? "Le document révisé semble déjà très solide."
              : "The reviewed document already appears very strong."}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function DocumentReviewPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [access, setAccess] = useState(null);
  const [documentType, setDocumentType] = useState("letter_of_explanation");
  const [reviewDepth, setReviewDepth] = useState("standard");
  const [content, setContent] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [result, setResult] = useState(null);
  const [reviewUsage, setReviewUsage] = useState(0);

  const [sourceContext, setSourceContext] = useState({
    label: "",
    reason: "",
    noc: "",
    context: "",
    checklistId: "",
    matterType: "general",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAccess();
    setReviewUsage(readReviewUsage());
  }, []);

  useEffect(() => {
    const queryDocumentType = searchParams.get("document_type");
    const label = searchParams.get("label") || "";
    const reason = searchParams.get("reason") || "";
    const noc = searchParams.get("noc") || "";
    const context = searchParams.get("context") || "";
    const contentParam = searchParams.get("content") || "";
    const checklistId = searchParams.get("checklist_id") || "";
    const matterType = searchParams.get("matter_type") || "general";

    const validDocumentType = DOCUMENT_TYPES.some(
      (item) => item.value === queryDocumentType
    )
      ? queryDocumentType
      : null;

    if (validDocumentType) {
      setDocumentType(validDocumentType);
    }

    setSourceContext({
      label,
      reason,
      noc,
      context,
      checklistId,
      matterType,
    });

    const importedContext = buildImportedContext({
      label,
      reason,
      noc,
      context,
      language,
    });

    if (importedContext) {
      setAdditionalContext((prev) => {
        const current = String(prev || "").trim();
        if (!current) return importedContext;
        if (current.includes(importedContext)) return current;
        return `${importedContext}\n\n${current}`;
      });
    }

    if (contentParam) {
      try {
        setContent(decodeURIComponent(contentParam));
      } catch {
        setContent(contentParam);
      }
    }

    if (validDocumentType) {
      setMessage(
        language === "fr"
          ? "Type de document prérempli pour la révision."
          : "Document type prefilled for review."
      );
    }
  }, [searchParams, language]);

  async function loadAccess() {
    try {
      const res = await getBillingAccess();
      setAccess(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  const selectedDocumentMeta =
    DOCUMENT_TYPES.find((item) => item.value === documentType) ||
    DOCUMENT_TYPES[0];

  const documentTypeLabel =
    language === "fr" ? selectedDocumentMeta.fr : selectedDocumentMeta.en;

  const canPreviewReview = Boolean(access?.can_preview_document_review);
  const canReviewDocumentsFull = Boolean(access?.can_review_documents_full);
  const hasAdvancedCopilot = Boolean(access?.can_use_advanced_ai);

  const remainingFreeReviews = Math.max(FREE_REVIEW_LIMIT - reviewUsage, 0);
  const reviewLimitReached =
    !canReviewDocumentsFull && remainingFreeReviews <= 0;
  const reviewNearLimit =
    !canReviewDocumentsFull &&
    remainingFreeReviews > 0 &&
    remainingFreeReviews <= 1;
  const canReviewNow = canPreviewReview && !reviewLimitReached;

  const pageText = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Révision de document IA",
        subtitle:
          "Collez un document et obtenez une révision structurée avec points forts, risques, éléments manquants et actions d’amélioration.",
        input: "Entrée",
        documentType: "Type de document",
        reviewDepth: "Niveau de révision",
        standard: "Standard",
        detailed: "Détaillé",
        documentToReview: "Document à réviser",
        documentPlaceholder: "Collez ici votre document...",
        additionalContext: "Contexte additionnel",
        additionalContextPlaceholder:
          "Ajoutez un contexte utile pour améliorer la révision.",
        review: "Réviser le document",
        reviewing: "Révision...",
        unlockTitle: "Débloquez la révision complète",
        unlockProTitle: "Passez à Pro pour continuer",
        unlockProBody:
          "Débloquez l’analyse complète, les actions d’amélioration détaillées et la boucle complète de révision.",
        upgradeToPro: "Passer à Pro",
        strengths: "Points forts",
        concerns: "Risques / faiblesses",
        missingSupport: "Éléments potentiellement manquants",
        improvementActions: "Actions d’amélioration",
        reviewedPreview: "Aperçu révisé",
        helperBody:
          "Utilisez le copilote pour comprendre ce qu’un bon document devrait démontrer avant de lancer la révision.",
        bestPracticesEyebrow: "Bonnes pratiques",
        bestPracticesTitle: "Avant de lancer la révision",
        bestPractices: [
          "Collez un document suffisamment complet pour obtenir un retour utile.",
          "Ajoutez un contexte clair si votre situation comporte des éléments sensibles ou inhabituels.",
          "Utilisez ensuite le générateur de documents pour renforcer votre version finale.",
        ],
        openGenerator: "Retour au générateur",
        usageTitle: "Utilisation gratuite",
        usageText: `${reviewUsage}/${FREE_REVIEW_LIMIT} révisions utilisées`,
        nearLimitTitle: "Il vous reste 1 révision gratuite",
        nearLimitBody:
          "Passez à Pro maintenant pour continuer vos révisions sans interruption.",
        limitTitle: "Limite gratuite atteinte",
        limitBody:
          "Passez à Pro pour débloquer la révision IA complète de vos documents.",
        outputEyebrow: "Analyse",
        outputTitle: "Résultat de révision",
        outputBody:
          "Examinez les points forts, risques et améliorations, puis revenez au générateur pour renforcer votre version finale.",
        noItems: "Aucun élément disponible.",
        passedContext: "Contexte transmis",
        relatedItem: "Élément lié",
        mappedNoc: "CNP liée",
        checklistReason: "Raison de la checklist",
        importedContextBody:
          "Cette page de révision a été préremplie à partir de votre checklist documentaire.",
        autoFocusTitle: "Document ciblé",
        autoFocusBody:
          "Le type de document à réviser a été sélectionné automatiquement à partir de votre stratégie ou de votre guidance.",
        applyImprovements: "Appliquer les améliorations au générateur",
        markReviewed: "Marquer comme révisé",
        premiumBar:
          "Pro débloque l’analyse complète et la boucle d’amélioration. Premium s’intègre au flux avancé global.",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "AI Document Review",
      subtitle:
        "Paste a document and get a structured review with strengths, risks, missing support, and improvement actions.",
      input: "Input",
      documentType: "Document type",
      reviewDepth: "Review depth",
      standard: "Standard",
      detailed: "Detailed",
      documentToReview: "Document to review",
      documentPlaceholder: "Paste your document here...",
      additionalContext: "Additional context",
      additionalContextPlaceholder:
        "Add any useful context to improve the review.",
      review: "Review document",
      reviewing: "Reviewing...",
      unlockTitle: "Unlock the full review",
      unlockProTitle: "Upgrade to Pro to continue",
      unlockProBody:
        "Unlock full analysis, detailed improvement actions, and the complete review loop.",
      upgradeToPro: "Upgrade to Pro",
      strengths: "Strengths",
      concerns: "Concerns / risks",
      missingSupport: "Potentially missing support",
      improvementActions: "Improvement actions",
      reviewedPreview: "Reviewed preview",
      helperBody:
        "Use the copilot to understand what a strong document should demonstrate before you run the review.",
      bestPracticesEyebrow: "Best practices",
      bestPracticesTitle: "Before you run the review",
      bestPractices: [
        "Paste a complete enough document to receive meaningful feedback.",
        "Add clear context if your situation includes sensitive or unusual facts.",
        "Then use the document generator to strengthen the final version.",
      ],
      openGenerator: "Back to generator",
      usageTitle: "Free usage",
      usageText: `${reviewUsage}/${FREE_REVIEW_LIMIT} reviews used`,
      nearLimitTitle: "You have 1 free review left",
      nearLimitBody:
        "Upgrade to Pro now to keep reviewing without interruption.",
      limitTitle: "Free limit reached",
      limitBody: "Upgrade to Pro to unlock full AI document review.",
      outputEyebrow: "Analysis",
      outputTitle: "Review result",
      outputBody:
        "Examine the strengths, risks, and improvements, then return to the generator to strengthen the final version.",
      noItems: "No items available.",
      passedContext: "Passed context",
      relatedItem: "Related item",
      mappedNoc: "Mapped NOC",
      checklistReason: "Checklist reason",
      importedContextBody:
        "This review page was prefilled from your document checklist.",
      autoFocusTitle: "Targeted document",
      autoFocusBody:
        "The document type to review was selected automatically from your strategy or guidance.",
      applyImprovements: "Apply improvements in generator",
      markReviewed: "Mark as reviewed",
      premiumBar:
        "Pro unlocks full analysis and the improvement loop. Premium fits into the broader advanced workflow.",
    };
  }, [language, reviewUsage]);

  const contextPresets = useMemo(() => {
    if (language === "fr") {
      return [
        "Le document doit être crédible, cohérent et rassurant.",
        "Le dossier comporte des éléments qui doivent être clarifiés avec soin.",
        "Je veux améliorer la structure, la clarté et la force persuasive.",
        "Je veux m’assurer que les faits soutiennent bien mon objectif principal.",
      ];
    }

    return [
      "The document should feel credible, consistent, and reassuring.",
      "The file includes facts that need careful clarification.",
      "I want to improve structure, clarity, and persuasive strength.",
      "I want to make sure the facts strongly support my main objective.",
    ];
  }, [language]);

  async function handleReview() {
    if (!canReviewNow) {
      setMessage(
        language === "fr"
          ? "Vous avez atteint votre limite gratuite. Passez à Pro pour continuer."
          : "You have reached your free limit. Upgrade to Pro to continue."
      );
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setResult(null);

      const contextualAdditionalContext = buildFinalAdditionalContext({
        additionalContext,
        sourceContext,
        language,
      });

      const res = await reviewAIDocument({
        document_type: documentType,
        content,
        language,
        review_depth: reviewDepth,
        additional_context: contextualAdditionalContext,
      });

      setResult(res.data);

      if (!canReviewDocumentsFull) {
        const nextUsage = reviewUsage + 1;
        writeReviewUsage(nextUsage);
        setReviewUsage(nextUsage);
      }

      if (sourceContext?.checklistId) {
        updateCompletionRecord({
          matterType: sourceContext.matterType,
          checklistId: sourceContext.checklistId,
          documentType,
          patch: {
            reviewed: true,
            completed: false,
          },
        });
      }
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Échec de la révision du document."
            : "Failed to review document.")
      );
    } finally {
      setLoading(false);
    }
  }

  function handleMarkReviewed() {
    if (!sourceContext?.checklistId) {
      setMessage(
        language === "fr"
          ? "Aucun élément de checklist lié à marquer."
          : "No linked checklist item to mark."
      );
      return;
    }

    updateCompletionRecord({
      matterType: sourceContext.matterType,
      checklistId: sourceContext.checklistId,
      documentType,
      patch: {
        reviewed: true,
        completed: false,
      },
    });

    setMessage(
      language === "fr"
        ? "Document marqué comme révisé."
        : "Document marked as reviewed."
    );
  }

  function handleApplyImprovements() {
    if (!result?.improvement_actions?.length) {
      navigate("/documents/generator");
      return;
    }

    const params = new URLSearchParams();
    params.set("document_type", documentType);

    if (sourceContext?.label) params.set("label", sourceContext.label);
    if (sourceContext?.reason) params.set("reason", sourceContext.reason);
    if (sourceContext?.noc) params.set("noc", sourceContext.noc);
    if (sourceContext?.context) params.set("context", sourceContext.context);
    if (sourceContext?.checklistId) {
      params.set("checklist_id", sourceContext.checklistId);
    }
    if (sourceContext?.matterType) {
      params.set("matter_type", sourceContext.matterType);
    }

    const mergedContext = [
      buildFinalAdditionalContext({
        additionalContext,
        sourceContext,
        language,
      }),
      ...(result?.improvement_actions || []),
    ]
      .filter(Boolean)
      .join("\n\n");

    if (mergedContext) {
      params.set("context", mergedContext);
    }

    navigate(`/documents/generator?${params.toString()}`);
  }

  function applyContextPreset(text) {
    setAdditionalContext((prev) => {
      const current = String(prev || "").trim();
      if (!current) return text;
      if (current.includes(text)) return current;
      return `${current}\n\n${text}`;
    });
  }

  const locked = Boolean(result?.locked);
  const upgradeReason =
    result?.upgrade_reason ||
    (language === "fr"
      ? "Passez à Pro pour débloquer la révision complète."
      : "Upgrade to Pro to unlock the full review.");

  const scoring = useMemo(() => {
    if (!result?.reviewed_document_preview || locked) return null;
    return scoreReviewedDocument({
      content: result.reviewed_document_preview,
      language,
    });
  }, [result, language, locked]);

  return (
    <Layout>
      {message && (
        <div className="mb-6 rounded-[24px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {message}
        </div>
      )}

      <PageHeader
        brand={pageText.brand}
        title={pageText.title}
        subtitle={pageText.subtitle}
      />

      {!canReviewDocumentsFull && (
        <>
          <Card variant="soft" padding="lg" className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {pageText.usageTitle}
            </p>
            <p className="mt-2 text-sm text-slate-700">{pageText.usageText}</p>
            <p className="mt-3 text-sm text-slate-600">{pageText.premiumBar}</p>
          </Card>

          {reviewNearLimit && (
            <div className="mb-6">
              <UpgradePrompt
                title={pageText.nearLimitTitle}
                body={pageText.nearLimitBody}
                buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
              />
            </div>
          )}

          {reviewLimitReached && (
            <div className="mb-6">
              <UpgradePrompt
                title={pageText.limitTitle}
                body={pageText.limitBody}
                buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
              />
            </div>
          )}
        </>
      )}

      {searchParams.get("document_type") && (
        <Card variant="premium" padding="lg" className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
            {pageText.autoFocusTitle}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            {documentTypeLabel}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {pageText.autoFocusBody}
          </p>
        </Card>
      )}

      {(sourceContext?.label ||
        sourceContext?.reason ||
        sourceContext?.noc ||
        sourceContext?.context) && (
        <Card padding="lg" className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            {pageText.passedContext}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            {pageText.importedContextBody}
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {sourceContext?.label && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {pageText.relatedItem}
                </p>
                <p className="mt-2 text-sm text-slate-800">{sourceContext.label}</p>
              </div>
            )}

            {sourceContext?.noc && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  {pageText.mappedNoc}
                </p>
                <p className="mt-2 text-sm font-medium text-blue-900">
                  {sourceContext.noc}
                </p>
              </div>
            )}
          </div>

          {sourceContext?.reason && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {pageText.checklistReason}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {sourceContext.reason}
              </p>
            </div>
          )}
        </Card>
      )}

      <AICopilotCard
        title={
          language === "fr"
            ? "Copilote IA de révision"
            : "Review AI Copilot"
        }
        description={pageText.helperBody}
        buttonLabel={
          language === "fr"
            ? "Que devrait démontrer un bon document ?"
            : "What should a strong document show?"
        }
        language={language}
        prompt={
          language === "fr"
            ? `Agis comme un copilote de révision pour ${documentTypeLabel}. Donne-moi les qualités attendues, les risques fréquents et les points à vérifier avant soumission.`
            : `Act as a review copilot for ${documentTypeLabel}. Tell me the qualities a strong draft should demonstrate, common risks, and key things to verify before submission.`
        }
        premiumLocked={!hasAdvancedCopilot}
        premiumTitle={
          language === "fr"
            ? "Débloquez le copilote avancé"
            : "Unlock advanced AI copilot"
        }
        premiumBody={
          language === "fr"
            ? "Passez à Pro ou Premium pour des recommandations plus profondes."
            : "Upgrade to Pro or Premium for deeper recommendations."
        }
        className="mb-6"
      />

      <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card variant="premium" padding="lg">
            <SectionIntro
              eyebrow={pageText.input}
              title={pageText.input}
              body={pageText.bestPracticesTitle}
            />

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {pageText.documentType}
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  {DOCUMENT_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {language === "fr" ? item.fr : item.en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {pageText.reviewDepth}
                </label>
                <select
                  value={reviewDepth}
                  onChange={(e) => setReviewDepth(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="standard">{pageText.standard}</option>
                  <option value="detailed">{pageText.detailed}</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {pageText.documentToReview}
                </label>
                <textarea
                  rows={12}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder={pageText.documentPlaceholder}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {pageText.additionalContext}
                </label>
                <textarea
                  rows={5}
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder={pageText.additionalContextPlaceholder}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  {language === "fr" ? "Contexte rapide" : "Quick context ideas"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {contextPresets.map((preset, index) => (
                    <button
                      key={`${preset}-${index}`}
                      type="button"
                      onClick={() => applyContextPreset(preset)}
                      className="rounded-full border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleReview} disabled={loading || !content.trim() || !canReviewNow}>
                  {loading ? pageText.reviewing : pageText.review}
                </Button>

                <Button variant="secondary" onClick={() => navigate("/documents/generator")}>
                  {pageText.openGenerator}
                </Button>
              </div>
            </div>
          </Card>

          <Card variant="soft" padding="lg">
            <SectionIntro
              eyebrow={pageText.bestPracticesEyebrow}
              title={pageText.bestPracticesTitle}
            />
            <div className="mt-5 space-y-2">
              {pageText.bestPractices.map((tip, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                >
                  {tip}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {result ? (
            <>
              <Card variant="premium" padding="lg">
                <SectionIntro
                  eyebrow={pageText.outputEyebrow}
                  title={pageText.outputTitle}
                  body={pageText.outputBody}
                />

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <p className="text-sm leading-7 text-slate-700">
                    {result.summary}
                  </p>
                </div>

                {locked && (
                  <div className="mt-5">
                    <UpgradePrompt
                      title={pageText.unlockTitle}
                      body={upgradeReason || pageText.unlockProBody}
                      buttonLabel={pageText.upgradeToPro}
                    />
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  {/* 🔁 LOOP BACK TO GENERATOR */}
                  <Button variant="secondary" onClick={handleApplyImprovements}>
                    {pageText.applyImprovements}
                  </Button>

                  {/* ✅ MARK STEP */}
                  <Button variant="secondary" onClick={handleMarkReviewed}>
                    {pageText.markReviewed}
                  </Button>

                  {/* 🚀 PRIMARY NEXT STEP */}
                  <Button onClick={() => navigate("/documents/generator")}>
                    {language === "fr"
                      ? "Finaliser le document"
                      : "Finalize Document"}
                  </Button>
                </div>
              </Card>

              {!locked && scoring && (
                <ScorePanel scoring={scoring} language={language} />
              )}

              <ReviewListCard
                title={pageText.strengths}
                items={result.strengths}
                emptyText={pageText.noItems}
                tone="success"
              />

              <ReviewListCard
                title={pageText.concerns}
                items={result.concerns}
                emptyText={pageText.noItems}
                tone="danger"
              />

              <ReviewListCard
                title={pageText.missingSupport}
                items={result.missing_support}
                emptyText={pageText.noItems}
                tone="warning"
              />

              <ReviewListCard
                title={pageText.improvementActions}
                items={result.improvement_actions}
                emptyText={pageText.noItems}
              />

              {!locked && result.reviewed_document_preview ? (
                <Card padding="lg">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {pageText.reviewedPreview}
                  </p>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                    <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {result.reviewed_document_preview}
                    </pre>
                  </div>
                </Card>
              ) : null}

              {!locked && result?.reviewed_document_preview && (
                <div className="mt-6 rounded-[28px] border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-6">
                  <h3 className="text-xl font-semibold text-slate-900">
                    {language === "fr"
                      ? "Votre document est prêt"
                      : "Your document is ready"}
                  </h3>

                  <p className="mt-2 text-sm text-slate-600">
                    {language === "fr"
                      ? "Passez à Premium pour exporter un PDF propre, prêt à être soumis."
                      : "Upgrade to Premium to export a clean, submission-ready PDF."}
                  </p>

                  <div className="mt-4 flex gap-3">
                    <Button onClick={() => navigate("/pricing")}>
                      {language === "fr"
                        ? "Passer à Premium"
                        : "Upgrade to Premium"}
                    </Button>

                    <Button variant="secondary" onClick={handleApplyImprovements}>
                      {language === "fr"
                        ? "Améliorer encore"
                        : "Improve further"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card variant="soft" padding="lg">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                {pageText.outputTitle}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {language === "fr"
                  ? "La révision apparaîtra ici."
                  : "The review will appear here."}
              </p>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}