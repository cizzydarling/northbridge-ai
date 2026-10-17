import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import { getFamilyDocuments, getSelfDocuments, createSelfDocument, updateSelfDocument, uploadSelfDocumentFile, downloadSelfDocumentFile } from "../api";
import Button from "./ui/Button";
import Card from "./ui/Card";
import { Alert, EmptyState, LoadingState } from "./ui/Feedback";
import { documentError } from "../utils/documentErrors";

export default function FamilyDocuments({ caseId }) {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  const t = (en, french) => fr ? french : en;
  const [data, setData] = useState(null);
  const [previous, setPrevious] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pendingReview, setPendingReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const attempt = ++generation.current;
    setLoading(true); setError(null); setPrevious([]);
    let operation = "context";
    try {
      const result = (await getFamilyDocuments(caseId)).data;
      if (attempt !== generation.current) return;
      setData(result);
      operation = "list";
      const records = (await getSelfDocuments()).data;
      if (attempt !== generation.current) return;
      setPrevious((records || []).filter(d => d.matter_type !== `case_${result.context.case_id}`));
    } catch (cause) {
      if (attempt === generation.current) setError({ cause, operation });
    } finally {
      if (attempt === generation.current) setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    const counter = generation;
    setData(null); load();
    return () => { counter.current++; };
  }, [load]);

  async function act(item, file, completed = false) {
    if (!data || busy) return;
    setBusy(true); setError(null);
    if (!file) setPendingReview({ id: item.id, completed });
    try {
      const record = item.document || (await createSelfDocument({ matter_type: `case_${data.context.case_id}`, document_key: item.id, document_name: t("Family identity review", "Examen d’identité familiale"), priority: "Review", required: false })).data;
      if (file) await uploadSelfDocumentFile(record.id, file);
      else await updateSelfDocument(record.id, { completed });
      // Reconcile the explicit pending control state with persisted server data.
      await load();
    } catch (cause) { setError({ cause, operation: "save" }); }
    finally { setPendingReview(null); setBusy(false); }
  }

  async function download(item) {
    try {
      const response = await downloadSelfDocumentFile(item.document.id);
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = item.document.file_name || "document";
      anchor.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError({ cause, operation: "download" }); }
  }

  const message = error && (error.operation === "save"
    ? t("Unable to save. Changes have not been confirmed by the server.", "Enregistrement impossible. Les modifications ne sont pas confirmées par le serveur.")
    : error.operation === "download" ? t("Unable to download the document.", "Téléchargement du document impossible.")
    : documentError(error.cause, error.operation, fr));

  if (error?.cause?.response?.status === 401) return <Navigate to="/auth" replace />;
  return <Card className="my-5 space-y-4" as="section">
    <h2 className="text-xl font-semibold">{t("Family documents", "Documents familiaux")}</h2>
    <p>{t("Optional evidence organization. Applicability requires rule verification; this is not a complete immigration checklist.", "Organisation facultative des preuves. L’applicabilité nécessite une vérification des règles ; cette liste n’est pas une liste d’immigration complète.")}</p>
    {busy && <div id="family-save-pending"><LoadingState>{t("Saving… not yet confirmed by the server.", "Enregistrement… pas encore confirmé par le serveur.")}</LoadingState></div>}
    {loading && <LoadingState>{t("Loading documents…", "Chargement des documents…")}</LoadingState>}
    {error && <Alert onRetry={load} retryLabel={t("Retry document loading", "Réessayer le chargement")}>{message}</Alert>}
    {data && !data.requirements.length && <EmptyState title={t("No family members selected for this application.", "Aucun membre sélectionné pour cette demande.")} />}
    {data?.requirements.map(item => <div key={item.id} data-testid={`family-document-${item.member_id}`} className="space-y-2 border-t pt-3">
      <strong>{item.display_name || `${t("Member", "Membre")} #${item.member_id}`} — {t("Identity evidence to review", "Preuve d’identité à examiner")}</strong>
      <label className="block">{t("Upload evidence", "Téléverser une preuve")}<input disabled={busy || loading} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx" onChange={e => { const file = e.target.files?.[0]; if (file) act(item, file); e.target.value = ""; }} /></label>
      {item.document?.file_name && <Button variant="secondary" disabled={busy} onClick={() => download(item)}>{item.document.file_name}</Button>}
      {item.document && <details><summary>{t("Preview document metadata", "Aperçu des métadonnées du document")}</summary><dl className="mt-2 space-y-2">
        <div><dt className="font-medium">{t("Document", "Document")}</dt><dd>{item.document.document_name}</dd></div>
        <div><dt className="font-medium">{t("Application", "Demande")}</dt><dd>{item.document.matter_type}</dd></div>
        <div><dt className="font-medium">{t("File", "Fichier")}</dt><dd>{item.document.file_name || t("No file uploaded", "Aucun fichier téléversé")}</dd></div>
      </dl><p>{t("Download to inspect the file. This preview shows saved metadata only.", "Téléchargez le fichier pour le consulter. Cet aperçu présente uniquement les métadonnées enregistrées.")}</p></details>}
      <label className="block"><input type="checkbox" disabled={busy || loading} aria-busy={busy} aria-describedby={busy ? "family-save-pending" : undefined} checked={pendingReview?.id === item.id ? pendingReview.completed : !!item.document?.completed} onChange={e => act(item, null, e.target.checked)} /> {t("Reviewed for this member", "Examiné pour ce membre")}</label>
    </div>)}
    {previous.length > 0 && <details><summary>{t("Saved documents from previous workspaces", "Documents conservés des espaces précédents")}</summary><p>{t("These records are preserved separately from the active application.", "Ces dossiers sont conservés séparément de la demande active.")}</p><ul>{previous.map(d => <li key={d.id}>{d.document_name} — {d.matter_type} {d.file_name && <Button variant="secondary" onClick={() => download({ document: d })}>{d.file_name}</Button>}</li>)}</ul></details>}
  </Card>;
}
