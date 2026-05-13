import { useEffect } from "react";

export default function UpgradeModal({
  open,
  onClose,
  onUpgrade,
  language = "en",
  variant = "pro",
  source = "app",
  intent = "upgrade",
}) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const isFrench = String(language || "en").toLowerCase().startsWith("fr");
  const isPremium = String(variant || "pro").toLowerCase() === "premium";

  const text = isFrench
    ? isPremium
      ? {
          eyebrow: "NorthBridgeAI",
          title: "Passez à Premium pour finaliser votre dossier",
          body:
            "Premium est conçu pour les utilisateurs qui veulent aller jusqu’au rendu final avec plus de temps, plus de confort et l’export PDF.",
          highlightsTitle: "Ce que vous débloquez",
          highlights: [
            "Export PDF propre et partageable",
            "Fenêtre de préparation plus longue pour compléter votre dossier",
            "Meilleure couche de finition pour aller jusqu’au rendu final",
          ],
          primary: "Voir Premium",
          secondary: "Peut-être plus tard",
          sourceLabel: "Origine",
          intentLabel: "Intention",
        }
      : {
          eyebrow: "NorthBridgeAI",
          title: "Débloquez votre stratégie complète avec Pro",
          body:
            "Pro est le point d’entrée pour passer de l’exploration à l’exécution. Débloquez la stratégie complète, les outils documents et formulaires, ainsi qu’une guidance plus exploitable.",
          highlightsTitle: "Ce que vous débloquez",
          highlights: [
            "Analyse stratégique complète et recommandations prioritaires",
            "Génération de documents, formulaires et flux d’exécution",
            "Copilote IA avancé pour mieux préparer votre dossier",
          ],
          primary: "Passer à Pro",
          secondary: "Peut-être plus tard",
          sourceLabel: "Origine",
          intentLabel: "Intention",
        }
    : isPremium
    ? {
        eyebrow: "NorthBridgeAI",
        title: "Upgrade to Premium to finalize your case",
        body:
          "Premium is built for users who want to go all the way to final output with more time, more comfort, and PDF export.",
        highlightsTitle: "What you unlock",
        highlights: [
          "Clean, shareable PDF export",
          "A longer preparation window to complete your case",
          "A stronger finishing layer for going to final output",
        ],
        primary: "See Premium",
        secondary: "Maybe later",
        sourceLabel: "Source",
        intentLabel: "Intent",
      }
    : {
        eyebrow: "NorthBridgeAI",
        title: "Unlock your full strategy with Pro",
        body:
          "Pro is the point where you move from exploration into execution. Unlock the full strategy, documents and forms tools, and more actionable guidance.",
        highlightsTitle: "What you unlock",
        highlights: [
          "Full strategy analysis and smarter priority recommendations",
          "Documents, forms, and execution workflow access",
          "Advanced AI copilot to prepare your case with more confidence",
        ],
        primary: "Upgrade to Pro",
        secondary: "Maybe later",
        sourceLabel: "Source",
        intentLabel: "Intent",
      };

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <div className="bg-slate-950 px-6 py-6 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100">
            {text.eyebrow}
          </p>

          <h3
            id="upgrade-modal-title"
            className="mt-3 text-2xl font-semibold tracking-tight"
          >
            {text.title}
          </h3>

          <p className="mt-3 text-sm leading-7 text-slate-200">{text.body}</p>
        </div>

        <div className="px-6 py-6">
          {(source || intent) && (
            <div className="mb-4 flex flex-wrap gap-2">
              {source ? (
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {text.sourceLabel}: {source}
                </span>
              ) : null}

              {intent ? (
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {text.intentLabel}: {intent}
                </span>
              ) : null}
            </div>
          )}

          <div
            className={`rounded-[24px] p-4 ${
              isPremium
                ? "border border-amber-200 bg-amber-50"
                : "border border-amber-200 bg-amber-50"
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                isPremium ? "text-amber-900" : "text-amber-900"
              }`}
            >
              {text.highlightsTitle}
            </p>

            <div className="mt-3 space-y-2.5">
              {text.highlights.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="rounded-2xl border border-white bg-white px-4 py-3 text-sm leading-7 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onUpgrade}
              className={`flex-1 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
                isPremium
                  ? "bg-slate-950 hover:bg-slate-800"
                  : "bg-slate-950 hover:bg-slate-800"
              }`}
            >
              {text.primary}
            </button>

            <button
              onClick={onClose}
              className="flex-1 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {text.secondary}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
