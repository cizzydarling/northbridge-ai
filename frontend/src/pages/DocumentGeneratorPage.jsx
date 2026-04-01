import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  deleteDocument,
  downloadAIDocumentDocx,
  duplicateDocument,
  generateAIDocument,
  getDocument,
  getSavedDocuments,
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

export default function DocumentGeneratorPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [documentType, setDocumentType] = useState("letter_of_explanation");
  const [tone, setTone] = useState("professional");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [result, setResult] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [duplicatingDraft, setDuplicatingDraft] = useState(false);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDrafts();
  }, []);

  async function loadDrafts() {
    try {
      const res = await getSavedDocuments();
      setDrafts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleGenerate() {
    try {
      setLoading(true);
      setMessage("");
      setResult(null);
      setSelectedDraftId(null);

      const res = await generateAIDocument({
        document_type: documentType,
        language,
        tone,
        additional_instructions: additionalInstructions,
      });

      setResult(res.data);
      await loadDrafts();

      setMessage(
        language === "fr"
          ? "Document généré."
          : "Document generated."
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

      const res = await downloadAIDocumentDocx({
        document_type: documentType,
        language,
        tone,
        additional_instructions: additionalInstructions,
      });

      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const fallbackName =
        language === "fr" ? "document_genere.docx" : "generated_document.docx";
      link.download = fallbackName;

      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      const status = err?.response?.status;

      if (status === 403) {
        setMessage(
          err?.response?.data?.detail ||
            (language === "fr"
              ? "Le téléchargement Word nécessite Premium."
              : "Word download requires Premium.")
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

  async function handleOpenDraft(docId) {
    try {
      setMessage("");
      const res = await getDocument(docId);
      const doc = res.data;

      setSelectedDraftId(doc.id);
      setDocumentType(doc.document_type);
      setTone(doc.tone || "professional");
      setResult({
        ...doc,
        is_premium: true,
        locked: false,
      });

      setMessage(
        language === "fr"
          ? "Brouillon chargé."
          : "Draft loaded."
      );
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
      });

      setResult((prev) => ({
        ...prev,
        ...res.data,
        is_premium: true,
        locked: false,
      }));

      await loadDrafts();

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

      setMessage(
        language === "fr"
          ? "Brouillon dupliqué."
          : "Draft duplicated."
      );
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

      setMessage(
        language === "fr"
          ? "Brouillon supprimé."
          : "Draft deleted."
      );
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

  const locked = Boolean(result?.locked);
  const isPremium = Boolean(result?.is_premium);
  const upgradeReason =
    result?.upgrade_reason ||
    (language === "fr"
      ? "Passez à Premium pour débloquer le brouillon complet et le téléchargement Word."
      : "Upgrade to Premium to unlock the full draft and Word download.");

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
          {language === "fr" ? "Générateur de documents" : "Document Generator"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {language === "fr"
            ? "Générez un brouillon personnalisé à partir de votre profil, de votre stratégie et de votre contexte de demande."
            : "Generate a personalized draft from your profile, strategy, and application context."}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {language === "fr" ? "Paramètres" : "Settings"}
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
                  {language === "fr" ? "Ton" : "Tone"}
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                >
                  <option value="professional">
                    {language === "fr" ? "Professionnel" : "Professional"}
                  </option>
                  <option value="formal">
                    {language === "fr" ? "Formel" : "Formal"}
                  </option>
                  <option value="clear">
                    {language === "fr" ? "Clair" : "Clear"}
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {language === "fr"
                    ? "Instructions supplémentaires"
                    : "Additional instructions"}
                </label>
                <textarea
                  rows={8}
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  placeholder={
                    language === "fr"
                      ? "Ajoutez ici des détails à inclure dans le document."
                      : "Add details here that should be reflected in the document."
                  }
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleGenerate} disabled={loading}>
                  {loading
                    ? language === "fr"
                      ? "Génération..."
                      : "Generating..."
                    : language === "fr"
                    ? "Générer le document"
                    : "Generate document"}
                </Button>

                <Button
                  variant="secondary"
                  onClick={handleDownloadWord}
                  disabled={downloading || !isPremium}
                >
                  {downloading
                    ? language === "fr"
                      ? "Téléchargement..."
                      : "Downloading..."
                    : language === "fr"
                    ? "Télécharger Word"
                    : "Download Word"}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {language === "fr" ? "Mes brouillons" : "My Drafts"}
            </p>

            <div className="mt-4 space-y-2">
              {drafts.length > 0 ? (
                drafts.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => handleOpenDraft(doc.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      selectedDraftId === doc.id
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {doc.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  {language === "fr"
                    ? "Aucun brouillon enregistré pour le moment."
                    : "No saved drafts yet."}
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {language === "fr" ? "Résultat" : "Output"}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {result?.title ||
                  (language === "fr"
                    ? "Aucun document généré"
                    : "No document generated")}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {result?.content && (
                <Button variant="secondary" onClick={handleCopy}>
                  {language === "fr" ? "Copier" : "Copy"}
                </Button>
              )}

              {selectedDraftId && !locked && (
                <>
                  <Button
                    variant="secondary"
                    onClick={handleSaveDraft}
                    disabled={savingDraft}
                  >
                    {savingDraft
                      ? language === "fr"
                        ? "Enregistrement..."
                        : "Saving..."
                      : language === "fr"
                      ? "Enregistrer"
                      : "Save"}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={handleDuplicateDraft}
                    disabled={duplicatingDraft}
                  >
                    {duplicatingDraft
                      ? language === "fr"
                        ? "Duplication..."
                        : "Duplicating..."
                      : language === "fr"
                      ? "Dupliquer"
                      : "Duplicate"}
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={handleDeleteDraft}
                    disabled={deletingDraft}
                  >
                    {deletingDraft
                      ? language === "fr"
                        ? "Suppression..."
                        : "Deleting..."
                      : language === "fr"
                      ? "Supprimer"
                      : "Delete"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {result?.content ? (
            <>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <textarea
                  value={result.content}
                  onChange={(e) =>
                    setResult((prev) => ({
                      ...prev,
                      content: e.target.value,
                    }))
                  }
                  readOnly={locked}
                  rows={22}
                  className={`w-full resize-y bg-transparent text-sm leading-7 text-slate-700 outline-none ${
                    locked ? "cursor-not-allowed" : ""
                  }`}
                />
              </div>

              {result?.disclaimer && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {result.disclaimer}
                </div>
              )}

              {locked && (
                <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5">
                  <p className="text-sm font-semibold text-amber-900">
                    {language === "fr"
                      ? "Débloquez le brouillon complet"
                      : "Unlock the full draft"}
                  </p>
                  <p className="mt-2 text-sm text-amber-800">
                    {upgradeReason}
                  </p>
                  <div className="mt-4">
                    <Button onClick={() => navigate("/pricing")}>
                      {language === "fr"
                        ? "Passer à Premium"
                        : "Upgrade to Premium"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              {language === "fr"
                ? "Le document apparaîtra ici après génération."
                : "Your document will appear here after generation."}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}