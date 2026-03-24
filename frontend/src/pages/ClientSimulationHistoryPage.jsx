import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import {
  getClient,
  getClientSimulations,
  updateClientSimulation,
  deleteClientSimulation,
  getToken,
  logoutUser,
} from "../api";
import SimulationCard from "../components/SimulationCard";

export default function ClientSimulationHistoryPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [simulations, setSimulations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const fetchSimulations = async () => {
    try {
      setLoading(true);
      setMessage("");

      const token = getToken();
      if (!token) {
        navigate("/auth");
        return;
      }

      const [clientData, data] = await Promise.all([
        getClient(clientId),
        getClientSimulations(clientId),
      ]);

      setClient(clientData);
      setSimulations(data || []);
    } catch (err) {
      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      setMessage(
        err.response?.data?.detail || "Failed to load saved simulations."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimulations();
  }, [clientId]);

  const handleRename = async (simulation) => {
    const newName = window.prompt("Enter a new scenario name:", simulation.name);
    if (!newName || newName.trim() === simulation.name) return;

    try {
      const updated = await updateClientSimulation(clientId, simulation.id, {
        name: newName.trim(),
      });

      setSimulations((prev) =>
        prev.map((item) => (item.id === simulation.id ? updated : item))
      );
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to rename simulation.");
    }
  };

  const handleDelete = async (simulation) => {
    const confirmed = window.confirm(
      `Delete "${simulation.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteClientSimulation(clientId, simulation.id);
      setSimulations((prev) => prev.filter((item) => item.id !== simulation.id));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete simulation.");
    }
  };

  const handleCompare = (simulation) => {
    navigate(`/clients/${clientId}/simulations/compare?first=${simulation.id}`);
  };

  const handleOpen = (simulation) => {
    navigate(`/clients/${clientId}/simulations`, {
      state: { selectedSimulation: simulation },
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          Loading saved simulations...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {client?.full_name || "Client"} — Saved Simulation Scenarios
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Review, rename, compare, reopen, and manage past client simulation
            scenarios.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate(`/clients/${clientId}`)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Overview
          </button>

          <button
            onClick={() => navigate(`/clients/${clientId}/simulations`)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            New Simulation
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {message}
        </div>
      )}

      {simulations.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            No saved simulations yet
          </h2>
          <p className="mt-2 text-slate-600">
            Run a simulation and save it to start building scenario history for
            this client.
          </p>
          <button
            onClick={() => navigate(`/clients/${clientId}/simulations`)}
            className="mt-5 rounded-xl bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
          >
            Go to Simulation Workspace
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {simulations.map((simulation) => (
            <SimulationCard
              key={simulation.id}
              simulation={simulation}
              onOpen={handleOpen}
              onCompare={handleCompare}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </Layout>
  );
}