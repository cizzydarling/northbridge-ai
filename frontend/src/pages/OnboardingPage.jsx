import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProfile, getMyProfile, updateMyProfile } from "../api";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

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

export default function OnboardingPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState(defaultForm);
  const [profileExists, setProfileExists] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(1);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const res = await getMyProfile();
        if (!mounted) return;

        setForm({
          ...defaultForm,
          ...res.data,
        });
        setProfileExists(true);
      } catch (err) {
        if (err?.response?.status === 404) {
          setProfileExists(false);
        } else {
          setMessage("Unable to load onboarding information.");
        }
      } finally {
        if (mounted) {
          setPageLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const progress = useMemo(() => {
    return step === 1 ? 50 : 100;
  }, [step]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function nextStep() {
    setStep(2);
    setMessage("");
  }

  function previousStep() {
    setStep(1);
    setMessage("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const payload = {
        ...form,
        age: Number(form.age),
        language_score: Number(form.language_score),
        experience_years: Number(form.experience_years),
        occupation: form.occupation?.trim() || null,
        noc_code: form.noc_code?.trim() || null,
        preferred_province: form.preferred_province || null,
        first_name: form.first_name?.trim() || null,
        last_name: form.last_name?.trim() || null,
        nationality: form.nationality?.trim() || null,
        current_country: form.current_country?.trim() || null,
        current_city: form.current_city?.trim() || null,
        phone_number: form.phone_number?.trim() || null,
        date_of_birth: form.date_of_birth || null,
        marital_status: form.marital_status || null,
        preferred_language: form.preferred_language || "en",
      };

      if (profileExists) {
        await updateMyProfile(payload);
      } else {
        await createProfile(payload);
        setProfileExists(true);
      }

      navigate("/dashboard");
    } catch (err) {
      setMessage(
        err?.response?.data?.detail || "Failed to save onboarding details."
      );
    } finally {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading onboarding...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-600">NorthBridgeAI</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Welcome — let’s set up your profile
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Complete a few key details so your strategy, AI guidance, and
            documents are personalized from the start.
          </p>
        </div>

        <Card className="p-6">
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>Step {step} of 2</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Personal details
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    These details help us personalize your experience and your
                    generated documents.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="First Name"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                  />

                  <Input
                    label="Last Name"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                  />

                  <Input
                    label="Nationality"
                    name="nationality"
                    value={form.nationality}
                    onChange={handleChange}
                  />

                  <Input
                    label="Country of Residence"
                    name="current_country"
                    value={form.current_country}
                    onChange={handleChange}
                  />

                  <Input
                    label="City"
                    name="current_city"
                    value={form.current_city}
                    onChange={handleChange}
                  />

                  <Input
                    label="Phone Number"
                    name="phone_number"
                    value={form.phone_number}
                    onChange={handleChange}
                  />

                  <Input
                    label="Date of Birth"
                    name="date_of_birth"
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

                <div className="flex justify-end">
                  <Button type="button" onClick={nextStep}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Immigration profile
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    These details power your strategy engine and recommendation
                    logic.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Age"
                    name="age"
                    type="number"
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
                    label="Language Score"
                    name="language_score"
                    type="number"
                    value={form.language_score}
                    onChange={handleChange}
                  />

                  <Input
                    label="Experience Years"
                    name="experience_years"
                    type="number"
                    value={form.experience_years}
                    onChange={handleChange}
                  />

                  <Input
                    label="Occupation"
                    name="occupation"
                    value={form.occupation}
                    onChange={handleChange}
                  />

                  <Input
                    label="NOC Code"
                    name="noc_code"
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

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button type="button" variant="secondary" onClick={previousStep}>
                    Back
                  </Button>

                  <Button type="submit" disabled={loading}>
                    {loading ? "Saving..." : "Finish Setup"}
                  </Button>
                </div>
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {message}
              </div>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}