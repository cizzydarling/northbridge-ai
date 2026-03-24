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
        <div className="flex items-center justify-center px-4 py-10">
          <p className="text-lg text-slate-600">
            {t("profile.loading", { defaultValue: "Loading profile..." })}
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-600">{t("app.name")}</p>
          <h1 className="text-3xl font-bold text-slate-900">
            {t("profile.title")}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t("profile.subtitle")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("profile.age")}
              </label>
              <input
                name="age"
                type="number"
                min="18"
                max="100"
                value={form.age}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("profile.education")}
              </label>
              <select
                name="education"
                value={form.education}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="high school">
                  {t("profile.educationOptions.highSchool")}
                </option>
                <option value="diploma">
                  {t("profile.educationOptions.diploma")}
                </option>
                <option value="bachelor">
                  {t("profile.educationOptions.bachelor")}
                </option>
                <option value="master">
                  {t("profile.educationOptions.master")}
                </option>
                <option value="phd">
                  {t("profile.educationOptions.phd")}
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("profile.languageScore")}
              </label>
              <input
                name="language_score"
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={form.language_score}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("profile.experienceYears")}
              </label>
              <input
                name="experience_years"
                type="number"
                min="0"
                max="50"
                value={form.experience_years}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("profile.occupation")}
              </label>
              <input
                name="occupation"
                value={form.occupation}
                onChange={handleChange}
                placeholder={t("profile.placeholders.occupation", {
                  defaultValue: "e.g. Project Coordinator",
                })}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("profile.nocCode")}
              </label>
              <input
                name="noc_code"
                value={form.noc_code}
                onChange={handleChange}
                placeholder={t("profile.placeholders.nocCode", {
                  defaultValue: "e.g. 13100",
                })}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {t("profile.province")}
              </label>
              <select
                name="preferred_province"
                value={form.preferred_province}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">
                  {t("profile.selectProvince", {
                    defaultValue: "Select a province",
                  })}
                </option>
                <option value="Alberta">Alberta</option>
                <option value="British Columbia">British Columbia</option>
                <option value="Manitoba">Manitoba</option>
                <option value="New Brunswick">New Brunswick</option>
                <option value="Newfoundland and Labrador">
                  Newfoundland and Labrador
                </option>
                <option value="Nova Scotia">Nova Scotia</option>
                <option value="Ontario">Ontario</option>
                <option value="Prince Edward Island">
                  Prince Edward Island
                </option>
                <option value="Quebec">Quebec</option>
                <option value="Saskatchewan">Saskatchewan</option>
              </select>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-800">
              {t("profile.additionalInformation", {
                defaultValue: "Additional Information",
              })}
            </h2>

            <div className="grid gap-3">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-slate-700">
                <input
                  type="checkbox"
                  name="has_job_offer"
                  checked={form.has_job_offer}
                  onChange={handleChange}
                  className="h-4 w-4"
                />
                <span>{t("profile.hasJobOffer")}</span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-slate-700">
                <input
                  type="checkbox"
                  name="has_canadian_experience"
                  checked={form.has_canadian_experience}
                  onChange={handleChange}
                  className="h-4 w-4"
                />
                <span>{t("profile.hasCanadianExperience")}</span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-slate-700">
                <input
                  type="checkbox"
                  name="studied_in_canada"
                  checked={form.studied_in_canada}
                  onChange={handleChange}
                  className="h-4 w-4"
                />
                <span>{t("profile.studiedInCanada")}</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-slate-900 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? t("common.saving")
                : profileExists
                ? t("profile.updateProfile", {
                    defaultValue: "Update Profile",
                  })
                : t("profile.saveProfile")}
            </button>

            <button
              type="button"
              onClick={() => navigate("/strategy")}
              className="flex-1 rounded-xl border border-slate-300 bg-white py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("profile.viewStrategy", {
                defaultValue: "View Strategy",
              })}
            </button>
          </div>

          {message ? <p className="text-sm text-red-600">{message}</p> : null}
        </form>
      </div>
    </Layout>
  );
}