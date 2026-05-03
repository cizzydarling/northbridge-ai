import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  addHouseholdMember,
  getHouseholdMembers,
  getMyHousehold,
  updateHouseholdMember,
} from "../api";

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  relationship_to_primary: "spouse",
  date_of_birth: "",
  nationality: "",
  current_country: "",
  email: "",
  is_primary_applicant: false,
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

function InfoPill({ children }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
      {children}
    </span>
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

export default function HouseholdPage() {
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";

  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const text = useMemo(() => {
    if (language === "fr") {
      return {
        brand: "NorthBridgeAI",
        title: "Famille et ménage",
        subtitle:
          "Ajoutez les personnes incluses dans votre parcours afin que les demandes, formulaires et documents soient organisés correctement.",
        household: "Ménage",
        members: "Membres du ménage",
        addMember: "Ajouter un membre",
        firstName: "Prénom",
        lastName: "Nom",
        relationship: "Relation",
        dateOfBirth: "Date de naissance",
        nationality: "Nationalité",
        currentCountry: "Pays actuel",
        email: "Email",
        primary: "Demandeur principal",
        save: "Ajouter",
        saving: "Ajout...",
        empty: "Aucun membre ajouté pour le moment.",
        added: "Membre ajouté.",
        updated: "Membre mis à jour.",
        self: "Moi",
        spouse: "Époux/épouse",
        child: "Enfant",
        parent: "Parent",
        sibling: "Frère/sœur",
        other: "Autre",
        setPrimary: "Définir comme principal",
      };
    }

    return {
      brand: "NorthBridgeAI",
      title: "Household",
      subtitle:
        "Add the people included in your journey so applications, forms, and documents stay organized correctly.",
      household: "Household",
      members: "Household members",
      addMember: "Add member",
      firstName: "First name",
      lastName: "Last name",
      relationship: "Relationship",
      dateOfBirth: "Date of birth",
      nationality: "Nationality",
      currentCountry: "Current country",
      email: "Email",
      primary: "Primary applicant",
      save: "Add",
      saving: "Adding...",
      empty: "No members added yet.",
      added: "Member added.",
      updated: "Member updated.",
      self: "Self",
      spouse: "Spouse",
      child: "Child",
      parent: "Parent",
      sibling: "Sibling",
      other: "Other",
      setPrimary: "Set as primary",
    };
  }, [language]);

  async function loadPage() {
    try {
      setLoading(true);
      setMessage("");

      const [householdRes, membersRes] = await Promise.all([
        getMyHousehold(),
        getHouseholdMembers(),
      ]);

      setHousehold(householdRes.data);
      setMembers(Array.isArray(membersRes.data) ? membersRes.data : []);
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de charger le ménage."
          : "Unable to load household."
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

  async function handleAddMember(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      await addHouseholdMember({
        ...form,
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        nationality: form.nationality.trim() || null,
        current_country: form.current_country.trim() || null,
        email: form.email.trim() || null,
        date_of_birth: form.date_of_birth || null,
      });

      setForm(EMPTY_FORM);
      setMessage(text.added);
      await loadPage();
    } catch (err) {
      console.error(err);
      setMessage(
        err?.response?.data?.detail ||
          (language === "fr"
            ? "Impossible d’ajouter le membre."
            : "Unable to add member.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPrimary(member) {
    try {
      setMessage("");

      await updateHouseholdMember(member.id, {
        is_primary_applicant: true,
      });

      setMessage(text.updated);
      await loadPage();
    } catch (err) {
      console.error(err);
      setMessage(
        language === "fr"
          ? "Impossible de modifier le demandeur principal."
          : "Unable to update primary applicant."
      );
    }
  }

  function relationshipLabel(value) {
    const map = {
      self: text.self,
      spouse: text.spouse,
      child: text.child,
      parent: text.parent,
      sibling: text.sibling,
      other: text.other,
    };

    return map[value] || value || text.other;
  }

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
      <PageHeader
        brand={text.brand}
        title={text.title}
        subtitle={text.subtitle}
      />

      {message ? (
        <div className="mb-6 rounded-[24px] border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card padding="lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {text.household}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {household?.name || text.household}
                </h2>
              </div>

              <InfoPill>
                {members.length} {language === "fr" ? "membre(s)" : "member(s)"}
              </InfoPill>
            </div>
          </Card>

          <Card padding="lg">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              {text.members}
            </h2>

            {members.length > 0 ? (
              <div className="mt-5 space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          {[member.first_name, member.last_name]
                            .filter(Boolean)
                            .join(" ") || "—"}
                        </h3>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <InfoPill>
                            {relationshipLabel(member.relationship_to_primary)}
                          </InfoPill>

                          {member.is_primary_applicant ? (
                            <InfoPill>{text.primary}</InfoPill>
                          ) : null}

                          {member.nationality ? (
                            <InfoPill>{member.nationality}</InfoPill>
                          ) : null}
                        </div>

                        {member.email ? (
                          <p className="mt-3 text-sm text-slate-500">
                            {member.email}
                          </p>
                        ) : null}
                      </div>

                      {!member.is_primary_applicant ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSetPrimary(member)}
                        >
                          {text.setPrimary}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                {text.empty}
              </div>
            )}
          </Card>
        </div>

        <Card padding="lg" className="xl:sticky xl:top-24 xl:self-start">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            {text.addMember}
          </h2>

          <form className="mt-5 space-y-4" onSubmit={handleAddMember}>
            <Field label={text.firstName}>
              <input
                className={inputClass()}
                value={form.first_name}
                onChange={(e) => updateForm("first_name", e.target.value)}
              />
            </Field>

            <Field label={text.lastName}>
              <input
                className={inputClass()}
                value={form.last_name}
                onChange={(e) => updateForm("last_name", e.target.value)}
              />
            </Field>

            <Field label={text.relationship}>
              <select
                className={inputClass()}
                value={form.relationship_to_primary}
                onChange={(e) =>
                  updateForm("relationship_to_primary", e.target.value)
                }
              >
                <option value="spouse">{text.spouse}</option>
                <option value="child">{text.child}</option>
                <option value="parent">{text.parent}</option>
                <option value="sibling">{text.sibling}</option>
                <option value="other">{text.other}</option>
              </select>
            </Field>

            <Field label={text.dateOfBirth}>
              <input
                type="date"
                className={inputClass()}
                value={form.date_of_birth}
                onChange={(e) => updateForm("date_of_birth", e.target.value)}
              />
            </Field>

            <Field label={text.nationality}>
              <input
                className={inputClass()}
                value={form.nationality}
                onChange={(e) => updateForm("nationality", e.target.value)}
              />
            </Field>

            <Field label={text.currentCountry}>
              <input
                className={inputClass()}
                value={form.current_country}
                onChange={(e) => updateForm("current_country", e.target.value)}
              />
            </Field>

            <Field label={text.email}>
              <input
                type="email"
                className={inputClass()}
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
              />
            </Field>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_primary_applicant}
                onChange={(e) =>
                  updateForm("is_primary_applicant", e.target.checked)
                }
              />
              {text.primary}
            </label>

            <Button type="submit" fullWidth loading={saving}>
              {saving ? text.saving : text.save}
            </Button>
          </form>
        </Card>
      </div>
    </Layout>
  );
}