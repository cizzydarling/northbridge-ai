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

import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

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
      try {
        const token = getToken();
        if (!token) return navigate("/auth");

        const clientRes = await getClientById(clientId);
        setClient(clientRes.data);

        try {
          const profileRes = await getClientProfile(clientId);
          const p = profileRes.data;

          setProfileExists(true);
          setForm({
            age: p.age ?? "",
            education: p.education ?? "",
            language_score: p.language_score ?? "",
            experience_years: p.experience_years ?? "",
            has_job_offer: Boolean(p.has_job_offer),
            has_canadian_experience: Boolean(p.has_canadian_experience),
            studied_in_canada: Boolean(p.studied_in_canada),
            occupation: p.occupation ?? "",
            noc_code: p.noc_code ?? "",
            preferred_province: p.preferred_province ?? "",
          });
        } catch (err) {
          if (err.response?.status === 404) {
            setProfileExists(false);
          } else throw err;
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

  const isFormValid = useMemo(() => {
    return (
      form.age &&
      form.education &&
      form.language_score &&
      form.experience_years
    );
  }, [form]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const payload = {
        age: Number(form.age),
        education: form.education,
        language_score: Number(form.language_score),
        experience_years: Number(form.experience_years),
        has_job_offer: form.has_job_offer,
        has_canadian_experience: form.has_canadian_experience,
        studied_in_canada: form.studied_in_canada,
        occupation: form.occupation || null,
        noc_code: form.noc_code || null,
        preferred_province: form.preferred_province || null,
      };

      const res = profileExists
        ? await updateClientProfile(clientId, payload)
        : await createClientProfile(clientId, payload);

      setProfileExists(true);
      setForm(res.data);

      setMessage(
        profileExists
          ? "Profile updated successfully."
          : "Profile created successfully."
      );
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.detail || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-10">
          <p className="text-slate-600">Loading profile...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
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

      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {client?.full_name} — Profile
        </h1>

        <Button
          variant="secondary"
          onClick={() => navigate(`/clients/${clientId}`)}
        >
          Back
        </Button>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="age" placeholder="Age" value={form.age} onChange={handleChange} />
          <Input name="education" placeholder="Education" value={form.education} onChange={handleChange} />
          <Input name="language_score" placeholder="Language Score" value={form.language_score} onChange={handleChange} />
          <Input name="experience_years" placeholder="Experience Years" value={form.experience_years} onChange={handleChange} />

          <Input name="occupation" placeholder="Occupation" value={form.occupation} onChange={handleChange} />
          <Input name="noc_code" placeholder="NOC Code" value={form.noc_code} onChange={handleChange} />
          <Input name="preferred_province" placeholder="Province" value={form.preferred_province} onChange={handleChange} />

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!isFormValid || saving}
              className="flex-1"
            >
              {saving ? "Saving..." : "Save Profile"}
            </Button>

            <Button
              variant="secondary"
              onClick={() => navigate(`/clients/${clientId}`)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </Layout>
  );
}