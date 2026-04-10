import { useEffect } from "react";

export default function UpgradeModal({
  open,
  onClose,
  onUpgrade,
  language = "en",
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

  const text = isFrench
    ? {
        eyebrow: "NorthBridgeAI",
        title: "Débloquez votre stratégie d’immigration complète",
        body:
          "Passez à une offre supérieure pour voir vos meilleures voies, obtenir des recommandations plus approfondies, utiliser les outils IA avancés et avancer avec plus de clarté.",
        highlightsTitle: "Ce que vous débloquez",
        highlights: [
          "Analyse stratégique complète et recommandations prioritaires",
          "Orientation documentaire et formulaires plus approfondie",
          "Copilote IA avancé pour mieux préparer votre dossier",
        ],
        primary: "Voir les tarifs",
        secondary: "Peut-être plus tard",
      }
    : {
        eyebrow: "NorthBridgeAI",
        title: "Unlock your full immigration strategy",
        body:
          "Upgrade to unlock your strongest pathways, deeper recommendations, advanced AI tools, and a clearer action plan for moving forward.",
        highlightsTitle: "What you unlock",
        highlights: [
          "Full strategy analysis and smarter priority recommendations",
          "Deeper documents and forms guidance",
          "Advanced AI copilot to prepare your case with more confidence",
        ],
        primary: "View pricing",
        secondary: "Maybe later",
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
        <div className="bg-gradient-to-br from-blue-900 via-blue-700 to-indigo-600 px-6 py-6 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100">
            {text.eyebrow}
          </p>
          <h3
            id="upgrade-modal-title"
            className="mt-3 text-2xl font-semibold tracking-tight"
          >
            {text.title}
          </h3>
          <p className="mt-3 text-sm leading-7 text-blue-50">{text.body}</p>
        </div>

        <div className="px-6 py-6">
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              {text.highlightsTitle}
            </p>

            <div className="mt-3 space-y-2.5">
              {text.highlights.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="rounded-2xl border border-amber-100 bg-white px-4 py-3 text-sm leading-7 text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onUpgrade}
              className="flex-1 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
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