import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Button from "./ui/Button";

function AccentBadge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800 backdrop-blur-sm">
      {children}
    </span>
  );
}

export default function UpgradePrompt({
  title,
  body,
  buttonLabel,
  pricingPath = "/pricing",
  className = "",
  compact = false,
}) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.language === "fr" ? "fr" : "en";

  const copy = useMemo(() => {
    if (language === "fr") {
      return {
        eyebrow: "Premium",
        chip: "Accès étendu",
        defaultButtonLabel: "Voir les tarifs",
        helper:
          "Débloquez plus de profondeur, plus d’exécution et une meilleure finition.",
      };
    }

    return {
      eyebrow: "Premium",
      chip: "Extended access",
      defaultButtonLabel: "View pricing",
      helper:
        "Unlock more depth, more execution, and stronger finishing value.",
    };
  }, [language]);

  const defaultButtonLabel = buttonLabel || copy.defaultButtonLabel;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-amber-200 bg-stone-50 shadow-[0_16px_48px_rgba(15,23,42,0.06)] ${className}`}
    >
      <div className={compact ? "p-5" : "p-6 md:p-7"}>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <AccentBadge>{copy.eyebrow}</AccentBadge>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                {copy.chip}
              </span>
            </div>

            <h3
              className={`mt-4 font-semibold tracking-tight text-slate-900 ${
                compact ? "text-xl" : "text-2xl"
              }`}
            >
              {title}
            </h3>

            {body ? (
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            ) : null}

            {!compact ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {copy.helper}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Button
              variant="premium"
              onClick={() => navigate(pricingPath)}
            >
              {defaultButtonLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
