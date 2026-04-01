import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { acceptDisclosure, getMyDisclosures } from "../api";

const REQUIRED_DISCLOSURES = [
  { type: "terms_of_use", version: "v2" },
  { type: "privacy_consent", version: "v2" },
  { type: "ai_assistance_disclaimer", version: "v2" },
  { type: "no_legal_advice_acknowledgment", version: "v2" },
  { type: "user_responsibility_acknowledgment", version: "v2" },
  { type: "limitation_of_scope_acknowledgment", version: "v2" },
];

export default function DisclosureAcceptanceModal({
  isOpen,
  onClose,
  onAccepted,
  clientId = null,
  matterId = null,
}) {
  const { t } = useTranslation();

  const [checked, setChecked] = useState({});
  const [finalCertificationChecked, setFinalCertificationChecked] =
    useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [error, setError] = useState("");

  const disclosures = useMemo(() => {
    return REQUIRED_DISCLOSURES.map((item) => {
      switch (item.type) {
        case "terms_of_use":
          return {
            ...item,
            title: t("legal.sections.termsOfUseTitle", {
              defaultValue: "Terms of Use",
            }),
            text: t("legal.custom.termsOfUseBody", {
              defaultValue:
                "By using NorthBridgeAI, you acknowledge and agree that the platform provides administrative, educational, informational, workflow, organization, and document-preparation support only. NorthBridgeAI does not guarantee eligibility, approval, invitation, permit issuance, permanent residence, citizenship, or any immigration outcome. You remain solely responsible for reviewing all information, confirming its accuracy, and deciding whether and how to use any content, output, recommendation, checklist, template, or draft generated or displayed by the platform.",
            }),
          };

        case "privacy_consent":
          return {
            ...item,
            title: t("legal.custom.privacyConsentTitle", {
              defaultValue: "Privacy and Data Processing Consent",
            }),
            text: t("legal.custom.privacyConsentBody", {
              defaultValue:
                "You consent to the collection, storage, organization, use, and processing of the information and documents you submit for the operation of the platform, including profile analysis, workflow support, document organization, AI-assisted features, report generation, and related service delivery. You are responsible for ensuring that you have the right to provide any third-party personal information or documents uploaded to the platform.",
            }),
          };

        case "ai_assistance_disclaimer":
          return {
            ...item,
            title: t("legal.sections.aiDisclaimerTitle", {
              defaultValue: "AI Assistance Disclaimer",
            }),
            text: t("legal.custom.aiDisclaimerBody", {
              defaultValue:
                "You understand and accept that AI-generated content may contain errors, omissions, incomplete reasoning, formatting issues, or outdated information. AI outputs may misinterpret facts, fail to account for exceptions, or present information in a way that is not appropriate for your specific legal or procedural situation. All AI-generated outputs, including recommendations, explanations, drafts, checklists, probabilities, and summaries, must be independently reviewed and verified before being relied upon or used.",
            }),
          };

        case "no_legal_advice_acknowledgment":
          return {
            ...item,
            title: t("legal.sections.notLegalAdviceTitle", {
              defaultValue: "No Legal Advice Acknowledgment",
            }),
            text: t("legal.custom.notLegalAdviceBody", {
              defaultValue:
                "You acknowledge that NorthBridgeAI does not provide legal advice, legal representation, or regulated immigration representation unless such professional services are explicitly offered through a properly authorized lawyer or regulated immigration professional under a separate valid engagement. Use of this platform alone does not create a lawyer-client, consultant-client, fiduciary, or other professional advisory relationship.",
            }),
          };

        case "user_responsibility_acknowledgment":
          return {
            ...item,
            title: t("legal.custom.userResponsibilityTitle", {
              defaultValue: "User Responsibility Acknowledgment",
            }),
            text: t("legal.custom.userResponsibilityBody", {
              defaultValue:
                "You acknowledge that you are solely responsible for the accuracy, completeness, and truthfulness of the information you provide, the documents you upload, and the final content of any immigration-related form, application, letter, declaration, or submission. You also acknowledge that deadlines, eligibility rules, documentary requirements, and government processes may change and that it is your responsibility to confirm current official requirements before taking action.",
            }),
          };

        case "limitation_of_scope_acknowledgment":
          return {
            ...item,
            title: t("legal.custom.scopeTitle", {
              defaultValue: "Platform Scope and Limitation Acknowledgment",
            }),
            text: t("legal.custom.scopeBody", {
              defaultValue:
                "You understand that the platform is intended to support planning, organization, education, and workflow assistance only. NorthBridgeAI is not responsible for decisions made by immigration authorities, for user misunderstandings, for incomplete or incorrect user-provided information, or for actions taken by users without independent review. Past outputs, saved strategies, or prior guidance should not be treated as guarantees of current accuracy or future results.",
            }),
          };

        default:
          return {
            ...item,
            title: item.type,
            text: "",
          };
      }
    });
  }, [t]);

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    async function loadExistingAcceptances() {
      try {
        setLoadingExisting(true);
        setError("");
        setFinalCertificationChecked(false);

        const res = await getMyDisclosures({
          client_id: clientId,
          matter_id: matterId,
        });

        const records = Array.isArray(res?.data) ? res.data : [];
        const nextChecked = {};

        for (const item of REQUIRED_DISCLOSURES) {
          const found = records.find(
            (record) =>
              record.disclosure_type === item.type &&
              record.disclosure_version === item.version &&
              (record.client_id ?? null) === clientId &&
              (record.matter_id ?? null) === matterId
          );

          if (found) {
            nextChecked[item.type] = true;
          }
        }

        if (isCancelled) return;

        setChecked(nextChecked);

        const allAlreadyAccepted = REQUIRED_DISCLOSURES.every(
          (item) => nextChecked[item.type] === true
        );

        if (allAlreadyAccepted) {
          onClose?.();
          if (onAccepted) {
            await onAccepted();
          }
        }
      } catch (err) {
        console.error("Failed to load disclosures", err);

        if (!isCancelled) {
          setChecked({});
        }
      } finally {
        if (!isCancelled) {
          setLoadingExisting(false);
        }
      }
    }

    loadExistingAcceptances();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, clientId, matterId, onAccepted, onClose]);

  const allChecked = useMemo(() => {
    return REQUIRED_DISCLOSURES.every((item) => checked[item.type] === true);
  }, [checked]);

  const canSubmit = allChecked && finalCertificationChecked && !submitting;

  if (!isOpen) return null;

  const toggleChecked = (type) => {
    setChecked((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const handleAcceptAll = async () => {
    if (!allChecked) {
      setError(
        t("legal.custom.mustAcceptAll", {
          defaultValue:
            "You must review and accept every required disclosure before continuing.",
        })
      );
      return;
    }

    if (!finalCertificationChecked) {
      setError(
        t("legal.custom.mustCertify", {
          defaultValue:
            "You must confirm the final acknowledgment before continuing.",
        })
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      for (const item of disclosures) {
        if (checked[item.type] !== true) continue;

        await acceptDisclosure({
          disclosure_type: item.type,
          disclosure_version: item.version,
          accepted_text_snapshot: item.text,
          client_id: clientId,
          matter_id: matterId,
        });
      }

      onClose?.();

      if (onAccepted) {
        await onAccepted();
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
          t("legal.custom.saveError", {
            defaultValue: "Failed to save disclosure acceptance.",
          })
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
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

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          {loadingExisting ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              {t("legal.custom.loading", {
                defaultValue: "Loading disclosures...",
              })}
            </div>
          ) : (
            <>
              {disclosures.map((item, index) => (
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
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                          {index + 1}
                        </span>
                        <h3 className="text-base font-semibold text-slate-900">
                          {item.title}
                        </h3>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {item.text}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        {t("legal.custom.versionLabel", {
                          defaultValue: "Version",
                        })}
                        : {item.version}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={finalCertificationChecked}
                    onChange={() =>
                      setFinalCertificationChecked((prev) => !prev)
                    }
                    className="mt-1"
                  />
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {t("legal.custom.finalCertificationTitle", {
                        defaultValue: "Final User Certification",
                      })}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {t("legal.custom.finalCertificationBody", {
                        defaultValue:
                          "I confirm that I have read and understood the disclosures above, that I will not treat platform content as legal advice, that I will independently review all outputs before use, and that I remain solely responsible for my decisions, submissions, deadlines, and the accuracy of my information and documents.",
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("common.cancel")}
          </button>

          <button
            onClick={handleAcceptAll}
            disabled={!canSubmit || loadingExisting}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? t("common.saving") : t("legal.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}