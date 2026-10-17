import Button from "./Button";

export function Alert({ children, onRetry, retryLabel, tone = "error" }) {
  return <div role={tone === "error" ? "alert" : "status"} className={`nb-alert nb-alert-${tone}`}><div>{children}</div>{onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>{retryLabel}</Button>}</div>;
}
export function LoadingState({ children }) {
  return <p role="status" className="nb-loading"><span aria-hidden="true" className="nb-loading-dot" />{children}</p>;
}
export function EmptyState({ title, children }) {
  return <div className="nb-empty"><h3 className="font-semibold">{title}</h3>{children && <p className="mt-2">{children}</p>}</div>;
}
export function Progress({ value, max, label }) {
  const safeMax = Math.max(1, max);
  return <div><p className="mb-2 text-sm">{label}</p><progress className="nb-progress" aria-label={label} value={Math.min(safeMax, Math.max(0, value))} max={safeMax} /></div>;
}
