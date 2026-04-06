import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import AICopilotCard from "../components/AICopilotCard";
import UpgradePrompt from "../components/UpgradePrompt";
import { getBillingAccess } from "../api";

const COMPLETION_STORAGE_KEY = "nbai_document_completion_engine_v1";

const DOCUMENT_LIBRARY = [
  {
    id: "passport_identity",
    category: "identity",
    title: {
      en: "Passport / Identity Documents",
      fr: "Passeport / Pièces d’identité",
    },
    description: {
      en: "Core identity documents used across most immigration applications.",
      fr: "Documents d’identité de base utilisés dans la plupart des demandes d’immigration.",
    },
  },
  {
    id: "education_records",
    category: "education",
    title: {
      en: "Education Records",
      fr: "Preuves d’études",
    },
    description: {
      en: "Diplomas, transcripts, and supporting study documents.",
      fr: "Diplômes, relevés de notes et documents d’études pertinents.",
    },
  },
  {
    id: "language_results",
    category: "language",
    title: {
      en: "Language Test Results",
      fr: "Résultats de tests linguistiques",
    },
    description: {
      en: "IELTS, CELPIP, TEF, TCF, and related proof.",
      fr: "IELTS, CELPIP, TEF, TCF et preuves connexes.",
    },
  },
  {
    id: "work_experience_records",
    category: "employment",
    title: {
      en: "Work Experience Proof",
      fr: "Preuves d’expérience professionnelle",
    },
    description: {
      en: "Reference letters, pay records, and job evidence aligned to your NOC.",
      fr: "Lettres de référence, fiches de paie et preuves d’emploi alignées à votre CNP.",
    },
  },
  {
    id: "proof_of_funds",
    category: "financial",
    title: {
      en: "Proof of Funds",
      fr: "Preuve de fonds",
    },
    description: {
      en: "Bank statements, financial letters, and supporting explanations.",
      fr: "Relevés bancaires, lettres financières et explications de soutien.",
    },
  },
  {
    id: "relationship_evidence",
    category: "family",
    title: {
      en: "Relationship Evidence",
      fr: "Preuves de relation",
    },
    description: {
      en: "Useful for family-based and sponsorship-related applications.",
      fr: "Utile pour les demandes familiales et les parrainages.",
    },
  },
  {
    id: "travel_history",
    category: "travel",
    title: {
      en: "Travel History Support",
      fr: "Justificatifs d’historique de voyage",
    },
    description: {
      en: "Travel explanations, prior visas, entry stamps, and related support.",
      fr: "Explications de voyage, visas antérieurs, tampons d’entrée et pièces connexes.",
    },
  },
];

function readCompletionEngine() {
  try {
    return JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCompletionEngine(value) {
  localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(value || {}));
  window.dispatchEvent(new Event("nbai-document-engine-updated"));
}

function getDocumentState(engine, id) {
  return (
    engine?.[id] || {
      drafted: false,
      reviewed: false,
      completed: false,
    }
  );
}

function getCategoryOrder() {
  return [
    "identity",
    "education",
    "language",
    "employment",
    "financial",
    "family",
    "travel",
  ];
}

function getCategoryLabel(category, language) {
  const labels = {
    identity: {
      en: "Identity",
      fr: "Identité",
    },
    education: {
      en: "Education",
      fr: "Études",
    },
    language: {
      en: "Language",
      fr: "Langues",
    },
    employment: {
      en: "Employment",
      fr: "Emploi",
    },
    financial: {
      en: "Financial",
      fr: "Financier",
    },
    family: {
      en: "Family",
      fr: "Famille",
    },
    travel: {
      en: "Travel",
      fr: "Voyage",
    },
  };

  return labels?.[category]?.[language] || category;
}

function StatPill({ active, children }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
    >
      {children}
    </span>
  );
}

export default function SelfDocumentsPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [engineVersion, setEngineVersion] = useState(0);
  const [access, setAccess] = useState(null);

  useEffect(() => {
    loadAccess();

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

  async function loadAccess() {
    try {
      const res = await getBillingAccess();
      setAccess(res.data);
    } catch (err) {
      console.error(err);
      setAccess(null);
    }
  }

  const isPro = Boolean(access?.is_pro);
  const isPremium = Boolean(access?.is_premium);

  const engine = useMemo(() => readCompletionEngine(), [engineVersion]);

  const stats = useMemo(() => {
    const states = DOCUMENT_LIBRARY.map((doc) => getDocumentState(engine, doc.id));

    return {
      total: DOCUMENT_LIBRARY.length,
      drafted: states.filter((item) => item.drafted).length,
      reviewed: states.filter((item) => item.reviewed).length,
      completed: states.filter((item) => item.completed).length,
    };
  }, [engine]);

  function handleOpenGenerator(id) {
    if (!isPro) {
      navigate("/pricing");
      return;
    }

    navigate(`/documents/generator?checklist_id=${id}`);
  }

  function handleOpenReview(id) {
    if (!isPro) {
      navigate("/pricing");
      return;
    }

    navigate(`/documents/review?checklist_id=${id}`);
  }

  function updateDocument(id, patch) {
    const current = readCompletionEngine();
    const existing = current[id] || {
      drafted: false,
      reviewed: false,
      completed: false,
    };

    const next = {
      ...current,
      [id]: {
        ...existing,
        ...patch,
        updated_at: new Date().toISOString(),
      },
    };

    writeCompletionEngine(next);
  }

  function resetDocument(id) {
    const current = readCompletionEngine();
    const next = { ...current };
    delete next[id];
    writeCompletionEngine(next);
  }

  function handleMarkDraft(id) {
    updateDocument(id, { drafted: true });
  }

  function handleMarkReviewed(id) {
    updateDocument(id, { drafted: true, reviewed: true });
  }

  function handleMarkCompleted(id) {
    updateDocument(id, {
      drafted: true,
      reviewed: true,
      completed: true,
    });
  }

  const text = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Mes documents",
        subtitle:
          "Suivez votre progression documentaire, préparez vos brouillons et passez à la révision lorsque vous êtes prêt.",
        copilotTitle: "Copilote IA Documents",
        copilotDesc:
          "Obtenez une recommandation sur les documents à prioriser.",
        copilotButton: "Prioriser mes documents",
        upgradeTitle: "Débloquez la génération de documents",
        upgradeBody:
          "Passez à Pro pour générer et réviser vos documents avec l’IA.",
        featureLocked: "Fonction verrouillée",
        featureLockedBody: "Passez à Pro pour générer et réviser ce document.",
        generate: "Générer",
        review: "Réviser",
        markDraft: "Brouillon",
        markReviewed: "Révisé",
        markCompleted: "Complété",
        reset: "Réinitialiser",
        drafted: "Brouillons",
        reviewed: "Révisés",
        completed: "Complétés",
        total: "Total",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "My Documents",
      subtitle:
        "Track your document progress, prepare drafts, and move into review when you are ready.",
      copilotTitle: "Documents AI Copilot",
      copilotDesc:
        "Get recommendations on which documents to prioritize.",
      copilotButton: "Prioritize my documents",
      upgradeTitle: "Unlock document generation",
      upgradeBody:
        "Upgrade to Pro to generate and review your documents with AI.",
      featureLocked: "Feature locked",
      featureLockedBody: "Upgrade to Pro to generate and review this document.",
      generate: "Generate",
      review: "Review",
      markDraft: "Draft",
      markReviewed: "Reviewed",
      markCompleted: "Completed",
      reset: "Reset",
      drafted: "Drafted",
      reviewed: "Reviewed",
      completed: "Completed",
      total: "Total",
    };
  }, [language]);

  return (
    <Layout>
      <div className="mb-8 max-w-3xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
          {text.brand}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          {text.title}
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-600">
          {text.subtitle}
        </p>
      </div>

      <AICopilotCard
        title={text.copilotTitle}
        description={text.copilotDesc}
        buttonLabel={text.copilotButton}
        language={language}
        prompt={
          language === "fr"
            ? "Analyse ma progression documentaire et dis-moi quoi prioriser."
            : "Analyze my document progress and tell me what to prioritize."
        }
        className="mb-6"
      />

      {!isPro && (
        <UpgradePrompt
          className="mb-6"
          title={text.upgradeTitle}
          body={text.upgradeBody}
        />
      )}

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <Card padding="lg">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
            {text.total}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {stats.total}
          </p>
        </Card>

        <Card padding="lg">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
            {text.drafted}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {stats.drafted}
          </p>
        </Card>

        <Card padding="lg">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
            {text.reviewed}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {stats.reviewed}
          </p>
        </Card>

        <Card padding="lg">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
            {text.completed}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {stats.completed}
          </p>
        </Card>
      </div>

      <div className="space-y-10">
        {getCategoryOrder().map((category) => {
          const docs = DOCUMENT_LIBRARY.filter((d) => d.category === category);

          if (!docs.length) return null;

          return (
            <section key={category}>
              <div className="mb-4">
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {getCategoryLabel(category, language)}
                </h2>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {docs.map((doc) => {
                  const state = getDocumentState(engine, doc.id);

                  return (
                    <Card key={doc.id} padding="lg">
                      <h3 className="mb-2 text-lg font-semibold text-slate-900">
                        {doc.title[language]}
                      </h3>

                      <p className="mb-4 text-sm leading-7 text-slate-600">
                        {doc.description[language]}
                      </p>

                      <div className="mb-4 flex flex-wrap gap-2">
                        <StatPill active={state.drafted}>{text.markDraft}</StatPill>
                        <StatPill active={state.reviewed}>{text.markReviewed}</StatPill>
                        <StatPill active={state.completed}>{text.markCompleted}</StatPill>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenGenerator(doc.id)}
                        >
                          {text.generate}
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() => handleOpenReview(doc.id)}
                        >
                          {text.review}
                        </Button>

                        <Button onClick={() => handleMarkDraft(doc.id)}>
                          {text.markDraft}
                        </Button>

                        <Button onClick={() => handleMarkReviewed(doc.id)}>
                          {text.markReviewed}
                        </Button>

                        <Button onClick={() => handleMarkCompleted(doc.id)}>
                          {text.markCompleted}
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() => resetDocument(doc.id)}
                        >
                          {text.reset}
                        </Button>
                      </div>

                      {!isPro && (
                        <div className="mt-4">
                          <UpgradePrompt
                            compact
                            title={text.featureLocked}
                            body={text.featureLockedBody}
                          />
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </Layout>
  );
}