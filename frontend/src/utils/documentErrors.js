// Never display provider details, headers or request payloads.
export function documentError(error, operation, fr) {
  const status = error?.response?.status;
  if (status === 401) return fr ? "Votre session a expiré. Reconnectez-vous." : "Your session expired. Sign in again.";
  if (status === 403) return fr ? "Accès non autorisé à ces documents." : "You are not authorized to access these documents.";
  if (status === 404) return fr ? "Contexte ou document indisponible. Vérifiez la demande active." : "Context or document unavailable. Check the active application.";
  const subject = operation === "context" ? (fr ? "le contexte familial" : "household context") : (fr ? "la liste des documents" : "the document list");
  if (!error?.response && (error?.isAxiosError || ["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT"].includes(error?.code))) return fr ? `Connexion interrompue. Chargement impossible : ${subject}. Réessayez.` : `Connection failed while loading ${subject}. Try again.`;
  return fr ? `Impossible de charger ${subject}. Réessayez.` : `Unable to load ${subject}. Try again.`;
}
