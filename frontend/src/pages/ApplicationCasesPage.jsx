import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import { getApplicationCases, getApplicationCase, getHouseholdMembers, createApplicationCase, updateApplicationCase, archiveApplicationCase, activateApplicationCase } from "../api";

export default function ApplicationCasesPage() {
  const { i18n } = useTranslation(); const fr = i18n.language.startsWith("fr");
  const t = (a,b) => fr?b:a;
  const [params, setParams] = useSearchParams();
  const [cases,setCases] = useState([]); const [members,setMembers] = useState([]);
  const [selected,setSelected] = useState(null); const [participation,setParticipation] = useState({});
  const [error,setError] = useState(""); const [loading,setLoading] = useState(true); const [saving,setSaving] = useState(false);
  async function select(id) {
    const item = (await getApplicationCase(id)).data;
    await activateApplicationCase(id);
    setSelected(item); setParticipation(Object.fromEntries(item.members.filter(m=>m.relationship!=="self").map(m=>[m.member_id,m.participation])));
    setParams({case_id:String(id)}, {replace:true});
  }
  async function load() {
    try {
      const items=(await getApplicationCases()).data; setCases(items);
      setMembers((await getHouseholdMembers()).data.filter(m=>m.relationship_to_primary!=="self"));
      const requested=params.get("case_id");
      const valid=items.find(c=>String(c.id)===requested);
      if(requested && !valid) setError(t("That application is unavailable. Your active application was restored.", "Cette demande est indisponible. Votre demande active a été rétablie."));
      const choice=valid || items.find(c=>c.is_active) || items[0];
      if(choice) await select(choice.id);
    } catch {setError(t("Unable to load applications.", "Impossible de charger les demandes."));}
    finally {setLoading(false);}
  }
  useEffect(()=>{load();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(e) {
    e.preventDefault();setSaving(true);setError("");
    try {await updateApplicationCase(selected.id,{case_title:selected.case_title||null,application_type:selected.application_type,status:selected.status,
      members:Object.entries(participation).map(([id,state])=>({household_member_id:Number(id),participation:state}))});await load();}
    catch {setError(t("Unable to save application.", "Impossible d’enregistrer la demande."));} finally {setSaving(false);}
  }
  async function create() {setSaving(true);try {const item=(await createApplicationCase({application_type:"permanent_residence",case_title:t("New application", "Nouvelle demande")})).data;setCases((await getApplicationCases()).data);await select(item.id);}catch{setError(t("Unable to create application.", "Impossible de créer la demande."));}finally{setSaving(false);}}
  async function archive() {if(!window.confirm(t("Archive this application? Existing records and documents are preserved.", "Archiver cette demande ? Les dossiers et documents seront conservés.")))return;try{await archiveApplicationCase(selected.id);setParams({}, {replace:true});await load();}catch{setError(t("Unable to archive application.", "Impossible d’archiver la demande."));}}
  return <Layout><main className="mx-auto max-w-4xl space-y-5"><h1 className="text-3xl font-bold">{t("Applications", "Demandes")}</h1>
    <nav className="flex gap-4"><Link to="/household">{t("Household", "Ménage")}</Link><Link to="/strategy">{t("Strategy", "Stratégie")}</Link><Link to="/documents">Documents</Link><Link to="/forms">{t("Forms", "Formulaires")}</Link></nav>
    <p>{t("YOU remain the primary applicant. Save family participation before continuing.", "VOUS restez le demandeur principal. Enregistrez la participation familiale avant de continuer.")}</p>
    {error&&<p role="alert" className="text-red-700">{error}<button onClick={load} className="ml-3 underline">{t("Retry", "Réessayer")}</button></p>}
    {loading?<p>{t("Loading…", "Chargement…")}</p>:<>
      <div className="flex flex-wrap gap-3">{cases.map(c=><button key={c.id} className="rounded border p-3" aria-pressed={selected?.id===c.id} onClick={()=>select(c.id).catch(()=>setError(t("Application unavailable", "Demande indisponible")))}>{c.case_title || t("Application", "Demande")} #{c.id}</button>)}<button disabled={saving} onClick={create}>{t("New application", "Nouvelle demande")}</button></div>
      {selected&&<form onSubmit={save} className="space-y-4 rounded-xl border bg-white p-6">
        <label className="block">{t("Case title", "Titre de la demande")}<input className="block w-full border p-2" maxLength={120} value={selected.case_title||""} onChange={e=>setSelected({...selected,case_title:e.target.value})}/></label>
        <label className="block">{t("Application type", "Type de demande")}<select className="block w-full border p-2" value={selected.application_type} onChange={e=>setSelected({...selected,application_type:e.target.value})}>{[["permanent_residence","Permanent residence","Résidence permanente"],["study_permit","Study permit","Permis d’études"],["work_permit","Work permit","Permis de travail"],["visitor_visa","Visitor visa","Visa de visiteur"],["spousal_sponsorship","Spousal sponsorship","Parrainage conjugal"]].map(([v,en,fr])=><option key={v} value={v}>{t(en,fr)}</option>)}</select></label>
        <label className="block">{t("Status", "État")}<select value={selected.status} onChange={e=>setSelected({...selected,status:e.target.value})}><option value="draft">{t("Draft", "Brouillon")}</option><option value="in_progress">{t("In progress", "En cours")}</option></select></label>
        <h2 className="text-xl">{t("Family participation", "Participation familiale")}</h2>
        {!members.length&&<p>{t("Single applicant. Add family members in Household if needed.", "Demandeur seul. Ajoutez des membres dans Ménage au besoin.")}</p>}
        {members.map(m=><label className="flex justify-between gap-4" key={m.id}><span>{[m.first_name,m.last_name].filter(Boolean).join(" ")}</span><select aria-label={`${m.first_name} ${t("participation", "participation")}`} value={participation[m.id]||"excluded"} onChange={e=>setParticipation(old=>{const next={...old};if(e.target.value==="excluded")delete next[m.id];else next[m.id]=e.target.value;return next;})}><option value="excluded">{t("Not selected for this case", "Non sélectionné pour cette demande")}</option><option value="unknown">{t("Unknown", "Inconnu")}</option><option value="accompanying">{t("Accompanying", "Accompagnant")}</option><option value="non_accompanying">{t("Non-accompanying", "Non accompagnant")}</option></select></label>)}
        <p>{t("Participation does not determine immigration dependency eligibility. Unknown facts are not inferred.", "La participation ne détermine pas l’admissibilité comme personne à charge. Les faits inconnus ne sont pas déduits.")}</p>
        <div className="flex gap-5"><button disabled={saving} className="rounded bg-blue-700 p-3 text-white">{t("Save application", "Enregistrer la demande")}</button><button type="button" onClick={archive}>{t("Archive", "Archiver")}</button></div>
      </form>}
    </>}
  </main></Layout>;
}
