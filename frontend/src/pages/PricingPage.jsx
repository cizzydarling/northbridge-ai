import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCurrentUserLocal, getToken } from "../api";

export default function PricingPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const token = getToken();
  const user = getCurrentUserLocal();

  const [loadingPlan, setLoadingPlan] = useState("");
  const [message, setMessage] = useState("");

  function switchLanguage(lang) {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  }

  function handleFreeAction() {
    if (!token || !user) {
      navigate("/auth");
      return;
    }

    navigate("/self/dashboard");
  }

  async function handlePremiumAction() {
    try {
      setLoadingPlan("premium");
      setMessage("");

      if (!token || !user) {
        navigate("/auth");
        return;
      }

      /*
        Future billing hook:
        When your billing route is ready, replace this section with:
        const res = await createCheckoutSession({ plan: "premium" });
        if (res?.data?.checkout_url) {
          window.location.href = res.data.checkout_url;
          return;
        }
      */

      navigate("/self/dashboard");
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          t("pricing.error", {
            defaultValue:
              "Unable to start the premium flow right now. Please try again.",
          })
      );
    } finally {
      setLoadingPlan("");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <p className="font-semibold text-blue-600">{t("common.appName")}</p>

          <div className="flex gap-3">
            <select
              value={i18n.language}
              onChange={(e) => switchLanguage(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
            </select>

            <button
              onClick={() => navigate("/")}
              className="text-sm text-slate-600 hover:underline"
            >
              {t("pricing.home")}
            </button>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 px-4 py-16 text-white">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="text-4xl font-bold">{t("pricing.title")}</h1>
          <p className="mt-4 text-lg text-blue-100">{t("pricing.subtitle")}</p>

          <p className="mt-6 text-sm text-blue-200">
            {t("pricing.trustNote", {
              defaultValue:
                "Structured guidance. Clear next steps. No guesswork.",
            })}
          </p>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            <HeroMiniCard
              title={t("pricing.heroCards.0.title", {
                defaultValue: "Full strategy access",
              })}
              text={t("pricing.heroCards.0.text", {
                defaultValue:
                  "Unlock the complete immigration strategy experience.",
              })}
            />
            <HeroMiniCard
              title={t("pricing.heroCards.1.title", {
                defaultValue: "Better next steps",
              })}
              text={t("pricing.heroCards.1.text", {
                defaultValue:
                  "See clearer priorities and deeper action planning.",
              })}
            />
            <HeroMiniCard
              title={t("pricing.heroCards.2.title", {
                defaultValue: "Premium guidance",
              })}
              text={t("pricing.heroCards.2.text", {
                defaultValue:
                  "Access more complete advisor insights and roadmap content.",
              })}
            />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-16">
        {message ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <PricingCard
            badge={t("pricing.free.badge")}
            title={t("pricing.free.title")}
            price={t("pricing.free.price")}
            subtitle={t("pricing.free.subtitle")}
            features={[
              t("pricing.free.features.0"),
              t("pricing.free.features.1"),
              t("pricing.free.features.2"),
              t("pricing.free.features.3"),
            ]}
            buttonLabel={t("pricing.free.button")}
            onClick={handleFreeAction}
          />

          <PricingCard
            featured
            badge={t("pricing.pro.badge")}
            title={t("pricing.pro.title")}
            price={t("pricing.pro.price")}
            subtitle={t("pricing.pro.subtitle")}
            features={[
              t("pricing.pro.features.0"),
              t("pricing.pro.features.1"),
              t("pricing.pro.features.2"),
              t("pricing.pro.features.3"),
              t("pricing.pro.features.4", {
                defaultValue: "Full weaknesses analysis",
              }),
              t("pricing.pro.features.5", {
                defaultValue: "Complete advisor summary",
              }),
            ]}
            buttonLabel={
              loadingPlan === "premium"
                ? t("pricing.pro.loading", { defaultValue: "Loading..." })
                : t("pricing.pro.button")
            }
            onClick={handlePremiumAction}
            disabled={loadingPlan === "premium"}
          />
        </div>

        <div className="mt-16 rounded-3xl border bg-white p-8 shadow-sm">
          <h2 className="text-center text-2xl font-bold">
            {t("pricing.availableTitle")}
          </h2>

          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <IncludedCard
              title={t("pricing.available.cards.0.title")}
              text={t("pricing.available.cards.0.text")}
            />
            <IncludedCard
              title={t("pricing.available.cards.1.title")}
              text={t("pricing.available.cards.1.text")}
            />
            <IncludedCard
              title={t("pricing.available.cards.2.title")}
              text={t("pricing.available.cards.2.text")}
            />
            <IncludedCard
              title={t("pricing.available.cards.3.title")}
              text={t("pricing.available.cards.3.text")}
            />
          </div>
        </div>

        <div className="mt-16 rounded-3xl border border-blue-200 bg-blue-50 p-8">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold text-blue-700">
                {t("pricing.strategyUnlock.label", {
                  defaultValue: "Connected to your strategy page",
                })}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {t("pricing.strategyUnlock.title", {
                  defaultValue: "What Premium unlocks",
                })}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {t("pricing.strategyUnlock.text", {
                  defaultValue:
                    "Premium unlocks the sections currently gated on your strategy page, including deeper weaknesses analysis, stronger next-step planning, and fuller AI-generated guidance.",
                })}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <UnlockCard
                title={t("pricing.unlockCards.0.title", {
                  defaultValue: "Detailed weaknesses",
                })}
                text={t("pricing.unlockCards.0.text", {
                  defaultValue:
                    "See the profile gaps and blockers affecting your options.",
                })}
              />
              <UnlockCard
                title={t("pricing.unlockCards.1.title", {
                  defaultValue: "Smarter next steps",
                })}
                text={t("pricing.unlockCards.1.text", {
                  defaultValue:
                    "Get a clearer sequence of actions to improve your case.",
                })}
              />
              <UnlockCard
                title={t("pricing.unlockCards.2.title", {
                  defaultValue: "Full summary",
                })}
                text={t("pricing.unlockCards.2.text", {
                  defaultValue:
                    "Unlock the complete strategic advisor summary.",
                })}
              />
              <UnlockCard
                title={t("pricing.unlockCards.3.title", {
                  defaultValue: "Premium growth path",
                })}
                text={t("pricing.unlockCards.3.text", {
                  defaultValue:
                    "Prepare your account for future premium features.",
                })}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={handlePremiumAction}
              disabled={loadingPlan === "premium"}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loadingPlan === "premium"
                ? t("pricing.pro.loading", { defaultValue: "Loading..." })
                : t("pricing.pro.button")}
            </button>

            <button
              onClick={() => navigate("/strategy")}
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {t("pricing.backToStrategy", {
                defaultValue: "Back to Strategy",
              })}
            </button>
          </div>
        </div>
      </main>

      <footer className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-600">
          {t("pricing.footer.disclaimer")}
        </div>
      </footer>
    </div>
  );
}

function PricingCard({
  badge,
  title,
  price,
  subtitle,
  features,
  buttonLabel,
  onClick,
  featured = false,
  disabled = false,
}) {
  return (
    <div
      className={`rounded-3xl p-8 shadow-lg transition hover:scale-[1.01] ${
        featured ? "bg-slate-900 text-white" : "border bg-white"
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          featured ? "text-blue-300" : "text-blue-600"
        }`}
      >
        {badge}
      </p>

      <h2 className="mt-4 text-3xl font-bold">{title}</h2>
      <p className="mt-2 text-2xl">{price}</p>

      <p
        className={`mt-3 text-sm ${
          featured ? "text-slate-300" : "text-slate-600"
        }`}
      >
        {subtitle}
      </p>

      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="text-sm">
            ✓ {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={onClick}
        disabled={disabled}
        className={`mt-8 w-full rounded-xl py-3 font-medium transition ${
          featured
            ? "bg-white text-slate-900 disabled:opacity-70"
            : "bg-slate-900 text-white disabled:opacity-70"
        } disabled:cursor-not-allowed`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function IncludedCard({ title, text }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5 text-center">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function HeroMiniCard({ title, text }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-left backdrop-blur-sm">
      <h3 className="font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-blue-100">{text}</p>
    </div>
  );
}

function UnlockCard({ title, text }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{text}</p>
    </div>
  );
}