// src/components/StatCard.jsx
export default function StatCard({
  label,
  value,
  description,
  badge,
  valueClassName = "text-4xl",
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
      <p className="text-sm font-medium text-slate-500">{label}</p>

      <h2 className={`mt-3 font-bold text-slate-900 ${valueClassName}`}>
        {value}
      </h2>

      {badge && (
        <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {badge}
        </p>
      )}

      {description && (
        <p className="mt-3 text-sm text-slate-500">{description}</p>
      )}
    </div>
  );
}