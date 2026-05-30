import { useCallback, useEffect, useMemo, useState } from "react";
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
  explainAIDocument,
  fixAIDocumentIssues,
  generateAIDocument,
  getBillingAccess,
  getDocument,
  getSavedDocuments,
  improveAIDocumentBody,
  improveAIDocumentConclusion,
  improveAIDocumentIntro,
  makeAIDocumentOfficerReady,
  scoreAIDocumentConfidence,
  updateDocument,
} from "../api";

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

function buildProPricingPath(source = "documents", intent = "execute") {
  return `/pricing?plan=pro&source=${source}&intent=${intent}`;
}

function buildPremiumPricingPath(source = "documents", intent = "export") {
  return `/pricing?plan=premium&source=${source}&intent=${intent}`;
}

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

function normalizeParagraphs(value) {
  return String(value || "").replace(/\r/g, "").trim();
}

function splitContentIntoSections(content) {
  const text = normalizeParagraphs(content);

  if (!text) {
    return {
      intro: "",
      body: "",
      conclusion: "",
    };
  }

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    return {
      intro: paragraphs[0] || "",
      body: "",
      conclusion: "",
    };
  }

  if (paragraphs.length === 2) {
    return {
      intro: paragraphs[0] || "",
      body: "",
      conclusion: paragraphs[1] || "",
    };
  }

  return {
    intro: paragraphs[0] || "",
    body: paragraphs.slice(1, -1).join("\n\n"),
    conclusion: paragraphs[paragraphs.length - 1] || "",
  };
}

function buildCombinedContentFromSections(sections) {
  const intro = normalizeParagraphs(sections?.intro);
  const body = normalizeParagraphs(sections?.body);
  const conclusion = normalizeParagraphs(sections?.conclusion);

  return [intro, body, conclusion].filter(Boolean).join("\n\n");
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

function SectionBuilder({
  sections,
  setSections,
  language,
  onImproveSection,
  improvingSection,
}) {
  const text =
    language === "fr"
      ? {
          eyebrow: "Constructeur par sections",
          title: "Introduction, développement, conclusion",
          body:
            "Ajustez la structure du brouillon dans des blocs distincts pour mieux contrôler le message.",
          intro: "Introduction",
          introPlaceholder:
            "Présentez l’objet du document, le contexte principal et votre intention.",
          main: "Développement principal",
          mainPlaceholder:
            "Expliquez les faits, la chronologie, la logique et les éléments qui soutiennent votre dossier.",
          conclusion: "Conclusion",
          conclusionPlaceholder:
            "Terminez avec une synthèse claire et crédible de votre demande ou explication.",
          improveIntro: "Améliorer l’introduction",
          improveBody: "Améliorer le développement",
          improveConclusion: "Améliorer la conclusion",
          improving: "Amélioration...",
        }
      : {
          eyebrow: "Section builder",
          title: "Introduction, body, conclusion",
          body:
            "Refine the draft in distinct blocks for better control over structure and messaging.",
          intro: "Introduction",
          introPlaceholder:
            "Introduce the purpose of the document, the key context, and your intent.",
          main: "Main body",
          mainPlaceholder:
            "Explain the facts, chronology, logic, and details that support your file.",
          conclusion: "Conclusion",
          conclusionPlaceholder:
            "Close with a clear and credible summary of your request or explanation.",
          improveIntro: "Improve introduction",
          improveBody: "Improve body",
          improveConclusion: "Improve conclusion",
          improving: "Improving...",
        };

  return (
    <Card padding="lg">
      <SectionIntro
        eyebrow={text.eyebrow}
        title={text.title}
        body={text.body}
      />

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            {text.intro}
          </label>
          <textarea
            rows={5}
            value={sections.intro}
            onChange={(e) =>
              setSections((prev) => ({ ...prev, intro: e.target.value }))
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            placeholder={text.introPlaceholder}
          />
          <div className="mt-3">
            <Button
              variant="secondary"
              onClick={() => onImproveSection("intro")}
              disabled={improvingSection === "intro" || !sections.intro?.trim()}
            >
              {improvingSection === "intro"
                ? text.improving
                : text.improveIntro}
            </Button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            {text.main}
          </label>
          <textarea
            rows={8}
            value={sections.body}
            onChange={(e) =>
              setSections((prev) => ({ ...prev, body: e.target.value }))
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            placeholder={text.mainPlaceholder}
          />
          <div className="mt-3">
            <Button
              variant="secondary"
              onClick={() => onImproveSection("body")}
              disabled={improvingSection === "body" || !sections.body?.trim()}
            >
              {improvingSection === "body"
                ? text.improving
                : text.improveBody}
            </Button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            {text.conclusion}
          </label>
          <textarea
            rows={5}
            value={sections.conclusion}
            onChange={(e) =>
              setSections((prev) => ({ ...prev, conclusion: e.target.value }))
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            placeholder={text.conclusionPlaceholder}
          />
          <div className="mt-3">
            <Button
              variant="secondary"
              onClick={() => onImproveSection("conclusion")}
              disabled={
                improvingSection === "conclusion" ||
                !sections.conclusion?.trim()
              }
            >
              {improvingSection === "conclusion"
                ? text.improving
                : text.improveConclusion}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function WhyThisWorksPanel({ explanation, language }) {
  const text =
    language === "fr"
      ? {
          eyebrow: "Pourquoi cela fonctionne",
          title: "Explication de la logique du document",
          body:
            "Cette explication aide l’utilisateur à comprendre pourquoi le brouillon paraît plus crédible, structuré et persuasif.",
        }
      : {
          eyebrow: "Why this works",
          title: "Explanation of the draft logic",
          body:
            "This helps the user understand why the draft feels more credible, structured, and persuasive.",
        };

  return (
    <Card variant="soft" padding="lg">
      <SectionIntro eyebrow={text.eyebrow} title={text.title} body={text.body} />

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {explanation}
        </div>
      </div>
    </Card>
  );
}

function ConfidencePanel({ report, language }) {
  return (
    <Card variant="soft" padding="lg">
      <SectionIntro
        eyebrow={language === "fr" ? "Confiance" : "Confidence"}
        title={
          language === "fr"
            ? "Évaluation de solidité"
            : "Strength assessment"
        }
        body={
          language === "fr"
            ? "Cette analyse met en évidence le niveau global de solidité perçue du document."
            : "This analysis highlights the document’s overall perceived strength."
        }
      />
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
          {report}
        </div>
      </div>
    </Card>
  );
}

function PremiumCommandBar({
  language,
  documentTypeLabel,
  pathway,
  sourceContext,
  tone,
  scoring,
}) {
  const items = [
    {
      label: language === "fr" ? "Document" : "Document",
      value: documentTypeLabel || "--",
    },
    {
      label: language === "fr" ? "Parcours" : "Pathway",
      value: pathway || "--",
    },
    {
      label: language === "fr" ? "CNP" : "NOC",
      value: sourceContext?.noc || "--",
    },
    {
      label: language === "fr" ? "Ton" : "Tone",
      value: tone || "--",
    },
    {
      label: language === "fr" ? "Score" : "Score",
      value: scoring?.score ?? "--",
    },
  ];

  return (
    <Card
      padding="lg"
      className="mb-6 border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white"
    >
      <div className="grid gap-4 md:grid-cols-5">
        {items.map((item) => (
          <div key={item.label}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              {item.label}
            </p>
            <p className="mt-2 text-sm font-medium text-white">{item.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function DocumentGeneratorPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pathway = searchParams.get("pathway") || "";
  const language = i18n.language === "fr" ? "fr" : "en";

  const [access, setAccess] = useState(null);
  const [documentType, setDocumentType] = useState("letter_of_explanation");
  const [tone, setTone] = useState("professional");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [result, setResult] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);
  const [generatorUsage, setGeneratorUsage] = useState(0);

  const [sections, setSections] = useState({
    intro: "",
    body: "",
    conclusion: "",
  });

  const [whyThisWorks, setWhyThisWorks] = useState("");
  const [confidenceReport, setConfidenceReport] = useState("");

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
  const [explaining, setExplaining] = useState(false);
  const [officerReadyLoading, setOfficerReadyLoading] = useState(false);
  const [syncingSections, setSyncingSections] = useState(false);
  const [fixingAll, setFixingAll] = useState(false);
  const [improvingSection, setImprovingSection] = useState("");
  const [scoringConfidence, setScoringConfidence] = useState(false);
  const [message, setMessage] = useState("");

  const loadDrafts = useCallback(async () => {
    try {
      const res = await getSavedDocuments();
      setDrafts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadAccess = useCallback(async () => {
    try {
      const res = await getBillingAccess();
      setAccess(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadPage = useCallback(async () => {
    setGeneratorUsage(readGeneratorUsage());
    await Promise.all([loadDrafts(), loadAccess()]);
  }, [loadAccess, loadDrafts]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

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

  useEffect(() => {
    if (!result?.content) {
      setSections({
        intro: "",
        body: "",
        conclusion: "",
      });
      return;
    }

    if (result?.sections) {
      setSections({
        intro: result.sections.intro || "",
        body: result.sections.body || "",
        conclusion: result.sections.conclusion || "",
      });
      return;
    }

    setSections(splitContentIntoSections(result.content));
  }, [result]);

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

  const proPath = buildProPricingPath("documents", "execute");
  const premiumPath = buildPremiumPricingPath("documents", "export");

  function getCurrentDraftContent() {
    return buildCombinedContentFromSections(sections) || result?.content || "";
  }

  function updateResultContentFromSections(nextSections) {
    const combined = buildCombinedContentFromSections(nextSections);

    setSections(nextSections);
    setResult((prev) => ({
      ...(prev || {}),
      title: prev?.title || documentTypeLabel,
      content: combined,
      sections: {
        intro: nextSections.intro || "",
        body: nextSections.body || "",
        conclusion: nextSections.conclusion || "",
      },
    }));
  }

  function applyInstructionPreset(text) {
    setAdditionalInstructions((prev) => {
      const current = String(prev || "").trim();
      if (!current) return text;
      if (current.includes(text)) return current;
      return `${current}\n\n${text}`;
    });
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
      setWhyThisWorks("");
      setConfidenceReport("");
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
        pathway,
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

    try {
      await navigator.clipboard.writeText(getCurrentDraftContent());
      setMessage(language === "fr" ? "Document copié." : "Document copied.");
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de copier le document."
          : "Failed to copy document."
      );
    }
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

      const { exportDocumentToPdf } = await import("../utils/documentPdf");

      exportDocumentToPdf({
        title: result?.title || documentTypeLabel,
        documentTypeLabel,
        language,
        tone,
        content: getCurrentDraftContent(),
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
      setWhyThisWorks("");
      setConfidenceReport("");

      const res = await getDocument(docId);
      const doc = res.data;

      setSelectedDraftId(doc.id);
      setDocumentType(doc.document_type || "letter_of_explanation");
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

      const currentContent = getCurrentDraftContent();

      const res = await updateDocument(selectedDraftId, {
        content: currentContent,
        title: result?.title || documentTypeLabel,
        tone,
        additional_instructions: additionalInstructions,
      });

      setResult((prev) => ({
        ...(prev || {}),
        ...(res.data || {}),
        content: currentContent,
        sections: {
          intro: sections.intro || "",
          body: sections.body || "",
          conclusion: sections.conclusion || "",
        },
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
      setWhyThisWorks("");
      setConfidenceReport("");
      setSections({
        intro: "",
        body: "",
        conclusion: "",
      });

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

  async function handleOpenReview() {
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
      params.set("content", getCurrentDraftContent());
    }

    navigate(`/documents/review?${params.toString()}`);
  }

  async function handleExplainWhyThisWorks() {
    const content = getCurrentDraftContent();
    if (!content) return;

    try {
      setExplaining(true);
      setMessage("");

      const res = await explainAIDocument({
        document_type: documentType,
        language,
        tone,
        additional_instructions: content,
      });

      setWhyThisWorks(String(res?.data?.content || "").trim());
      setMessage(
        language === "fr"
          ? "Explication générée."
          : "Explanation generated."
      );
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de générer l’explication."
          : "Failed to generate explanation."
      );
    } finally {
      setExplaining(false);
    }
  }

  async function handleMakeOfficerReady() {
    const content = getCurrentDraftContent();
    if (!content) return;

    if (!hasAdvancedCopilot) {
      navigate(proPath);
      return;
    }

    try {
      setOfficerReadyLoading(true);
      setMessage("");
      setWhyThisWorks("");
      setConfidenceReport("");

      const res = await makeAIDocumentOfficerReady({
        document_type: documentType,
        language,
        tone,
        additional_instructions: content,
      });

      const nextContent = String(res?.data?.content || "").trim();
      const nextSections =
        res?.data?.sections || splitContentIntoSections(nextContent);

      setResult((prev) => ({
        ...(prev || {}),
        ...(res?.data || {}),
        title: prev?.title || documentTypeLabel,
        content: nextContent || prev?.content || "",
        sections: nextSections,
      }));

      setMessage(
        language === "fr"
          ? "Document renforcé en version prête pour l’agent."
          : "Document upgraded into an officer-ready version."
      );
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de produire la version officer-ready."
          : "Failed to create the officer-ready version."
      );
    } finally {
      setOfficerReadyLoading(false);
    }
  }

  async function handleSyncSectionsToDraft() {
    try {
      setSyncingSections(true);
      const combined = buildCombinedContentFromSections(sections);

      setResult((prev) => ({
        ...(prev || {}),
        title: prev?.title || documentTypeLabel,
        content: combined,
        sections: {
          intro: sections.intro || "",
          body: sections.body || "",
          conclusion: sections.conclusion || "",
        },
      }));

      setMessage(
        language === "fr"
          ? "Sections fusionnées dans le brouillon."
          : "Sections merged into the draft."
      );
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de synchroniser les sections."
          : "Failed to sync sections."
      );
    } finally {
      setSyncingSections(false);
    }
  }

  async function handleFixAllIssues() {
    const content = getCurrentDraftContent();
    if (!content) return;

    if (!hasAdvancedCopilot) {
      navigate(proPath);
      return;
    }

    try {
      setFixingAll(true);
      setMessage("");
      setConfidenceReport("");

      const res = await fixAIDocumentIssues({
        document_type: documentType,
        language,
        tone,
        additional_instructions: content,
      });

      const nextContent = String(res?.data?.content || "").trim();
      const nextSections =
        res?.data?.sections || splitContentIntoSections(nextContent);

      setResult((prev) => ({
        ...(prev || {}),
        ...(res?.data || {}),
        title: prev?.title || documentTypeLabel,
        content: nextContent || prev?.content || "",
        sections: nextSections,
      }));

      setMessage(
        language === "fr"
          ? "Le brouillon a été amélioré automatiquement."
          : "The draft was improved automatically."
      );
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de corriger automatiquement le document."
          : "Failed to fix the document automatically."
      );
    } finally {
      setFixingAll(false);
    }
  }

  async function handleImproveSection(sectionKey) {
    const sectionValue = sections?.[sectionKey];
    if (!sectionValue?.trim()) return;

    if (!hasAdvancedCopilot) {
      navigate(proPath);
      return;
    }

    const apiMap = {
      intro: improveAIDocumentIntro,
      body: improveAIDocumentBody,
      conclusion: improveAIDocumentConclusion,
    };

    try {
      setImprovingSection(sectionKey);
      setMessage("");

      const res = await apiMap[sectionKey]({
        document_type: documentType,
        language,
        tone,
        additional_instructions: sectionValue,
      });

      const improved = String(res?.data?.content || "").trim();
      if (!improved) return;

      const nextSections = {
        ...sections,
        [sectionKey]: improved,
      };

      updateResultContentFromSections(nextSections);

      setMessage(
        language === "fr"
          ? "Section améliorée."
          : "Section improved."
      );
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible d’améliorer cette section."
          : "Failed to improve this section."
      );
    } finally {
      setImprovingSection("");
    }
  }

  async function handleScoreConfidence() {
    const content = getCurrentDraftContent();
    if (!content) return;

    try {
      setScoringConfidence(true);
      setMessage("");

      const res = await scoreAIDocumentConfidence({
        document_type: documentType,
        language,
        tone,
        additional_instructions: content,
      });

      setConfidenceReport(String(res?.data?.content || "").trim());

      setMessage(
        language === "fr"
          ? "Analyse de confiance générée."
          : "Confidence analysis generated."
      );
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de générer le score de confiance."
          : "Failed to generate the confidence score."
      );
    } finally {
      setScoringConfidence(false);
    }
  }

  const instructionPresets = useMemo(() => {
    if (language === "fr") {
      return [
        "Utilisez un ton clair, crédible et rassurant.",
        "Mettez l’accent sur la cohérence du dossier.",
        "Expliquez les faits de manière chronologique.",
        "Soulignez les liens avec mon objectif principal.",
        sourceContext?.noc
          ? `Adaptez le contenu à la CNP ${sourceContext.noc} sans inventer de faits.`
          : null,
      ].filter(Boolean);
    }

    return [
      "Use a clear, credible, and reassuring tone.",
      "Emphasize the consistency of my file.",
      "Explain the facts in chronological order.",
      "Highlight how the facts support my main objective.",
      sourceContext?.noc
        ? `Tailor the content to NOC ${sourceContext.noc} without inventing facts.`
        : null,
    ].filter(Boolean);
  }, [language, sourceContext]);

  const pageText = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Générateur de documents",
        subtitle:
          "Générez un brouillon personnalisé à partir de votre profil, de votre stratégie et de votre contexte de demande.",
        settings: "Paramètres",
        myDrafts: "Mes brouillons",
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
        continueToReview: "Continuer vers la révision IA",
        unlockReview: "Débloquer la révision IA",
        improveBeforeExport: "Améliorer avant export",
        sectionSync: "Fusionner les sections",
        sectionSyncing: "Fusion...",
        whyThisWorks: "Pourquoi cela fonctionne",
        generatingExplanation: "Analyse...",
        officerReady: "Le rendre officer-ready",
        officerReadying: "Renforcement...",
        nocTailoringTitle: "Moteur d’adaptation CNP",
        nocTailoringBody:
          "Le contenu sera orienté vers les responsabilités, compétences et la logique de parcours liées à votre CNP quand cela est pertinent.",
        officerPromptTitle: "Débloquez la version officer-ready",
        officerPromptBody:
          "Passez à Pro pour réécrire automatiquement votre document dans une version plus claire, plus structurée et plus persuasive.",
        fixAll: "Corriger tous les points",
        fixingAll: "Correction...",
        confidenceScore: "Score de confiance",
        confidenceScoring: "Analyse...",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "Document Generator",
      subtitle:
        "Generate a personalized draft from your profile, strategy, and application context.",
      settings: "Settings",
      myDrafts: "My Drafts",
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
      continueToReview: "Continue to AI Review",
      unlockReview: "Unlock AI Review",
      improveBeforeExport: "Improve before export",
      sectionSync: "Merge sections into draft",
      sectionSyncing: "Merging...",
      whyThisWorks: "Why this works",
      generatingExplanation: "Analyzing...",
      officerReady: "Make it officer-ready",
      officerReadying: "Upgrading...",
      nocTailoringTitle: "NOC tailoring engine",
      nocTailoringBody:
        "The draft will be steered toward responsibilities, skills, and case logic that align with your NOC where relevant.",
      officerPromptTitle: "Unlock officer-ready rewriting",
      officerPromptBody:
        "Upgrade to Pro to automatically rewrite your document into a clearer, stronger, more persuasive version.",
      fixAll: "Fix all issues",
      fixingAll: "Fixing...",
      confidenceScore: "Confidence score",
      confidenceScoring: "Analyzing...",
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

      {pathway && (
        <Card
          padding="lg"
          className="mb-6 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
            {language === "fr" ? "Parcours sélectionné" : "Selected pathway"}
          </p>

          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            {pathway}
          </h2>

          <p className="mt-2 text-sm text-slate-700">
            {language === "fr"
              ? "Ce document sera généré en fonction de votre stratégie d’immigration."
              : "This document will be generated based on your immigration strategy."}
          </p>
        </Card>
      )}

      <PremiumCommandBar
        language={language}
        documentTypeLabel={documentTypeLabel}
        pathway={pathway}
        sourceContext={sourceContext}
        tone={tone}
        scoring={scoring}
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

          {sourceContext?.context && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {language === "fr" ? "Contexte détaillé" : "Detailed context"}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {sourceContext.context}
              </p>
            </div>
          )}

          {sourceContext?.noc && (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                {pageText.nocTailoringTitle}
              </p>
              <p className="mt-2 text-sm leading-6 text-blue-900">
                {pageText.nocTailoringBody}
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
            ? `Agis comme un copilote de rédaction pour ${documentTypeLabel}. Donne-moi ce qu’un bon document doit inclure, les erreurs à éviter, 3 actions concrètes, et 2 insights courts. ${
                sourceContext?.noc ? `Adapte la réponse à la CNP ${sourceContext.noc}.` : ""
              }`
            : `Act as a writing copilot for ${documentTypeLabel}. Tell me what a strong document should include, what to avoid, 3 concrete actions, and 2 short insights. ${
                sourceContext?.noc ? `Tailor the guidance to NOC ${sourceContext.noc}.` : ""
              }`
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

            <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                {language === "fr" ? "Assistant stratégique" : "Strategy assistant"}
              </p>
              <p className="mt-2 text-sm leading-6 text-violet-900">
                {pathway
                  ? language === "fr"
                    ? `Ce brouillon sera orienté vers le parcours ${pathway}${
                        sourceContext?.noc ? ` et la CNP ${sourceContext.noc}` : ""
                      }.`
                    : `This draft will be guided toward the ${pathway} pathway${
                        sourceContext?.noc ? ` and NOC ${sourceContext.noc}` : ""
                      }.`
                  : language === "fr"
                  ? "Ajoutez un contexte plus précis pour obtenir un brouillon plus stratégique."
                  : "Add more precise context to get a more strategic draft."}
              </p>
            </div>

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
                    onClick={() => navigate(proPath)}
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
                    onClick={() => navigate(premiumPath)}
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
                        : ""}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  {pageText.noDrafts}
                </div>
              )}
            </div>
          </Card>

          <Card padding="lg">
            <h2 className="text-xl font-semibold text-slate-900">
              {pageText.draftTipsTitle}
            </h2>

            <div className="mt-5 space-y-3">
              {pageText.draftTips.map((tip, index) => (
                <div
                  key={`${tip}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  {tip}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card variant="soft" padding="lg">
            <SectionIntro
              eyebrow={pageText.outputEyebrow}
              title={pageText.outputTitle}
              body={pageText.outputBody}
            />

            {locked ? (
              <div className="mt-6">
                <UpgradePrompt
                  title={language === "fr" ? "Accès Pro requis" : "Pro access required"}
                  body={upgradeReason}
                  buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
                />
              </div>
            ) : result?.content ? (
              <>
                <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {language === "fr" ? "Titre" : "Title"}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">
                        {result?.title || documentTypeLabel}
                      </h3>
                    </div>

                    {scoring && (
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${scoring.ratingClassName}`}
                      >
                        {scoring.rating}
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={18}
                    value={getCurrentDraftContent()}
                    onChange={(e) =>
                      updateResultContentFromSections(
                        splitContentIntoSections(e.target.value)
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={handleCopy}>
                    {pageText.copy}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={handleSaveDraft}
                    disabled={savingDraft || !selectedDraftId}
                  >
                    {savingDraft ? pageText.saving : pageText.save}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={handleDuplicateDraft}
                    disabled={duplicatingDraft || !selectedDraftId}
                  >
                    {duplicatingDraft ? pageText.duplicating : pageText.duplicate}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={handleDeleteDraft}
                    disabled={deletingDraft || !selectedDraftId}
                  >
                    {deletingDraft ? pageText.deleting : pageText.delete}
                  </Button>

                  {canReviewDocumentsFull ? (
                    <Button variant="secondary" onClick={handleOpenReview}>
                      {pageText.continueToReview}
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => navigate(proPath)}>
                      {pageText.unlockReview}
                    </Button>
                  )}
                </div>

                {!canReviewDocumentsFull && (
                  <div className="mt-4">
                    <UpgradePrompt
                      title={pageText.reviewPromptTitle}
                      body={pageText.reviewPromptBody}
                      buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-sm text-slate-500">
                {pageText.documentWillAppear}
              </div>
            )}
          </Card>

          {result?.content && !locked && (
            <>
              {scoring && <ScorePanel scoring={scoring} language={language} />}

              <SectionBuilder
                sections={sections}
                setSections={setSections}
                language={language}
                onImproveSection={handleImproveSection}
                improvingSection={improvingSection}
              />

              <Card padding="lg">
                <SectionIntro
                  eyebrow={language === "fr" ? "Actions IA" : "AI actions"}
                  title={language === "fr" ? "Renforcer le brouillon" : "Strengthen the draft"}
                  body={
                    language === "fr"
                      ? "Utilisez ces actions pour rendre le document plus clair, plus structuré et plus convaincant."
                      : "Use these actions to make the document clearer, better structured, and more persuasive."
                  }
                />

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleSyncSectionsToDraft}
                    disabled={syncingSections}
                  >
                    {syncingSections ? pageText.sectionSyncing : pageText.sectionSync}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={handleExplainWhyThisWorks}
                    disabled={explaining}
                  >
                    {explaining ? pageText.generatingExplanation : pageText.whyThisWorks}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={handleScoreConfidence}
                    disabled={scoringConfidence}
                  >
                    {scoringConfidence
                      ? pageText.confidenceScoring
                      : pageText.confidenceScore}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={handleFixAllIssues}
                    disabled={fixingAll}
                  >
                    {fixingAll ? pageText.fixingAll : pageText.fixAll}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={handleMakeOfficerReady}
                    disabled={officerReadyLoading}
                  >
                    {officerReadyLoading
                      ? pageText.officerReadying
                      : pageText.officerReady}
                  </Button>
                </div>

                {!hasAdvancedCopilot && (
                  <div className="mt-4">
                    <UpgradePrompt
                      title={pageText.officerPromptTitle}
                      body={pageText.officerPromptBody}
                      buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
                    />
                  </div>
                )}
              </Card>

              {whyThisWorks && (
                <WhyThisWorksPanel
                  explanation={whyThisWorks}
                  language={language}
                />
              )}

              {confidenceReport && (
                <ConfidencePanel report={confidenceReport} language={language} />
              )}

              {!canExportPdf && (
                <Card variant="premium" padding="lg">
                  <SectionIntro
                    eyebrow={language === "fr" ? "Finalisation" : "Finalization"}
                    title={pageText.finalPremiumTitle}
                    body={pageText.finalPremiumBody}
                  />
                  <div className="mt-5">
                    <Button onClick={() => navigate(premiumPath)}>
                      {pageText.upgradeToPremium}
                    </Button>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
