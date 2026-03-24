import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import {
  getClients,
  createClient,
  updateClient,
  deleteClient,
  getToken,
  logoutUser,
} from "../api";

const initialForm = {
  full_name: "",
  email: "",
  status: "Active",
  notes: "",
};

export default function ClientsPage() {
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingClientId, setEditingClientId] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const fetchClients = async () => {
    setLoading(true);
    setMessage("");

    try {
      const token = getToken();

      if (!token) {
        navigate("/auth");
        return;
      }

      const response = await getClients();
      setClients(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      setMessage(err.response?.data?.detail || "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [navigate]);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return clients;

    return clients.filter((client) => {
      return (
        client.full_name?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.status?.toLowerCase().includes(query) ||
        client.notes?.toLowerCase().includes(query)
      );
    });
  }, [clients, search]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingClientId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };

      if (editingClientId) {
        const response = await updateClient(editingClientId, payload);
        const updated = response.data;

        setClients((prev) =>
          prev.map((client) =>
            client.id === editingClientId ? updated : client
          )
        );

        setMessage("Client updated successfully.");
      } else {
        const response = await createClient(payload);
        const created = response.data;

        setClients((prev) => [created, ...prev]);
        setMessage("Client created successfully.");
      }

      resetForm();
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.detail || "Failed to save client.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (client) => {
    setEditingClientId(client.id);
    setForm({
      full_name: client.full_name || "",
      email: client.email || "",
      status: client.status || "Active",
      notes: client.notes || "",
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (clientId) => {
    try {
      await deleteClient(clientId);
      setClients((prev) => prev.filter((client) => client.id !== clientId));

      if (editingClientId === clientId) {
        resetForm();
      }

      setMessage("Client deleted successfully.");
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.detail || "Failed to delete client.");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-xl">
            <p className="text-lg font-medium text-slate-700">
              Loading client workspace...
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Preparing your client list and planning workspace.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Client Workspace</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage people, notes, and planning records in one place. This
          workspace supports guidance and planning, not licensed legal advice.
        </p>
      </div>

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl xl:col-span-1">
          <h2 className="text-xl font-semibold text-slate-900">
            {editingClientId ? "Edit Client" : "Add Client"}
          </h2>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <input
                name="full_name"
                value={form.full_name}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="Active">Active</option>
                <option value="Planning">Planning</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows="5"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? editingClientId
                    ? "Updating..."
                    : "Saving..."
                  : editingClientId
                  ? "Update Client"
                  : "Save Client"}
              </button>

              {editingClientId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl xl:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Saved Clients
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Track people, notes, and planning status.
              </p>
            </div>

            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 md:w-72"
            />
          </div>

          <div className="mt-5 space-y-4">
            {filteredClients.length > 0 ? (
              filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {client.full_name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {client.email || "No email provided"}
                      </p>
                      <p className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        {client.status}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {client.notes || "No notes added yet."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${client.id}`)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Open Overview
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${client.id}/profile`)}
                        className="rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                      >
                        Open Profile
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${client.id}/strategy`)}
                        className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                      >
                        Open Strategy
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${client.id}/simulations`)}
                        className="rounded-xl border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50"
                      >
                        Open Simulations
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate(`/clients/${client.id}/documents`)}
                        className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
                      >
                        Open Documents
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEdit(client)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(client.id)}
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
                <p className="text-slate-700">No clients found.</p>
                <p className="mt-2 text-sm text-slate-500">
                  Add your first client to start building a guided planning
                  workspace.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}