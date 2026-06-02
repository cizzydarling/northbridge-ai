import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Button from "../components/ui/Button";
import {
  createAdminPromoCode,
  getAdminPromoCodes,
  getCurrentUserLocal,
  updateAdminPromoCode,
} from "../api";

const ACCESS_OPTIONS = [
  { value: "individual_pro", label: "Individual Pro" },
  { value: "individual_premium", label: "Individual Premium" },
  { value: "agent_pro", label: "Agent Pro" },
];

const STARTER_CODES = [
  {
    code: "NB-FOUNDER-2026",
    access_type: "individual_premium",
    duration_days: 60,
    max_uses: 100,
    description: "Founder beta premium access",
  },
  {
    code: "ALPHA100",
    access_type: "individual_premium",
    duration_days: 30,
    max_uses: 100,
    description: "Alpha tester premium access",
  },
  {
    code: "MONTREALBETA",
    access_type: "individual_premium",
    duration_days: 60,
    max_uses: 75,
    description: "Montreal beta community access",
  },
  {
    code: "EARLYACCESS",
    access_type: "individual_pro",
    duration_days: 30,
    max_uses: 250,
    description: "Early access Pro trial",
  },
];

function normalizeDateInput(value) {
  if (!value) return null;
  return new Date(`${value}T23:59:59.000Z`).toISOString();
}

function formatDate(value, language) {
  if (!value) return language === "fr" ? "Aucune" : "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(language === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatAccessType(value) {
  return ACCESS_OPTIONS.find((option) => option.value === value)?.label || value;
}

function emptyForm() {
  return {
    code: "",
    access_type: "individual_premium",
    duration_days: 30,
    max_uses: 100,
    expires_at: "",
    active: true,
    description: "",
  };
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-amber-200 ${props.className || ""}`}
    />
  );
}

function SelectInput(props) {
  return (
    <select
      {...props}
      className={`h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-amber-200 ${props.className || ""}`}
    />
  );
}

export default function AdminPromoCodesPage() {
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";
  const currentUser = getCurrentUserLocal();

  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starterSaving, setStarterSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const text = useMemo(
    () =>
      language === "fr"
        ? {
            title: "Codes promotionnels",
            eyebrow: "Administration",
            subtitle:
              "Créez des codes d'accès temporaires pour les fondateurs, bêta-testeurs et partenaires.",
            createTitle: "Créer un code",
            code: "Code",
            access: "Accès",
            duration: "Durée en jours",
            maxUses: "Utilisations max",
            expires: "Expire le",
            description: "Description",
            active: "Actif",
            create: "Créer le code",
            starter: "Créer les codes fondateurs",
            existing: "Codes existants",
            status: "Statut",
            usage: "Utilisation",
            created: "Créé",
            actions: "Actions",
            refresh: "Actualiser",
            loading: "Chargement...",
            days: "jours",
            inactive: "Inactif",
            disable: "Désactiver",
            enable: "Activer",
            none: "Aucun code pour le moment.",
            denied: "Cette page est réservée aux administrateurs.",
            success: "Code créé.",
            starterSuccess: "Codes fondateurs créés ou déjà présents.",
            loadError: "Impossible de charger les codes.",
            saveError: "Impossible d'enregistrer le code.",
          }
        : {
            title: "Promo codes",
            eyebrow: "Administration",
            subtitle:
              "Create temporary access codes for founders, beta testers, and partners.",
            createTitle: "Create a code",
            code: "Code",
            access: "Access",
            duration: "Duration in days",
            maxUses: "Max uses",
            expires: "Expires on",
            description: "Description",
            active: "Active",
            create: "Create code",
            starter: "Create founder starter codes",
            existing: "Existing codes",
            status: "Status",
            usage: "Usage",
            created: "Created",
            actions: "Actions",
            refresh: "Refresh",
            loading: "Loading...",
            days: "days",
            inactive: "Inactive",
            disable: "Disable",
            enable: "Enable",
            none: "No codes yet.",
            denied: "This page is reserved for administrators.",
            success: "Code created.",
            starterSuccess: "Founder codes created or already present.",
            loadError: "Unable to load codes.",
            saveError: "Unable to save code.",
          },
    [language]
  );

  const loadCodes = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getAdminPromoCodes();
      setCodes(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setError(text.loadError);
    } finally {
      setLoading(false);
    }
  }, [text.loadError]);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  if (currentUser?.role !== "admin") {
    return (
      <Layout>
        <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          {text.denied}
        </section>
      </Layout>
    );
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await createAdminPromoCode({
        code: form.code,
        access_type: form.access_type,
        duration_days: Number(form.duration_days),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        expires_at: normalizeDateInput(form.expires_at),
        active: Boolean(form.active),
        description: form.description?.trim() || null,
      });
      setForm(emptyForm());
      setMessage(text.success);
      await loadCodes();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || text.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateStarterCodes() {
    setStarterSaving(true);
    setMessage("");
    setError("");

    try {
      for (const starterCode of STARTER_CODES) {
        try {
          await createAdminPromoCode({
            ...starterCode,
            active: true,
            expires_at: "2026-12-31T23:59:59.000Z",
          });
        } catch (err) {
          const detail = String(err?.response?.data?.detail || "");
          if (!detail.toLowerCase().includes("already exists")) {
            throw err;
          }
        }
      }
      setMessage(text.starterSuccess);
      await loadCodes();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || text.saveError);
    } finally {
      setStarterSaving(false);
    }
  }

  async function handleToggle(code) {
    setMessage("");
    setError("");

    try {
      await updateAdminPromoCode(code.id, { active: !code.active });
      await loadCodes();
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || text.saveError);
    }
  }

  return (
    <Layout>
      <section className="rounded-lg border border-slate-900/10 bg-[#172033] p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
          {text.eyebrow}
        </p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
              {text.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
              {text.subtitle}
            </p>
          </div>
          <Button
            variant="white"
            onClick={handleCreateStarterCodes}
            loading={starterSaving}
            disabled={starterSaving}
          >
            {text.starter}
          </Button>
        </div>
      </section>

      {message ? (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
          {error}
        </div>
      ) : null}

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
        >
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            {text.createTitle}
          </h2>
          <div className="mt-5 grid gap-4">
            <Field label={text.code}>
              <TextInput
                value={form.code}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
                }
                placeholder="NB-FOUNDER-2026"
                required
              />
            </Field>
            <Field label={text.access}>
              <SelectInput
                value={form.access_type}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, access_type: event.target.value }))
                }
              >
                {ACCESS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={text.duration}>
                <TextInput
                  type="number"
                  min="1"
                  value={form.duration_days}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, duration_days: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field label={text.maxUses}>
                <TextInput
                  type="number"
                  min="1"
                  value={form.max_uses}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, max_uses: event.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label={text.expires}>
              <TextInput
                type="date"
                value={form.expires_at}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, expires_at: event.target.value }))
                }
              />
            </Field>
            <Field label={text.description}>
              <TextInput
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Founder beta access"
              />
            </Field>
            <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, active: event.target.checked }))
                }
              />
              {text.active}
            </label>
            <Button type="submit" loading={saving} disabled={saving}>
              {text.create}
            </Button>
          </div>
        </form>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              {text.existing}
            </h2>
            <Button variant="secondary" size="sm" onClick={loadCodes}>
              {loading ? "..." : text.refresh}
            </Button>
          </div>

          <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
            <div className="min-w-[880px]">
              <div className="grid grid-cols-[1.05fr_1fr_0.75fr_0.75fr_0.85fr_1.1fr] bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                <div className="px-4 py-3">{text.code}</div>
                <div className="px-4 py-3">{text.access}</div>
                <div className="px-4 py-3">{text.usage}</div>
                <div className="px-4 py-3">{text.status}</div>
                <div className="px-4 py-3">{text.expires}</div>
                <div className="px-4 py-3">{text.actions}</div>
              </div>
              {codes.length ? (
                codes.map((code) => (
                  <div
                    key={code.id}
                    className="grid grid-cols-[1.05fr_1fr_0.75fr_0.75fr_0.85fr_1.1fr] items-center border-t border-slate-200 text-sm"
                  >
                    <div className="px-4 py-4">
                      <p className="font-semibold text-slate-950">{code.code}</p>
                      {code.description ? (
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                          {code.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="px-4 py-4 text-slate-700">
                      {formatAccessType(code.access_type)}
                      <p className="mt-1 text-xs text-slate-500">
                        {code.duration_days} {text.days}
                      </p>
                    </div>
                    <div className="px-4 py-4 text-slate-700">
                      {code.current_uses || 0}
                      {code.max_uses ? ` / ${code.max_uses}` : ""}
                    </div>
                    <div className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${
                          code.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {code.active ? text.active : text.inactive}
                      </span>
                    </div>
                    <div className="px-4 py-4 text-slate-700">
                      {formatDate(code.expires_at, language)}
                    </div>
                    <div className="px-4 py-4">
                      <Button
                        variant={code.active ? "danger" : "secondary"}
                        size="sm"
                        onClick={() => handleToggle(code)}
                      >
                        {code.active ? text.disable : text.enable}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="border-t border-slate-200 px-4 py-8 text-sm text-slate-500">
                  {loading ? text.loading : text.none}
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </Layout>
  );
}
