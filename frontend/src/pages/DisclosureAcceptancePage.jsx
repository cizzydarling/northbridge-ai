import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  acceptDisclosure,
  getLatestDisclosureAcceptance,
  refreshCurrentUser,
} from "../api";
import { REQUIRED_DISCLOSURES } from "../data/legalDisclosures";

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
        setError("disclosure_load_error");
      } finally {
        setLoading(false);
      }
    }

    loadAcceptanceStatus();
  }, [clientId, matterId]);

  const renderedError =
    error === "disclosure_load_error"
      ? t("legal.custom.loadError", {
          defaultValue: "Failed to load disclosure acceptance status.",
        })
      : error;

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

  const setDisclosureChecked = (type, value) => {
    setChecked((prev) => ({
      ...prev,
      [type]: value,
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

      try {
        await refreshCurrentUser();
      } catch (err) {
        console.warn("Unable to refresh user after disclosure acceptance", err);
      }
      window.dispatchEvent(new Event("nbai-disclosures-accepted"));
      window.dispatchEvent(new Event("nbai-bootstrap-refresh"));
      navigate(redirectTo, { replace: true });
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
      <div className="space-y-5">
        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-[30px] border border-slate-900/10 bg-[#172033] p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                {t("app.name", { defaultValue: "NorthBridgeAI" })}
              </p>
              <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
                {t("legal.custom.requiredDisclosuresTitle", {
                  defaultValue: "Required Disclosures and Acknowledgments",
                })}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68 md:text-base">
                {t("legal.custom.requiredDisclosuresBody", {
                  defaultValue:
                    "Please read each disclosure carefully. These acknowledgments are required before continuing to AI-assisted guidance, planning, document, or workflow features.",
                })}
              </p>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_14px_45px_rgba(15,23,42,0.06)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {t("legal.custom.reviewLabel", {
                defaultValue: "Review",
              })}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              {completionPercent}%
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {allAlreadyAccepted
                ? t("legal.custom.alreadyAccepted", {
                    defaultValue:
                      "These disclosures have already been accepted for this scope and version.",
                  })
                : t("legal.custom.reviewSubtitle", {
                    defaultValue:
                      "You must actively confirm each item before continuing.",
                  })}
            </p>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>

            <div className="mt-5 grid gap-3">
              <DisclosureMetric
                label={t("legal.custom.scopeLabel", {
                  defaultValue: "Scope",
                })}
                value={t("legal.custom.scopeValue", {
                  defaultValue: "Planning Only",
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

        {renderedError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {renderedError}
          </div>
        ) : null}

        <Card className="overflow-hidden rounded-[26px]" padding="none">
          <div className="border-b border-slate-200 px-6 py-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {t("legal.custom.progress", {
                defaultValue: "Completion",
              })}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
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
                  className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-5 transition hover:border-cyan-200 hover:bg-white hover:shadow-[0_16px_42px_rgba(15,23,42,0.08)]"
                >
                  <label className="flex cursor-pointer items-start gap-4">
                    <input
                      type="checkbox"
                      checked={checked[item.type] === true}
                      onChange={(event) =>
                        setDisclosureChecked(item.type, event.target.checked)
                      }
                      disabled={alreadyAccepted}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-amber-300"
                    />

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600">
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
                  onChange={(event) =>
                    setFinalCertificationChecked(event.target.checked)
                  }
                  disabled={allAlreadyAccepted}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-amber-300"
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
      </div>
    </Layout>
  );
}

function DisclosureMetric({ label, value }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  );
}
