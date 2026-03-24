import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCurrentUserLocal, getToken } from "../api";

export default function PricingPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const token = getToken();
  const user = getCurrentUserLocal();

  function switchLanguage(lang) {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
  }

  function handlePrimaryAction() {
    if (!token || !user) {
      navigate("/auth");
      return;
    }

    const isAgent = user?.plan === "agent" || user?.role === "agent";

    if (isAgent) {
      navigate("/clients");
    } else {
      navigate("/self/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              {t("common.appName")}
            </p>
            <p className="text-xs text-slate-500">{t("pricing.pageLabel")}</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={i18n.language}
              onChange={(e) => switchLanguage(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="en">{t("common.english")}</option>
              <option value="fr">{t("common.french")}</option>
            </select>

            <button
              onClick={() => navigate("/")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("pricing.home")}
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("pricing.signIn")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">
            {t("pricing.title")}
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            {t("pricing.subtitle")}
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
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
            onClick={() => navigate("/auth")}
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
            ]}
            buttonLabel={t("pricing.pro.button")}
            onClick={handlePrimaryAction}
          />
        </div>

        <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">
            {t("pricing.availableTitle")}
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              {t("common.appName")}
            </p>
            <p className="mt-2 text-sm text-slate-600">{t("pricing.pageLabel")}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">
              {t("pricing.footer.backHome")}
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-3 block text-sm text-slate-600 hover:underline"
            >
              {t("pricing.home")}
            </button>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">
              {t("pricing.footer.legal")}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {t("pricing.footer.disclaimer")}
            </p>
          </div>
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
}) {
  return (
    <div
      className={`rounded-3xl border p-8 shadow-sm ${
        featured
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <p
        className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
          featured
            ? "bg-white/10 text-slate-100"
            : "bg-blue-50 text-blue-700"
        }`}
      >
        {badge}
      </p>

      <h2 className="mt-5 text-3xl font-bold">{title}</h2>
      <p className="mt-2 text-2xl font-semibold">{price}</p>
      <p className={`mt-3 text-sm ${featured ? "text-slate-300" : "text-slate-600"}`}>
        {subtitle}
      </p>

      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li
            key={feature}
            className={`rounded-xl border px-4 py-3 text-sm ${
              featured
                ? "border-white/10 bg-white/5 text-slate-100"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={onClick}
        className={`mt-8 w-full rounded-xl px-4 py-3 text-sm font-medium ${
          featured
            ? "bg-white text-slate-900 hover:bg-slate-100"
            : "bg-slate-900 text-white hover:bg-slate-800"
        }`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}

function IncludedCard({ title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}