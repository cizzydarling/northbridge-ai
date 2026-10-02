import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getFamilyDocuments, getSelfDocuments, createSelfDocument, updateSelfDocument, uploadSelfDocumentFile, downloadSelfDocumentFile } from "../api";

export default function FamilyDocuments() {
  const { i18n } = useTranslation(); const fr = i18n.language.startsWith("fr");
  const t=(a,b)=>fr?b:a;
  const [data,setData]=useState(null); const [previous,setPrevious]=useState([]); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  async function load(){try{const result=(await getFamilyDocuments()).data; setData(result); setPrevious(((await getSelfDocuments()).data||[]).filter(d=>d.matter_type!==`case_${result.context.case_id}`));}catch{setError(t("Unable to load family documents.","Impossible de charger les documents familiaux."));}}
  useEffect(()=>{load();},[]); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(item, file, complete=false){const before=data;setBusy(true);setError("");if(!file)setData(old=>({...old,requirements:old.requirements.map(r=>r.id===item.id?{...r,document:{...(r.document||{}),completed:complete}}:r)}));try{
    const document=item.document || (await createSelfDocument({matter_type:`case_${data.context.case_id}`,document_key:item.id,document_name:t("Family identity review", "Examen d’identité familiale"),priority:"Review",required:false})).data;
    if(file)await uploadSelfDocumentFile(document.id,file);
    else await updateSelfDocument(document.id,{completed:complete});
    await load();
  }catch{setData(before);setError(t("Unable to save family document.","Impossible d’enregistrer le document familial."));}finally{setBusy(false);}}
  async function download(item){try{const response=await downloadSelfDocumentFile(item.document.id);const url=URL.createObjectURL(response.data);const a=document.createElement("a");a.href=url;a.download=item.document.file_name||"document";a.click();URL.revokeObjectURL(url);}catch{setError(t("Unable to download.","Téléchargement impossible."));}}
  return <section className="my-5 space-y-3 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{t("Family documents", "Documents familiaux")}</h2>
    <p>{t("Optional evidence organization. Applicability requires rule verification; this is not a complete immigration checklist.", "Organisation facultative des preuves. L’applicabilité nécessite une vérification des règles ; cette liste n’est pas une liste d’immigration complète.")}</p>
    {busy&&<p role="status">{t("Saving…", "Enregistrement…")}</p>}
    {error&&<p role="alert">{error}</p>}{!data&&!error&&<p>{t("Loading…","Chargement…")}</p>}
    {data&&!data.requirements.length&&<p>{t("No family members selected for this application.","Aucun membre sélectionné pour cette demande.")}</p>}
    {data?.requirements.map(item=><div key={item.id} data-testid={`family-document-${item.member_id}`} className="space-y-2 border-t pt-3"><strong>{item.display_name || `${t("Member", "Membre")} #${item.member_id}`} — {t("Identity evidence to review", "Preuve d’identité à examiner")}</strong>
      <label className="block">{t("Upload evidence", "Téléverser une preuve")}<input disabled={busy} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.txt" onChange={e=>act(item,e.target.files?.[0])}/></label>
      {item.document?.file_name&&<button disabled={busy} onClick={()=>download(item)}>{item.document.file_name}</button>}
      <label className="block"><input type="checkbox" disabled={busy} checked={!!item.document?.completed} onChange={e=>act(item,null,e.target.checked)}/>{t("Reviewed for this member", "Examiné pour ce membre")}</label>
    </div>)}
    {previous.length>0&&<details><summary>{t("Saved documents from previous workspaces", "Documents conservés des espaces précédents")}</summary><p>{t("These records are preserved separately from the active application.", "Ces dossiers sont conservés séparément de la demande active.")}</p><ul>{previous.map(d=><li key={d.id}>{d.document_name} — {d.matter_type} {d.file_name&&<button onClick={()=>download({document:d})}>{d.file_name}</button>}</li>)}</ul></details>}
  </section>;
}
