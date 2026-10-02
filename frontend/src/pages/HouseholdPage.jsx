import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import { getHouseholdMembers, addHouseholdMember, updateHouseholdMember, archiveHouseholdMember } from "../api";

const empty = { first_name: "", last_name: "", relationship_to_primary: "spouse", date_of_birth: "", nationality: "", current_country: "", email: "" };
export default function HouseholdPage() {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const t = (en, french) => fr ? french : en;
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    try { setMembers((await getHouseholdMembers()).data); }
    catch { setError(t("Unable to load household. Please retry.", "Impossible de charger le ménage. Réessayez.")); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const label = (r) => ({ self: t("YOU — Primary applicant", "VOUS — Demandeur principal"), spouse: t("Spouse", "Époux / épouse"), common_law_partner: t("Common-law partner", "Conjoint de fait"), child: t("Child", "Enfant") }[r]);
  async function save(e) {
    e.preventDefault(); setSaving(true); setError("");
    const payload = Object.fromEntries(Object.entries(form).map(([k,v]) => [k, v === "" ? null : v]));
    try {
      if (editing) await updateHouseholdMember(editing, payload); else await addHouseholdMember(payload);
      setForm(empty); setEditing(null); await load();
    } catch { setError(t("Unable to save. Check the fields; only one spouse or partner is allowed.", "Enregistrement impossible. Vérifiez les champs ; un seul époux ou conjoint est permis.")); }
    finally { setSaving(false); }
  }
  async function remove(m) {
    if (!window.confirm(t("Remove this member from current family guidance? Existing documents are preserved.", "Retirer ce membre des conseils familiaux actuels ? Les documents existants seront conservés."))) return;
    setError("");
    try { await archiveHouseholdMember(m.id); await load(); } catch { setError(t("Unable to remove member.", "Impossible de retirer le membre.")); }
  }
  return <Layout><main className="mx-auto max-w-4xl space-y-6">
    <h1 className="text-3xl font-bold">{t("Household", "Ménage")}</h1>
    <nav className="flex gap-5"><Link to="/profile">{t("Profile", "Profil")}</Link><Link to="/applications">{t("Continue to application", "Continuer vers la demande")} →</Link></nav>
    <p>{t("Your account remains the primary applicant. Select who accompanies you in each application. Missing information remains unknown.", "Votre compte reste le demandeur principal. Indiquez qui vous accompagne dans chaque demande. Les renseignements manquants restent inconnus.")}</p>
    {error && <p role="alert" className="text-red-700">{error}<button onClick={load} className="ml-3 underline">{t("Retry", "Réessayer")}</button></p>}
    {loading ? <p>{t("Loading…", "Chargement…")}</p> : <ul className="space-y-3">{members.map(m => <li key={m.id} className="rounded-xl border bg-white p-4">
      <strong>{label(m.relationship_to_primary)}</strong><p>{[m.first_name,m.last_name].filter(Boolean).join(" ") || t("Complete your profile", "Complétez votre profil")}</p>
      {m.relationship_to_primary === "self" ? <Link to="/profile">{t("Edit profile", "Modifier le profil")}</Link> : <div className="flex gap-4">
        <button onClick={() => { setEditing(m.id); setForm(Object.fromEntries(Object.keys(empty).map(k => [k,m[k] || ""]))); }}>{t("Edit", "Modifier")}</button>
        <button onClick={() => remove(m)}>{t("Remove", "Retirer")}</button></div>}
    </li>)}</ul>}
    {!loading && members.length === 1 && <p>{t("No family members added. A single-applicant application is supported.", "Aucun membre ajouté. Une demande individuelle est possible.")}</p>}
    <form onSubmit={save} className="grid gap-4 rounded-xl border bg-white p-6 md:grid-cols-2">
      <h2 className="text-xl md:col-span-2">{editing ? t("Edit member", "Modifier le membre") : t("Add family member", "Ajouter un membre")}</h2>
      <label>{t("Relationship", "Lien familial")}<select aria-label={t("Relationship", "Lien familial")} className="block w-full border p-2" value={form.relationship_to_primary} onChange={e => setForm({...form,relationship_to_primary:e.target.value})}>{["spouse","common_law_partner","child"].map(r=><option key={r} value={r}>{label(r)}</option>)}</select></label>
      {[["first_name",t("Given name", "Prénom"),"text"],["last_name",t("Family name", "Nom"),"text"],["date_of_birth",t("Date of birth (optional)", "Date de naissance (facultative)"),"date"],["nationality",t("Nationality (optional)", "Nationalité (facultative)"),"text"],["current_country",t("Current country (optional)", "Pays actuel (facultatif)"),"text"],["email",t("Email (optional)", "Courriel (facultatif)"),"email"]].map(([key,text,type])=><label key={key}>{text}<input className="block w-full border p-2" type={type} required={key==="first_name"} maxLength={key==="email"?254:100} max={type==="date"?new Date().toISOString().slice(0,10):undefined} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
      <button disabled={saving} className="rounded bg-blue-700 p-3 text-white">{saving?t("Saving…", "Enregistrement…"):t("Save member", "Enregistrer le membre")}</button>
      {editing && <button type="button" onClick={()=>{setEditing(null);setForm(empty);}}>{t("Cancel", "Annuler")}</button>}
    </form>
  </main></Layout>;
}
