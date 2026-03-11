import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function AuthPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      if (isLogin) {
        const res = await api.post("/auth/login", form);
        localStorage.setItem("token", res.data.access_token);
        navigate("/profile");
      } else {
        await api.post("/auth/register", form);
        setMessage("Registration successful. You can now log in.");
        setIsLogin(true);
      }
    } catch (err) {
      console.log("AUTH ERROR:", err);
      console.log("AUTH ERROR RESPONSE:", err.response);

      setMessage(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          "Something went wrong."
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-8">
        <div className="mb-8">
          <p className="text-sm font-semibold text-blue-600">NorthBridgeAI</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-2">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-slate-500 mt-2">
            AI-powered Canadian immigration planning.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            required
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 text-white py-3 font-medium hover:opacity-95"
          >
            {isLogin ? "Login" : "Register"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full mt-4 rounded-xl border border-slate-300 py-3 font-medium text-slate-700 hover:bg-slate-50"
        >
          Switch to {isLogin ? "Register" : "Login"}
        </button>
      </div>
    </div>
  );
}