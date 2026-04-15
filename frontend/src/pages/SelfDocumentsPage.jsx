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

function buildProPricingPath(source = "documents", intent = "execute") {
  return `/pricing?plan=pro&source=${source}&intent=${intent}`;
}

function buildPremiumPricingPath(source = "documents", intent = "export") {
  return `/pricing?plan=premium&source=${source}&intent=${intent}`;
}

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
    identity: { en: "Identity", fr: "Identité" },
    education: { en: "Education", fr: "Études" },
    language: { en: "Language", fr: "Langues" },
    employment: { en: "Employment", fr: "Emploi" },
    financial: { en: "Financial", fr: "Financier" },
    family: { en: "Family", fr: "Famille" },
    travel: { en: "Travel", fr: "Voyage" },
  };

  return labels?.[category]?.[language] || category;
}

function PageHeader({ brand, title, subtitle }) {
  return (
    <div className="mb-8 max-w-3xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
        {brand}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
        {subtitle}
      </p>
    </div>
  );
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

function CategoryNavButton({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
        active
          ? "bg-blue-50 text-blue-800"
          : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className={active ? "font-semibold" : "font-medium"}>{label}</span>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
          active ? "bg-white text-blue-700" : "bg-slate-100 text-slate-600"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function SummaryStatCard({ label, value }) {
  return (
    <Card padding="lg">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
        {value}
      </p>
    </Card>
  );
}

function DocumentCard({
  doc,
  state,
  text,
  isPro,
  onGenerate,
  onReview,
  onMarkDraft,
  onMarkReviewed,
  onMarkCompleted,
  onReset,
  language,
}) {
  return (
    <Card padding="lg" className="h-full">
      <div className="flex h-full flex-col">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {doc.title[language]}
          </h3>

          <p className="mt-2 text-sm leading-7 text-slate-600">
            {doc.description[language]}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatPill active={state.drafted}>{text.markDraft}</StatPill>
            <StatPill active={state.reviewed}>{text.markReviewed}</StatPill>
            <StatPill active={state.completed}>{text.markCompleted}</StatPill>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="primary" onClick={onGenerate} fullWidth>
              {text.generate}
            </Button>

            <Button variant="secondary" onClick={onReview} fullWidth>
              {text.review}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="subtle" onClick={onMarkDraft} fullWidth>
              {text.markDraft}
            </Button>

            <Button variant="subtle" onClick={onMarkReviewed} fullWidth>
              {text.markReviewed}
            </Button>

            <Button variant="premium" onClick={onMarkCompleted} fullWidth>
              {text.markCompleted}
            </Button>
          </div>

          <Button variant="ghost" onClick={onReset} fullWidth>
            {text.reset}
          </Button>
        </div>

        {!isPro && (
          <div className="mt-5">
            <UpgradePrompt
              compact
              title={text.featureLocked}
              body={text.featureLockedBody}
              buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

export default function SelfDocumentsPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [engineVersion, setEngineVersion] = useState(0);
  const [access, setAccess] = useState(null);
  const [activeCategory, setActiveCategory] = useState(getCategoryOrder()[0]);

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

  const groupedDocuments = useMemo(() => {
    return getCategoryOrder().map((category) => ({
      category,
      label: getCategoryLabel(category, language),
      documents: DOCUMENT_LIBRARY.filter((doc) => doc.category === category),
    }));
  }, [language]);

  const activeGroup = useMemo(() => {
    return (
      groupedDocuments.find((group) => group.category === activeCategory) ||
      groupedDocuments[0]
    );
  }, [groupedDocuments, activeCategory]);

  function handleOpenGenerator(id) {
    if (!isPro) {
      navigate(buildProPricingPath("documents", "execute"));
      return;
    }

    navigate(
      `/documents/generator?checklist_id=${id}&source=documents&intent=execute`
    );
  }

  function handleOpenReview(id) {
    if (!isPro) {
      navigate(buildProPricingPath("documents", "improve"));
      return;
    }

    navigate(
      `/documents/review?checklist_id=${id}&source=documents&intent=improve`
    );
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
          "Naviguez par catégorie, suivez votre progression et préparez vos brouillons sans avoir à parcourir une longue page.",
        copilotTitle: "Copilote IA Documents",
        copilotDesc:
          "Obtenez une recommandation sur les documents à prioriser selon votre progression actuelle.",
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
        categoryTitle: "Catégories",
        documentsInCategory: "Documents dans cette catégorie",
        finalizeTitle: "Finalisez vos documents",
        finalizeBody:
          "Passez à Premium pour exporter vos documents en PDF prêt à être soumis.",
        upgradeToPremium: "Passer à Premium",
        noDocuments: "Aucun document dans cette catégorie.",
        sectionLabel: "Espace documentaire",
        categoryCount: "Catégorie",
        navTitle: "Navigation",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "My Documents",
      subtitle:
        "Navigate by category, track your progress, and prepare drafts without scrolling through a long page.",
      copilotTitle: "Documents AI Copilot",
      copilotDesc:
        "Get recommendations on which documents to prioritize based on your current progress.",
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
      categoryTitle: "Categories",
      documentsInCategory: "Documents in this category",
      finalizeTitle: "Finalize your documents",
      finalizeBody:
        "Upgrade to Premium to export clean, submission-ready PDFs.",
      upgradeToPremium: "Upgrade to Premium",
      noDocuments: "No documents in this category.",
      sectionLabel: "Document workspace",
      categoryCount: "Category",
      navTitle: "Navigation",
    };
  }, [language]);

  return (
    <Layout>
      <PageHeader
        brand={text.brand}
        title={text.title}
        subtitle={text.subtitle}
      />

      <AICopilotCard
        title={text.copilotTitle}
        description={text.copilotDesc}
        buttonLabel={text.copilotButton}
        language={language}
        prompt={
          language === "fr"
            ? "Analyse ma progression documentaire actuelle et indique-moi quelles catégories ou quels documents prioriser maintenant."
            : "Analyze my current document progress and tell me which categories or documents I should prioritize now."
        }
        className="mb-6"
      />

      {!isPro && (
        <UpgradePrompt
          className="mb-6"
          title={text.upgradeTitle}
          body={text.upgradeBody}
          buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
        />
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryStatCard label={text.total} value={stats.total} />
        <SummaryStatCard label={text.drafted} value={stats.drafted} />
        <SummaryStatCard label={text.reviewed} value={stats.reviewed} />
        <SummaryStatCard label={text.completed} value={stats.completed} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
        <div className="space-y-6">
          <Card padding="lg" className="xl:sticky xl:top-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {text.navTitle}
            </p>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 xl:hidden">
              {groupedDocuments.map((group) => (
                <button
                  key={group.category}
                  type="button"
                  onClick={() => setActiveCategory(group.category)}
                  className={`shrink-0 rounded-full border px-3 py-2 text-sm transition ${
                    activeCategory === group.category
                      ? "border-blue-200 bg-blue-50 text-blue-700 font-semibold"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {group.label}
                </button>
              ))}
            </div>

            <div className="mt-4 hidden space-y-1.5 xl:block">
              {groupedDocuments.map((group) => (
                <CategoryNavButton
                  key={group.category}
                  active={activeCategory === group.category}
                  label={group.label}
                  count={group.documents.length}
                  onClick={() => setActiveCategory(group.category)}
                />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card padding="lg">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                  {text.sectionLabel}
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                  {activeGroup?.label}
                </h2>
              </div>

              <div className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                {text.categoryCount}: {activeGroup?.documents?.length || 0}
              </div>
            </div>
          </Card>

          {activeGroup?.documents?.length ? (
            <div
              key={activeCategory}
              className="grid gap-5 md:grid-cols-2 animate-[fadeIn_.18s_ease-out]"
            >
              {activeGroup.documents.map((doc) => {
                const state = getDocumentState(engine, doc.id);

                return (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    state={state}
                    text={text}
                    isPro={isPro}
                    language={language}
                    onGenerate={() => handleOpenGenerator(doc.id)}
                    onReview={() => handleOpenReview(doc.id)}
                    onMarkDraft={() => handleMarkDraft(doc.id)}
                    onMarkReviewed={() => handleMarkReviewed(doc.id)}
                    onMarkCompleted={() => handleMarkCompleted(doc.id)}
                    onReset={() => resetDocument(doc.id)}
                  />
                );
              })}
            </div>
          ) : (
            <Card padding="lg">
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                {text.noDocuments}
              </div>
            </Card>
          )}
        </div>
      </div>

      {isPro && !isPremium && (
        <Card variant="premium" padding="lg" className="mt-10">
          <h3 className="text-xl font-semibold text-slate-900">
            {text.finalizeTitle}
          </h3>

          <p className="mt-2 text-sm text-slate-600">{text.finalizeBody}</p>

          <div className="mt-4 flex gap-3">
            <Button
              variant="premium"
              onClick={() =>
                navigate(buildPremiumPricingPath("documents", "export"))
              }
            >
              {text.upgradeToPremium}
            </Button>
          </div>
        </Card>
      )}
    </Layout>
  );
}