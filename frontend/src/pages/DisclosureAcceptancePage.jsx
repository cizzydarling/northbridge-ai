import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  acceptDisclosure,
  getLatestDisclosureAcceptance,
} from "../api";

const REQUIRED_DISCLOSURES = [
  {
    type: "terms_of_use",
    version: "v2",
    titleKey: "legal.sections.termsOfUseTitle",
    defaultTitle: "Terms of Use",
    textKey: "legal.custom.termsOfUseBody",
    defaultText:
      "By using NorthBridgeAI, you acknowledge and agree that the platform provides administrative, educational, informational, workflow, organization, and document-preparation support only. NorthBridgeAI does not guarantee eligibility, approval, invitation, permit issuance, permanent residence, citizenship, or any immigration outcome. You remain solely responsible for reviewing all information, confirming its accuracy, and deciding whether and how to use any content, output, recommendation, checklist, template, or draft generated or displayed by the platform.",
  },
  {
    type: "privacy_consent",
    version: "v2",
    titleKey: "legal.custom.privacyConsentTitle",
    defaultTitle: "Privacy and Data Processing Consent",
    textKey: "legal.custom.privacyConsentBody",
    defaultText:
      "You consent to the collection, storage, organization, use, and processing of the information and documents you submit for the operation of the platform, including profile analysis, workflow support, document organization, AI-assisted features, report generation, and related service delivery. You are responsible for ensuring that you have the right to provide any third-party personal information or documents uploaded to the platform.",
  },
  {
    type: "ai_assistance_disclaimer",
    version: "v2",
    titleKey: "legal.sections.aiDisclaimerTitle",
    defaultTitle: "AI Assistance Disclaimer",
    textKey: "legal.custom.aiDisclaimerBody",
    defaultText:
      "You understand and accept that AI-generated content may contain errors, omissions, incomplete reasoning, formatting issues, or outdated information. AI outputs may misinterpret facts, fail to account for exceptions, or present information in a way that is not appropriate for your specific legal or procedural situation. All AI-generated outputs, including recommendations, explanations, drafts, checklists, probabilities, and summaries, must be independently reviewed and verified before being relied upon or used.",
  },
  {
    type: "no_legal_advice_acknowledgment",
    version: "v2",
    titleKey: "legal.sections.notLegalAdviceTitle",
    defaultTitle: "No Legal Advice Acknowledgment",
    textKey: "legal.custom.notLegalAdviceBody",
    defaultText:
      "You acknowledge that NorthBridgeAI does not provide legal advice, legal representation, or regulated immigration representation unless such professional services are explicitly offered through a properly authorized lawyer or regulated immigration professional under a separate valid engagement. Use of this platform alone does not create a lawyer-client, consultant-client, fiduciary, or other professional advisory relationship.",
  },
  {
    type: "user_responsibility_acknowledgment",
    version: "v2",
    titleKey: "legal.custom.userResponsibilityTitle",
    defaultTitle: "User Responsibility Acknowledgment",
    textKey: "legal.custom.userResponsibilityBody",
    defaultText:
      "You acknowledge that you are solely responsible for the accuracy, completeness, and truthfulness of the information you provide, the documents you upload, and the final content of any immigration-related form, application, letter, declaration, or submission. You also acknowledge that deadlines, eligibility rules, documentary requirements, and government processes may change and that it is your responsibility to confirm current official requirements before taking action.",
  },
  {
    type: "limitation_of_scope_acknowledgment",
    version: "v2",
    titleKey: "legal.custom.scopeTitle",
    defaultTitle: "Platform Scope and Limitation Acknowledgment",
    textKey: "legal.custom.scopeBody",
    defaultText:
      "You understand that the platform is intended to support planning, organization, education, and workflow assistance only. NorthBridgeAI is not responsible for decisions made by immigration authorities, for user misunderstandings, for incomplete or incorrect user-provided information, or for actions taken by users without independent review. Past outputs, saved strategies, or prior guidance should not be treated as guarantees of current accuracy or future results.",
  },
];

export default function DisclosureAcceptancePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const [checked, setChecked] = useState({});
  const [existingAccepted, setExistingAccepted] = useState({});
  const [finalCertificationChecked, setFinalCertificationChecked] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const clientId = searchParams.get("client_id");
  const matterId = searchParams.get("matter_id");
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  useEffect(() => {
    async function loadAcceptanceStatus() {
      try {
        setLoading(true);
        setError("");
        setMessage("");

        const results = await Promise.all(
          REQUIRED_DISCLOSURES.map(async (item) => {
            try {
              const res = await getLatestDisclosureAcceptance({
                disclosure_type: item.type,
                client_id: clientId || undefined,
                matter_id: matterId || undefined,
              });

              return {
                type: item.type,
                accepted:
                  res.data && res.data.disclosure_version === item.version,
              };
            } catch (err) {
              console.error(err);
              return {
                type: item.type,
                accepted: false,
              };
            }
          })
        );

        const mapped = {};
        for (const item of results) {
          mapped[item.type] = item.accepted;
        }

        const everythingAccepted = REQUIRED_DISCLOSURES.every(
          (item) => mapped[item.type] === true
        );

        setExistingAccepted(mapped);
        setChecked(mapped);
        setFinalCertificationChecked(everythingAccepted);
      } catch (err) {
        console.error(err);
        setError(
          t("legal.custom.loadError", {
            defaultValue: "Failed to load disclosure acceptance status.",
          })
        );
      } finally {
        setLoading(false);
      }
    }

    loadAcceptanceStatus();
  }, [clientId, matterId, t]);

  const allChecked = useMemo(() => {
    return REQUIRED_DISCLOSURES.every((item) => checked[item.type] === true);
  }, [checked]);

  const allAlreadyAccepted = useMemo(() => {
    return REQUIRED_DISCLOSURES.every(
      (item) => existingAccepted[item.type] === true
    );
  }, [existingAccepted]);

  const completionPercent = useMemo(() => {
    const completedCount = REQUIRED_DISCLOSURES.filter(
      (item) => checked[item.type] === true
    ).length;

    return Math.round((completedCount / REQUIRED_DISCLOSURES.length) * 100);
  }, [checked]);

  const canSubmit =
    allChecked &&
    finalCertificationChecked &&
    !submitting &&
    !allAlreadyAccepted;

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
      setMessage("");

      for (const item of REQUIRED_DISCLOSURES) {
        if (existingAccepted[item.type] === true) continue;

        const acceptedTextSnapshot = t(item.textKey, {
          defaultValue: item.defaultText,
        });

        await acceptDisclosure({
          disclosure_type: item.type,
          disclosure_version: item.version,
          accepted_text_snapshot: acceptedTextSnapshot,
          client_id: clientId ? Number(clientId) : null,
          matter_id: matterId ? Number(matterId) : null,
        });
      }

      setMessage(
        t("legal.custom.acceptedSuccess", {
          defaultValue: "Disclosures accepted successfully.",
        })
      );

      setTimeout(() => {
        navigate(redirectTo);
      }, 700);
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

  if (loading) {
    return (
      <Layout>
        <div className="mx-auto max-w-4xl">
          <Card className="p-8 shadow-xl">
            <p className="text-slate-700">
              {t("legal.custom.loading", {
                defaultValue: "Loading disclosures...",
              })}
            </p>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 px-6 py-8 text-white shadow-xl md:px-8 md:py-10">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
                {t("app.name", { defaultValue: "NorthBridgeAI" })}
              </p>
              <h1 className="mt-3 text-3xl font-bold md:text-4xl">
                {t("legal.custom.requiredDisclosuresTitle", {
                  defaultValue: "Required Disclosures and Acknowledgments",
                })}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-blue-100 md:text-base">
                {t("legal.custom.requiredDisclosuresBody", {
                  defaultValue:
                    "Please read each disclosure carefully. These acknowledgments are required before continuing to AI-assisted guidance, planning, document, or workflow features.",
                })}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <DisclosureMetric
                label={t("legal.custom.scopeLabel", {
                  defaultValue: "Scope",
                })}
                value={t("legal.custom.scopeValue", {
                  defaultValue: "Planning Only",
                })}
              />
              <DisclosureMetric
                label={t("legal.custom.reviewLabel", {
                  defaultValue: "Review",
                })}
                value={t("legal.custom.reviewValue", {
                  defaultValue: "Required",
                })}
              />
              <DisclosureMetric
                label={t("legal.custom.relationshipLabel", {
                  defaultValue: "Legal Relationship",
                })}
                value={t("legal.custom.relationshipValue", {
                  defaultValue: "Not Created",
                })}
              />
            </div>
          </div>
        </section>

        {allAlreadyAccepted ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            {t("legal.custom.alreadyAccepted", {
              defaultValue:
                "These disclosures have already been accepted for this scope and version.",
            })}
          </div>
        ) : null}

        {message ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
            <span>
              {t("legal.custom.progress", {
                defaultValue: "Completion",
              })}
            </span>
            <span>{completionPercent}%</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-blue-900 transition-all duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        <Card className="shadow-xl">
          <div className="border-b border-slate-200 px-6 py-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {t("legal.custom.reviewTitle", {
                defaultValue: "Review each required acknowledgment",
              })}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {t("legal.custom.reviewSubtitle", {
                defaultValue:
                  "You must actively confirm each item before continuing.",
              })}
            </p>
          </div>

          <div className="space-y-4 px-6 py-6">
            {REQUIRED_DISCLOSURES.map((item, index) => {
              const alreadyAccepted = existingAccepted[item.type] === true;

              return (
                <div
                  key={item.type}
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:shadow-sm"
                >
                  <label className="flex cursor-pointer items-start gap-4">
                    <input
                      type="checkbox"
                      checked={checked[item.type] === true}
                      onChange={() => toggleChecked(item.type)}
                      disabled={alreadyAccepted}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                          {index + 1}
                        </span>

                        <h3 className="text-base font-semibold text-slate-900">
                          {t(item.titleKey, {
                            defaultValue: item.defaultTitle,
                          })}
                        </h3>

                        {alreadyAccepted ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            {t("legal.custom.acceptedBadge", {
                              defaultValue: "Accepted",
                            })}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-3 text-sm leading-7 text-slate-700">
                        {t(item.textKey, {
                          defaultValue: item.defaultText,
                        })}
                      </p>

                      <p className="mt-3 text-xs text-slate-500">
                        {t("legal.custom.versionLabel", {
                          defaultValue: "Version",
                        })}
                        : {item.version}
                      </p>
                    </div>
                  </label>
                </div>
              );
            })}

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <label className="flex cursor-pointer items-start gap-4">
                <input
                  type="checkbox"
                  checked={finalCertificationChecked}
                  onChange={() =>
                    setFinalCertificationChecked((prev) => !prev)
                  }
                  disabled={allAlreadyAccepted}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />

                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {t("legal.custom.finalCertificationTitle", {
                      defaultValue: "Final User Certification",
                    })}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    {t("legal.custom.finalCertificationBody", {
                      defaultValue:
                        "I confirm that I have read and understood the disclosures above, that I will not treat platform content as legal advice, that I will independently review all outputs before use, and that I remain solely responsible for my decisions, submissions, deadlines, and the accuracy of my information and documents.",
                    })}
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              {t("common.back", { defaultValue: "Back" })}
            </Button>

            <Button onClick={handleAcceptAll} disabled={!canSubmit}>
              {allAlreadyAccepted
                ? t("legal.custom.alreadyAcceptedButton", {
                    defaultValue: "Already Accepted",
                  })
                : submitting
                ? t("common.saving", {
                    defaultValue: "Saving...",
                  })
                : t("legal.custom.acceptAndContinue", {
                    defaultValue: "Accept and Continue",
                  })}
            </Button>
          </div>
        </Card>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600 shadow-sm">
          <p className="font-semibold text-slate-900">
            {t("legal.custom.reviewRecommendationTitle", {
              defaultValue: "Recommended protection step",
            })}
          </p>
          <p className="mt-2">
            {t("legal.custom.reviewRecommendationBody", {
              defaultValue:
                "For stronger legal protection, have your final disclosure language, privacy policy, terms of use, client engagement wording, and workflow-specific acknowledgments reviewed by a licensed lawyer before public launch.",
            })}
          </p>
        </div>
      </div>
    </Layout>
  );
}

function DisclosureMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}