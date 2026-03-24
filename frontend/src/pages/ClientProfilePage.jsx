import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import {
  createClientProfile,
  getClientById,
  getClientProfile,
  getToken,
  logoutUser,
  updateClientProfile,
} from "../api";

const initialForm = {
  age: "",
  education: "",
  language_score: "",
  experience_years: "",
  has_job_offer: false,
  has_canadian_experience: false,
  studied_in_canada: false,
  occupation: "",
  noc_code: "",
  preferred_province: "",
};

export default function ClientProfilePage() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [profileExists, setProfileExists] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPageData = async () => {
      setLoading(true);
      setMessage("");

      try {
        const token = getToken();

        if (!token) {
          navigate("/auth");
          return;
        }

        const clientResponse = await getClientById(clientId);
        setClient(clientResponse.data);

        try {
          const profileResponse = await getClientProfile(clientId);
          const profile = profileResponse.data;

          setProfileExists(true);
          setForm({
            age: profile.age ?? "",
            education: profile.education ?? "",
            language_score: profile.language_score ?? "",
            experience_years: profile.experience_years ?? "",
            has_job_offer: Boolean(profile.has_job_offer),
            has_canadian_experience: Boolean(profile.has_canadian_experience),
            studied_in_canada: Boolean(profile.studied_in_canada),
            occupation: profile.occupation ?? "",
            noc_code: profile.noc_code ?? "",
            preferred_province: profile.preferred_province ?? "",
          });
        } catch (err) {
          if (err.response?.status === 404) {
            setProfileExists(false);
            setForm(initialForm);
          } else {
            throw err;
          }
        }
      } catch (err) {
        console.error(err);

        if (err.response?.status === 401) {
          logoutUser();
          navigate("/auth");
          return;
        }

        setMessage(err.response?.data?.detail || "Failed to load client profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchPageData();
  }, [clientId, navigate]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const buildPayload = () => {
    return {
      age: Number(form.age),
      education: form.education.trim(),
      language_score: Number(form.language_score),
      experience_years: Number(form.experience_years),
      has_job_offer: Boolean(form.has_job_offer),
      has_canadian_experience: Boolean(form.has_canadian_experience),
      studied_in_canada: Boolean(form.studied_in_canada),
      occupation: form.occupation.trim() || null,
      noc_code: form.noc_code.trim() || null,
      preferred_province: form.preferred_province.trim() || null,
    };
  };

  const isFormValid = useMemo(() => {
    return (
      String(form.age).trim() !== "" &&
      String(form.education).trim() !== "" &&
      String(form.language_score).trim() !== "" &&
      String(form.experience_years).trim() !== ""
    );
  }, [form]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const payload = buildPayload();

      let response;
      if (profileExists) {
        response = await updateClientProfile(clientId, payload);
      } else {
        response = await createClientProfile(clientId, payload);
      }

      const saved = response.data;

      setProfileExists(true);
      setForm({
        age: saved.age ?? "",
        education: saved.education ?? "",
        language_score: saved.language_score ?? "",
        experience_years: saved.experience_years ?? "",
        has_job_offer: Boolean(saved.has_job_offer),
        has_canadian_experience: Boolean(saved.has_canadian_experience),
        studied_in_canada: Boolean(saved.studied_in_canada),
        occupation: saved.occupation ?? "",
        noc_code: saved.noc_code ?? "",
        preferred_province: saved.preferred_province ?? "",
      });

      setMessage(
        profileExists
          ? "Client profile updated successfully."
          : "Client profile created successfully."
      );
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      setMessage(err.response?.data?.detail || "Failed to save client profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <p className="text-lg font-medium text-slate-700">Loading client profile...</p>
          <p className="mt-2 text-sm text-slate-500">
            Preparing the profile workspace for this client.
          </p>
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

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {client?.full_name || "Client"} — Profile
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Build the intake profile used for strategy, simulations, and planning.
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
            onClick={() => navigate(`/clients/${clientId}/strategy`)}
            className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Open Strategy
          </button>

          <button
            onClick={() => navigate(`/clients/${clientId}/simulations`)}
            className="rounded-xl border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
          >
            Open Simulations
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl xl:col-span-2">
          <h2 className="text-xl font-semibold text-slate-900">
            {profileExists ? "Edit Client Profile" : "Create Client Profile"}
          </h2>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Age" required>
                <input
                  name="age"
                  type="number"
                  min="0"
                  value={form.age}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>

              <Field label="Education" required>
                <select
                  name="education"
                  value={form.education}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                >
                  <option value="">Select education</option>
                  <option value="high_school">High School</option>
                  <option value="diploma">Diploma</option>
                  <option value="bachelor">Bachelor</option>
                  <option value="master">Master</option>
                  <option value="phd">PhD</option>
                </select>
              </Field>

              <Field label="Language Score" required>
                <input
                  name="language_score"
                  type="number"
                  min="0"
                  max="12"
                  value={form.language_score}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>

              <Field label="Experience (years)" required>
                <input
                  name="experience_years"
                  type="number"
                  min="0"
                  value={form.experience_years}
                  onChange={handleChange}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>

              <Field label="Occupation">
                <input
                  name="occupation"
                  value={form.occupation}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>

              <Field label="NOC Code">
                <input
                  name="noc_code"
                  value={form.noc_code}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>

              <Field label="Preferred Province">
                <input
                  name="preferred_province"
                  value={form.preferred_province}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
                />
              </Field>
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900">Profile Flags</h3>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <CheckboxCard
                  name="has_job_offer"
                  checked={form.has_job_offer}
                  onChange={handleChange}
                  label="Has job offer"
                />
                <CheckboxCard
                  name="has_canadian_experience"
                  checked={form.has_canadian_experience}
                  onChange={handleChange}
                  label="Has Canadian experience"
                />
                <CheckboxCard
                  name="studied_in_canada"
                  checked={form.studied_in_canada}
                  onChange={handleChange}
                  label="Studied in Canada"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving || !isFormValid}
                className="rounded-xl bg-slate-900 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? profileExists
                    ? "Updating..."
                    : "Creating..."
                  : profileExists
                  ? "Update Profile"
                  : "Create Profile"}
              </button>

              <button
                type="button"
                onClick={() => navigate(`/clients/${clientId}`)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900">Profile Guidance</h2>

          <div className="mt-5 space-y-4 text-sm text-slate-700">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              Complete the core profile first:
              <div className="mt-2 space-y-1 text-slate-600">
                <div>• age</div>
                <div>• education</div>
                <div>• language score</div>
                <div>• years of experience</div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              Occupation, NOC code, and preferred province help the strategy engine
              produce more useful recommendations.
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-slate-700">
              After saving this profile, continue to the strategy page or run
              simulations for scenario planning.
            </div>
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

function CheckboxCard({ name, checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 rounded border-slate-300"
      />
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
      </div>
    </label>
  );
}