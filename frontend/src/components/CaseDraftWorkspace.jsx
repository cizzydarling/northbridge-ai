import Button from "./ui/Button";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createCaseDraft, exportCaseDraft, getApplicationContext, getCaseDrafts, getCurrentUserLocal, reviewCaseDraft, saveCaseDraft } from "../api";
import useBillingAccess from "../hooks/useBillingAccess";
import PreparationJourney from "./PreparationJourney";

export default function CaseDraftWorkspace() {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith("fr") ? "fr" : "en";
  const tr = (en, fr) => language === "fr" ? fr : en;
  const { access } = useBillingAccess();
  const paid = Boolean(access?.is_pro || access?.is_premium);
  const [params] = useSearchParams();
  const requestedCase = params.get("case_id") || "";
  const userId = getCurrentUserLocal()?.id;
  const epoch = useRef(0);
  const invalidate = useCallback(() => { ++epoch.current; }, []);
  const [view, setView] = useState({ state: "loading", owner: null, caseId: null, rows: [] });
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const version = ++epoch.current;
    async function load() {
      try {
        const context = (await getApplicationContext(requestedCase || undefined)).data;
        const caseId = context.case_id;
        if (!Number.isInteger(caseId)) throw new Error("Invalid case response");
        const rows = (await getCaseDrafts(caseId)).data;
        if (!Array.isArray(rows) || rows.some(r => r.case_id !== caseId || typeof r.content !== "string" || typeof r.title !== "string" || !Number.isInteger(r.revision))) throw new Error("Invalid saved draft response");
        if (active && version === epoch.current && getCurrentUserLocal()?.id === userId) {
          setView({ state: "ready", owner: userId, caseId, rows }); setDraft(null); setDirty(false); setReview(null); setMessage("");
        }
      } catch { if (active && version === epoch.current) setView({ state: "failed", owner: userId, caseId: null, rows: [] }); }
    }
    load();
    return () => { active = false; invalidate(); };
  }, [userId, requestedCase, reload, invalidate]);
  const ready = view.state === "ready" && view.owner === userId && (!requestedCase || Number(requestedCase) === view.caseId);
  async function act(operation, action) {
    if (!ready || busy) return;
    const version = ++epoch.current;
    setBusy(true); setMessage("");
    try {
      const response = await operation();
      if (version !== epoch.current || getCurrentUserLocal()?.id !== userId) return;
      if (action === "review") setReview(response.data);
      else if (action === "export") {
        const url = URL.createObjectURL(response.data);
        const a = document.createElement("a"); a.href = url; a.download = `preparation-draft-${draft.id}.docx`; a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const saved = response.data;
        if (saved.case_id !== view.caseId || !Number.isInteger(saved.revision)) throw new Error("Invalid save response");
        setDraft(saved); setDirty(false); setReview(null);
        setView(current => ({ ...current, rows: [saved, ...current.rows.filter(r => r.id !== saved.id)] }));
        setMessage(tr("Saved on server", "Enregistré sur le serveur"));
      }
    } catch (error) {
      if (version === epoch.current) setMessage(error.response?.status === 409
        ? tr("Not saved: save Forms answers first, or reload if this draft changed elsewhere. Your edits remain here.", "Non enregistré : enregistrez les réponses des formulaires ou rechargez si le brouillon a changé ailleurs. Vos modifications restent ici.")
        : tr("Action failed. Nothing is marked saved. Retry when access is available.", "Échec de l’action. Aucun enregistrement confirmé. Réessayez lorsque l’accès sera disponible."));
    } finally { if (version === epoch.current) setBusy(false); }
  }
  function edit(field, value) { setDraft(current => ({ ...current, [field]: value })); setDirty(true); setReview(null); setMessage(""); }
  return <section id="case-drafts" className="nb-card border border-slate-200 bg-white mb-6 space-y-4 p-5" aria-label={tr("Saved case preparation", "Préparation du dossier enregistrée")}>
    <PreparationJourney />
    <h2 className="text-2xl font-semibold">{tr("Continue your saved case draft", "Reprendre le brouillon du dossier")}</h2>
    <p>{tr("Drafts reuse your saved Forms answers. They are not official forms or legal conclusions. Loading never creates or replaces a draft.", "Les brouillons réutilisent vos réponses enregistrées. Ce ne sont ni des formulaires officiels ni des conclusions juridiques. Le chargement ne crée ni ne remplace un brouillon.")}</p>
    {!ready && view.state !== "failed" && <p role="status">{tr("Loading owned case work…", "Chargement du dossier…")}</p>}
    {view.state === "failed" && <p role="alert">{tr("Saved work could not be loaded. Editing is disabled to protect it.", "Impossible de charger le travail enregistré. La modification est désactivée pour le protéger.")}</p>}
    <Button variant="secondary" type="button" className="nb-button-secondary" disabled={busy || dirty} onClick={() => setReload(n => n + 1)}>{tr("Reload saved work", "Recharger le travail enregistré")}</Button>
    {ready && <>
      <p>{tr("Active case", "Demande active")} #{view.caseId} · {view.rows.length} {tr("saved drafts", "brouillons enregistrés")}</p>
      <Link className="underline" to={`/forms?case_id=${view.caseId}`}>{tr("Return to saved Forms answers", "Retour aux réponses des formulaires")}</Link>
      {!paid && <p>{tr("Pro is required to create, edit, review and export case drafts. Existing work stays readable; checkout remains disabled during beta.", "Pro est requis pour créer, modifier, réviser et exporter. Le travail existant reste lisible ; le paiement reste désactivé pendant la bêta.")}</p>}
      <Button variant="primary" type="button" disabled={!paid || busy || dirty} onClick={() => act(() => createCaseDraft(view.caseId, language), "save")}>{tr("Create draft from saved answers", "Créer un brouillon depuis les réponses")}</Button>
      {!view.rows.length && <p>{tr("No case drafts yet. Save Forms answers, then create one explicitly.", "Aucun brouillon. Enregistrez les réponses, puis créez-en un explicitement.")}</p>}
      <ul className="flex flex-wrap gap-3">{view.rows.map(r => <li key={r.id}><Button variant="secondary" type="button" className="nb-button-secondary" disabled={busy || dirty} onClick={() => { setDraft(r); setReview(null); setMessage(""); }}>{r.title} · #{r.id}</Button></li>)}</ul>
      {draft && <div className="space-y-3">
        <p className="text-sm">{draft.notice}</p>
        <label className="block">{tr("Draft title", "Titre du brouillon")}<input className="mt-1 w-full rounded border p-2" maxLength={160} value={draft.title} disabled={!paid || busy} onChange={e => edit("title", e.target.value)} /></label>
        <label className="block">{tr("Editable draft", "Brouillon modifiable")}<textarea className="mt-1 w-full rounded border p-3" rows={12} maxLength={50000} value={draft.content} disabled={!paid || busy} onChange={e => edit("content", e.target.value)} /></label>
        <p role="status">{dirty ? tr("Unsaved edits", "Modifications non enregistrées") : tr("Saved revision", "Version enregistrée")} {!dirty && draft.revision}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" type="button" disabled={!paid || busy || !dirty || !draft.title.trim() || !draft.content.trim()} onClick={() => act(() => saveCaseDraft(draft.id, { revision: draft.revision, title: draft.title, content: draft.content }), "save")}>{tr("Save draft", "Enregistrer le brouillon")}</Button>
          <Button variant="secondary" type="button" className="nb-button-secondary" disabled={!paid || busy || dirty} onClick={() => act(() => reviewCaseDraft(draft.id), "review")}>{tr("Review saved draft", "Réviser le brouillon enregistré")}</Button>
          <Button variant="secondary" type="button" className="nb-button-secondary" disabled={!paid || busy || dirty} onClick={() => act(() => exportCaseDraft(draft.id), "export")}>{tr("Export saved DOCX", "Exporter le DOCX enregistré")}</Button>
        </div>
        {review && <section aria-label={tr("Preparation review", "Révision de préparation")}><h3>{tr("Human review still required", "Révision humaine toujours requise")}</h3><ul>{review.actions.map(x => <li key={x}>{x}</li>)}</ul><p>{review.notice}</p></section>}
      </div>}
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
