import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import AICopilotCard from "../components/AICopilotCard";
import { reviewAIDocument } from "../api";

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

export default function DocumentReviewPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [documentType, setDocumentType] = useState("letter_of_explanation");
  const [reviewDepth, setReviewDepth] = useState("standard");
  const [content, setContent] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedDocumentMeta =
    DOCUMENT_TYPES.find((item) => item.value === documentType) ||
    DOCUMENT_TYPES[0];

  const documentTypeLabel =
    language === "fr" ? selectedDocumentMeta.fr : selectedDocumentMeta.en;

  const pageText = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Révision de document IA",
        subtitle:
          "Collez un document et obtenez une révision structurée avec points forts, risques, éléments manquants et actions d’amélioration.",
        input: "Entrée",
        preview: "Aperçu",
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
        summary: "Résumé",
        reviewWillAppear: "La révision apparaîtra ici.",
        unlockTitle: "Débloquez la révision complète",
        upgrade: "Passer à Premium",
        strengths: "Points forts",
        concerns: "Risques / faiblesses",
        missingSupport: "Éléments potentiellement manquants",
        improvementActions: "Actions d’amélioration",
        reviewedPreview: "Aperçu révisé",
        helperEyebrow: "Copilote IA",
        helperTitle: "Mieux préparer la révision",
        helperBody:
          "Utilisez le copilote pour comprendre ce qu’un bon document devrait démontrer avant de lancer la révision.",
        quickContext: "Contexte rapide",
        bestPracticesEyebrow: "Bonnes pratiques",
        bestPracticesTitle: "Avant de lancer la révision",
        bestPractices: [
          "Collez un document suffisamment complet pour obtenir un retour utile.",
          "Ajoutez un contexte clair si votre situation comporte des éléments sensibles ou inhabituels.",
          "Utilisez ensuite le générateur de documents ou la stratégie pour renforcer votre dossier.",
        ],
        openGenerator: "Ouvrir le générateur",
        viewStrategy: "Voir ma stratégie",
        noItems: "Aucun élément disponible.",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "AI Document Review",
      subtitle:
        "Paste a document and get a structured review with strengths, risks, missing support, and improvement actions.",
      input: "Input",
      preview: "Preview",
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
      summary: "Summary",
      reviewWillAppear: "The review will appear here.",
      unlockTitle: "Unlock the full review",
      upgrade: "Upgrade to Premium",
      strengths: "Strengths",
      concerns: "Concerns / risks",
      missingSupport: "Potentially missing support",
      improvementActions: "Improvement actions",
      reviewedPreview: "Reviewed preview",
      helperEyebrow: "AI Copilot",
      helperTitle: "Prepare a stronger review",
      helperBody:
        "Use the copilot to understand what a strong document should demonstrate before you run the review.",
      quickContext: "Quick context ideas",
      bestPracticesEyebrow: "Best practices",
      bestPracticesTitle: "Before you run the review",
      bestPractices: [
        "Paste a complete enough document to receive meaningful feedback.",
        "Add clear context if your situation includes sensitive or unusual facts.",
        "Then use the document generator or strategy page to strengthen your file.",
      ],
      openGenerator: "Open generator",
      viewStrategy: "View my strategy",
      noItems: "No items available.",
    };
  }, [language]);

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
    try {
      setLoading(true);
      setMessage("");
      setResult(null);

      const res = await reviewAIDocument({
        document_type: documentType,
        content,
        language,
        review_depth: reviewDepth,
        additional_context: additionalContext,
      });

      setResult(res.data);
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

  function applyContextPreset(text) {
    setAdditionalContext((prev) => {
      const current = String(prev || "").trim();
      if (!current) return text;
      if (current.includes(text)) return current;
      return `${current}\n\n${text}`;
    });
  }

  const locked = Boolean(result?.locked);
  const isPremium = Boolean(result?.is_premium);
  const upgradeReason =
    result?.upgrade_reason ||
    (language === "fr"
      ? "Passez à Premium pour débloquer la révision complète."
      : "Upgrade to Premium to unlock the full review.");

  return (
    <Layout>
      {message && (
        <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {message}
        </div>
      )}

      <div className="mb-8">
        <p className="text-sm font-semibold text-blue-600">{pageText.brand}</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          {pageText.title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {pageText.subtitle}
        </p>
      </div>

      <AICopilotCard
        title={
          language === "fr"
            ? "Copilote IA de révision"
            : "Review AI Copilot"
        }
        description={pageText.helperBody}
        buttonLabel={
          language === "fr"
            ? "Que dois-je vérifier ?"
            : "What should I check?"
        }
        language={language}
        prompt={
          language === "fr"
            ? `Agis comme un copilote de révision documentaire.

Je travaille actuellement sur ce type de document: ${documentTypeLabel}.
Le niveau de révision choisi est: ${reviewDepth}.

Explique:
1. ce qu’un bon document de ce type doit démontrer
2. les risques ou faiblesses les plus fréquents
3. les éléments de preuve ou clarifications qui manquent souvent
4. retourne 3 suggested_next_actions courtes et concrètes`
            : `Act as a document review copilot.

I am currently reviewing this document type: ${documentTypeLabel}.
The selected review depth is: ${reviewDepth}.

Explain:
1. what a strong document of this type should demonstrate
2. the most common weaknesses or risks
3. what evidence or clarifications are often missing
4. return 3 short concrete suggested_next_actions`
        }
        className="mb-6"
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {pageText.input}
              </p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isPremium
                    ? "border border-green-200 bg-green-50 text-green-700"
                    : "border border-amber-200 bg-amber-50 text-amber-700"
                }`}
              >
                {isPremium ? "Premium" : pageText.preview}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {pageText.documentType}
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
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
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
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
                  rows={18}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
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
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  placeholder={pageText.additionalContextPlaceholder}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  {pageText.quickContext}
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

              <Button
                onClick={handleReview}
                disabled={loading || content.trim().length < 20}
              >
                {loading ? pageText.reviewing : pageText.review}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {pageText.bestPracticesEyebrow}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {pageText.bestPracticesTitle}
            </h2>

            <div className="mt-5 space-y-3">
              {pageText.bestPractices.map((tip, index) => (
                <div
                  key={index}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-900 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm text-slate-700">{tip}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => navigate("/documents/generator")}
              >
                {pageText.openGenerator}
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate("/strategy")}
              >
                {pageText.viewStrategy}
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {pageText.summary}
            </p>

            {result ? (
              <>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {result.summary}
                </h2>

                {result.disclaimer && (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    {result.disclaimer}
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                {pageText.reviewWillAppear}
              </div>
            )}
          </Card>

          {result && (
            <>
              <ReviewListCard
                title={pageText.strengths}
                items={result.strengths}
                emptyText={pageText.noItems}
              />

              <ReviewListCard
                title={pageText.concerns}
                items={result.concerns}
                emptyText={pageText.noItems}
              />

              <ReviewListCard
                title={pageText.missingSupport}
                items={result.missing_support}
                emptyText={pageText.noItems}
              />

              <ReviewListCard
                title={pageText.improvementActions}
                items={result.improvement_actions}
                emptyText={pageText.noItems}
              />

              <Card className="p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {pageText.reviewedPreview}
                </p>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">
                    {result.reviewed_document_preview}
                  </pre>
                </div>
              </Card>

              {locked && (
                <Card className="border border-amber-300 bg-amber-50 p-6">
                  <p className="text-sm font-semibold text-amber-900">
                    {pageText.unlockTitle}
                  </p>
                  <p className="mt-2 text-sm text-amber-800">{upgradeReason}</p>
                  <div className="mt-4">
                    <Button onClick={() => navigate("/pricing")}>
                      {pageText.upgrade}
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

function ReviewListCard({ title, items, emptyText }) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <Card className="p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>

      {safeItems.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {safeItems.map((item, index) => (
            <li
              key={index}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
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