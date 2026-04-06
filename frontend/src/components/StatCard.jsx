export default function StatCard({
  label,
  value,
  description,
  badge,
  valueClassName = "text-5xl",
  className = "",
}) {
  return (
    <div
      className={`rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_18px_60px_rgba(15,23,42,0.09)] ${className}`}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <h2
        className={`mt-4 font-semibold tracking-tight text-slate-900 ${valueClassName}`}
      >
        {value}
      </h2>

      {badge && (
        <p className="mt-4 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
          {badge}
        </p>
      )}

      {description && (
        <p className="mt-4 text-sm leading-7 text-slate-600">{description}</p>
      )}
    </div>
  );
}