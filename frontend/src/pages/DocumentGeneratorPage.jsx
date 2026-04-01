import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import AICopilotCard from "../components/AICopilotCard";
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
  const isPremium = Boolean(result?.is_premium);
  const upgradeReason =
    result?.upgrade_reason ||
    (language === "fr"
      ? "Passez à Premium pour débloquer le brouillon complet et le téléchargement Word."
      : "Upgrade to Premium to unlock the full draft and Word download.");

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
        downloading: "Téléchargement...",
        copy: "Copier",
        save: "Enregistrer",
        saving: "Enregistrement...",
        duplicate: "Dupliquer",
        duplicating: "Duplication...",
        delete: "Supprimer",
        deleting: "Suppression...",
        noDrafts: "Aucun brouillon enregistré pour le moment.",
        documentWillAppear: "Le document apparaîtra ici après génération.",
        unlockTitle: "Débloquez le brouillon complet",
        upgrade: "Passer à Premium",
        helperEyebrow: "Conseil IA",
        helperTitle: "Rédigez un document plus fort",
        helperBody:
          "Utilisez le copilote pour savoir quoi inclure, quoi clarifier et quel ton adopter avant de générer votre brouillon.",
        draftTipsEyebrow: "Bonnes pratiques",
        draftTipsTitle: "Avant de générer",
        draftTips: [
          "Choisissez le bon type de document selon votre situation.",
          "Ajoutez des instructions précises pour personnaliser le brouillon.",
          "Utilisez ensuite la révision IA ou l’export Word si nécessaire.",
        ],
        loadedOn: "Créé le",
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
      downloading: "Downloading...",
      copy: "Copy",
      save: "Save",
      saving: "Saving...",
      duplicate: "Duplicate",
      duplicating: "Duplicating...",
      delete: "Delete",
      deleting: "Deleting...",
      noDrafts: "No saved drafts yet.",
      documentWillAppear: "Your document will appear here after generation.",
      unlockTitle: "Unlock the full draft",
      upgrade: "Upgrade to Premium",
      helperEyebrow: "AI guidance",
      helperTitle: "Create a stronger document",
      helperBody:
        "Use the copilot to understand what to include, what to clarify, and what tone to use before generating your draft.",
      draftTipsEyebrow: "Best practices",
      draftTipsTitle: "Before you generate",
      draftTips: [
        "Choose the right document type for your situation.",
        "Add precise instructions to personalize the draft.",
        "Then use AI review or Word export if needed.",
      ],
      loadedOn: "Created on",
    };
  }, [language]);

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
            ? "Copilote IA du document"
            : "Document AI Copilot"
        }
        description={pageText.helperBody}
        buttonLabel={
          language === "fr"
            ? "Que dois-je inclure ?"
            : "What should I include?"
        }
        language={language}
        prompt={
          language === "fr"
            ? `Agis comme un copilote de préparation documentaire.

Je travaille actuellement sur ce type de document: ${documentTypeLabel}.
Le ton choisi est: ${tone}.

Explique:
1. les éléments que je devrais absolument inclure
2. les points à clarifier pour rendre le document plus crédible
3. le ton le plus approprié
4. retourne 3 suggested_next_actions courtes et concrètes`
            : `Act as a document-preparation copilot.

I am currently working on this document type: ${documentTypeLabel}.
The selected tone is: ${tone}.

Explain:
1. the points I should absolutely include
2. what I should clarify to make the document more credible
3. the most appropriate tone
4. return 3 short concrete suggested_next_actions`
        }
        className="mb-6"
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {pageText.settings}
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
                  {pageText.tone}
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
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
                  rows={8}
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
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
                      className="rounded-full border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleGenerate} disabled={loading}>
                  {loading ? pageText.generating : pageText.generate}
                </Button>

                <Button
                  variant="secondary"
                  onClick={handleDownloadWord}
                  disabled={downloading || !isPremium}
                >
                  {downloading ? pageText.downloading : pageText.downloadWord}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
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
                      {pageText.loadedOn}{" "}
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  {pageText.noDrafts}
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {pageText.draftTipsEyebrow}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">
              {pageText.draftTipsTitle}
            </h2>

            <div className="mt-5 space-y-3">
              {pageText.draftTips.map((tip, index) => (
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
              <Button variant="secondary" onClick={() => navigate("/documents/review")}>
                {language === "fr" ? "Ouvrir la révision IA" : "Open AI review"}
              </Button>
              <Button variant="secondary" onClick={() => navigate("/self/documents")}>
                {language === "fr" ? "Voir mes documents" : "View my documents"}
              </Button>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {pageText.output}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                {result?.title || pageText.noDocument}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {result?.content && (
                <Button variant="secondary" onClick={handleCopy}>
                  {pageText.copy}
                </Button>
              )}

              {selectedDraftId && !locked && (
                <>
                  <Button
                    variant="secondary"
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
                    variant="secondary"
                    onClick={handleDeleteDraft}
                    disabled={deletingDraft}
                  >
                    {deletingDraft ? pageText.deleting : pageText.delete}
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
                    {pageText.unlockTitle}
                  </p>
                  <p className="mt-2 text-sm text-amber-800">{upgradeReason}</p>
                  <div className="mt-4">
                    <Button onClick={() => navigate("/pricing")}>
                      {pageText.upgrade}
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              {pageText.documentWillAppear}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}