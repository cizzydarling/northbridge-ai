import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
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
        setError(err.response?.data?.detail || t("selfDocuments.errors.load"));
      }
    } finally {
      setLoading(false);
    }
  }

  async function syncDocumentsFromApplication(savedApplication, showMessage = false) {
    try {
      setSyncing(true);
      setError("");
      if (showMessage) setMessage("");

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
              document_name: item.name || t("selfDocuments.documentFallback"),
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
      setError(err.response?.data?.detail || t("selfDocuments.errors.sync"));
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
      setError(err.response?.data?.detail || t("selfDocuments.errors.upload"));
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
      setError(err.response?.data?.detail || t("selfDocuments.errors.update"));
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
      setError(err.response?.data?.detail || t("selfDocuments.errors.clear"));
    } finally {
      setClearingDocumentId(null);
    }
  }

  const stats = useMemo(() => {
    const totalItems = documents.length;
    const requiredItems = documents.filter((doc) => Boolean(doc.required)).length;
    const completedRequired = documents.filter(
      (doc) => Boolean(doc.required) && Boolean(doc.completed)
    ).length;
    const progress = requiredItems
      ? Math.round((completedRequired / requiredItems) * 100)
      : 0;

    return {
      totalItems,
      requiredItems,
      completedRequired,
      progress,
    };
  }, [documents]);

  function buildFileUrl(path) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${apiBaseUrl}${path}`;
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-16">
          <p className="text-slate-600">{t("selfDocuments.loading")}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 px-6 py-8 text-white shadow-xl md:px-8 md:py-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-200">
                {t("app.name")}
              </p>
              <h1 className="mt-2 text-3xl font-bold">
                {t("selfDocuments.workspaceTitle")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                {t("selfDocuments.subtitle")}
              </p>

              {application?.matter_type ? (
                <p className="mt-4 text-sm text-blue-100">
                  <span className="font-semibold">
                    {t("selfDocuments.savedApplicationType")}
                  </span>{" "}
                  {application.matter_type}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="white"
                className="h-12"
                onClick={() => syncDocumentsFromApplication(application, true)}
                disabled={!application || syncing}
              >
                {syncing
                  ? t("selfDocuments.syncing")
                  : t("selfDocuments.syncButton")}
              </Button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!application ? (
          <Card variant="soft" padding="lg">
            <p className="text-sm text-slate-700">{t("selfDocuments.noApplication")}</p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <MetricCard
                label={t("selfDocuments.stats.totalItems")}
                value={stats.totalItems}
              />
              <MetricCard
                label={t("selfDocuments.stats.requiredItems")}
                value={stats.requiredItems}
              />
              <MetricCard
                label={t("selfDocuments.stats.completedRequired")}
                value={stats.completedRequired}
              />
              <MetricCard
                label={t("selfDocuments.stats.progress")}
                value={`${stats.progress}%`}
              />
            </div>

            <Card variant="elevated" padding="lg">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("selfDocuments.progressTitle")}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {t("selfDocuments.progressSubtitle", {
                  completed: stats.completedRequired,
                  required: stats.requiredItems,
                })}
              </p>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${stats.progress}%` }}
                />
              </div>
            </Card>

            <Card variant="elevated" padding="lg">
              <h2 className="text-xl font-semibold text-slate-900">
                {t("selfDocuments.checklistTitle")}
              </h2>

              {documents.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm text-slate-600">{t("selfDocuments.empty")}</p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {documents.map((doc) => {
                    const fileUrl = buildFileUrl(doc.file_url || doc.file_path || "");
                    const isUploading = uploadingDocumentId === doc.id;
                    const isToggling = togglingDocumentId === doc.id;
                    const isRemovingFile = removingFileDocumentId === doc.id;
                    const isClearing = clearingDocumentId === doc.id;

                    return (
                      <div
                        key={doc.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-slate-900">
                                {doc.document_name || t("selfDocuments.documentFallback")}
                              </h3>

                              <PriorityBadge priority={doc.priority} t={t} />

                              {doc.completed ? (
                                <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                                  {t("selfDocuments.complete")}
                                </span>
                              ) : null}
                            </div>

                            <p className="mt-3 text-sm leading-6 text-slate-600">
                              {doc.notes || t("selfDocuments.noNotes")}
                            </p>

                            <div className="mt-4 space-y-2 text-sm text-slate-600">
                              {fileUrl ? (
                                <div>
                                  <span className="font-medium">
                                    {t("selfDocuments.uploadedFile")}
                                  </span>{" "}
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-700 underline"
                                  >
                                    {t("selfDocuments.openFile")}
                                  </a>
                                </div>
                              ) : (
                                <div>{t("selfDocuments.noFile")}</div>
                              )}

                              {doc.updated_at ? (
                                <div>
                                  {t("selfDocuments.savedAt", {
                                    date: new Date(doc.updated_at).toLocaleString(),
                                  })}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex w-full flex-col gap-2 sm:w-auto">
                            <label className="inline-flex">
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) =>
                                  handleUploadFile(doc.id, e.target.files?.[0])
                                }
                              />
                              <span className="inline-flex min-h-[44px] cursor-pointer items-center justify-center whitespace-nowrap rounded-xl border border-slate-300 bg-white px-5 text-sm font-medium text-slate-800 transition duration-200 hover:bg-slate-50">
                                {isUploading
                                  ? t("selfDocuments.uploading")
                                  : t("common.upload")}
                              </span>
                            </label>

                            <Button
                              variant="secondary"
                              className="h-11"
                              onClick={() => handleToggleComplete(doc)}
                              disabled={isToggling}
                            >
                              {isToggling
                                ? t("selfDocuments.updating")
                                : doc.completed
                                ? t("selfDocuments.markIncomplete")
                                : t("selfDocuments.markComplete")}
                            </Button>

                            {fileUrl ? (
                              <Button
                                variant="secondary"
                                className="h-11"
                                onClick={() => handleRemoveFile(doc.id)}
                                disabled={isRemovingFile}
                              >
                                {isRemovingFile
                                  ? t("selfDocuments.removingFile")
                                  : t("selfDocuments.removeFile")}
                              </Button>
                            ) : null}

                            <Button
                              variant="danger"
                              className="h-11"
                              onClick={() => handleClearDocument(doc.id)}
                              disabled={isClearing}
                            >
                              {isClearing
                                ? t("selfDocuments.clearing")
                                : t("selfDocuments.clearEntry")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}

function MetricCard({ label, value }) {
  return (
    <Card variant="default" padding="md">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </Card>
  );
}

function PriorityBadge({ priority, t }) {
  const normalized = String(priority || "").toLowerCase();

  let className =
    "border-blue-200 bg-blue-50 text-blue-700";
  let text = t("selfDocuments.priority.info");

  if (normalized === "required" || normalized === "obligatoire") {
    className = "border-red-200 bg-red-50 text-red-700";
    text = t("selfDocuments.priority.required");
  } else if (
    normalized === "recommended" ||
    normalized === "recommandé" ||
    normalized === "recommande"
  ) {
    className = "border-amber-200 bg-amber-50 text-amber-700";
    text = t("selfDocuments.priority.recommended");
  }

  return (
    <span
      className={`rounded-full border px-2 py-1 text-xs font-medium ${className}`}
    >
      {text}
    </span>
  );
}