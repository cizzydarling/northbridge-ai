import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import {
  createClientDocument,
  deleteClientDocument,
  generateMatterDocuments,
  getClientById,
  getClientDocuments,
  getClientMatters,
  getToken,
  logoutUser,
  removeClientDocumentFile,
  unverifyClientDocument,
  updateClientDocument,
  uploadClientDocumentFile,
  verifyClientDocument,
} from "../api";

const initialForm = {
  matter_id: "",
  document_name: "",
  document_key: "",
  priority: "Required",
  required: true,
  notes: "",
  status: "Pending",
};

function toPayload(form) {
  return {
    matter_id: form.matter_id ? Number(form.matter_id) : null,
    document_name: form.document_name.trim(),
    document_key: form.document_key.trim() || null,
    priority: form.priority,
    required: Boolean(form.required),
    notes: form.notes.trim() || null,
    status: form.status,
  };
}

export default function ClientDocumentsPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [matters, setMatters] = useState([]);
  const [selectedMatterId, setSelectedMatterId] = useState("");
  const [editingDocumentId, setEditingDocumentId] = useState(null);
  const [form, setForm] = useState(initialForm);

  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadingDocumentId, setUploadingDocumentId] = useState(null);
  const [removingFileDocumentId, setRemovingFileDocumentId] = useState(null);

  const loadPage = useCallback(async ({ isRefresh = false } = {}) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setMessage("");

    try {
      const token = getToken();

      if (!token) {
        navigate("/auth");
        return;
      }

      const [clientRes, docsRes, mattersRes] = await Promise.all([
        getClientById(clientId),
        getClientDocuments(clientId),
        getClientMatters(clientId),
      ]);

      setClient(clientRes.data);
      setDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
      setMatters(Array.isArray(mattersRes.data) ? mattersRes.data : []);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      setMessage(
        err.response?.data?.detail || "Failed to load client documents."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId, navigate]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return documents.filter((doc) => {
      const matchesSearch =
        !query ||
        doc.document_name?.toLowerCase().includes(query) ||
        doc.document_key?.toLowerCase().includes(query) ||
        doc.priority?.toLowerCase().includes(query) ||
        doc.status?.toLowerCase().includes(query) ||
        doc.notes?.toLowerCase().includes(query);

      const matchesMatter =
        !selectedMatterId ||
        String(doc.matter_id || "") === String(selectedMatterId);

      return matchesSearch && matchesMatter;
    });
  }, [documents, search, selectedMatterId]);

  const completionStats = useMemo(() => {
    const total = documents.length;
    const completed = documents.filter(
      (doc) => doc.completed || doc.status === "Verified"
    ).length;
    const uploaded = documents.filter((doc) => Boolean(doc.file_url || doc.file_path))
      .length;
    const verified = documents.filter((doc) => doc.status === "Verified").length;

    return { total, completed, uploaded, verified };
  }, [documents]);

  const resetForm = () => {
    setEditingDocumentId(null);
    setForm(initialForm);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEditDocument = (document) => {
    setEditingDocumentId(document.id);
    setForm({
      matter_id: document.matter_id ? String(document.matter_id) : "",
      document_name: document.document_name || "",
      document_key: document.document_key || "",
      priority: document.priority || "Required",
      required: Boolean(document.required),
      notes: document.notes || "",
      status: document.status || "Pending",
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveDocument = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const payload = toPayload(form);

      if (editingDocumentId) {
        const response = await updateClientDocument(
          clientId,
          editingDocumentId,
          payload
        );
        const updated = response.data;

        setDocuments((prev) =>
          prev.map((doc) => (doc.id === editingDocumentId ? updated : doc))
        );
        setMessage("Client document updated successfully.");
      } else {
        const response = await createClientDocument(clientId, payload);
        const created = response.data;

        setDocuments((prev) => [created, ...prev]);
        setMessage("Client document created successfully.");
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.detail || "Failed to save client document."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    try {
      setMessage("");
      await deleteClientDocument(clientId, documentId);

      setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));

      if (editingDocumentId === documentId) {
        resetForm();
      }

      setMessage("Client document deleted successfully.");
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.detail || "Failed to delete client document."
      );
    }
  };

  const handleUploadFile = async (documentId, file) => {
    if (!file) return;

    try {
      setUploadingDocumentId(documentId);
      setMessage("");

      const response = await uploadClientDocumentFile(clientId, documentId, file);
      const updated = response.data;

      setDocuments((prev) =>
        prev.map((doc) => (doc.id === documentId ? updated : doc))
      );
      setMessage("Document file uploaded successfully.");
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.detail || "Failed to upload document file."
      );
    } finally {
      setUploadingDocumentId(null);
    }
  };

  const handleRemoveFile = async (documentId) => {
    try {
      setRemovingFileDocumentId(documentId);
      setMessage("");

      const response = await removeClientDocumentFile(clientId, documentId);
      const updated = response.data;

      setDocuments((prev) =>
        prev.map((doc) => (doc.id === documentId ? updated : doc))
      );
      setMessage("Document file removed successfully.");
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.detail || "Failed to remove document file."
      );
    } finally {
      setRemovingFileDocumentId(null);
    }
  };

  const handleToggleVerification = async (document) => {
    try {
      setMessage("");

      const response =
        document.status === "Verified"
          ? await unverifyClientDocument(clientId, document.id)
          : await verifyClientDocument(clientId, document.id);

      const updated = response.data;

      setDocuments((prev) =>
        prev.map((doc) => (doc.id === document.id ? updated : doc))
      );

      setMessage(
        document.status === "Verified"
          ? "Document marked as unverified."
          : "Document verified successfully."
      );
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.detail || "Failed to update verification status."
      );
    }
  };

  const handleGenerateMatterDocuments = async () => {
    if (!selectedMatterId) {
      setMessage("Please select a matter first.");
      return;
    }

    try {
      setGenerating(true);
      setMessage("");

      const response = await generateMatterDocuments(
        clientId,
        selectedMatterId,
        {}
      );

      const createdDocs = Array.isArray(response.data) ? response.data : [];

      if (createdDocs.length > 0) {
        setDocuments((prev) => {
          const existingIds = new Set(prev.map((doc) => doc.id));
          const merged = [...prev];

          createdDocs.forEach((doc) => {
            if (!existingIds.has(doc.id)) {
              merged.unshift(doc);
            }
          });

          return merged;
        });
      }

      setMessage("Matter documents generated successfully.");
    } catch (err) {
      console.error(err);
      setMessage(
        err.response?.data?.detail || "Failed to generate matter documents."
      );
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-xl">
            <p className="text-lg font-medium text-slate-700">
              Loading client documents...
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Preparing document checklist and upload workspace.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {message && (
        <div
          className={`mb-6 rounded-2xl px-4 py-3 ${
            message.toLowerCase().includes("success") ||
            message.toLowerCase().includes("verified") ||
            message.toLowerCase().includes("generated") ||
            message.toLowerCase().includes("removed")
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {client?.full_name || "Client"} — Documents
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage document checklists, uploads, and verification across client
            matters.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate(`/clients/${clientId}`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to Overview
          </button>

          <button
            onClick={() => navigate(`/clients/${clientId}/matters`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Matters
          </button>

          <button
            onClick={() => loadPage({ isRefresh: true })}
            disabled={refreshing}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total Documents" value={completionStats.total} />
        <StatCard label="Completed" value={completionStats.completed} />
        <StatCard label="Uploaded" value={completionStats.uploaded} />
        <StatCard label="Verified" value={completionStats.verified} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">
              {editingDocumentId ? "Edit Document" : "Add Document"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Add a checklist item or update an existing document.
            </p>

            <form onSubmit={handleSaveDocument} className="mt-5 space-y-4">
              <Field label="Matter">
                <select
                  name="matter_id"
                  value={form.matter_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="">No matter selected</option>
                  {matters.map((matter) => (
                    <option key={matter.id} value={matter.id}>
                      {matter.title || `${matter.matter_type} #${matter.id}`}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Document Name" required>
                <input
                  name="document_name"
                  value={form.document_name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Passport"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>

              <Field label="Document Key">
                <input
                  name="document_key"
                  value={form.document_key}
                  onChange={handleChange}
                  placeholder="e.g. passport_copy"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>

              <Field label="Priority">
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="Required">Required</option>
                  <option value="Recommended">Recommended</option>
                  <option value="Optional">Optional</option>
                </select>
              </Field>

              <Field label="Status">
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="Pending">Pending</option>
                  <option value="Uploaded">Uploaded</option>
                  <option value="Verified">Verified</option>
                  <option value="Not Needed">Not Needed</option>
                </select>
              </Field>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  name="required"
                  checked={form.required}
                  onChange={handleChange}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-700">
                  Required document
                </span>
              </label>

              <Field label="Notes">
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Add any notes, guidance, or follow-up details."
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? editingDocumentId
                      ? "Updating..."
                      : "Saving..."
                    : editingDocumentId
                    ? "Update Document"
                    : "Save Document"}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Reset
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">
              Matter Tools
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Filter by matter or generate a document checklist from a matter.
            </p>

            <div className="mt-5 space-y-4">
              <Field label="Selected Matter">
                <select
                  value={selectedMatterId}
                  onChange={(e) => setSelectedMatterId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="">All matters</option>
                  {matters.map((matter) => (
                    <option key={matter.id} value={matter.id}>
                      {matter.title || `${matter.matter_type} #${matter.id}`}
                    </option>
                  ))}
                </select>
              </Field>

              <button
                type="button"
                onClick={handleGenerateMatterDocuments}
                disabled={!selectedMatterId || generating}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {generating ? "Generating..." : "Generate Matter Documents"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl xl:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Document Checklist
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review status, uploads, and verification across all client
                documents.
              </p>
            </div>

            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 md:w-72"
            />
          </div>

          <div className="mt-5 space-y-4">
            {filteredDocuments.length > 0 ? (
              filteredDocuments.map((document) => {
                const matter = matters.find((m) => m.id === document.matter_id);

                return (
                  <div
                    key={document.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">
                            {document.document_name}
                          </h3>

                          <Badge>{document.priority || "Required"}</Badge>
                          <StatusBadge status={document.status} />
                          {document.required ? <Badge>Required</Badge> : <Badge>Optional</Badge>}
                        </div>

                        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                          <MetaText
                            label="Matter"
                            value={
                              matter?.title ||
                              (document.matter_id ? `Matter #${document.matter_id}` : "No matter")
                            }
                          />
                          <MetaText
                            label="Key"
                            value={document.document_key || "No key"}
                          />
                          <MetaText
                            label="Completed"
                            value={document.completed ? "Yes" : "No"}
                          />
                          <MetaText
                            label="Uploaded File"
                            value={
                              document.file_name ||
                              document.file_url ||
                              document.file_path ||
                              "No file uploaded"
                            }
                          />
                        </div>

                        {document.notes && (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-sm text-slate-700">{document.notes}</p>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            {uploadingDocumentId === document.id
                              ? "Uploading..."
                              : "Upload File"}
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) =>
                                handleUploadFile(document.id, e.target.files?.[0])
                              }
                              disabled={uploadingDocumentId === document.id}
                            />
                          </label>

                          {(document.file_url || document.file_path) && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(document.id)}
                              disabled={removingFileDocumentId === document.id}
                              className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                            >
                              {removingFileDocumentId === document.id
                                ? "Removing..."
                                : "Remove File"}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleVerification(document)}
                            className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                          >
                            {document.status === "Verified"
                              ? "Mark Unverified"
                              : "Verify"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEditDocument(document)}
                            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(document.id)}
                            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-slate-700">No documents found.</p>
                <p className="mt-2 text-sm text-slate-500">
                  Add a document manually or generate a checklist from a matter.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Field({ label, required = false, children }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Badge({ children }) {
  return (
    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const styleMap = {
    Pending: "bg-amber-100 text-amber-700",
    Uploaded: "bg-blue-100 text-blue-700",
    Verified: "bg-green-100 text-green-700",
    "Not Needed": "bg-slate-200 text-slate-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styleMap[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {status || "Pending"}
    </span>
  );
}

function MetaText({ label, value }) {
  return (
    <div className="rounded-lg bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-700 break-words">{value}</p>
    </div>
  );
}
