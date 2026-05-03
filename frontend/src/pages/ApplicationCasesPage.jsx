import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  createApplicationCase,
  getApplicationCases,
  getHouseholdMembers,
} from "../api";

const ACTIVE_CASE_KEY = "nbai_active_application_case_id";

const EMPTY_CASE = {
  application_type: "permanent_residence",
  case_title: "",
  primary_applicant_member_id: "",
  target_country: "Canada",
  target_province: "",
  pathway: "",
  family_size: 1,
};

function PageHeader({ brand, title, subtitle }) {
  return (
    <div className="mb-6 max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
        {brand}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
        {subtitle}
      </p>
    </div>
  );
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

function inputClass() {
  return "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100";
}

function CaseBadge({ children }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
      {children}
    </span>
  );
}

function getMemberName(member) {
  return (
    [member?.first_name, member?.last_name].filter(Boolean).join(" ") || "—"
  );
}

export default function ApplicationCasesPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [cases, setCases] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeCaseId, setActiveCaseId] = useState(
    localStorage.getItem(ACTIVE_CASE_KEY) || ""
  );
  const [form, setForm] = useState(EMPTY_CASE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const text = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Demandes",
        subtitle:
          "Créez une demande active pour relier la stratégie, les documents et les formulaires au bon dossier.",
        existingCases: "Demandes existantes",
        createCase: "Créer une demande",
        noCases: "Aucune demande créée pour le moment.",
        active: "Active",
        setActive: "Définir active",
        openStrategy: "Ouvrir stratégie",
        openDocuments: "Ouvrir documents",
        applicationType: "Type de demande",
        caseTitle: "Titre du dossier",
        primaryApplicant: "Demandeur principal",
        targetProvince: "Province cible",
        pathway: "Parcours",
        familySize: "Taille de famille",
        save: "Créer",
        saving: "Création...",
        created: "Demande créée.",
        permanentResidence: "Résidence permanente",
        studyPermit: "Permis d’études",
        workPermit: "Permis de travail",
        visitorVisa: "Visa visiteur",
        sponsorship: "Parrainage",
        selectApplicant: "Sélectionner un demandeur",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "Applications",
      subtitle:
        "Create an active application case so strategy, documents, and forms connect to the right file.",
      existingCases: "Existing cases",
      createCase: "Create application case",
      noCases: "No application cases created yet.",
      active: "Active",
      setActive: "Set active",
      openStrategy: "Open strategy",
      openDocuments: "Open documents",
      applicationType: "Application type",
      caseTitle: "Case title",
      primaryApplicant: "Primary applicant",
      targetProvince: "Target province",
      pathway: "Pathway",
      familySize: "Family size",
      save: "Create",
      saving: "Creating...",
      created: "Application case created.",
      permanentResidence: "Permanent residence",
      studyPermit: "Study permit",
      workPermit: "Work permit",
      visitorVisa: "Visitor visa",
      sponsorship: "Sponsorship",
      selectApplicant: "Select applicant",
    };
  }, [language]);

  async function loadPage() {
    try {
      setLoading(true);
      setMessage("");

      const [casesRes, membersRes] = await Promise.all([
        getApplicationCases(),
        getHouseholdMembers(),
      ]);

      const loadedCases = Array.isArray(casesRes.data) ? casesRes.data : [];
      const loadedMembers = Array.isArray(membersRes.data) ? membersRes.data : [];

      setCases(loadedCases);
      setMembers(loadedMembers);

      if (!activeCaseId && loadedCases.length > 0) {
        const id = String(loadedCases[0].id);
        setActiveCaseId(id);
        localStorage.setItem(ACTIVE_CASE_KEY, id);
      }

      const primary = loadedMembers.find((m) => m.is_primary_applicant);
      if (primary) {
        setForm((prev) => ({
          ...prev,
          primary_applicant_member_id: String(primary.id),
          family_size: Math.max(1, loadedMembers.length || 1),
        }));
      }
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de charger les demandes."
          : "Unable to load application cases."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  function updateForm(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleSetActive(caseId) {
    const id = String(caseId);
    setActiveCaseId(id);
    localStorage.setItem(ACTIVE_CASE_KEY, id);
    window.dispatchEvent(new Event("nbai-active-case-updated"));
  }

  async function handleCreateCase(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      const res = await createApplicationCase({
        ...form,
        case_title: form.case_title.trim() || null,
        target_province: form.target_province.trim() || null,
        pathway: form.pathway.trim() || null,
        primary_applicant_member_id: form.primary_applicant_member_id
          ? Number(form.primary_applicant_member_id)
          : null,
        family_size: Number(form.family_size || 1),
      });

      const created = res.data;
      handleSetActive(created.id);

      setForm((prev) => ({
        ...EMPTY_CASE,
        primary_applicant_member_id: prev.primary_applicant_member_id,
        family_size: prev.family_size,
      }));

      setMessage(text.created);
      await loadPage();
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Impossible de créer la demande."
            : "Unable to create application case.")
      );
    } finally {
      setSaving(false);
    }
  }

  function applicationTypeLabel(value) {
    const map = {
      permanent_residence: text.permanentResidence,
      study_permit: text.studyPermit,
      work_permit: text.workPermit,
      visitor_visa: text.visitorVisa,
      sponsorship: text.sponsorship,
    };

    return map[value] || value;
  }

  const memberById = useMemo(() => {
    return members.reduce((acc, member) => {
      acc[String(member.id)] = member;
      return acc;
    }, {});
  }, [members]);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24">
          <p className="text-lg text-slate-700">
            {language === "fr" ? "Chargement..." : "Loading..."}
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader brand={text.brand} title={text.title} subtitle={text.subtitle} />

      {message ? (
        <div className="mb-6 rounded-[24px] border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card padding="lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {text.existingCases}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {cases.length} {language === "fr" ? "demande(s)" : "case(s)"}
              </h2>
            </div>
          </div>

          {cases.length > 0 ? (
            <div className="mt-6 space-y-3">
              {cases.map((item) => {
                const isActive = String(item.id) === String(activeCaseId);
                const applicant = memberById[String(item.primary_applicant_member_id)];

                return (
                  <div
                    key={item.id}
                    className={`rounded-[24px] border p-5 shadow-sm ${
                      isActive
                        ? "border-blue-200 bg-blue-50/60"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            {item.case_title ||
                              applicationTypeLabel(item.application_type)}
                          </h3>

                          {isActive ? <CaseBadge>{text.active}</CaseBadge> : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <CaseBadge>
                            {applicationTypeLabel(item.application_type)}
                          </CaseBadge>
                          <CaseBadge>
                            {language === "fr" ? "Famille" : "Family"}:{" "}
                            {item.family_size || 1}
                          </CaseBadge>
                          {applicant ? (
                            <CaseBadge>{getMemberName(applicant)}</CaseBadge>
                          ) : null}
                          {item.pathway ? <CaseBadge>{item.pathway}</CaseBadge> : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {!isActive ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSetActive(item.id)}
                          >
                            {text.setActive}
                          </Button>
                        ) : null}

                        <Button size="sm" onClick={() => navigate("/strategy")}>
                          {text.openStrategy}
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate("/documents")}
                        >
                          {text.openDocuments}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              {text.noCases}
            </div>
          )}
        </Card>

        <Card padding="lg" className="xl:sticky xl:top-24 xl:self-start">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            {text.createCase}
          </h2>

          <form className="mt-5 space-y-4" onSubmit={handleCreateCase}>
            <Field label={text.applicationType}>
              <select
                className={inputClass()}
                value={form.application_type}
                onChange={(e) => updateForm("application_type", e.target.value)}
              >
                <option value="permanent_residence">{text.permanentResidence}</option>
                <option value="study_permit">{text.studyPermit}</option>
                <option value="work_permit">{text.workPermit}</option>
                <option value="visitor_visa">{text.visitorVisa}</option>
                <option value="sponsorship">{text.sponsorship}</option>
              </select>
            </Field>

            <Field label={text.caseTitle}>
              <input
                className={inputClass()}
                value={form.case_title}
                onChange={(e) => updateForm("case_title", e.target.value)}
                placeholder={
                  language === "fr"
                    ? "Ex: RP famille 2026"
                    : "Ex: Family PR 2026"
                }
              />
            </Field>

            <Field label={text.primaryApplicant}>
              <select
                className={inputClass()}
                value={form.primary_applicant_member_id}
                onChange={(e) =>
                  updateForm("primary_applicant_member_id", e.target.value)
                }
              >
                <option value="">{text.selectApplicant}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {getMemberName(member)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={text.targetProvince}>
              <input
                className={inputClass()}
                value={form.target_province}
                onChange={(e) => updateForm("target_province", e.target.value)}
                placeholder="Ontario"
              />
            </Field>

            <Field label={text.pathway}>
              <input
                className={inputClass()}
                value={form.pathway}
                onChange={(e) => updateForm("pathway", e.target.value)}
                placeholder="Express Entry"
              />
            </Field>

            <Field label={text.familySize}>
              <input
                type="number"
                min="1"
                className={inputClass()}
                value={form.family_size}
                onChange={(e) => updateForm("family_size", e.target.value)}
              />
            </Field>

            <Button type="submit" fullWidth loading={saving}>
              {saving ? text.saving : text.save}
            </Button>
          </form>
        </Card>
      </div>
    </Layout>
  );
}