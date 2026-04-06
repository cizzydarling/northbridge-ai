export default function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
  error = "",
  hint = "",
  ...props
}) {
  const hasError = Boolean(error);

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-700">
          {label}
        </label>
      )}

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={hasError}
        className={`
          w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900
          placeholder:text-slate-400
          transition-all duration-200 ease-out
          outline-none

          ${
            hasError
              ? "border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100"
              : "border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
          }

          hover:border-slate-400
          focus:shadow-sm

          ${className}
        `}
        {...props}
      />

      {hint && !hasError && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}

      {hasError && (
        <p className="text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}