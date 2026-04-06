import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import AICopilotCard from "../components/AICopilotCard";
import UpgradePrompt from "../components/UpgradePrompt";
import {
  deleteDocument,
  downloadAIDocumentDocx,
  duplicateDocument,
  generateAIDocument,
  getBillingAccess,
  getDocument,
  getSavedDocuments,
  updateDocument,
} from "../api";
import { exportDocumentToPdf } from "../utils/documentPdf";

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
    en: "Relationship Explanation Letter",
    fr: "Lettre d’explication de la relation",
  },
];

const COMPLETION_STORAGE_KEY = "nbai_document_completion_engine_v1";
const GENERATOR_USAGE_KEY = "nbai_doc_generator_usage_v1";
const FREE_GENERATOR_LIMIT = 3;

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

function readGeneratorUsage() {
  try {
    return Number(localStorage.getItem(GENERATOR_USAGE_KEY) || 0);
  } catch {
    return 0;
  }
}

function writeGeneratorUsage(value) {
  localStorage.setItem(GENERATOR_USAGE_KEY, String(value));
}

function buildContextualInstructions({
  baseInstructions,
  sourceContext,
  language,
}) {
  const sections = [];
  const cleanedBase = String(baseInstructions || "").trim();

  if (sourceContext?.source === "checklist") {
    sections.push(
      language === "fr"
        ? "Contexte importé depuis la checklist documentaire."
        : "Context imported from the document checklist."
    );
  }

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
        ? `Alignez le contenu avec la CNP ${sourceContext.noc} lorsque cela est pertinent.`
        : `Align the content with NOC ${sourceContext.noc} where relevant.`
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

function scoreDocument({
  content,
  additionalInstructions,
  sourceContext,
  language,
}) {
  const text = String(content || "").trim();
  const lower = text.toLowerCase();
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const paragraphCount = text
    ? text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).length
    : 0;

  let score = 0;
  const strengths = [];
  const improvements = [];
  const checklist = [];

  if (wordCount >= 350) {
    score += 20;
    strengths.push(
      language === "fr"
        ? "Le document a une longueur utile pour soutenir l’explication."
        : "The document has a useful length for supporting the explanation."
    );
  } else if (wordCount >= 180) {
    score += 12;
    improvements.push(
      language === "fr"
        ? "Le document pourrait être développé davantage pour renforcer l’argumentaire."
        : "The document could be developed further to strengthen the argument."
    );
  } else {
    improvements.push(
      language === "fr"
        ? "Le document est trop court pour être pleinement convaincant."
        : "The document is too short to be fully persuasive."
    );
  }

  if (paragraphCount >= 3) {
    score += 15;
    strengths.push(
      language === "fr"
        ? "Le contenu est structuré en plusieurs sections ou paragraphes."
        : "The content is structured into multiple sections or paragraphs."
    );
  } else {
    improvements.push(
      language === "fr"
        ? "Ajoutez davantage de structure avec plusieurs paragraphes clairs."
        : "Add more structure with several clear paragraphs."
    );
  }

  const hasDates = /\b(20\d{2}|19\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/.test(text);
  if (hasDates) {
    score += 10;
    strengths.push(
      language === "fr"
        ? "Le document contient des repères temporels utiles."
        : "The document includes helpful time references."
    );
  } else {
    improvements.push(
      language === "fr"
        ? "Ajoutez des dates ou repères temporels lorsque cela est pertinent."
        : "Add dates or time references where relevant."
    );
  }

  const hasTransitionWords =
    /(because|therefore|however|specifically|in addition|as a result|car|donc|cependant|ainsi|de plus|par conséquent)/i.test(
      text
    );
  if (hasTransitionWords) {
    score += 10;
    strengths.push(
      language === "fr"
        ? "Le raisonnement semble articulé avec des transitions utiles."
        : "The reasoning appears connected with useful transitions."
    );
  } else {
    improvements.push(
      language === "fr"
        ? "Renforcez les liens logiques entre les idées."
        : "Strengthen the logical links between ideas."
    );
  }

  const hasSpecificContext =
    Boolean(sourceContext?.label) ||
    Boolean(sourceContext?.reason) ||
    Boolean(sourceContext?.noc) ||
    Boolean(additionalInstructions?.trim());

  if (hasSpecificContext) {
    score += 10;
    checklist.push(
      language === "fr"
        ? "Le document devrait rester cohérent avec votre contexte importé et vos instructions."
        : "The document should remain consistent with your imported context and instructions."
    );
  }

  if (sourceContext?.noc) {
    const nocFound = lower.includes(String(sourceContext.noc).toLowerCase());
    if (nocFound) {
      score += 8;
      strengths.push(
        language === "fr"
          ? "Le contenu semble tenir compte de la CNP liée."
          : "The content appears to take the mapped NOC into account."
      );
    } else {
      improvements.push(
        language === "fr"
          ? "Ajoutez un meilleur alignement avec la CNP liée lorsque pertinent."
          : "Add better alignment with the mapped NOC where relevant."
      );
    }
  }

  const hasFirstPerson = /\b(i|my|me|je|j’|j'|mon|ma|mes|moi)\b/i.test(text);
  if (hasFirstPerson) {
    score += 8;
    strengths.push(
      language === "fr"
        ? "La voix personnelle du demandeur est présente."
        : "The applicant’s personal voice is present."
    );
  } else {
    improvements.push(
      language === "fr"
        ? "Le document gagnerait à refléter davantage votre voix personnelle."
        : "The document would benefit from reflecting your personal voice more clearly."
    );
  }

  const longSentences = text
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.split(/\s+/).length > 40).length;

  if (longSentences === 0) {
    score += 8;
    strengths.push(
      language === "fr"
        ? "La lisibilité générale semble bonne."
        : "Overall readability appears strong."
    );
  } else {
    improvements.push(
      language === "fr"
        ? "Certaines phrases sont probablement trop longues; simplifiez-les."
        : "Some sentences are likely too long; simplify them."
    );
  }

  const hasClearOpening =
    text.length > 0 &&
    text
      .slice(0, 260)
      .toLowerCase()
      .includes(language === "fr" ? "je" : "i");

  if (hasClearOpening) {
    score += 6;
  } else {
    improvements.push(
      language === "fr"
        ? "Renforcez l’ouverture avec une introduction plus directe."
        : "Strengthen the opening with a clearer introductory statement."
    );
  }

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

  if (!strengths.length) {
    strengths.push(
      language === "fr"
        ? "Le document offre une base de travail exploitable."
        : "The document provides a workable starting foundation."
    );
  }

  if (!improvements.length) {
    improvements.push(
      language === "fr"
        ? "Le prochain gain viendra surtout d’un affinage du ton et des détails."
        : "The next gains will mostly come from refining tone and detail."
    );
  }

  return {
    score,
    rating,
    ratingClassName,
    wordCount,
    paragraphCount,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 4),
    checklist: checklist.slice(0, 3),
  };
}

function ScorePanel({ scoring, language }) {
  const text =
    language === "fr"
      ? {
          eyebrow: "Score documentaire",
          title: "Évaluation du brouillon",
          score: "Score",
          words: "Mots",
          paragraphs: "Paragraphes",
          strengths: "Forces",
          improvements: "Améliorations prioritaires",
          checklist: "Points de contrôle",
        }
      : {
          eyebrow: "Document score",
          title: "Draft assessment",
          score: "Score",
          words: "Words",
          paragraphs: "Paragraphs",
          strengths: "Strengths",
          improvements: "Priority improvements",
          checklist: "Quality checks",
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

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{text.strengths}</p>
          <div className="mt-3 space-y-2">
            {scoring.strengths.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">
            {text.improvements}
          </p>
          <div className="mt-3 space-y-2">
            {scoring.improvements.map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">{text.checklist}</p>
          <div className="mt-3 space-y-2">
            {(scoring.checklist.length
              ? scoring.checklist
              : [
                  language === "fr"
                    ? "Maintenez une cohérence entre le ton, les faits et le contexte de votre dossier."
                    : "Keep the tone, facts, and file context consistent throughout the draft.",
                ]).map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
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

export default function DocumentGeneratorPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [access, setAccess] = useState(null);
  const [documentType, setDocumentType] = useState("letter_of_explanation");
  const [tone, setTone] = useState("professional");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [result, setResult] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [generatorUsage, setGeneratorUsage] = useState(0);

  const [sourceContext, setSourceContext] = useState({
    source: "",
    label: "",
    reason: "",
    noc: "",
    context: "",
    checklistId: "",
    matterType: "general",
  });

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [duplicatingDraft, setDuplicatingDraft] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const queryDocumentType = searchParams.get("document_type");
    const source = searchParams.get("source") || "";
    const label = searchParams.get("label") || "";
    const reason = searchParams.get("reason") || "";
    const noc = searchParams.get("noc") || "";
    const context = searchParams.get("context") || "";
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
      source,
      label,
      reason,
      noc,
      context,
      checklistId,
      matterType,
    });

    if (context) {
      setAdditionalInstructions((prev) => {
        const current = String(prev || "").trim();
        const incoming = String(context || "").trim();

        if (!incoming) return current;
        if (!current) return incoming;
        if (current.includes(incoming)) return current;

        return `${incoming}\n\n${current}`;
      });
    }

    if (validDocumentType) {
      setMessage(
        language === "fr"
          ? "Type de document prérempli à partir de votre guidance."
          : "Document type prefilled from your guidance."
      );
    }
  }, [searchParams, language]);

  async function loadPage() {
    setGeneratorUsage(readGeneratorUsage());
    await Promise.all([loadDrafts(), loadAccess()]);
  }

  async function loadDrafts() {
    try {
      const res = await getSavedDocuments();
      setDrafts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadAccess() {
    try {
      const res = await getBillingAccess();
      setAccess(res.data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleGenerate() {
    if (!canGenerateMore) {
      setResult({
        locked: true,
        upgrade_reason:
          language === "fr"
            ? "Passez à Pro pour continuer à générer des documents."
            : "Upgrade to Pro to continue generating documents.",
      });
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setResult(null);
      setSelectedDraftId(null);

      const contextualInstructions = buildContextualInstructions({
        baseInstructions: additionalInstructions,
        sourceContext,
        language,
      });

      const res = await generateAIDocument({
        document_type: documentType,
        language,
        tone,
        additional_instructions: contextualInstructions,
      });

      setResult(res.data);
      await loadDrafts();

      if (!canGenerateDocumentsFull) {
        const nextUsage = generatorUsage + 1;
        writeGeneratorUsage(nextUsage);
        setGeneratorUsage(nextUsage);
      }

      if (sourceContext?.checklistId) {
        updateCompletionRecord({
          matterType: sourceContext.matterType,
          checklistId: sourceContext.checklistId,
          documentType,
          patch: {
            reviewed: false,
            completed: false,
          },
        });
      }

      setMessage(
        language === "fr" ? "Document généré." : "Document generated."
      );
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Échec de la génération du document."
            : "Failed to generate document.")
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result?.content) return;
    await navigator.clipboard.writeText(result.content);
    setMessage(language === "fr" ? "Document copié." : "Document copied.");
  }

  async function handleDownloadWord() {
    try {
      setDownloading(true);
      setMessage("");

      if (!canDownloadDocx) {
        setMessage(
          language === "fr"
            ? "Le téléchargement Word nécessite Pro ou Premium."
            : "Word download requires Pro or Premium."
        );
        return;
      }

      const contextualInstructions = buildContextualInstructions({
        baseInstructions: additionalInstructions,
        sourceContext,
        language,
      });

      const res = await downloadAIDocumentDocx({
        document_type: documentType,
        language,
        tone,
        additional_instructions: contextualInstructions,
      });

      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        language === "fr" ? "document_genere.docx" : "generated_document.docx";

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessage(
        language === "fr"
          ? "Document Word téléchargé."
          : "Word document downloaded."
      );
    } catch (err) {
      console.error(err);
      const status = err?.response?.status;

      if (status === 403) {
        setMessage(
          err?.response?.data?.detail ||
            (language === "fr"
              ? "Le téléchargement Word nécessite Pro ou Premium."
              : "Word download requires Pro or Premium.")
        );
        return;
      }

      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Échec du téléchargement Word."
            : "Failed to download Word document.")
      );
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadPdf() {
    if (!result?.content) return;

    try {
      setDownloadingPdf(true);
      setMessage("");

      if (!canExportPdf) {
        setMessage(
          language === "fr"
            ? "L’export PDF nécessite Premium."
            : "PDF export requires Premium."
        );
        return;
      }

      exportDocumentToPdf({
        title: result?.title || documentTypeLabel,
        documentTypeLabel,
        language,
        tone,
        content: result.content,
      });

      setMessage(
        language === "fr"
          ? "Document PDF téléchargé."
          : "PDF document downloaded."
      );
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Échec du téléchargement PDF."
          : "Failed to download PDF document."
      );
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleOpenDraft(docId) {
    try {
      setMessage("");
      const res = await getDocument(docId);
      const doc = res.data;

      setSelectedDraftId(doc.id);
      setDocumentType(doc.document_type);
      setTone(doc.tone || "professional");
      setAdditionalInstructions(doc.additional_instructions || "");
      setResult({
        ...doc,
        is_premium: doc.is_premium ?? true,
        locked: doc.locked ?? false,
      });

      setMessage(language === "fr" ? "Brouillon chargé." : "Draft loaded.");
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Impossible de charger le brouillon."
            : "Failed to load draft.")
      );
    }
  }

  async function handleSaveDraft() {
    if (!selectedDraftId || !result?.content) return;

    try {
      setSavingDraft(true);
      setMessage("");

      const res = await updateDocument(selectedDraftId, {
        content: result.content,
        title: result.title,
        tone,
        additional_instructions: additionalInstructions,
      });

      setResult((prev) => ({
        ...prev,
        ...res.data,
        is_premium: true,
        locked: false,
      }));

      await loadDrafts();

      if (sourceContext?.checklistId) {
        updateCompletionRecord({
          matterType: sourceContext.matterType,
          checklistId: sourceContext.checklistId,
          documentType,
          patch: {
            reviewed: false,
            completed: false,
          },
        });
      }

      setMessage(language === "fr" ? "Brouillon enregistré." : "Draft saved.");
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Échec de l’enregistrement du brouillon."
            : "Failed to save draft.")
      );
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleDuplicateDraft() {
    if (!selectedDraftId) return;

    try {
      setDuplicatingDraft(true);
      setMessage("");

      const res = await duplicateDocument(selectedDraftId);
      await loadDrafts();
      await handleOpenDraft(res.data.id);

      setMessage(language === "fr" ? "Brouillon dupliqué." : "Draft duplicated.");
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Échec de la duplication du brouillon."
            : "Failed to duplicate draft.")
      );
    } finally {
      setDuplicatingDraft(false);
    }
  }

  async function handleDeleteDraft() {
    if (!selectedDraftId) return;

    try {
      setDeletingDraft(true);
      setMessage("");

      await deleteDocument(selectedDraftId);
      await loadDrafts();

      setSelectedDraftId(null);
      setResult(null);

      setMessage(language === "fr" ? "Brouillon supprimé." : "Draft deleted.");
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Échec de la suppression du brouillon."
            : "Failed to delete draft.")
      );
    } finally {
      setDeletingDraft(false);
    }
  }

  function handleOpenReview() {
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
    if (result?.content) {
      params.set("content", encodeURIComponent(result.content));
    }

    navigate(`/documents/review?${params.toString()}`);
  }

  function applyInstructionPreset(text) {
    setAdditionalInstructions((prev) => {
      const current = String(prev || "").trim();
      if (!current) return text;
      if (current.includes(text)) return current;
      return `${current}\n\n${text}`;
    });
  }

  const selectedDocumentMeta =
    DOCUMENT_TYPES.find((item) => item.value === documentType) ||
    DOCUMENT_TYPES[0];

  const documentTypeLabel =
    language === "fr" ? selectedDocumentMeta.fr : selectedDocumentMeta.en;

  const locked = Boolean(result?.locked);
  const upgradeReason =
    result?.upgrade_reason ||
    (language === "fr"
      ? "Passez à Pro pour débloquer la génération complète, puis à Premium pour les exports PDF."
      : "Upgrade to Pro to unlock full generation, then Premium for PDF exports.");

  const canPreviewGenerator = Boolean(access?.can_preview_document_generator);
  const canGenerateDocumentsFull = Boolean(access?.can_generate_documents_full);
  const canDownloadDocx = Boolean(access?.can_download_document_docx);
  const canExportPdf = Boolean(access?.can_export_pdf);
  const canReviewDocumentsFull = Boolean(access?.can_review_documents_full);
  const hasAdvancedCopilot = Boolean(access?.can_use_advanced_ai);

  const remainingFreeGenerations = Math.max(
    FREE_GENERATOR_LIMIT - generatorUsage,
    0
  );
  const limitReached =
    !canGenerateDocumentsFull && remainingFreeGenerations <= 0;
  const nearLimit =
    !canGenerateDocumentsFull &&
    remainingFreeGenerations > 0 &&
    remainingFreeGenerations <= 1;
  const canGenerateMore =
    canPreviewGenerator && (canGenerateDocumentsFull || !limitReached);

  const instructionPresets = useMemo(() => {
    if (language === "fr") {
      return [
        "Utilisez un ton clair, crédible et rassurant.",
        "Mettez l’accent sur la cohérence du dossier.",
        "Expliquez les faits de manière chronologique.",
        "Soulignez les liens avec mon objectif principal.",
      ];
    }

    return [
      "Use a clear, credible, and reassuring tone.",
      "Emphasize the consistency of my file.",
      "Explain the facts in chronological order.",
      "Highlight how the facts support my main objective.",
    ];
  }, [language]);

  const pageText = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Générateur de documents",
        subtitle:
          "Générez un brouillon personnalisé à partir de votre profil, de votre stratégie et de votre contexte de demande.",
        settings: "Paramètres",
        preview: "Aperçu",
        myDrafts: "Mes brouillons",
        output: "Résultat",
        noDocument: "Aucun document généré",
        documentType: "Type de document",
        tone: "Ton",
        professional: "Professionnel",
        formal: "Formel",
        clear: "Clair",
        additionalInstructions: "Instructions supplémentaires",
        additionalInstructionsPlaceholder:
          "Ajoutez ici des détails à inclure dans le document.",
        smartPrompts: "Instructions rapides",
        generate: "Générer le document",
        generating: "Génération...",
        downloadWord: "Télécharger Word",
        downloadPdf: "Télécharger PDF",
        downloading: "Téléchargement...",
        downloadingPdf: "PDF...",
        copy: "Copier",
        save: "Enregistrer",
        saving: "Enregistrement...",
        duplicate: "Dupliquer",
        duplicating: "Duplication...",
        delete: "Supprimer",
        deleting: "Suppression...",
        noDrafts: "Aucun brouillon enregistré pour le moment.",
        documentWillAppear: "Le document apparaîtra ici après génération.",
        unlockTitle: "Débloquez le flux complet de rédaction",
        unlockProTitle: "Passez à Pro pour continuer",
        unlockProBody:
          "Débloquez la génération complète, le téléchargement Word et la révision complète des documents.",
        unlockPremiumTitle: "Débloquez l’export PDF",
        unlockPremiumBody:
          "Passez à Premium pour télécharger vos brouillons en PDF propre et partageable.",
        upgradeToPro: "Passer à Pro",
        upgradeToPremium: "Passer à Premium",
        helperBody:
          "Utilisez le copilote pour savoir quoi inclure, quoi clarifier et quel ton adopter avant de générer votre brouillon.",
        draftTipsTitle: "Avant de générer",
        draftTips: [
          "Choisissez le bon type de document selon votre situation.",
          "Ajoutez des instructions précises pour personnaliser le brouillon.",
          "Passez ensuite en révision IA pour renforcer la qualité du contenu.",
        ],
        loadedOn: "Créé le",
        openReview: "Ouvrir la révision IA",
        openDocuments: "Voir mes documents",
        checklistContext: "Contexte de la checklist",
        sourceContext: "Contexte transmis",
        relatedItem: "Élément lié",
        mappedNoc: "CNP liée",
        importedContext:
          "Ce générateur a été prérempli à partir de votre checklist documentaire.",
        autoFocusTitle: "Document ciblé",
        autoFocusBody:
          "Le type de document a été sélectionné automatiquement à partir de votre stratégie ou de votre guidance.",
        usageTitle: "Utilisation gratuite",
        usageText: `${generatorUsage}/${FREE_GENERATOR_LIMIT} générations utilisées`,
        nearLimitTitle: "Il vous reste 1 génération gratuite",
        nearLimitBody:
          "Passez à Pro maintenant pour éviter l’interruption lorsque vous atteindrez votre limite.",
        limitTitle: "Limite gratuite atteinte",
        limitBody:
          "Passez à Pro pour débloquer la génération complète et continuer à produire vos brouillons.",
        outputEyebrow: "Rédaction",
        outputTitle: "Brouillon en cours",
        outputBody:
          "Affinez le contenu, enregistrez-le comme brouillon, puis passez en révision IA pour améliorer sa qualité.",
        premiumBar:
          "Pro débloque la génération complète et Word. Premium ajoute l’export PDF.",
        pdfPromptTitle: "Débloquez l’export PDF",
        pdfPromptBody:
          "Passez à Premium pour télécharger vos brouillons en PDF propre et partageable.",
        wordPromptTitle: "Débloquez le téléchargement Word",
        wordPromptBody:
          "Passez à Pro pour télécharger vos brouillons en format Word et poursuivre le flux complet de préparation.",
        reviewPromptTitle: "Débloquez la révision complète",
        reviewPromptBody:
          "Passez à Pro pour obtenir la révision IA complète de vos brouillons.",
        finalPremiumTitle: "Votre document est prêt à être finalisé",
        finalPremiumBody:
          "Passez à Premium pour exporter un PDF propre et prêt à être soumis.",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "Document Generator",
      subtitle:
        "Generate a personalized draft from your profile, strategy, and application context.",
      settings: "Settings",
      preview: "Preview",
      myDrafts: "My Drafts",
      output: "Output",
      noDocument: "No document generated",
      documentType: "Document type",
      tone: "Tone",
      professional: "Professional",
      formal: "Formal",
      clear: "Clear",
      additionalInstructions: "Additional instructions",
      additionalInstructionsPlaceholder:
        "Add details here that should be reflected in the document.",
      smartPrompts: "Quick instruction ideas",
      generate: "Generate document",
      generating: "Generating...",
      downloadWord: "Download Word",
      downloadPdf: "Download PDF",
      downloading: "Downloading...",
      downloadingPdf: "PDF...",
      copy: "Copy",
      save: "Save",
      saving: "Saving...",
      duplicate: "Duplicate",
      duplicating: "Duplicating...",
      delete: "Delete",
      deleting: "Deleting...",
      noDrafts: "No saved drafts yet.",
      documentWillAppear: "Your document will appear here after generation.",
      unlockTitle: "Unlock the full writing workflow",
      unlockProTitle: "Upgrade to Pro to continue",
      unlockProBody:
        "Unlock full generation, Word download, and full document review.",
      unlockPremiumTitle: "Unlock PDF export",
      unlockPremiumBody:
        "Upgrade to Premium to download your drafts as a clean, shareable PDF.",
      upgradeToPro: "Upgrade to Pro",
      upgradeToPremium: "Upgrade to Premium",
      helperBody:
        "Use the copilot to understand what to include, what to clarify, and what tone to use before generating your draft.",
      draftTipsTitle: "Before you generate",
      draftTips: [
        "Choose the right document type for your situation.",
        "Add precise instructions to personalize the draft.",
        "Then move into AI review to strengthen the content.",
      ],
      loadedOn: "Created on",
      openReview: "Open AI review",
      openDocuments: "View my documents",
      checklistContext: "Checklist context",
      sourceContext: "Passed context",
      relatedItem: "Related item",
      mappedNoc: "Mapped NOC",
      importedContext:
        "This generator was prefilled from your document checklist.",
      autoFocusTitle: "Targeted document",
      autoFocusBody:
        "The document type was selected automatically from your strategy or guidance.",
      usageTitle: "Free usage",
      usageText: `${generatorUsage}/${FREE_GENERATOR_LIMIT} generations used`,
      nearLimitTitle: "You have 1 free generation left",
      nearLimitBody:
        "Upgrade to Pro now to avoid interruption when you hit your limit.",
      limitTitle: "Free limit reached",
      limitBody:
        "Upgrade to Pro to unlock full generation and continue producing drafts.",
      outputEyebrow: "Writing",
      outputTitle: "Draft in progress",
      outputBody:
        "Refine the content, save it as a draft, then move into AI review to strengthen its quality.",
      premiumBar:
        "Pro unlocks full generation and Word. Premium adds PDF export.",
      pdfPromptTitle: "Unlock PDF export",
      pdfPromptBody:
        "Upgrade to Premium to download your drafts as a clean, shareable PDF.",
      wordPromptTitle: "Unlock Word download",
      wordPromptBody:
        "Upgrade to Pro to download your drafts in Word format and continue the full preparation flow.",
      reviewPromptTitle: "Unlock full review",
      reviewPromptBody:
        "Upgrade to Pro to get full AI review for your drafts.",
      finalPremiumTitle: "Your document is ready to finalize",
      finalPremiumBody:
        "Upgrade to Premium to export a clean, submission-ready PDF.",
    };
  }, [language, generatorUsage]);

  const scoring = useMemo(() => {
    if (!result?.content || locked) return null;

    return scoreDocument({
      content: result.content,
      additionalInstructions,
      sourceContext,
      language,
    });
  }, [result, additionalInstructions, sourceContext, language, locked]);

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

      {!canGenerateDocumentsFull && (
        <>
          <Card variant="soft" padding="lg" className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {pageText.usageTitle}
            </p>
            <p className="mt-2 text-sm text-slate-700">{pageText.usageText}</p>
            <p className="mt-3 text-sm text-slate-600">{pageText.premiumBar}</p>
          </Card>

          {nearLimit && (
            <div className="mb-6">
              <UpgradePrompt
                title={pageText.nearLimitTitle}
                body={pageText.nearLimitBody}
                buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
              />
            </div>
          )}

          {limitReached && (
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
            {pageText.sourceContext}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            {pageText.importedContext}
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
                {pageText.checklistContext}
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
            ? "Copilote IA de rédaction"
            : "Writing AI Copilot"
        }
        description={pageText.helperBody}
        buttonLabel={language === "fr" ? "Que dois-je inclure ?" : "What should I include?"}
        language={language}
        prompt={
          language === "fr"
            ? `Agis comme un copilote de rédaction pour ${documentTypeLabel}. Donne-moi ce qu’un bon document doit inclure, les erreurs à éviter, 3 actions concrètes, et 2 insights courts.`
            : `Act as a writing copilot for ${documentTypeLabel}. Tell me what a strong document should include, what to avoid, 3 concrete actions, and 2 short insights.`
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
              eyebrow={pageText.settings}
              title={pageText.settings}
              body={pageText.draftTipsTitle}
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
                  {pageText.tone}
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="professional">{pageText.professional}</option>
                  <option value="formal">{pageText.formal}</option>
                  <option value="clear">{pageText.clear}</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {pageText.additionalInstructions}
                </label>
                <textarea
                  rows={7}
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder={pageText.additionalInstructionsPlaceholder}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  {pageText.smartPrompts}
                </p>
                <div className="flex flex-wrap gap-2">
                  {instructionPresets.map((preset, index) => (
                    <button
                      key={`${preset}-${index}`}
                      type="button"
                      onClick={() => applyInstructionPreset(preset)}
                      disabled={!canGenerateMore}
                      className="rounded-full border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleGenerate} disabled={loading || !canGenerateMore}>
                    {loading ? pageText.generating : pageText.generate}
                  </Button>

                  {canDownloadDocx ? (
                    <Button
                      variant="secondary"
                      onClick={handleDownloadWord}
                      disabled={downloading || !result?.content}
                    >
                      {downloading ? pageText.downloading : pageText.downloadWord}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => navigate("/pricing")}
                      disabled={!result?.content}
                    >
                      {pageText.downloadWord}
                    </Button>
                  )}

                  {canExportPdf ? (
                    <Button
                      variant="secondary"
                      onClick={handleDownloadPdf}
                      disabled={downloadingPdf || !result?.content}
                    >
                      {downloadingPdf ? pageText.downloadingPdf : pageText.downloadPdf}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => navigate("/pricing")}
                      disabled={!result?.content}
                    >
                      {pageText.downloadPdf}
                    </Button>
                  )}
                </div>

                {!canDownloadDocx && (
                  <div className="mt-4">
                    <UpgradePrompt
                      title={pageText.wordPromptTitle}
                      body={pageText.wordPromptBody}
                      buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
                    />
                  </div>
                )}

                {canDownloadDocx && !canExportPdf && (
                  <div className="mt-4">
                    <UpgradePrompt
                      title={pageText.pdfPromptTitle}
                      body={pageText.pdfPromptBody}
                      buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
                    />
                  </div>
                )}
              </>
            </div>
          </Card>

          <Card padding="lg">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {pageText.myDrafts}
            </p>

            <div className="mt-4 space-y-2">
              {drafts.length > 0 ? (
                drafts.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => handleOpenDraft(doc.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedDraftId === doc.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="text-sm font-medium text-slate-900">
                      {doc.title || documentTypeLabel}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {pageText.loadedOn}{" "}
                      {doc.created_at
                        ? new Date(doc.created_at).toLocaleDateString()
                        : "—"}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  {pageText.noDrafts}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="premium" padding="lg">
            <SectionIntro
              eyebrow={pageText.outputEyebrow}
              title={pageText.outputTitle}
              body={pageText.outputBody}
            />

            {result?.content ? (
              <>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <textarea
                    value={result.content}
                    onChange={(e) =>
                      setResult((prev) => ({ ...prev, content: e.target.value }))
                    }
                    className="min-h-[360px] w-full resize-y border-none bg-transparent text-sm leading-7 text-slate-700 outline-none"
                  />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={handleCopy}>
                    {pageText.copy}
                  </Button>

                  {selectedDraftId ? (
                    <>
                      <Button
                        onClick={handleSaveDraft}
                        disabled={savingDraft}
                      >
                        {savingDraft ? pageText.saving : pageText.save}
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={handleDuplicateDraft}
                        disabled={duplicatingDraft}
                      >
                        {duplicatingDraft ? pageText.duplicating : pageText.duplicate}
                      </Button>

                      <Button
                        variant="danger"
                        onClick={handleDeleteDraft}
                        disabled={deletingDraft}
                      >
                        {deletingDraft ? pageText.deleting : pageText.delete}
                      </Button>
                    </>
                  ) : null}

                  <Button
                    onClick={handleOpenReview}
                    disabled={!canReviewDocumentsFull}
                  >
                    {pageText.openReview}
                  </Button>
                </div>

                {!canReviewDocumentsFull && (
                  <div className="mt-5">
                    <UpgradePrompt
                      title={pageText.reviewPromptTitle}
                      body={pageText.reviewPromptBody}
                      buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
                    />
                  </div>
                )}

                {canGenerateDocumentsFull && !canExportPdf && (
                  <div className="mt-5">
                    <UpgradePrompt
                      title={pageText.finalPremiumTitle}
                      body={pageText.finalPremiumBody}
                      buttonLabel={
                        language === "fr" ? "Passer à Premium" : "Upgrade to Premium"
                      }
                    />
                  </div>
                )}

                {locked && (
                  <div className="mt-5">
                    <UpgradePrompt
                      title={pageText.unlockTitle}
                      body={upgradeReason}
                      buttonLabel={
                        canGenerateDocumentsFull
                          ? pageText.upgradeToPremium
                          : pageText.upgradeToPro
                      }
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                {pageText.documentWillAppear}
              </div>
            )}
          </Card>

          {scoring && <ScorePanel scoring={scoring} language={language} />}

          {result?.content && (
            <Card variant="soft" padding="lg">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {pageText.draftTipsTitle}
              </p>
              <div className="mt-4 space-y-2">
                {pageText.draftTips.map((tip, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    {tip}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => navigate("/self/documents")}>
                  {pageText.openDocuments}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate("/pricing")}
                >
                  {canGenerateDocumentsFull
                    ? pageText.upgradeToPremium
                    : pageText.upgradeToPro}
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}