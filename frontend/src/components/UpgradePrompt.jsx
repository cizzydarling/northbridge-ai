import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Button from "./ui/Button";

export default function UpgradePrompt({
  title,
  body,
  buttonLabel,
  className = "",
  compact = false,
}) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.language === "fr" ? "fr" : "en";

  const defaultButtonLabel =
    buttonLabel || (language === "fr" ? "Voir les tarifs" : "View pricing");

  return (
    <div
      className={`rounded-[28px] border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-sm ${className}`}
    >
      <div className={compact ? "p-5" : "p-6 md:p-7"}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
              {language === "fr" ? "Premium" : "Premium"}
            </p>

            <h3
              className={`mt-2 font-semibold tracking-tight text-slate-900 ${
                compact ? "text-xl" : "text-2xl"
              }`}
            >
              {title}
            </h3>

            {body ? (
              <p className="mt-3 text-sm leading-7 text-slate-600">{body}</p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Button onClick={() => navigate("/pricing")}>
              {defaultButtonLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}