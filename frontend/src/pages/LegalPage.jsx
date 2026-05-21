import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { REQUIRED_DISCLOSURES } from "../data/legalDisclosures";

export default function LegalPage() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <Link to="/" className="text-sm font-semibold text-amber-700">
          NorthBridgeAI
        </Link>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">
            Legal
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Terms, Privacy, and Platform Disclosures
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            These notices explain the current platform scope. Registered users
            must actively accept the required disclosure set before accessing
            protected workspace features or starting checkout.
          </p>
        </section>

        <section className="mt-6 space-y-4">
          {REQUIRED_DISCLOSURES.map((item) => (
            <article
              key={item.type}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-950">
                  {t(item.titleKey, { defaultValue: item.defaultTitle })}
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {item.version}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {t(item.textKey, { defaultValue: item.defaultText })}
              </p>
            </article>
          ))}
        </section>

        <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-slate-600">
          <Link className="hover:text-slate-950" to="/auth">
            Sign in
          </Link>
          <Link className="hover:text-slate-950" to="/pricing">
            Pricing
          </Link>
          <Link className="hover:text-slate-950" to="/">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
