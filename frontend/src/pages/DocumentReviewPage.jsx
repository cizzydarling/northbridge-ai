import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
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
        <p className="text-sm font-semibold text-blue-600">NorthBridgeAI</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">
          {language === "fr" ? "Révision de document IA" : "AI Document Review"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {language === "fr"
            ? "Collez un document et obtenez une révision structurée avec points forts, risques, éléments manquants et actions d’amélioration."
            : "Paste a document and get a structured review with strengths, risks, missing support, and improvement actions."}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {language === "fr" ? "Entrée" : "Input"}
            </p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isPremium
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {isPremium
                ? "Premium"
                : language === "fr"
                ? "Aperçu"
                : "Preview"}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {language === "fr" ? "Type de document" : "Document type"}
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
                {language === "fr" ? "Niveau de révision" : "Review depth"}
              </label>
              <select
                value={reviewDepth}
                onChange={(e) => setReviewDepth(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="standard">
                  {language === "fr" ? "Standard" : "Standard"}
                </option>
                <option value="detailed">
                  {language === "fr" ? "Détaillé" : "Detailed"}
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {language === "fr" ? "Document à réviser" : "Document to review"}
              </label>
              <textarea
                rows={18}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                placeholder={
                  language === "fr"
                    ? "Collez ici votre document..."
                    : "Paste your document here..."
                }
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {language === "fr" ? "Contexte additionnel" : "Additional context"}
              </label>
              <textarea
                rows={5}
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                placeholder={
                  language === "fr"
                    ? "Ajoutez un contexte utile pour améliorer la révision."
                    : "Add any useful context to improve the review."
                }
              />
            </div>

            <Button onClick={handleReview} disabled={loading || content.trim().length < 20}>
              {loading
                ? language === "fr"
                  ? "Révision..."
                  : "Reviewing..."
                : language === "fr"
                ? "Réviser le document"
                : "Review document"}
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {language === "fr" ? "Résumé" : "Summary"}
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
                {language === "fr"
                  ? "La révision apparaîtra ici."
                  : "The review will appear here."}
              </div>
            )}
          </Card>

          {result && (
            <>
              <ReviewListCard
                title={language === "fr" ? "Points forts" : "Strengths"}
                items={result.strengths}
              />

              <ReviewListCard
                title={language === "fr" ? "Risques / faiblesses" : "Concerns / risks"}
                items={result.concerns}
              />

              <ReviewListCard
                title={language === "fr" ? "Éléments potentiellement manquants" : "Potentially missing support"}
                items={result.missing_support}
              />

              <ReviewListCard
                title={language === "fr" ? "Actions d’amélioration" : "Improvement actions"}
                items={result.improvement_actions}
              />

              <Card className="p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {language === "fr" ? "Aperçu révisé" : "Reviewed preview"}
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
                    {language === "fr"
                      ? "Débloquez la révision complète"
                      : "Unlock the full review"}
                  </p>
                  <p className="mt-2 text-sm text-amber-800">{upgradeReason}</p>
                  <div className="mt-4">
                    <Button onClick={() => navigate("/pricing")}>
                      {language === "fr" ? "Passer à Premium" : "Upgrade to Premium"}
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

function ReviewListCard({ title, items }) {
  return (
    <Card className="p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <ul className="mt-4 space-y-2">
        {(items || []).map((item, index) => (
          <li
            key={index}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
          >
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}