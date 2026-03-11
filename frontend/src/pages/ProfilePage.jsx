import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
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
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      const payload = {
        ...form,
        age: Number(form.age),
        language_score: Number(form.language_score),
        experience_years: Number(form.experience_years),
      };

      try {
        await api.post("/profiles/create", payload);
      } catch (err) {
        if (err.response?.status === 400) {
          await api.put("/profiles/me", payload);
        } else {
          throw err;
        }
      }

      navigate("/strategy");
    } catch (err) {
      setMessage(err.response?.data?.detail || "Failed to save profile.");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm font-semibold text-blue-600">NorthBridgeAI</p>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">
              Your Immigration Profile
            </h1>
          </div>
          <button
            onClick={logout}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Logout
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white shadow-xl border border-slate-200 p-6 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              name="age"
              type="number"
              value={form.age}
              onChange={handleChange}
              placeholder="Age"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
            <input
              name="education"
              value={form.education}
              onChange={handleChange}
              placeholder="Education"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
            <input
              name="language_score"
              type="number"
              value={form.language_score}
              onChange={handleChange}
              placeholder="Language Score"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
            <input
              name="experience_years"
              type="number"
              value={form.experience_years}
              onChange={handleChange}
              placeholder="Experience Years"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
            <input
              name="occupation"
              value={form.occupation}
              onChange={handleChange}
              placeholder="Occupation"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
            <input
              name="noc_code"
              value={form.noc_code}
              onChange={handleChange}
              placeholder="NOC Code"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
            <input
              name="preferred_province"
              value={form.preferred_province}
              onChange={handleChange}
              placeholder="Preferred Province"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 md:col-span-2"
            />
          </div>

          <div className="grid gap-3">
            <label className="flex items-center gap-3 text-slate-700">
              <input
                type="checkbox"
                name="has_job_offer"
                checked={form.has_job_offer}
                onChange={handleChange}
              />
              Has job offer
            </label>
            <label className="flex items-center gap-3 text-slate-700">
              <input
                type="checkbox"
                name="has_canadian_experience"
                checked={form.has_canadian_experience}
                onChange={handleChange}
              />
              Has Canadian experience
            </label>
            <label className="flex items-center gap-3 text-slate-700">
              <input
                type="checkbox"
                name="studied_in_canada"
                checked={form.studied_in_canada}
                onChange={handleChange}
              />
              Studied in Canada
            </label>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-slate-900 text-white py-3 font-medium"
            >
              Save Profile
            </button>
            <button
              type="button"
              onClick={() => navigate("/strategy")}
              className="flex-1 rounded-xl border border-slate-300 bg-white py-3 font-medium text-slate-700"
            >
              View Strategy
            </button>
          </div>

          {message && <p className="text-sm text-red-600">{message}</p>}
        </form>
      </div>
    </div>
  );
}