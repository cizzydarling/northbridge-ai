import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import LockBadge from "../components/ui/LockBadge";
import UpgradePrompt from "../components/UpgradePrompt";
import {
  getBillingAccess,
  getMyStrategyLite,
  getMyStrategy,
  sendAIMessage,
} from "../api";
import { getActiveCaseId } from "../utils/activeCase";

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
    id: "spouse_passport",
    category: "family",
    title: {
      en: "Spouse Passport / Identity Document",
      fr: "Passeport / pièce d’identité de l’époux(se)",
    },
    description: {
      en: "Identity document for the spouse or partner included in the application.",
      fr: "Pièce d’identité de l’époux(se) ou partenaire inclus(e) dans la demande.",
    },
  },
  {
    id: "spouse_police_certificate",
    category: "family",
    title: {
      en: "Spouse Police Certificate",
      fr: "Certificat de police de l’époux(se)",
    },
    description: {
      en: "Police certificate for the spouse or partner when required by the application type.",
      fr: "Certificat de police de l’époux(se) ou partenaire lorsque requis par le type de demande.",
    },
  },
  {
    id: "relationship_proof",
    category: "family",
    title: {
      en: "Marriage / Relationship Evidence",
      fr: "Preuve de mariage ou de relation",
    },
    description: {
      en: "Marriage certificate, common-law evidence, photos, joint accounts, or other relationship proof.",
      fr: "Certificat de mariage, preuves d’union de fait, photos, comptes conjoints ou autres preuves de relation.",
    },
  },
  {
    id: "child_passport",
    category: "family",
    title: {
      en: "Child Passport / Identity Document",
      fr: "Passeport / pièce d’identité de l’enfant",
    },
    description: {
      en: "Identity document for each dependent child included in the application.",
      fr: "Pièce d’identité de chaque enfant à charge inclus dans la demande.",
    },
  },
  {
    id: "child_birth_certificate",
    category: "family",
    title: {
      en: "Child Birth Certificate",
      fr: "Acte de naissance de l’enfant",
    },
    description: {
      en: "Birth certificate proving the relationship between the child and parent or guardian.",
      fr: "Acte de naissance prouvant le lien entre l’enfant et le parent ou tuteur.",
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
    <div className="mb-6 max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">
        {brand}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
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
      onClick={onClick}
      className={`grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-lg border px-4 py-3.5 text-left text-sm transition ${
        active
          ? "border-amber-200 bg-amber-50 font-semibold text-slate-950 shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span
        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
          active ? "bg-white text-amber-800" : "bg-slate-100 text-slate-500"
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

function ProgressBadge({ value, text }) {
  const percentage = Math.max(0, Math.min(100, Number(value || 0)));

  return (
    <Card padding="lg" className="border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
        {text.progressTitle}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {percentage}%
      </h2>
      <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        {text.progressBody}
      </p>
    </Card>
  );
}

function FirstRunHero({
  isPro,
  isPremium,
  text,
  onPrimary,
  onSecondary,
}) {
  const unlocked = isPro || isPremium;

  return (
    <Card
      padding="lg"
      className={`overflow-hidden ${
        unlocked
          ? "border-green-200 bg-gradient-to-br from-green-50 via-white to-white"
          : "border-blue-200 bg-gradient-to-br from-blue-50 via-white to-white"
      }`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div
            className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white ${
              unlocked ? "bg-green-600" : "bg-blue-600"
            }`}
          >
            {unlocked ? text.unlockedTitle : text.guidedTitle}
          </div>

          <h2 className="mt-4 text-[28px] font-semibold tracking-tight text-slate-900 md:text-[34px]">
            {unlocked ? text.unlockedHeadline : text.guidedHeadline}
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700">
            {unlocked ? text.unlockedBody : text.guidedBody}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <StatPill active={unlocked}>
              <LockBadge
                locked={!unlocked}
                label={unlocked ? text.unlockedBadge : text.lockedBadge}
                className="h-5 w-5"
              />
            </StatPill>
            {isPremium ? <StatPill active>{text.premiumBadge}</StatPill> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={onPrimary}>{text.primaryAction}</Button>
          <Button variant="secondary" onClick={onSecondary}>
            {text.secondaryAction}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function NextStepCard({ text, firstIncompleteDoc, onStart, onForms, onReview }) {
  return (
    <Card padding="lg" className="border-slate-200 bg-white">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {text.nextStepTitle}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {text.nextStepHeadline}
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        {firstIncompleteDoc
          ? `${text.nextStepBody} ${firstIncompleteDoc.title[text.language]}.`
          : text.nextStepNoDoc}
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Button onClick={onStart}>{text.primaryAction}</Button>
        <Button variant="secondary" onClick={onForms}>
          {text.formsAction}
        </Button>
        <Button variant="secondary" onClick={onReview}>
          {text.reviewAction}
        </Button>
      </div>
    </Card>
  );
}

function DashboardSectionTitle({ children }) {
  return (
    <h2 className="text-xl font-semibold tracking-tight text-slate-900">
      {children}
    </h2>
  );
}

function DocumentCard({
  doc,
  state,
  text,
  isPro,
  isCriticalFamilyRequirement = false,
  isHighlighted = false,
  onGenerate,
  onReview,
  onMarkDraft,
  onMarkReviewed,
  onMarkCompleted,
  onReset,
  language,
}) {
  const progressCount = [
    state.drafted,
    state.reviewed,
    state.completed,
  ].filter(Boolean).length;

  return (
    <Card
      padding="lg"
      className={`h-full transition hover:shadow-md ${
        isHighlighted
          ? "border-blue-300 bg-blue-50/80 ring-2 ring-blue-200 shadow-lg"
          : isCriticalFamilyRequirement && !state.completed
          ? "border-red-300 bg-red-50/70 ring-2 ring-red-200 shadow-md"
          : ""
      }`}
    >
      <div className="flex h-full flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {doc.title[language]}
              </h3>

              {isCriticalFamilyRequirement && !state.completed ? (
                <span className="mt-2 inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                  {language === "fr" ? "Critique" : "Critical"}
                </span>
              ) : null}
              {isHighlighted ? (
                <span className="ml-2 mt-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                  {language === "fr" ? "Cible IA" : "AI target"}
                </span>
              ) : null}
            </div>

            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {progressCount}/3
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {doc.description[language]}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <StatPill active={state.drafted}>{text.markDraft}</StatPill>
            <StatPill active={state.reviewed}>{text.markReviewed}</StatPill>
            <StatPill active={state.completed}>{text.markCompleted}</StatPill>
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
        </div>

        <div className="mt-5 space-y-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="primary" onClick={onGenerate} className="w-full justify-center">
              {text.generate}
            </Button>

            <Button variant="secondary" onClick={onReview} className="w-full justify-center">
              {text.review}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="subtle" onClick={onMarkDraft}>
              {text.markDraft}
            </Button>

            <Button variant="subtle" onClick={onMarkReviewed}>
              {text.markReviewed}
            </Button>

            <Button variant="premium" onClick={onMarkCompleted}>
              {text.markCompleted}
            </Button>
          </div>

          <Button variant="ghost" onClick={onReset} className="w-full justify-center">
            {text.reset}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function formatDocumentBannerValue(value) {
  if (value === null || typeof value === "undefined" || value === "") return "--";
  return value;
}

function getStrategyPathwayName(strategy, pathway) {
  return (
    pathway ||
    strategy?.best_pathway?.name ||
    strategy?.best_pathway?.pathway ||
    strategy?.top_recommendation?.name ||
    strategy?.top_recommendation?.pathway ||
    strategy?.recommended_programs?.[0] ||
    strategy?.pathways?.[0] ||
    null
  );
}

function getStrategyNocLabel(strategy) {
  const noc =
    strategy?.noc_profile ||
    strategy?.noc_summary ||
    strategy?.noc_advantage ||
    {};

  const code =
    noc.resolved_noc_code ||
    noc.noc_code ||
    noc.suggested_noc_code ||
    noc.entered_noc_code;
  const title =
    noc.resolved_title ||
    noc.noc_title ||
    noc.suggested_title ||
    strategy?.profile_snapshot?.resolved_noc_title ||
    strategy?.profile_snapshot?.occupation;

  if (code && title) return `${code} - ${title}`;
  return code || title || null;
}

function PathwayBanner({ pathway, strategy, activeCaseId, language }) {
  const pathwayName = getStrategyPathwayName(strategy, pathway);
  const crsScore = strategy?.crs_score;
  const nocLabel = getStrategyNocLabel(strategy);

  if (!pathwayName && !crsScore && !nocLabel && !activeCaseId) return null;

  const text =
    language === "fr"
      ? {
          eyebrow: activeCaseId ? "Dossier actif" : "Espace documents",
          title: "Votre dossier documentaire est aligné à votre stratégie",
          body:
            "Utilisez ces signaux pour prioriser les documents qui renforcent le parcours, le CNP et la préparation du dossier.",
          score: "Score CRS",
          noc: "CNP",
          pathway: "Parcours",
        }
      : {
          eyebrow: activeCaseId ? "Active application" : "Document workspace",
          title: "Your document file is aligned to your strategy",
          body:
            "Use these signals to prioritize documents that support the pathway, NOC, and case readiness.",
          score: "CRS Score",
          noc: "NOC",
          pathway: "Pathway",
        };

  return (
    <Card
      padding="lg"
      className="mb-6 overflow-hidden border-slate-800 bg-[#172033] text-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">
            {text.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            {text.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/72">{text.body}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
          {[
            [text.score, crsScore],
            [text.noc, nocLabel],
            [text.pathway, pathwayName],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-white/10 bg-white/[0.07] px-4 py-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                {label}
              </p>
              <p className="mt-2 break-words text-sm font-semibold leading-5 text-white">
                {formatDocumentBannerValue(value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function DocumentsAIDrawer({
  open,
  onClose,
  language,
  stats,
  overallProgress,
  firstIncompleteDoc,
  isPro,
  onNavigate,
}) {
  const text =
    language === "fr"
      ? {
          title: "Assistant IA Documents",
          subtitle:
            "Obtenez une recommandation claire sur le prochain document à préparer, réviser ou finaliser.",
          close: "Fermer",
          next: "Prochaine priorité",
          why: "Pourquoi c’est important",
          actions: "Actions recommandées",
          noDoc:
            "Tous vos documents semblent complétés. Passez à la révision finale ou à l’export.",
          locked:
            "La génération et la révision IA complètes nécessitent le forfait Pro.",
          generate: "Générer ce document",
          review: "Réviser ce document",
          pricing: "Voir les tarifs",
        }
      : {
          title: "Documents AI Assistant",
          subtitle:
            "Get a clear recommendation on the next document to prepare, review, or finalize.",
          close: "Close",
          next: "Next priority",
          why: "Why this matters",
          actions: "Recommended actions",
          noDoc:
            "Your documents look completed. Move to final review or export.",
          locked:
            "Full AI generation and review require the Pro plan.",
          generate: "Generate this document",
          review: "Review this document",
          pricing: "View pricing",
        };

  const docTitle = firstIncompleteDoc?.title?.[language];

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/35 transition-opacity duration-300 ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-xl transform flex-col border-l border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
                NorthBridgeAI
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {text.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {text.subtitle}
              </p>
            </div>

            <Button variant="ghost" size="sm" onClick={onClose}>
              {text.close}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {language === "fr" ? "État actuel" : "Current state"}
            </p>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {overallProgress < 30
                ? language === "fr"
                  ? "Vous commencez votre dossier."
                  : "You are just getting started."
                : overallProgress < 70
                ? language === "fr"
                  ? "Votre dossier prend forme."
                  : "Your case is taking shape."
                : language === "fr"
                ? "Vous êtes proche de finaliser."
                : "You are close to finalizing your case."}
            </div>
          </div>
          <div className="space-y-3 mt-6">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {language === "fr" ? "Blocage principal" : "Main blocker"}
            </p>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {firstIncompleteDoc
                ? language === "fr"
                  ? `Vous devez compléter: ${firstIncompleteDoc.title[language]}`
                  : `You need to complete: ${firstIncompleteDoc.title[language]}`
                : language === "fr"
                ? "Aucun blocage détecté."
                : "No blockers detected."}
            </div>
          </div>
          <div className="space-y-3 mt-6">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {language === "fr" ? "Prochaine action" : "Next best action"}
            </p>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm text-slate-800">
                {firstIncompleteDoc
                  ? language === "fr"
                    ? `Commencez avec ${firstIncompleteDoc.title[language]}`
                    : `Start with ${firstIncompleteDoc.title[language]}`
                  : language === "fr"
                  ? "Passez à la révision finale de vos documents."
                  : "Move to final review of your documents."}
              </p>

              <div className="mt-4">
                <Button
                  onClick={() =>
                    firstIncompleteDoc
                      ? onNavigate(`/documents/generator?checklist_id=${firstIncompleteDoc.id}`)
                      : onNavigate("/documents/review")
                  }
                  className="w-full justify-center"
                >
                  {language === "fr" ? "Continuer" : "Continue"}
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <MiniDrawerStat label="Drafted" value={stats.drafted} />
            <MiniDrawerStat label="Reviewed" value={stats.reviewed} />
            <MiniDrawerStat label="Done" value={stats.completed} />
          </div>

          <div className="mt-5 rounded-[24px] border border-blue-200 bg-blue-50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
              {text.next}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {docTitle || text.noDoc}
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {docTitle
                ? language === "fr"
                  ? `Ce document est la prochaine pièce à avancer selon votre progression actuelle (${overallProgress}%).`
                  : `This document is the next item to move forward based on your current progress (${overallProgress}%).`
                : text.noDoc}
            </p>
          </div>

          <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {text.why}
            </p>
            <div className="mt-3 space-y-2">
              {(language === "fr"
                ? [
                    "Un dossier clair réduit les incohérences.",
                    "Les documents préparés tôt accélèrent l’exécution.",
                    "La révision IA aide à repérer les lacunes avant la soumission.",
                  ]
                : [
                    "A clear file reduces inconsistencies.",
                    "Preparing documents early speeds up execution.",
                    "AI review helps identify gaps before submission.",
                  ]
              ).map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          {!isPro ? (
            <div className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm leading-7 text-amber-900">{text.locked}</p>
              <div className="mt-4">
                <Button
                  variant="premium"
                  onClick={() => onNavigate(buildProPricingPath("documents", "execute"))}
                >
                  {text.pricing}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-200 px-6 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="premium"
              onClick={() =>
                firstIncompleteDoc
                  ? onNavigate(`/documents/generator?checklist_id=${firstIncompleteDoc.id}&source=documents&intent=execute`)
                  : onNavigate("/documents/generator")
              }
            >
              {text.generate}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                firstIncompleteDoc
                  ? onNavigate(`/documents/review?checklist_id=${firstIncompleteDoc.id}&source=documents&intent=improve`)
                  : onNavigate("/documents/review")
              }
            >
              {text.review}
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

function MiniDrawerStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function getSmartMomentum({
  stats,
  overallProgress,
  firstIncompleteDoc,
  language,
}) {
  const completed = Number(stats?.completed || 0);
  const total = Number(stats?.total || 0);
  const docTitle = firstIncompleteDoc?.title?.[language];

  if (completed >= total && total > 0) {
    return {
      title: language === "fr" ? "Prêt pour la finalisation" : "Ready to finalize",
      body:
        language === "fr"
          ? "Vos documents principaux sont complétés. Passez à la révision finale."
          : "Your main documents are completed. Move to final review.",
      tone: "success",
    };
  }

  if (overallProgress < 30) {
    return {
      title: language === "fr" ? "Démarrage du dossier" : "Case getting started",
      body: docTitle
        ? language === "fr"
          ? `Commencez avec ${docTitle}.`
          : `Start with ${docTitle}.`
        : language === "fr"
        ? "Commencez par les documents de base."
        : "Start with the core documents.",
      tone: "default",
    };
  }

  return {
    title: language === "fr" ? "Progression active" : "Active momentum",
    body: docTitle
      ? language === "fr"
        ? `Continuez avec ${docTitle}.`
        : `Continue with ${docTitle}.`
      : language === "fr"
      ? "Continuez à compléter les documents restants."
      : "Keep completing the remaining documents.",
    tone: "info",
  };
}



function detectCriticalDocumentGaps({ strategy, engine, language }) {
  const completed = (id) => Boolean(engine?.[id]?.completed);

  const strategyText = [
    strategy?.best_pathway?.name,
    ...(Array.isArray(strategy?.recommended_programs)
      ? strategy.recommended_programs
      : []),
    ...(Array.isArray(strategy?.weaknesses) ? strategy.weaknesses : []),
    ...(Array.isArray(strategy?.next_steps) ? strategy.next_steps : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const gaps = [];

  const addGap = (id, en, fr, reasonEn, reasonFr) => {
    if (!completed(id)) {
      gaps.push({
        id,
        title: language === "fr" ? fr : en,
        reason: language === "fr" ? reasonFr : reasonEn,
      });
    }
  };

  if (
    strategyText.includes("express entry") ||
    strategyText.includes("crs") ||
    Number(strategy?.crs_score || 0) > 0
  ) {
    addGap(
      "language_results",
      "Language results missing",
      "Résultats linguistiques manquants",
      "Language proof is usually critical for CRS-based pathways.",
      "Les preuves linguistiques sont souvent essentielles pour les parcours basés sur le CRS."
    );

    addGap(
      "education_records",
      "Education records missing",
      "Preuves d’études manquantes",
      "Education evidence supports points, eligibility, and credibility.",
      "Les preuves d’études soutiennent les points, l’admissibilité et la crédibilité."
    );

    addGap(
      "work_experience_records",
      "Work experience proof missing",
      "Preuves d’expérience manquantes",
      "Work evidence is central to skilled immigration credibility.",
      "Les preuves d’expérience sont centrales pour la crédibilité en immigration qualifiée."
    );
  }

  if (
    strategyText.includes("pnp") ||
    strategyText.includes("provincial") ||
    strategyText.includes("province") ||
    strategyText.includes("british columbia") ||
    strategyText.includes("ontario")
  ) {
    addGap(
      "work_experience_records",
      "Province-aligned work proof missing",
      "Preuves d’emploi alignées à la province manquantes",
      "Provincial pathways often depend on occupation fit and strong employment evidence.",
      "Les voies provinciales dépendent souvent de l’adéquation professionnelle et de preuves d’emploi solides."
    );
  }

  if (
    strategyText.includes("fund") ||
    strategyText.includes("financial") ||
    strategyText.includes("fonds") ||
    strategyText.includes("financier")
  ) {
    addGap(
      "proof_of_funds",
      "Proof of funds missing",
      "Preuve de fonds manquante",
      "Financial evidence may be needed to support readiness and admissibility.",
      "Les preuves financières peuvent soutenir la préparation et l’admissibilité."
    );
  }

  return gaps.slice(0, 3);
}

function buildSubmissionReadiness({
  stats,
  familyRequirements,
  engine,
  strategy,
  formsPreview,
  language,
}) {
  const missingCriticalDocs = familyRequirements.filter((item) => {
    const state = getDocumentState(engine, item.id);
    return !state.completed;
  });
  const missingFormFields = Array.isArray(formsPreview?.missing_fields)
  ? formsPreview.missing_fields
  : [];

  const totalDocs = Number(stats?.total || 0);
  const completedDocs = Number(stats?.completed || 0);
  const reviewedDocs = Number(stats?.reviewed || 0);

  const completionScore =
    totalDocs > 0 ? Math.round((completedDocs / totalDocs) * 60) : 0;

  const reviewScore =
    totalDocs > 0 ? Math.round((reviewedDocs / totalDocs) * 25) : 0;

  const criticalPenalty = missingCriticalDocs.length * 15;
  const formsPenalty = missingFormFields.length * 5;

  const strategyScore = strategy ? 15 : 0;

  const rawScore =
  completionScore +
  reviewScore +
  strategyScore -
  criticalPenalty -
  formsPenalty;

  const score = Math.max(0, Math.min(100, rawScore));

  const blockers = missingCriticalDocs.map((item) => ({
    id: item.id,
    label: item.label,
    reason:
      language === "fr"
        ? "Document critique requis avant finalisation."
        : "Critical document required before finalization.",
  }));

  if (missingFormFields.length > 0) {
    blockers.push({
      id: "forms_missing",
      label:
        language === "fr"
          ? "Champs de formulaires manquants"
          : "Missing form fields",
      reason:
        language === "fr"
          ? "Certains formulaires ne sont pas encore complets."
          : "Some forms are not complete yet.",
    });
  }

  if (completedDocs < totalDocs) {
    blockers.push({
      id: "incomplete_documents",
      label:
        language === "fr"
          ? "Documents non complétés"
          : "Incomplete documents",
      reason:
        language === "fr"
          ? "Tous les documents requis ne sont pas encore marqués comme complétés."
          : "Not all required documents are marked as completed yet.",
    });
  }

  const status =
    score >= 85 && blockers.length === 0
      ? "ready"
      : score >= 60
      ? "almost"
      : "not_ready";

  return {
    score,
    status,
    blockers,
    missingCriticalDocs,
    nextAction:
      blockers[0]?.label ||
      (language === "fr"
        ? "Réviser le dossier final"
        : "Review final package"),
  };
}

function parseFixPlan(raw) {
  if (!raw) return {};

  const targetMatch = raw.match(/target:\s*(document|form|review)/i);
  const idMatch = raw.match(/target_id:\s*([\w-]+)/i);

  return {
    target: targetMatch?.[1]?.toLowerCase() || null,
    targetId: idMatch?.[1] || null,
  };
}

export default function SelfDocumentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";
  const [strategy, setStrategy] = useState(null);

  const [activeCaseId, setActiveCaseId] = useState(getActiveCaseId());
  const [fixingCase, setFixingCase] = useState(false);
  const [fixCaseResult, setFixCaseResult] = useState("");
  const [fixCaseAction, setFixCaseAction] = useState(null);
  const [suggestedAction, setSuggestedAction] = useState(null);
  const [highlightedDocId, setHighlightedDocId] = useState(null);

  const pathway = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("pathway");
  }, [location.search]);

  const [engineVersion, setEngineVersion] = useState(0);
  const [access, setAccess] = useState(null);
  const [activeCategory, setActiveCategory] = useState(getCategoryOrder()[0]);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  const loadAccess = useCallback(async () => {
    try {
      const [accessRes, strategyLiteRes] = await Promise.allSettled([
        getBillingAccess(),
        getMyStrategyLite(language),
      ]);

      if (accessRes.status === "fulfilled") {
        setAccess(accessRes.value.data);
      } else {
        setAccess(null);
      }

      if (strategyLiteRes.status === "fulfilled") {
        setStrategy(strategyLiteRes.value?.data || null);
      } else {
        try {
          const strategyRes = await getMyStrategy(language);
          setStrategy(strategyRes?.data || null);
        } catch {
          setStrategy(null);
        }
      }
    } catch (err) {
      console.error(err);
      setAccess(null);
      setStrategy(null);
    }
  }, [language]);

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
  }, [language, activeCaseId, loadAccess]);

  useEffect(() => {
  function handleActiveCaseUpdate() {
    setActiveCaseId(getActiveCaseId());
    loadAccess();
  }

  window.addEventListener("nbai-active-case-updated", handleActiveCaseUpdate);

  return () => {
    window.removeEventListener("nbai-active-case-updated", handleActiveCaseUpdate);
  };
  }, [loadAccess]);

  const engine = useMemo(() => {
    void engineVersion;
    return readCompletionEngine();
  }, [engineVersion]);
  const familyRequirements = useMemo(
    () =>
      Array.isArray(strategy?.family_document_requirements)
        ? strategy.family_document_requirements
        : [],
    [strategy?.family_document_requirements]
  );

  function readFormsPreview() {
    try {
      return JSON.parse(localStorage.getItem("nbai_forms_preview_v1") || "null");
    } catch {
      return null;
    }
  }

  const familyRequirementIds = useMemo(() => {
    return new Set(familyRequirements.map((item) => item.id));
  }, [familyRequirements]);

  const isPro = Boolean(access?.is_pro || access?.is_premium);
  const isPremium = Boolean(access?.is_premium);

  const criticalGaps = useMemo(() => {
  return detectCriticalDocumentGaps({
    strategy,
    engine,
    language,
  });
}, [strategy, engine, language]);

  const stats = useMemo(() => {
    const states = DOCUMENT_LIBRARY.map((doc) =>
      getDocumentState(engine, doc.id)
    );

    return {
      total: DOCUMENT_LIBRARY.length,
      drafted: states.filter((item) => item.drafted).length,
      reviewed: states.filter((item) => item.reviewed).length,
      completed: states.filter((item) => item.completed).length,
    };
  }, [engine]);

  const formsPreview = useMemo(() => {
    void engineVersion;
    return readFormsPreview();
  }, [engineVersion]);

  const submissionReadiness = useMemo(() => {
    return buildSubmissionReadiness({
      stats,
      familyRequirements,
      engine,
      strategy,
      formsPreview,
      language,
    });
  }, [stats, familyRequirements, engine, strategy, formsPreview, language]);

  const overallProgress = useMemo(() => {
    const totalPossible = DOCUMENT_LIBRARY.length * 3;
    const done = stats.drafted + stats.reviewed + stats.completed;
    return totalPossible > 0 ? Math.round((done / totalPossible) * 100) : 0;
  }, [stats]);

  const groupedDocuments = useMemo(() => {
    return getCategoryOrder().map((category) => ({
      category,
      label: getCategoryLabel(category, language),
      documents: DOCUMENT_LIBRARY
        .filter((doc) => doc.category === category)
        .sort((a, b) => {
          const aCritical = criticalGaps.some((g) => g.id === a.id);
          const bCritical = criticalGaps.some((g) => g.id === b.id);

          if (aCritical && !bCritical) return -1;
          if (!aCritical && bCritical) return 1;
          return 0;
        }),
    }));
  }, [language, criticalGaps]);

  const activeGroup = useMemo(() => {
    return (
      groupedDocuments.find((group) => group.category === activeCategory) ||
      groupedDocuments[0]
    );
  }, [groupedDocuments, activeCategory]);

  const activeGroupStats = useMemo(() => {
    const documents = activeGroup?.documents || [];
    const completed = documents.filter(
      (doc) => getDocumentState(engine, doc.id).completed
    ).length;

    return {
      total: documents.length,
      completed,
      remaining: Math.max(0, documents.length - completed),
    };
  }, [activeGroup, engine]);

  const firstIncompleteDoc = useMemo(() => {
    const priorityMap = {
      "Express Entry": [
        "language_results",
        "work_experience_records",
        "education_records",
        "proof_of_funds",
      ],
      PNP: [
        "work_experience_records",
        "proof_of_funds",
        "education_records",
      ],
    };


    const priorities = pathway ? priorityMap[pathway] || [] : [];

    const orderedDocs = [...priorities, ...DOCUMENT_LIBRARY.map((d) => d.id)];

    return orderedDocs
      .map((id) => DOCUMENT_LIBRARY.find((doc) => doc.id === id))
      .find((doc) => {
        if (!doc) return false;
        const state = getDocumentState(engine, doc.id);
        return !state.completed;
      });
  }, [engine, pathway]);

  const smartMomentum = useMemo(() => {
    return getSmartMomentum({
      stats,
      overallProgress,
      firstIncompleteDoc,
      language,
    });
  }, [stats, overallProgress, firstIncompleteDoc, language]);

  function handleOpenGenerator(id) {
    if (!isPro) {
      navigate(buildProPricingPath("documents", "execute"));
      return;
    }

    navigate(
      `/documents/generator?checklist_id=${id}&source=documents&intent=execute${
        pathway ? `&pathway=${encodeURIComponent(pathway)}` : ""
      }`
    );
  }

  function handleOpenReview(id) {
    if (!isPro) {
      navigate(buildProPricingPath("documents", "improve"));
      return;
    }

    navigate(
      `/documents/review?checklist_id=${id}&source=documents&intent=improve${
        pathway ? `&pathway=${encodeURIComponent(pathway)}` : ""
      }`
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

  async function handleFixMyCase() {
    try {
      setFixingCase(true);
      setFixCaseResult("");
      setFixCaseAction(null);

      const prompt =
        language === "fr"
          ? `
  Tu es le copilote de préparation NorthBridgeAI.

  Analyse ce dossier et donne un plan d'action très concret pour corriger les problèmes avant soumission.

  Contexte:
  - Score de préparation: ${submissionReadiness.score}%
  - Statut: ${submissionReadiness.status}
  - Bloqueurs: ${submissionReadiness.blockers
              .map((b) => `${b.label}: ${b.reason}`)
              .join(" | ") || "aucun"}
  - Documents critiques familiaux: ${familyRequirements
              .map((d) => `${d.label} (${d.status || "missing"})`)
              .join(" | ") || "aucun"}
  - Champs de formulaires manquants: ${
              Array.isArray(formsPreview?.missing_fields)
                ? formsPreview.missing_fields
                    .map((item) =>
                      typeof item === "string"
                        ? item
                        : `${item.form_code || ""} ${item.field || ""}`.trim()
                    )
                    .join(" | ")
                : "aucun"
            }

  Réponds avec:
  1. Résumé du risque
  2. Les 3 corrections prioritaires
  3. La prochaine action exacte
  4. target: document, form, or review
  5. target_id: l’identifiant du document si target=document
          `.trim()
          : `
  You are the NorthBridgeAI case preparation copilot.

  Analyze this case and give a very concrete action plan to fix issues before submission.

  Context:
  - Readiness score: ${submissionReadiness.score}%
  - Status: ${submissionReadiness.status}
  - Blockers: ${submissionReadiness.blockers
              .map((b) => `${b.label}: ${b.reason}`)
              .join(" | ") || "none"}
  - Critical family documents: ${familyRequirements
              .map((d) => `${d.label} (${d.status || "missing"})`)
              .join(" | ") || "none"}
  - Missing form fields: ${
              Array.isArray(formsPreview?.missing_fields)
                ? formsPreview.missing_fields
                    .map((item) =>
                      typeof item === "string"
                        ? item
                        : `${item.form_code || ""} ${item.field || ""}`.trim()
                    )
                    .join(" | ")
                : "none"
            }

  Respond with:
  1. Risk summary
  2. Top 3 priority fixes
  3. Exact next action
  4. target: document, form, or review
  5. target_id: document id if target=document
          `.trim();

      const res = await sendAIMessage({
        message: prompt,
        chat_history: [],
        language,
      });

      const reply = res?.data?.reply || "";

      const parsed = parseFixPlan(reply);

      setFixCaseResult(reply);
      setFixCaseAction(parsed);
      setSuggestedAction(parsed);
      if (parsed?.target === "document" && parsed?.targetId) {
        setHighlightedDocId(parsed.targetId);

        const targetDoc = DOCUMENT_LIBRARY.find((doc) => doc.id === parsed.targetId);
        if (targetDoc?.category) {
          setActiveCategory(targetDoc.category);
        }
      }
    } catch (err) {
      console.error(err);
      setFixCaseResult(
        language === "fr"
          ? "Impossible de générer le plan de correction pour le moment."
          : "Unable to generate the fix plan right now."
      );
    } finally {
      setFixingCase(false);
    }
  }

  const text = useMemo(() => {
    if (language === "fr") {
      return {
        language,
        brand: "NorthBridgeAI",
        title: "Mes documents",
        subtitle:
          "Passez à l’exécution. Préparez, révisez et finalisez vos documents étape par étape.",
        upgradeTitle: "Débloquez la génération de documents",
        upgradeBody:
          "Passez à Pro pour générer et réviser vos documents avec l’IA.",
        featureLocked: "Accès Pro requis",
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
        finalizeTitle: "Finalisez vos documents",
        finalizeBody:
          "Passez à Premium pour exporter vos documents en PDF prêt à être soumis.",
        upgradeToPremium: "Passer à Premium",
        noDocuments: "Aucun document dans cette catégorie.",
        sectionLabel: "Espace documentaire",
        navTitle: "Navigation",
        progressTitle: "Progression",
        progressBody:
          "Suivez l’avancement global de vos brouillons, révisions et documents finalisés.",
        guidedTitle: "Flux guidé",
        unlockedTitle: "Accès débloqué",
        guidedHeadline: "Commencez par votre document prioritaire",
        unlockedHeadline: "Vos outils documents sont disponibles",
        guidedBody:
          "Ouvrez le générateur, révisez vos documents et marquez votre progression au fur et à mesure.",
        unlockedBody:
          "Générez, révisez et organisez vos documents plus rapidement avec un workflow orienté exécution.",
        lockedBadge: "Pro requis",
        unlockedBadge: "Exécution débloquée",
        premiumBadge: "Premium actif",
        primaryAction: "Ouvrir le générateur",
        secondaryAction: "Assistant IA Documents",
        nextStepTitle: "Étape recommandée",
        nextStepHeadline: "Voici votre meilleure prochaine action",
        nextStepBody: "Le prochain document à traiter est",
        nextStepNoDoc:
          "Tous vos documents semblent complétés. Vous pouvez maintenant revoir ou finaliser votre dossier.",
        formsAction: "Forms Studio",
        reviewAction: "Révision IA",
      };
    }

    return {
      language,
      brand: "NorthBridgeAI",
      title: "My Documents",
      subtitle:
        "Move into execution. Prepare, review, and finalize your documents step by step.",
      upgradeTitle: "Unlock document generation",
      upgradeBody:
        "Upgrade to Pro to generate and review your documents with AI.",
      featureLocked: "Pro access required",
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
      finalizeTitle: "Finalize your documents",
      finalizeBody:
        "Upgrade to Premium to export clean, submission-ready PDFs.",
      upgradeToPremium: "Upgrade to Premium",
      noDocuments: "No documents in this category.",
      sectionLabel: "Document workspace",
      navTitle: "Navigation",
      progressTitle: "Progress",
      progressBody:
        "Track your overall draft, review, and completion progress across the document workspace.",
      guidedTitle: "Guided workflow",
      unlockedTitle: "Access unlocked",
      guidedHeadline: "Start with your highest-priority document",
      unlockedHeadline: "Your document tools are available",
      guidedBody:
        "Open the generator, review your documents, and mark progress as your case moves forward.",
      unlockedBody:
        "Generate, review, and organize your documents faster with an execution-focused workflow.",
      lockedBadge: "Pro required",
      unlockedBadge: "Execution unlocked",
      premiumBadge: "Premium active",
      primaryAction: "Open generator",
      secondaryAction: "Documents AI Assistant",
      nextStepTitle: "Recommended next step",
      nextStepHeadline: "Here is your best next action",
      nextStepBody: "The next document to work on is",
      nextStepNoDoc:
        "Your documents look completed. You can now review or finalize your case.",
      formsAction: "Forms Studio",
      reviewAction: "AI Review",
    };
  }, [language]);

  return (
    <Layout>
      <PageHeader brand={text.brand} title={text.title} subtitle={text.subtitle} />

      <PathwayBanner
        pathway={pathway}
        strategy={strategy}
        activeCaseId={activeCaseId}
        language={language}
      />

      <FirstRunHero
        isPro={isPro}
        isPremium={isPremium}
        text={text}
        onPrimary={() =>
          firstIncompleteDoc
            ? handleOpenGenerator(firstIncompleteDoc.id)
            : navigate("/documents/generator")
        }
        onSecondary={() => setAiDrawerOpen(true)}
      />

      {!isPro && (
        <UpgradePrompt
          className="mb-6 mt-6"
          title={text.upgradeTitle}
          body={text.upgradeBody}
          buttonLabel={language === "fr" ? "Voir les tarifs" : "View pricing"}
        />
      )}

      <div className="mb-6 mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryStatCard label={text.total} value={stats.total} />
        <SummaryStatCard label={text.drafted} value={stats.drafted} />
        <SummaryStatCard label={text.reviewed} value={stats.reviewed} />
        <SummaryStatCard label={text.completed} value={stats.completed} />
        <ProgressBadge value={overallProgress} text={text} />
      </div>

      {familyRequirements.filter((item) => {
        const state = getDocumentState(engine, item.id);
        return !state.completed;
      }).length > 0 && (
        <Card padding="md" className="mb-6 border-red-200 bg-red-50/70">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-700">
            {language === "fr"
              ? "Documents critiques manquants"
              : "Critical missing documents"}
          </p>

          <div className="mt-3 space-y-2">
            {familyRequirements
              .filter((item) => {
                const state = getDocumentState(engine, item.id);
                return !state.completed;
              })
              .map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm text-red-800"
                >
                  {item.label}
                </div>
              ))}
          </div>
        </Card>
      )}

      <Card
        padding="md"
        className={`mb-6 transition-all duration-300 hover:shadow-md ${
          smartMomentum.tone === "success"
            ? "border-emerald-200 bg-emerald-50/60"
            : smartMomentum.tone === "warning"
            ? "border-amber-200 bg-amber-50/60"
            : smartMomentum.tone === "info"
            ? "border-blue-200 bg-blue-50/60"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {language === "fr" ? "Dynamique du dossier" : "Case momentum"}
        </p>

        <p className="mt-1 text-base font-semibold text-slate-900">
          {smartMomentum.title}
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-700">
          {smartMomentum.body}
        </p>

        {/* 👇 THIS is the upgrade */}
        <div className="mt-4 flex gap-2">
          {firstIncompleteDoc && (
            <Button
              variant="primary"
              onClick={() => handleOpenGenerator(firstIncompleteDoc.id)}
            >
              {language === "fr" ? "Continuer" : "Continue"}
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={() => navigate("/documents/review")}
          >
            {language === "fr" ? "Révision IA" : "AI Review"}
          </Button>
        </div>
      </Card>

      {criticalGaps.length > 0 && (
        <Card
          padding="md"
          className="mb-6 border-red-200 bg-red-50/60 transition-all duration-300 hover:shadow-md"
        >
          <p className="text-xs uppercase tracking-wide text-red-600">
            {language === "fr" ? "Documents critiques manquants" : "Critical missing documents"}
          </p>

          <div className="mt-3 space-y-3">
            {criticalGaps.map((gap) => (
              <div
                key={gap.id}
                className="rounded-2xl border border-red-100 bg-white p-4"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {gap.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {gap.reason}
                </p>

                <div className="mt-3">
                  <Button size="sm" onClick={() => handleOpenGenerator(gap.id)}>
                    {language === "fr" ? "Préparer maintenant" : "Prepare now"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card
        padding="lg"
        className={`mb-6 ${
          submissionReadiness.status === "ready"
            ? "border-emerald-200 bg-emerald-50/70"
            : submissionReadiness.status === "almost"
            ? "border-amber-200 bg-amber-50/70"
            : "border-red-200 bg-red-50/70"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {language === "fr" ? "Préparation à la soumission" : "Submission readiness"}
        </p>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              {submissionReadiness.score}%
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-700">
              {submissionReadiness.status === "ready"
                ? language === "fr"
                  ? "Votre dossier semble prêt pour une révision finale."
                  : "Your case appears ready for final review."
                : submissionReadiness.status === "almost"
                ? language === "fr"
                  ? "Votre dossier est proche, mais certains points doivent être réglés."
                  : "Your case is close, but some items still need attention."
                : language === "fr"
                ? "Votre dossier n’est pas encore prêt à être soumis."
                : "Your case is not ready for submission yet."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
          <Button
            variant={
              submissionReadiness.status === "ready" ? "primary" : "secondary"
            }
            onClick={() => navigate("/forms")}
          >
            {language === "fr" ? "Vérifier les formulaires" : "Check forms"}
          </Button>

          <Button
            variant="premium"
            loading={fixingCase}
            onClick={handleFixMyCase}
          >
            {fixingCase
              ? language === "fr"
                ? "Analyse..."
                : "Analyzing..."
              : language === "fr"
              ? "Corriger mon dossier"
              : "Fix my case"}
          </Button>
        </div>
        </div>

        {submissionReadiness.blockers.length > 0 ? (
          <div className="mt-5 space-y-2">
            {submissionReadiness.blockers.slice(0, 4).map((blocker) => (
              <div
                key={blocker.id}
                className="rounded-2xl border border-white/70 bg-white px-4 py-3"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {blocker.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {blocker.reason}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {fixCaseResult ? (
        <div className="mt-5 rounded-2xl border border-blue-200 bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            {language === "fr" ? "Plan IA de correction" : "AI fix plan"}
          </p>
          <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">
            {fixCaseResult}
          </p>
          {fixCaseAction?.target ? (
            <div className="mt-4">
              <Button
                variant="premium"
                onClick={() => {
                  if (fixCaseAction.target === "document") {
                    navigate(
                      `/documents/generator?checklist_id=${fixCaseAction.targetId}&auto_focus=true&source=fix_case`
                    );
                    return;
                  }

                  if (fixCaseAction.target === "form") {
                    navigate("/forms");
                    return;
                  }

                  if (fixCaseAction.target === "review") {
                    navigate(`/documents/review?checklist_id=${fixCaseAction.targetId}&source=fix_case&intent=fix`);
                  }
                }}
              >
                {language === "fr" ? "Corriger maintenant" : "Fix now"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      </Card>

      {suggestedAction?.target && (
        <Card
          padding="md"
          className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-white"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                {language === "fr" ? "Action recommandée" : "Recommended action"}
              </p>

              <p className="mt-1 text-sm text-slate-700">
                {language === "fr"
                  ? "Corrigez ce point pour améliorer votre dossier."
                  : "Fix this item to improve your case."}
              </p>
            </div>

            <Button
              variant="primary"
              onClick={() => {
                if (suggestedAction.target === "document") {
                  handleOpenGenerator(suggestedAction.targetId);
                }

                if (suggestedAction.target === "form") {
                  navigate("/forms");
                }

                if (suggestedAction.target === "review") {
                  navigate("/documents/review");
                }
              }}
            >
              {language === "fr" ? "Corriger maintenant" : "Fix now"}
            </Button>
          </div>
        </Card>
      )}

      <NextStepCard
        text={text}
        firstIncompleteDoc={firstIncompleteDoc}
        onStart={() =>
          firstIncompleteDoc
            ? handleOpenGenerator(firstIncompleteDoc.id)
            : navigate("/documents/generator")
        }
        onForms={() => navigate("/forms")}
        onReview={() =>
          firstIncompleteDoc
            ? handleOpenReview(firstIncompleteDoc.id)
            : navigate("/documents/review")
        }
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[310px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card padding="lg" className="xl:sticky xl:top-24 xl:h-fit">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {text.navTitle}
            </p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:hidden">
              {groupedDocuments.map((group) => (
                <button
                  key={group.category}
                  type="button"
                  onClick={() => setActiveCategory(group.category)}
                  className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                    activeCategory === group.category
                      ? "border-amber-200 bg-amber-50 font-semibold text-slate-950"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate">{group.label}</span>
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {group.documents.length}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 hidden space-y-2 xl:block">
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
          <div className="rounded-2xl border border-slate-800 bg-[#172033] p-5 text-white shadow-[0_18px_60px_rgba(15,23,42,0.16)] sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                  {text.sectionLabel}
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  {activeGroup?.label ||
                    (language === "fr" ? "Documents" : "Documents")}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                  {language === "fr"
                    ? "Concentrez-vous sur cette categorie et terminez chaque document dans l'ordre: brouillon, revision, completion."
                    : "Focus this category and move each document through draft, review, and completion."}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
                {[
                  [
                    language === "fr" ? "Total" : "Total",
                    activeGroupStats.total,
                  ],
                  [
                    language === "fr" ? "Complétés" : "Done",
                    activeGroupStats.completed,
                  ],
                  [
                    language === "fr" ? "Restants" : "Left",
                    activeGroupStats.remaining,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-3 text-center"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                      {label}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {activeGroup?.documents?.length ? (
            <div
              key={activeCategory}
              className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3 animate-[fadeIn_.18s_ease-out]"
            >
              {[...activeGroup.documents]
                .sort((a, b) => {
                  const aCritical = familyRequirementIds.has(a.id);
                  const bCritical = familyRequirementIds.has(b.id);

                  if (aCritical && !bCritical) return -1;
                  if (!aCritical && bCritical) return 1;
                  return 0;
                })
                .map((doc) => {
                const state = getDocumentState(engine, doc.id);

                return (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    isHighlighted={highlightedDocId === doc.id}
                    state={state}
                    text={text}
                    isPro={isPro}
                    isCriticalFamilyRequirement={
                      familyRequirementIds.has(doc.id) ||
                      criticalGaps.some((gap) => gap.id === doc.id)
                    }
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
        <Card
          variant="premium"
          padding="lg"
          className="mt-10 bg-gradient-to-br from-violet-50 via-white to-white"
        >
          <h3 className="text-xl font-semibold text-slate-900">
            {text.finalizeTitle}
          </h3>

          <p className="mt-2 text-sm leading-7 text-slate-600">
            {text.finalizeBody}
          </p>

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

      <DocumentsAIDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        language={language}
        stats={stats}
        overallProgress={overallProgress}
        firstIncompleteDoc={firstIncompleteDoc}
        isPro={isPro}
        onNavigate={(path) => {
          setAiDrawerOpen(false);
          navigate(path);
        }}
      />
    </Layout>
  );
}
