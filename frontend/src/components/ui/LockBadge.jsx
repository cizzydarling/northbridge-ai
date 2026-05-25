export default function LockBadge({
  locked = true,
  label = locked ? "Access required" : "Available",
  active = false,
  className = "",
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
        locked
          ? active
            ? "border-amber-200/40 bg-amber-200/15 text-amber-100"
            : "border-amber-200 bg-amber-50 text-amber-700"
          : active
          ? "border-emerald-200/40 bg-emerald-200/15 text-emerald-100"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      } ${className}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {locked ? (
          <>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </>
        ) : (
          <>
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 7.5-1.9" />
          </>
        )}
      </svg>
    </span>
  );
}
