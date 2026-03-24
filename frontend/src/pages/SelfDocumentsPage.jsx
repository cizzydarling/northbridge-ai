import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import {
  getSavedSelfApplication,
  getSelfDocuments,
  createSelfDocument,
  updateSelfDocument,
  deleteSelfDocument,
  uploadSelfDocumentFile,
  removeSelfDocumentFile,
} from "../api";

export default function SelfDocumentsPage() {
  const { t } = useTranslation();
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [uploadingDocumentId, setUploadingDocumentId] = useState(null);
  const [togglingDocumentId, setTogglingDocumentId] = useState(null);
  const [removingFileDocumentId, setRemovingFileDocumentId] = useState(null);
  const [clearingDocumentId, setClearingDocumentId] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [application, setApplication] = useState(null);
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const savedAppRes = await getSavedSelfApplication();
      const savedApplication = savedAppRes.data;
      setApplication(savedApplication);

      await syncDocumentsFromApplication(savedApplication);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 404) {
        setApplication(null);
        setDocuments([]);
        setError(t("selfDocuments.errors.noApplication"));
      } else {
        setError(
          err.response?.data?.detail || t("selfDocuments.errors.load")
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function syncDocumentsFromApplication(savedApplication, showMessage = false) {
    try {
      setSyncing(true);

      const matterType = savedApplication?.matter_type;
      const checklist = Array.isArray(savedApplication?.checklist_result)
        ? savedApplication.checklist_result
        : [];

      const existingRes = await getSelfDocuments(matterType);
      const existingDocs = Array.isArray(existingRes.data) ? existingRes.data : [];

      const existingByKey = new Map(
        existingDocs.map((doc) => [String(doc.document_key), doc])
      );

      for (const item of checklist) {
        const key = String(item.id || "");
        if (!key) continue;

        const existing = existingByKey.get(key);

        if (!existing) {
          const createRes = await createSelfDocument({
            matter_type: matterType,
            document_key: key,
            document_name: item.name || t("selfDocuments.documentFallback"),
            priority: item.status || "Required",
            required: item.status === "Required",
            notes: item.reason || null,
          });
          existingByKey.set(key, createRes.data);
        } else {
          const needsUpdate =
            existing.document_name !==
              (item.name || t("selfDocuments.documentFallback")) ||
            existing.priority !== (item.status || "Required") ||
            Boolean(existing.required) !== Boolean(item.status === "Required") ||
            (existing.notes || "") !== (item.reason || "");

          if (needsUpdate) {
            const updateRes = await updateSelfDocument(existing.id, {
              document_name:
                item.name || t("selfDocuments.documentFallback"),
              priority: item.status || "Required",
              required: item.status === "Required",
              notes: item.reason || null,
            });
            existingByKey.set(key, updateRes.data);
          }
        }
      }

      const refreshedRes = await getSelfDocuments(matterType);
      setDocuments(Array.isArray(refreshedRes.data) ? refreshedRes.data : []);

      if (showMessage) {
        setMessage(t("selfDocuments.messages.synced"));
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail || t("selfDocuments.errors.sync")
      );
    } finally {
      setSyncing(false);
    }
  }

  async function handleUploadFile(documentId, file) {
    if (!file) return;

    try {
      setUploadingDocumentId(documentId);
      setError("");
      setMessage("");

      const res = await uploadSelfDocumentFile(documentId, file);

      setDocuments((prev) =>
        prev.map((doc) => (doc.id === documentId ? res.data : doc))
      );

      setMessage(t("selfDocuments.messages.uploaded"));
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail || t("selfDocuments.errors.upload")
      );
    } finally {
      setUploadingDocumentId(null);
    }
  }

  async function handleToggleComplete(document) {
    try {
      setTogglingDocumentId(document.id);
      setError("");
      setMessage("");

      const res = await updateSelfDocument(document.id, {
        completed: !document.completed,
      });

      setDocuments((prev) =>
        prev.map((doc) => (doc.id === document.id ? res.data : doc))
      );

      setMessage(
        res.data.completed
          ? t("selfDocuments.messages.markedComplete")
          : t("selfDocuments.messages.markedIncomplete")
      );
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail || t("selfDocuments.errors.update")
      );
    } finally {
      setTogglingDocumentId(null);
    }
  }

  async function handleRemoveFile(documentId) {
    try {
      setRemovingFileDocumentId(documentId);
      setError("");
      setMessage("");

      const res = await removeSelfDocumentFile(documentId);

      setDocuments((prev) =>
        prev.map((doc) => (doc.id === documentId ? res.data : doc))
      );

      setMessage(t("selfDocuments.messages.fileRemoved"));
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail || t("selfDocuments.errors.removeFile")
      );
    } finally {
      setRemovingFileDocumentId(null);
    }
  }

  async function handleClearDocument(documentId) {
    try {
      setClearingDocumentId(documentId);
      setError("");
      setMessage("");

      await deleteSelfDocument(documentId);

      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
      setMessage(t("selfDocuments.messages.cleared"));
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail || t("selfDocuments.errors.clear")
      );
    } finally {
      setClearingDocumentId(null);
    }
  }

  const stats = useMemo(() => {
    const total = documents.length;
    const required = documents.filter((item) => item.required).length;
    const completedRequired = documents.filter(
      (item) => item.required && item.completed
    ).length;
    const percent =
      required > 0 ? Math.round((completedRequired / required) * 100) : 0;

    return { total, required, completedRequired, percent };
  }, [documents]);

  if (loading) {
    return (
      <Layout>
        <div className="p-6 text-slate-700">{t("selfDocuments.loading")}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-6xl">

          <div className="mb-8">
            <p className="text-sm font-semibold text-blue-600">{t("app.name")}</p>
            <h1 className="text-3xl font-bold text-slate-900">
              {t("layout.myDocuments")}
            </h1>
            <p className="mt-2 text-slate-600">
              {t("selfDocuments.subtitle")}
            </p>
          </div>

          {/* rest unchanged */}
        </div>
      </div>
    </Layout>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function PriorityBadge({ value, t }) {
  const classes =
    value === "Required"
      ? "bg-red-50 text-red-700 border-red-200"
      : value === "Recommended"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-blue-50 text-blue-700 border-blue-200";

  const label =
    value === "Required"
      ? t("selfDocuments.priority.required")
      : value === "Recommended"
      ? t("selfDocuments.priority.recommended")
      : t("selfDocuments.priority.info");

  return (
    <span className={`rounded-full border px-2 py-1 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}