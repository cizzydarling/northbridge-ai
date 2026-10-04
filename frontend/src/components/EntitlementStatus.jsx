import { useTranslation } from "react-i18next";

export default function EntitlementStatus({ error = false, onRetry }) {
  const { i18n } = useTranslation();
  const fr = i18n.language.startsWith("fr");
  return <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 p-8" data-testid="entitlement-status">
    <p role={error ? "alert" : "status"}>{error
      ? (fr ? "Votre accès est temporairement indisponible. Veuillez réessayer." : "Your account access is temporarily unavailable. Please try again.")
      : (fr ? "Vérification de votre accès…" : "Checking your account access…")}</p>
    {error && <button className="rounded-lg border px-4 py-2" onClick={onRetry}>{fr ? "Réessayer" : "Try again"}</button>}
  </main>;
}
