import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  acceptDisclosure,
  getDisclosureRequirements,
} from "../api";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [disclosures, setDisclosures] = useState([]);

  useEffect(() => {
    if (!isOpen) return;

    async function loadDisclosures() {
      try {
        setLoading(true);
        const res = await getDisclosureRequirements();
        setDisclosures(res.data.required_disclosures || {});
      } catch (err) {
        console.error(err);
        setError("Failed to load disclosures.");
      } finally {
        setLoading(false);
      }
    }

    loadDisclosures();
  }, [isOpen]);

  const allChecked = useMemo(() => {
    return disclosures.every((item) => checked[item.disclosure_type]);
  }, [checked, disclosures]);

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
      setError("You must accept all disclosures.");
      return;
    }

    if (!finalCertificationChecked) {
      setError("You must confirm final acknowledgment.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      for (const item of disclosures) {
        if (!checked[item.disclosure_type]) continue;

        await acceptDisclosure({
          disclosure_type: item.disclosure_type,
          disclosure_version: item.disclosure_version,
          accepted_text_snapshot: item.accepted_text_snapshot,
          client_id: clientId,
          matter_id: matterId,
        });
      }

      onClose?.();
      await onAccepted?.();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl">
        <div className="border-b p-6">
          <h2 className="text-xl font-bold">Disclosures</h2>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
          {loading ? (
            <p>Loading...</p>
          ) : (
            disclosures.map((item, index) => (
              <div
                key={item.disclosure_type}
                className="border rounded-xl p-4"
              >
                <div className="flex gap-3">
                  <input
                    type="checkbox"
                    checked={checked[item.disclosure_type] || false}
                    onChange={() =>
                      toggleChecked(item.disclosure_type)
                    }
                  />
                  <div>
                    <p className="font-semibold">
                      {item.disclosure_type}
                    </p>
                    <p className="text-sm text-slate-600">
                      {item.accepted_text_snapshot}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}

          <div className="border rounded-xl p-4 bg-amber-50">
            <label className="flex gap-3">
              <input
                type="checkbox"
                checked={finalCertificationChecked}
                onChange={() =>
                  setFinalCertificationChecked((prev) => !prev)
                }
              />
              <span>
                I confirm I have read and accept all disclosures.
              </span>
            </label>
          </div>

          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}
        </div>

        <div className="flex justify-between p-6 border-t">
          <button onClick={onClose}>Cancel</button>

          <button
            onClick={handleAcceptAll}
            disabled={!canSubmit}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}