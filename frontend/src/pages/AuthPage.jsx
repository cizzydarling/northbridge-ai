import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  loginUser,
  registerUser,
  setToken,
  setCurrentUserLocal,
  refreshCurrentUser,
} from "../api";

function getErrorMessage(err, fallback = "Something went wrong.") {
  if (!err.response) {
    return "Unable to connect to server. Please check your connection.";
  }

  const detail = err.response?.data?.detail;
  const message = err.response?.data?.message;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === "string") return first;
    if (first?.msg) return first.msg;
    return "Request validation failed.";
  }

  if (detail && typeof detail === "object") {
    return detail.msg || "Request validation failed.";
  }

  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return fallback;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "individual",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function switchLanguage(lang) {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
    window.location.reload();
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (isLogin) {
        const res = await loginUser({
          email: form.email,
          password: form.password,
        });

        const token = res?.data?.access_token;
        const returnedUser = res?.data?.user;

        if (!token) {
          throw new Error("No token returned from server.");
        }

        setToken(token);

        if (returnedUser) {
          setCurrentUserLocal(returnedUser);
        }

        const freshUser = await refreshCurrentUser();
        const user = freshUser || returnedUser;

        if (!user) {
          throw new Error("Unable to resolve user after login.");
        }

        if (user.role === "agent" || user.plan === "agent_pro") {
          navigate("/clients");
        } else {
          navigate("/dashboard");
        }
      } else {
        await registerUser({
          email: form.email,
          password: form.password,
          role: form.role,
        });

        setMessage(t("auth.registrationSuccess"));
        setIsLogin(true);
        setForm((prev) => ({ ...prev, password: "" }));
      }
    } catch (err) {
      console.error("AUTH ERROR:", err);
      console.error("AUTH ERROR RESPONSE:", err.response?.data);

      setMessage(
        getErrorMessage(
          err,
          isLogin ? "Login failed." : "Registration failed."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              {t("app.name")}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {isLogin ? t("auth.welcomeBack") : t("auth.createAccount")}
            </h1>
            <p className="mt-2 text-slate-500">{t("auth.subtitle")}</p>
          </div>

          <select
            value={i18n.language}
            onChange={(e) => switchLanguage(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="en">{t("common.english")}</option>
            <option value="fr">{t("common.french")}</option>
          </select>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            name="email"
            placeholder={t("auth.email")}
            value={form.email}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            required
          />

          <input
            type="password"
            name="password"
            placeholder={t("auth.password")}
            value={form.password}
            onChange={handleChange}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            required
          />

          {!isLogin && (
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value="individual">{t("auth.individual")}</option>
              <option value="agent">{t("auth.agent")}</option>
            </select>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 py-3 font-medium text-white"
          >
            {loading
              ? t("auth.pleaseWait")
              : isLogin
              ? t("auth.login")
              : t("auth.register")}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setMessage("");
          }}
          className="mt-4 w-full rounded-xl border border-slate-300 py-3 font-medium text-slate-700"
        >
          {isLogin ? t("auth.switchToRegister") : t("auth.switchToLogin")}
        </button>
      </div>
    </div>
  );
}