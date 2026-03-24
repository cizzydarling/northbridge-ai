import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { acceptDisclosure } from "../api";

export default function DisclosureAcceptanceModal({
  isOpen,
  onClose,
  onAccepted,
  clientId = null,
  matterId = null,
}) {
  const { t } = useTranslation();

  // 👇 Disclosures now come from i18n
  const disclosures = [
    {
      type: "terms_of_use",
      version: "v1",
      title: t("legal.sections.termsOfUseTitle"),
      text: t("legal.sections.termsOfUseBody"),
    },
    {
      type: "privacy_consent",
      version: "v1",
      title: t("legal.sections.privacyTitle"),
      text: t("legal.sections.privacyBody"),
    },
    {
      type: "ai_assistance_disclaimer",
      version: "v1",
      title: t("legal.sections.aiDisclaimerTitle"),
      text: t("legal.sections.aiDisclaimerBody"),
    },
    {
      type: "no_legal_advice_acknowledgment",
      version: "v1",
      title: t("legal.sections.notLegalAdviceTitle"),
      text: t("legal.sections.notLegalAdviceBody"),
    },
  ];

  const [checked, setChecked] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const allChecked = useMemo(() => {
    return disclosures.every((item) => checked[item.type] === true);
  }, [checked, disclosures]);

  if (!isOpen) return null;

  const toggleChecked = (type) => {
    setChecked((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const handleAcceptAll = async () => {
    if (!allChecked) {
      setError(t("legal.required"));
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      for (const item of disclosures) {
        await acceptDisclosure({
          disclosure_type: item.type,
          disclosure_version: item.version,
          accepted_text_snapshot: item.text,
          client_id: clientId,
          matter_id: matterId,
        });
      }

      if (onAccepted) {
        onAccepted();
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
          t("errors.generic")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        
        {/* HEADER */}
        <div className="border-b border-slate-200 px-6 py-5">
          <p className="text-sm font-semibold text-blue-600">
            {t("app.name")}
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">
            {t("legal.title")}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("legal.intro")}
          </p>
        </div>

        {/* CONTENT */}
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          {disclosures.map((item) => (
            <div
              key={item.type}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked[item.type] === true}
                  onChange={() => toggleChecked(item.type)}
                  className="mt-1"
                />
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {item.text}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {t("common.version", { version: item.version }) || `Version: ${item.version}`}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("common.cancel")}
          </button>

          <button
            onClick={handleAcceptAll}
            disabled={submitting}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? t("common.saving") : t("legal.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}