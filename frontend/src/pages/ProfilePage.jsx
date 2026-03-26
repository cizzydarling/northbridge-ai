import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import {
  createProfile,
  getMyProfile,
  updateMyProfile,
  logoutUser,
  getToken,
} from "../api";

import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const defaultForm = {
  age: 30,
  education: "master",
  language_score: 8,
  experience_years: 5,
  has_job_offer: false,
  has_canadian_experience: false,
  studied_in_canada: false,
  occupation: "",
  noc_code: "",
  preferred_province: "",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = getToken();

      if (!token) {
        navigate("/auth");
        return;
      }

      try {
        const response = await getMyProfile();
        const data = response.data;

        setForm({
          age: data.age ?? 30,
          education: data.education ?? "master",
          language_score: data.language_score ?? 8,
          experience_years: data.experience_years ?? 5,
          has_job_offer: data.has_job_offer ?? false,
          has_canadian_experience: data.has_canadian_experience ?? false,
          studied_in_canada: data.studied_in_canada ?? false,
          occupation: data.occupation ?? "",
          noc_code: data.noc_code ?? "",
          preferred_province: data.preferred_province ?? "",
        });

        setProfileExists(true);
      } catch (err) {
        console.error(err);

        if (err.response?.status === 404) {
          setProfileExists(false);
        } else if (err.response?.status === 401) {
          logoutUser();
          navigate("/auth");
          return;
        } else {
          setMessage(
            err.response?.data?.detail ||
              t("profile.loadError", {
                defaultValue: "Could not load profile.",
              })
          );
        }
      } finally {
        setPageLoading(false);
      }
    };

    fetchProfile();
  }, [navigate, t]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const payload = {
        ...form,
        age: Number(form.age),
        language_score: Number(form.language_score),
        experience_years: Number(form.experience_years),
        occupation: form.occupation?.trim() || null,
        noc_code: form.noc_code?.trim() || null,
        preferred_province: form.preferred_province || null,
      };

      if (profileExists) {
        await updateMyProfile(payload);
      } else {
        await createProfile(payload);
        setProfileExists(true);
      }

      navigate("/strategy");
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      setMessage(
        err.response?.data?.detail ||
          t("profile.saveError", {
            defaultValue: "Failed to save profile.",
          })
      );
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
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
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <p className="text-sm font-semibold">{t("app.name")}</p>
          <h1 className="text-3xl font-bold">{t("profile.title")}</h1>
          <p className="text-slate-600">{t("profile.subtitle")}</p>
        </div>

        <Card className="p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label={t("profile.age")}
                name="age"
                type="number"
                value={form.age}
                onChange={handleChange}
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {t("profile.education")}
                </label>
                <select
                  name="education"
                  value={form.education}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="high school">High School</option>
                  <option value="diploma">Diploma</option>
                  <option value="bachelor">Bachelor</option>
                  <option value="master">Master</option>
                  <option value="phd">PhD</option>
                </select>
              </div>

              <Input
                label={t("profile.languageScore")}
                name="language_score"
                type="number"
                value={form.language_score}
                onChange={handleChange}
              />

              <Input
                label={t("profile.experienceYears")}
                name="experience_years"
                type="number"
                value={form.experience_years}
                onChange={handleChange}
              />

              <Input
                label={t("profile.occupation")}
                name="occupation"
                value={form.occupation}
                onChange={handleChange}
              />

              <Input
                label={t("profile.nocCode")}
                name="noc_code"
                value={form.noc_code}
                onChange={handleChange}
              />

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {t("profile.province")}
                </label>
                <select
                  name="preferred_province"
                  value={form.preferred_province}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">Select a province</option>
                  <option value="Ontario">Ontario</option>
                  <option value="Quebec">Quebec</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Saving..." : "Save Profile"}
              </Button>

              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => navigate("/strategy")}
              >
                View Strategy
              </Button>
            </div>

            {message && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-600">
                {message}
              </div>
            )}
          </form>
        </Card>
      </div>
    </Layout>
  );
}