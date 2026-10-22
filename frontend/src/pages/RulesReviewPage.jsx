import Button from "../components/ui/Button";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import { getCurrentUserLocal, getRulesReviewQueue, recordRulesReview } from "../api";

export default function RulesReviewPage() {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const tr = (en, french) => fr ? french : en;
  const user = getCurrentUserLocal();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState({});
  const load = useCallback(async () => {
    try { const response = await getRulesReviewQueue(); setData(response.data); setFailed(false); }
    catch { setFailed(true); }
  }, []);
  useEffect(() => { if (user?.role === "admin") load(); }, [user?.role, load]);
  async function decide(id, decision) {
    setBusy(true);
    try { await recordRulesReview(id, { decision, note: notes[id] }); await load(); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <Layout><main className="mx-auto max-w-5xl space-y-5 p-5">
    <h1 className="text-3xl font-semibold">{tr("Official-source review queue", "File de révision des sources officielles")}</h1>
    <p>{tr("Inactive evidence queue. Monitoring success is not verification. No AI analysis, approval or executable activation is available here.", "File de preuves inactive. Un suivi réussi ne vaut pas validation. Aucune analyse IA, approbation ni activation exécutable n’est disponible ici.")}</p>
    {user?.role !== "admin" ? <p role="alert">{tr("Administrator access required.", "Accès administrateur requis.")}</p> : <>
      <Button variant="secondary" type="button" className="nb-button-secondary" disabled={busy} onClick={load}>{tr("Refresh queue", "Actualiser la file")}</Button>
      {failed && <p role="alert">{tr("Request failed. No approval or activation occurred.", "Échec de la demande. Aucune approbation ni activation effectuée.")}</p>}
      {!data && !failed && <p role="status">{tr("Loading…", "Chargement…")}</p>}
      {data && <>
        <section className="nb-card border border-slate-200 bg-white space-y-2 p-4"><h2>{tr("November 3 reference — review required", "Référence du 3 novembre — révision requise")}</h2><p>{data.november_reference.old_version} → {data.november_reference.new_version}</p><p>{tr("Effective date", "Date d’entrée en vigueur")}: {data.november_reference.effective_date} · {tr("Announcement date unknown", "Date d’annonce inconnue")}</p></section>
        <h2 className="text-xl font-semibold">{tr("Detected changes", "Changements détectés")}</h2>
        {!data.changes.length && <p>{tr("No collected changes. The scheduler has not established verified rules.", "Aucun changement recueilli. Le suivi n’établit pas de règles vérifiées.")}</p>}
        {data.changes.map(change => <section key={change.id} className="nb-card border border-slate-200 bg-white space-y-3 p-4">
          <h3>{change.source_id} · #{change.id} · {change.status}</h3>
          <p>{change.detected_at} · {tr("Effective date", "Date d’entrée en vigueur")}: {change.effective_date || tr("UNKNOWN", "INCONNUE")}</p>
          <p>{change.classification} · {change.extraction_status} · {change.modules.join(", ")}</p>
          <p className="break-words">{tr("Before", "Avant")}: {change.before_excerpt}</p><p className="break-words">{tr("After", "Après")}: {change.after_excerpt}</p>
          <p>{change.validation} · {change.activation}</p>
          <label className="block">{tr("Review note", "Note de révision")}<textarea className="block w-full rounded border p-2" maxLength={1000} value={notes[change.id] || ""} onChange={e => setNotes(n => ({ ...n, [change.id]: e.target.value }))} /></label>
          <div className="flex flex-wrap gap-3">{[["UNDER_REVIEW", "Review", "Réviser"], ["MORE_EVIDENCE", "Request evidence", "Demander des preuves"], ["REJECTED", "Reject", "Rejeter"], ["WITHDRAWN", "Withdraw", "Retirer"]].map(([action, en, french]) => <Button variant="secondary" key={action} type="button" className="nb-button-secondary" disabled={busy || !notes[change.id]?.trim()} onClick={() => decide(change.id, action)}>{tr(en, french)}</Button>)}</div>
          <details><summary>{tr("Review history", "Historique des décisions")}</summary><ul>{change.history.map(h => <li key={h.id}>{h.created_at} · {h.reviewer_id} · {h.decision} · {h.note}</li>)}</ul></details>
        </section>)}
        <h2 className="text-xl font-semibold">{tr("Source monitoring", "Suivi des sources")}</h2>
        <ul className="space-y-3">{data.sources.map(s => <li key={s.identifier} className="break-words rounded border p-3"><a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.authority} · {s.jurisdiction} · {s.identifier}</a><p>{s.retrieval_status} · {s.cadence_hours} h · {s.last_successful_check || tr("Never checked", "Jamais vérifiée")}</p><p>{tr("Rule verification pending", "Validation de la règle en attente")}</p></li>)}</ul>
      </>}
    </>}
  </main></Layout>;
}
