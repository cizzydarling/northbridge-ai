import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import {
  createProfile,
  getMyProfile,
  updateMyProfile,
  logoutUser,
  getToken,
  refreshCurrentUser,
} from "../api";

import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const defaultForm = {
  first_name: "",
  last_name: "",
  nationality: "",
  current_country: "",
  current_city: "",
  phone_number: "",
  date_of_birth: "",
  marital_status: "",
  preferred_language: "en",

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
          ...defaultForm,
          ...data,
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
          setMessage("Could not load profile.");
        }
      } finally {
        setPageLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

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
        first_name: form.first_name?.trim() || null,
        last_name: form.last_name?.trim() || null,
        nationality: form.nationality?.trim() || null,
        current_country: form.current_country?.trim() || null,
        current_city: form.current_city?.trim() || null,
        phone_number: form.phone_number?.trim() || null,
        date_of_birth: form.date_of_birth || null,
        marital_status: form.marital_status || null,
        preferred_language: form.preferred_language || "en",
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

      const currentUser =
        JSON.parse(localStorage.getItem("current_user") || "null") ||
        JSON.parse(localStorage.getItem("user") || "null") ||
        {};

      const patchedUser = {
        ...currentUser,
        first_name: payload.first_name,
        last_name: payload.last_name,
      };

      localStorage.setItem("current_user", JSON.stringify(patchedUser));
      localStorage.setItem("user", JSON.stringify(patchedUser));

      window.dispatchEvent(new Event("userUpdated"));

      await refreshCurrentUser();
      navigate("/strategy");
    } catch (err) {
      console.error(err);

      if (err.response?.status === 401) {
        logoutUser();
        navigate("/auth");
        return;
      }

      setMessage(err.response?.data?.detail || "Failed to save profile.");
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
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Your Profile</h1>
          <p className="text-slate-600">
            Complete your profile to improve your immigration strategy and
            personalize your experience.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="space-y-4 p-6">
            <h2 className="text-xl font-semibold">Personal Information</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                name="first_name"
                label="First Name"
                value={form.first_name}
                onChange={handleChange}
              />
              <Input
                name="last_name"
                label="Last Name"
                value={form.last_name}
                onChange={handleChange}
              />

              <Input
                name="nationality"
                label="Nationality"
                value={form.nationality}
                onChange={handleChange}
              />
              <Input
                name="current_country"
                label="Country"
                value={form.current_country}
                onChange={handleChange}
              />

              <Input
                name="current_city"
                label="City"
                value={form.current_city}
                onChange={handleChange}
              />
              <Input
                name="phone_number"
                label="Phone"
                value={form.phone_number}
                onChange={handleChange}
              />

              <Input
                name="date_of_birth"
                label="Date of Birth"
                type="date"
                value={form.date_of_birth}
                onChange={handleChange}
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Marital Status
                </label>
                <select
                  name="marital_status"
                  value={form.marital_status}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">Select</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="common-law">Common-law</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Preferred Language
                </label>
                <select
                  name="preferred_language"
                  value={form.preferred_language}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="en">English</option>
                  <option value="fr">French</option>
                </select>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-xl font-semibold">Immigration Profile</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                name="age"
                type="number"
                label="Age"
                value={form.age}
                onChange={handleChange}
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Education
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
                name="language_score"
                type="number"
                label="Language Score"
                value={form.language_score}
                onChange={handleChange}
              />

              <Input
                name="experience_years"
                type="number"
                label="Experience Years"
                value={form.experience_years}
                onChange={handleChange}
              />

              <Input
                name="occupation"
                label="Occupation"
                value={form.occupation}
                onChange={handleChange}
              />

              <Input
                name="noc_code"
                label="NOC Code"
                value={form.noc_code}
                onChange={handleChange}
              />

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Preferred Province
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
                  <option value="British Columbia">British Columbia</option>
                  <option value="Alberta">Alberta</option>
                  <option value="Manitoba">Manitoba</option>
                  <option value="Saskatchewan">Saskatchewan</option>
                  <option value="Nova Scotia">Nova Scotia</option>
                  <option value="New Brunswick">New Brunswick</option>
                  <option value="Prince Edward Island">
                    Prince Edward Island
                  </option>
                  <option value="Newfoundland and Labrador">
                    Newfoundland and Labrador
                  </option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="has_job_offer"
                  checked={form.has_job_offer}
                  onChange={handleChange}
                />
                Has job offer
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="has_canadian_experience"
                  checked={form.has_canadian_experience}
                  onChange={handleChange}
                />
                Has Canadian experience
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="studied_in_canada"
                  checked={form.studied_in_canada}
                  onChange={handleChange}
                />
                Studied in Canada
              </label>
            </div>
          </Card>

          <div className="flex gap-4">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Saving..." : "Save Profile"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/strategy")}
            >
              Continue
            </Button>
          </div>

          {message && <div className="text-red-500">{message}</div>}
        </form>
      </div>
    </Layout>
  );
}