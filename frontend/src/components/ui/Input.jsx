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
    <div>
      {label ? (
        <label className="mb-2 block text-sm font-medium text-slate-700">
          {label}
        </label>
      ) : null}

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={hasError}
        className={`w-full rounded-2xl border bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition ${
          hasError
            ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            : "border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        } ${className}`}
        {...props}
      />

      {hint && !hasError ? (
        <p className="mt-2 text-xs text-slate-500">{hint}</p>
      ) : null}

      {hasError ? (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}