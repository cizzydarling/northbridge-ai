export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  loading = false,
}) {
  const base =
    "inline-flex items-center justify-center whitespace-nowrap rounded-2xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60";

  const sizes = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-5 text-sm",
    lg: "h-12 px-6 text-base",
  };

  const variants = {
    primary:
      "bg-blue-900 text-white shadow-sm shadow-blue-900/10 hover:bg-blue-800 active:scale-[0.98]",

    secondary:
      "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-[0.98]",

    ghost:
      "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]",

    danger:
      "border border-red-200 bg-white text-red-600 hover:bg-red-50 active:scale-[0.98]",

    white:
      "bg-white text-slate-900 shadow-sm hover:bg-slate-100 active:scale-[0.98]",

    outlineLight:
      "border border-white/80 text-white hover:bg-white hover:text-slate-900 active:scale-[0.98]",

    subtle: // ⭐ NEW (premium low-emphasis button)
      "bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98]",

    premium: // ⭐ NEW (used sparingly for high-value actions)
      "bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-md shadow-blue-900/20 hover:opacity-95 active:scale-[0.98]",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${
        variants[variant] || variants.primary
      } ${className}`}
    >
      <span className="flex items-center justify-center gap-2">
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {children}
      </span>
    </button>
  );
}