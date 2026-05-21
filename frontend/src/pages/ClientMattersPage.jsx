import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import {
  createClientMatter,
  deleteClientMatter,
  getClientById,
  getClientMatters,
  getToken,
  logoutUser,
  updateClientMatter,
} from "../api";

const initialForm = {
  matter_type: "Express Entry",
  title: "",
  status: "Open",
  target_program: "",
  country_of_residence: "",
  inside_canada: false,
  notes: "",
};

function toPayload(form) {
  return {
    matter_type: form.matter_type,
    title: form.title.trim(),
    status: form.status,
    target_program: form.target_program.trim() || null,
    country_of_residence: form.country_of_residence.trim() || null,
    inside_canada: Boolean(form.inside_canada),
    notes: form.notes.trim() || null,
  };
}

export default function ClientMattersPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [matters, setMatters] = useState([]);
  const [editingMatterId, setEditingMatterId] = useState(null);
  const [form, setForm] = useState(initialForm);

  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

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

      const [clientRes, mattersRes] = await Promise.all([
        getClientById(clientId),
        getClientMatters(clientId),
      ]);

      setClient(clientRes.data);
      setMatters(Array.isArray(mattersRes.data) ? mattersRes.data : []);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      setMessage(err.response?.data?.detail || "Failed to load client matters.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientId, navigate]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const filteredMatters = useMemo(() => {
    const query = search.trim().toLowerCase();

    return matters.filter((matter) => {
      const matchesQuery =
        !query ||
        matter.title?.toLowerCase().includes(query) ||
        matter.matter_type?.toLowerCase().includes(query) ||
        matter.status?.toLowerCase().includes(query) ||
        matter.target_program?.toLowerCase().includes(query) ||
        matter.country_of_residence?.toLowerCase().includes(query) ||
        matter.notes?.toLowerCase().includes(query);

      const matchesStatus =
        !statusFilter || matter.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchesQuery && matchesStatus;
    });
  }, [matters, search, statusFilter]);

  const stats = useMemo(() => {
    const total = matters.length;
    const open = matters.filter((m) => (m.status || "").toLowerCase() === "open").length;
    const inProgress = matters.filter(
      (m) => (m.status || "").toLowerCase() === "in progress"
    ).length;
    const closed = matters.filter((m) => (m.status || "").toLowerCase() === "closed").length;

    return { total, open, inProgress, closed };
  }, [matters]);

  const resetForm = () => {
    setEditingMatterId(null);
    setForm(initialForm);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEditMatter = (matter) => {
    setEditingMatterId(matter.id);
    setForm({
      matter_type: matter.matter_type || "Express Entry",
      title: matter.title || "",
      status: matter.status || "Open",
      target_program: matter.target_program || "",
      country_of_residence: matter.country_of_residence || "",
      inside_canada: Boolean(matter.inside_canada),
      notes: matter.notes || "",
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveMatter = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const payload = toPayload(form);

      if (editingMatterId) {
        const response = await updateClientMatter(clientId, editingMatterId, payload);
        const updated = response.data;

        setMatters((prev) =>
          prev.map((matter) => (matter.id === editingMatterId ? updated : matter))
        );
        setMessage("Client matter updated successfully.");
      } else {
        const response = await createClientMatter(clientId, payload);
        const created = response.data;

        setMatters((prev) => [created, ...prev]);
        setMessage("Client matter created successfully.");
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.detail || "Failed to save client matter.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMatter = async (matterId) => {
    try {
      setMessage("");
      await deleteClientMatter(clientId, matterId);

      setMatters((prev) => prev.filter((matter) => matter.id !== matterId));

      if (editingMatterId === matterId) {
        resetForm();
      }

      setMessage("Client matter deleted successfully.");
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.detail || "Failed to delete client matter.");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-xl">
            <p className="text-lg font-medium text-slate-700">
              Loading client matters...
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Preparing matter workspace and case planning records.
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
            message.toLowerCase().includes("success")
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
            {client?.full_name || "Client"} — Matters
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage active planning files, track case types, and organize work by
            matter.
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
            onClick={() => navigate(`/clients/${clientId}/documents`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Documents
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
        <StatCard label="Total Matters" value={stats.total} />
        <StatCard label="Open" value={stats.open} />
        <StatCard label="In Progress" value={stats.inProgress} />
        <StatCard label="Closed" value={stats.closed} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900">
              {editingMatterId ? "Edit Matter" : "Add Matter"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Create or update a matter used for planning, documents, and workflow.
            </p>

            <form onSubmit={handleSaveMatter} className="mt-5 space-y-4">
              <Field label="Matter Type" required>
                <select
                  name="matter_type"
                  value={form.matter_type}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                  required
                >
                  <option value="Express Entry">Express Entry</option>
                  <option value="PNP">PNP</option>
                  <option value="Work Permit">Work Permit</option>
                  <option value="Study Permit">Study Permit</option>
                  <option value="Visitor Visa">Visitor Visa</option>
                  <option value="Spousal Sponsorship">Spousal Sponsorship</option>
                  <option value="Citizenship">Citizenship</option>
                  <option value="Other">Other</option>
                </select>
              </Field>

              <Field label="Title" required>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Ontario PNP planning"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>

              <Field label="Status">
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Closed">Closed</option>
                </select>
              </Field>

              <Field label="Target Program">
                <input
                  name="target_program"
                  value={form.target_program}
                  onChange={handleChange}
                  placeholder="e.g. OINP Human Capital Priorities"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>

              <Field label="Country of Residence">
                <input
                  name="country_of_residence"
                  value={form.country_of_residence}
                  onChange={handleChange}
                  placeholder="e.g. Canada"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  name="inside_canada"
                  checked={form.inside_canada}
                  onChange={handleChange}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-700">
                  Inside Canada
                </span>
              </label>

              <Field label="Notes">
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Add matter notes, intake context, or follow-up actions."
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
                    ? editingMatterId
                      ? "Updating..."
                      : "Saving..."
                    : editingMatterId
                    ? "Update Matter"
                    : "Save Matter"}
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
            <h2 className="text-xl font-semibold text-slate-900">Filters</h2>
            <p className="mt-1 text-sm text-slate-500">
              Narrow the list of matters by keyword or status.
            </p>

            <div className="mt-5 space-y-4">
              <Field label="Search">
                <input
                  type="text"
                  placeholder="Search matters..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>

              <Field label="Status">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="">All statuses</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Closed">Closed</option>
                </select>
              </Field>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl xl:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Matter List</h2>
              <p className="mt-1 text-sm text-slate-500">
                Review and manage all planning files for this client.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {filteredMatters.length > 0 ? (
              filteredMatters.map((matter) => (
                <div
                  key={matter.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {matter.title}
                        </h3>
                        <Badge>{matter.matter_type || "Matter"}</Badge>
                        <StatusBadge status={matter.status} />
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <MetaText
                          label="Target Program"
                          value={matter.target_program || "Not set"}
                        />
                        <MetaText
                          label="Country of Residence"
                          value={matter.country_of_residence || "Not set"}
                        />
                        <MetaText
                          label="Inside Canada"
                          value={matter.inside_canada ? "Yes" : "No"}
                        />
                        <MetaText
                          label="Matter ID"
                          value={matter.id}
                        />
                      </div>

                      {matter.notes && (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-sm text-slate-700">{matter.notes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditMatter(matter)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${clientId}/documents`)}
                        className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                      >
                        Open Documents
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteMatter(matter.id)}
                        className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-slate-700">No matters found.</p>
                <p className="mt-2 text-sm text-slate-500">
                  Add a matter to begin organizing this client’s workflow.
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
    Open: "bg-green-100 text-green-700",
    "In Progress": "bg-blue-100 text-blue-700",
    "On Hold": "bg-amber-100 text-amber-700",
    Closed: "bg-slate-200 text-slate-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styleMap[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {status || "Open"}
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
