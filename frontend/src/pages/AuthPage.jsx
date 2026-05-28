import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  loginUser,
  registerUser,
  confirmEmail,
  requestPasswordReset,
  resetPassword,
  setToken,
  setCurrentUserLocal,
  refreshCurrentUser,
} from "../api";

import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

function getErrorMessage(err, fallback = "Something went wrong.") {
  if (!err.response) {
    return "Unable to connect to server. Please check your connection.";
  }

  const detail = err.response?.data?.detail;
  const message = err.response?.data?.message;

  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === "string") return first;
    if (first?.msg) return first.msg;
    return "Request validation failed.";
  }

  if (detail && typeof detail === "object") {
    return detail.msg || "Request validation failed.";
  }

  if (typeof message === "string" && message.trim()) return message;

  return fallback;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [isLogin, setIsLogin] = useState(true);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetToken, setResetToken] = useState("");
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
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const confirmToken = params.get("confirm_token");
    const passwordToken = params.get("reset_token");

    if (passwordToken) {
      setResetToken(passwordToken);
      setForgotMode(false);
      setIsLogin(true);
      return;
    }

    if (!confirmToken) return;

    setLoading(true);
    confirmEmail(confirmToken)
      .then(() => {
        setMessage(
          i18n.language === "fr"
            ? "Email confirme. Vous pouvez vous connecter."
            : "Email confirmed. You can sign in."
        );
      })
      .catch((err) => {
        setMessage(getErrorMessage(err, "Unable to confirm email."));
      })
      .finally(() => {
        setLoading(false);
        const next = new URL(window.location.href);
        next.searchParams.delete("confirm_token");
        window.history.replaceState({}, "", next.toString());
      });
  }, [i18n.language]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (resetToken) {
        await resetPassword({
          token: resetToken,
          password: form.password,
        });
        setMessage(
          i18n.language === "fr"
            ? "Mot de passe reinitialise. Vous pouvez vous connecter."
            : "Password reset. You can sign in."
        );
        setResetToken("");
        setForm((prev) => ({ ...prev, password: "" }));
      } else if (forgotMode) {
        await requestPasswordReset(form.email);
        setMessage(
          i18n.language === "fr"
            ? "Si ce compte existe, un email de reinitialisation a ete envoye."
            : "If that account exists, a password reset email has been sent."
        );
        setForgotMode(false);
      } else if (isLogin) {
        const res = await loginUser({
          email: form.email,
          password: form.password,
        });

        const token = res?.data?.access_token;
        const returnedUser = res?.data?.user;

        if (!token) throw new Error("No token returned");

        setToken(token);
        if (returnedUser) setCurrentUserLocal(returnedUser);

        const freshUser = await refreshCurrentUser();
        const user = freshUser?.data || freshUser || returnedUser;

        if (!user) throw new Error("User resolution failed");

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
        setForm((prev) => ({
          ...prev,
          password: "",
        }));
      }
    } catch (err) {
      console.error(err);
      setMessage(
        getErrorMessage(
          err,
          isLogin ? t("auth.loginFailed") : t("auth.registrationFailed")
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const heroTitle =
    i18n.language === "fr"
      ? "Planifiez votre immigration avec clarté et confiance"
      : "Plan your immigration with clarity and confidence";

  const heroSubtitle =
    i18n.language === "fr"
      ? "NorthBridgeAI vous guide étape par étape avec une stratégie personnalisée, des actions concrètes et un accompagnement intelligent."
      : "NorthBridgeAI guides you step-by-step with a personalized strategy, clear actions, and intelligent support.";

  const isSuccessMessage =
    message &&
    (message.toLowerCase().includes("success") ||
      message.toLowerCase().includes("successfully") ||
      message.toLowerCase().includes("confirmed") ||
      message.toLowerCase().includes("sent") ||
      message.toLowerCase().includes("confirme") ||
      message.toLowerCase().includes("envoye") ||
      message.toLowerCase().includes("succès"));

  const formTitle = resetToken
    ? i18n.language === "fr"
      ? "Reinitialiser le mot de passe"
      : "Reset password"
    : forgotMode
    ? i18n.language === "fr"
      ? "Recevoir un lien"
      : "Get a reset link"
    : isLogin
    ? t("auth.welcomeBack")
    : t("auth.createAccount");

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#172033] lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_28%)]" />

          <div className="relative flex w-full flex-col justify-between p-10 xl:p-14">
            <div>
              <Link to="/" className="inline-flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-950 shadow-sm">
                  NB
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {t("app.name")}
                  </p>
                  <p className="text-xs text-white/55">{t("app.tagline")}</p>
                </div>
              </Link>

              <div className="mt-16 max-w-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
                  {isLogin ? t("auth.welcomeBack") : t("auth.createAccount")}
                </p>

                <h1 className="mt-4 text-4xl font-bold leading-tight text-white xl:text-5xl">
                  {heroTitle}
                </h1>

                <p className="mt-5 text-lg leading-8 text-slate-300">
                  {heroSubtitle}
                </p>

              </div>

              <div className="mt-10 grid max-w-xl gap-4 sm:grid-cols-3">
                <FeatureStat
                  value="AI"
                  label={
                    i18n.language === "fr"
                      ? "Stratégie intelligente"
                      : "Smart strategy engine"
                  }
                />
                <FeatureStat
                  value="Step-by-step"
                  label={
                    i18n.language === "fr"
                      ? "Guidance claire"
                      : "Clear guidance"
                  }
                />
                <FeatureStat
                  value="Real-time"
                  label={
                    i18n.language === "fr"
                      ? "Actions personnalisées"
                      : "Personalized actions"
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <PreviewCard
                title={
                  i18n.language === "fr"
                    ? "Votre stratégie complète"
                    : "Your full strategy"
                }
                text={
                  i18n.language === "fr"
                    ? "Comprenez exactement où vous en êtes et ce que vous devez faire ensuite."
                    : "Understand exactly where you stand and what to do next."
                }
              />

              <PreviewCard
                title={i18n.language === "fr" ? "Copilote IA" : "AI Copilot"}
                text={
                  i18n.language === "fr"
                    ? "Posez vos questions et recevez des réponses adaptées à votre profil."
                    : "Ask questions and get answers tailored to your profile."
                }
                featured
              />
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="w-full max-w-md">
            <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
              <Link to="/" className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white shadow-sm">
                  NB
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {t("app.name")}
                  </p>
                  <p className="text-xs text-slate-500">{t("app.tagline")}</p>
                </div>
              </Link>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => switchLanguage("en")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    i18n.language === "en"
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => switchLanguage("fr")}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    i18n.language === "fr"
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  FR
                </button>
              </div>
            </div>

            <Card variant="elevated" padding="lg" className="shadow-xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-amber-700">
                    {t("app.name")}
                  </p>
                  <h1 className="mt-1 text-3xl font-bold text-slate-900">
                    {formTitle}
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {t("auth.subtitle")}
                  </p>
                </div>

                <div className="hidden items-center gap-2 lg:flex">
                  <button
                    type="button"
                    onClick={() => switchLanguage("en")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      i18n.language === "en"
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => switchLanguage("fr")}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                      i18n.language === "fr"
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    FR
                  </button>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setForgotMode(false);
                    setResetToken("");
                    setMessage("");
                  }}
                  className={`flex h-11 items-center justify-center rounded-xl text-sm font-medium transition ${
                    isLogin
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t("auth.login")}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setForgotMode(false);
                    setResetToken("");
                    setMessage("");
                  }}
                  className={`flex h-11 items-center justify-center rounded-xl text-sm font-medium transition ${
                    !isLogin
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {t("auth.register")}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {!resetToken && (
                  <Input
                    label={t("auth.email")}
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                  />
                )}

                {!forgotMode && (
                  <Input
                    label={t("auth.password")}
                    type="password"
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    required
                  />
                )}

                {!isLogin && !forgotMode && !resetToken && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      {t("auth.role", { defaultValue: "Role" })}
                    </label>
                    <select
                      name="role"
                      value={form.role}
                      onChange={handleChange}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                    >
                      <option value="individual">{t("auth.individual")}</option>
                      <option value="agent">{t("auth.agent")}</option>
                    </select>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full text-base font-semibold"
                >
                  {loading
                    ? t("auth.pleaseWait")
                    : resetToken
                    ? i18n.language === "fr"
                      ? "Enregistrer le nouveau mot de passe"
                      : "Save new password"
                    : forgotMode
                    ? i18n.language === "fr"
                      ? "Envoyer le lien"
                      : "Send reset link"
                    : isLogin
                    ? i18n.language === "fr"
                      ? "Accéder à mon espace"
                      : "Access my workspace"
                    : i18n.language === "fr"
                    ? "Créer mon compte"
                    : "Create my account"}
                </Button>
              </form>

              {message && (
                <div
                  className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                    isSuccessMessage
                      ? "border border-green-200 bg-green-50 text-green-700"
                      : "border border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {message}
                </div>
              )}

              <div className="mt-6 border-t border-slate-200 pt-6">
                {isLogin && !forgotMode && !resetToken && (
                  <button
                    type="button"
                    className="mb-4 w-full text-center text-sm font-medium text-amber-700 hover:text-amber-800"
                    onClick={() => {
                      setForgotMode(true);
                      setMessage("");
                    }}
                  >
                    {i18n.language === "fr"
                      ? "Mot de passe oublie ?"
                      : "Forgot password?"}
                  </button>
                )}

                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 w-full"
                  onClick={() => {
                    if (forgotMode || resetToken) {
                      setForgotMode(false);
                      setResetToken("");
                      setIsLogin(true);
                    } else {
                      setIsLogin(!isLogin);
                    }
                    setMessage("");
                  }}
                >
                  {forgotMode || resetToken
                    ? t("auth.switchToLogin")
                    : isLogin
                    ? t("auth.switchToRegister")
                    : t("auth.switchToLogin")}
                </Button>

                <p className="mt-4 text-center text-xs text-slate-500">
                  {i18n.language === "fr"
                    ? "Aucune donnée n’est partagée. Plateforme sécurisée."
                    : "Your data is secure. No information is shared."}
                </p>

                <p className="mt-4 text-center text-sm text-slate-500">
                  {i18n.language === "fr"
                    ? "En continuant, vous accédez à une plateforme de planification et de soutien informatif."
                    : "By continuing, you access a planning and informational support platform."}
                </p>

                <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs font-medium text-slate-500">
                  <Link className="hover:text-slate-900" to="/legal">
                    Legal
                  </Link>
                  <Link className="hover:text-slate-900" to="/terms">
                    Terms
                  </Link>
                  <Link className="hover:text-slate-900" to="/privacy">
                    Privacy
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

function FeatureStat({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-300">{label}</p>
    </div>
  );
}

function PreviewCard({ title, text, featured = false }) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        featured
          ? "border border-amber-200/50 bg-white/15"
          : "border border-white/10 bg-white/5"
      }`}
    >
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}
