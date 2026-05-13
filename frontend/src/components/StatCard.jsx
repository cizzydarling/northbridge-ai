export default function StatCard({
  label,
  value,
  description,
  badge,
  trend,
  tone = "default",
  valueClassName = "text-5xl",
  className = "",
}) {
  const toneStyles = {
    default: {
      card: "border-slate-200 bg-white",
      badge: "border-slate-200 bg-slate-50 text-slate-700",
      trend: "border-slate-200 bg-slate-50 text-slate-700",
    },
    success: {
      card: "border-emerald-200 bg-emerald-50/40",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      trend: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    warning: {
      card: "border-amber-200 bg-amber-50/40",
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      trend: "border-amber-200 bg-amber-50 text-amber-700",
    },
    danger: {
      card: "border-red-200 bg-red-50/40",
      badge: "border-red-200 bg-red-50 text-red-700",
      trend: "border-red-200 bg-red-50 text-red-700",
    },
    info: {
      card: "border-teal-200 bg-teal-50/40",
      badge: "border-teal-200 bg-teal-50 text-teal-700",
      trend: "border-teal-200 bg-teal-50 text-teal-700",
    },
    premium: {
      card: "border-amber-200 bg-stone-50",
      badge: "border-amber-200 bg-amber-50 text-amber-800",
      trend: "border-amber-200 bg-amber-50 text-amber-800",
    },
  };

  const selectedTone = toneStyles[tone] || toneStyles.default;

  return (
    <div
      className={`min-h-[180px] rounded-2xl border p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_18px_60px_rgba(15,23,42,0.09)] ${selectedTone.card} ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>

        {badge ? (
          <p
            className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${selectedTone.badge}`}
          >
            {badge}
          </p>
        ) : null}
      </div>

      <h2
        className={`mt-4 break-words font-semibold tracking-tight text-slate-900 ${valueClassName}`}
      >
        {value}
      </h2>

      {trend ? (
        <div
          className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${selectedTone.trend}`}
        >
          {trend}
        </div>
      ) : null}

      {description ? (
        <p className="mt-4 text-sm leading-7 text-slate-600">{description}</p>
      ) : null}
    </div>
  );
}
