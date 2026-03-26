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

import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

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
      if (!token) return navigate("/auth");

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

    return clients.filter((client) =>
      [client.full_name, client.email, client.status, client.notes]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [clients, search]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
          prev.map((c) => (c.id === editingClientId ? updated : c))
        );

        setMessage("Client updated successfully.");
      } else {
        const response = await createClient(payload);
        setClients((prev) => [response.data, ...prev]);
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
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      setMessage("Client deleted successfully.");
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.detail || "Failed to delete client.");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-10">
          <p className="text-slate-600">Loading clients...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Client Workspace</h1>
        <p className="text-slate-600">
          Manage clients, notes, and planning records.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-xl px-4 py-3 ${
            message.toLowerCase().includes("success")
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {/* FORM */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold">
            {editingClientId ? "Edit Client" : "Add Client"}
          </h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <Input
              name="full_name"
              placeholder="Full name"
              value={form.full_name}
              onChange={handleChange}
            />

            <Input
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
            />

            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="input"
            >
              <option>Active</option>
              <option>Planning</option>
              <option>On Hold</option>
              <option>Completed</option>
            </select>

            <textarea
              name="notes"
              placeholder="Notes"
              value={form.notes}
              onChange={handleChange}
              className="input"
            />

            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving..." : "Save"}
              </Button>

              {editingClientId && (
                <Button
                  variant="secondary"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* CLIENT LIST */}
        <div className="xl:col-span-2 space-y-4">
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <Card key={client.id}>
                <h3 className="font-semibold">{client.full_name}</h3>
                <p className="text-sm text-slate-600">
                  {client.email || "No email"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    Overview
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() =>
                      navigate(`/clients/${client.id}/profile`)
                    }
                  >
                    Profile
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() =>
                      navigate(`/clients/${client.id}/strategy`)
                    }
                  >
                    Strategy
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={() => handleEdit(client)}
                  >
                    Edit
                  </Button>

                  <Button
                    variant="danger"
                    onClick={() => handleDelete(client.id)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <p className="text-slate-500">No clients found.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}