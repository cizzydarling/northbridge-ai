import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import {
  acceptDisclosure,
  getLatestDisclosureAcceptance,
} from "../api";

const REQUIRED_DISCLOSURES = [
  {
    type: "terms_of_use",
    version: "v1",
    title: "Terms of Use",
    text:
      "By using this platform, you agree that the service provides administrative, informational, and document-preparation support only. You remain responsible for reviewing all content and for any final immigration submission.",
  },
  {
    type: "privacy_consent",
    version: "v1",
    title: "Privacy Consent",
    text:
      "You consent to the collection, storage, and processing of your information and documents for immigration workflow support, case organization, document preparation, and related platform services.",
  },
  {
    type: "ai_assistance_disclaimer",
    version: "v1",
    title: "AI Assistance Disclaimer",
    text:
      "You understand that AI-generated outputs may contain errors, omissions, or outdated information. All recommendations, checklists, and draft answers must be reviewed before use.",
  },
  {
    type: "no_legal_advice_acknowledgment",
    version: "v1",
    title: "No Legal Advice Acknowledgment",
    text:
      "You acknowledge that this platform does not replace advice from an authorized immigration representative or lawyer unless such services are explicitly being provided through an authorized professional.",
  },
];

export default function DisclosureAcceptancePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [checked, setChecked] = useState({});
  const [existingAccepted, setExistingAccepted] = useState({});
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
                  res.data &&
                  res.data.disclosure_version === item.version,
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

        setExistingAccepted(mapped);
        setChecked(mapped);
      } catch (err) {
        console.error(err);
        setError("Failed to load disclosure acceptance status.");
      } finally {
        setLoading(false);
      }
    }

    loadAcceptanceStatus();
  }, [clientId, matterId]);

  const allChecked = useMemo(() => {
    return REQUIRED_DISCLOSURES.every((item) => checked[item.type] === true);
  }, [checked]);

  const allAlreadyAccepted = useMemo(() => {
    return REQUIRED_DISCLOSURES.every(
      (item) => existingAccepted[item.type] === true
    );
  }, [existingAccepted]);

  const toggleChecked = (type) => {
    setChecked((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const handleAcceptAll = async () => {
    if (!allChecked) {
      setError("Please accept all required disclosures before continuing.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      for (const item of REQUIRED_DISCLOSURES) {
        if (existingAccepted[item.type] === true) continue;

        await acceptDisclosure({
          disclosure_type: item.type,
          disclosure_version: item.version,
          accepted_text_snapshot: item.text,
          client_id: clientId ? Number(clientId) : null,
          matter_id: matterId ? Number(matterId) : null,
        });
      }

      setMessage("Disclosures accepted successfully.");

      setTimeout(() => {
        navigate(redirectTo);
      }, 800);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
          "Failed to save disclosure acceptance."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout maxWidth="max-w-4xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <p className="text-slate-700">Loading disclosures...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout maxWidth="max-w-4xl">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-6">
          <p className="text-sm font-semibold text-blue-600">NorthBridgeAI</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            Required Disclosures
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Review and accept these disclosures before continuing to advanced AI-assisted workflows.
          </p>
        </div>

        <div className="space-y-4 px-6 py-6">
          {allAlreadyAccepted ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-700">
              These disclosures have already been accepted for this scope.
            </div>
          ) : null}

          {REQUIRED_DISCLOSURES.map((item) => {
            const alreadyAccepted = existingAccepted[item.type] === true;

            return (
              <div
                key={item.type}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked[item.type] === true}
                    onChange={() => toggleChecked(item.type)}
                    disabled={alreadyAccepted}
                    className="mt-1"
                  />

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900">
                        {item.title}
                      </h2>
                      {alreadyAccepted ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          Accepted
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {item.text}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      Version: {item.version}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {message ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-700">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => navigate(redirectTo)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Skip for now
            </button>

            <button
              onClick={handleAcceptAll}
              disabled={submitting || allAlreadyAccepted}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {allAlreadyAccepted
                ? "Already Accepted"
                : submitting
                ? "Saving..."
                : "Accept and Continue"}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}