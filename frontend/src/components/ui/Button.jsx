export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon = null,
  rightIcon = null,
  ariaLabel,
}) {
  const isDisabled = disabled || loading;

  const base =
    "inline-flex items-center justify-center whitespace-nowrap rounded-2xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60";

  const widthClass = fullWidth ? "w-full" : "";

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

    subtle:
      "bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-[0.98]",

    premium:
      "bg-gradient-to-r from-blue-900 to-blue-700 text-white shadow-md shadow-blue-900/20 hover:opacity-95 active:scale-[0.98]",
  };

  const spinnerClassMap = {
    primary: "border-white/30 border-t-white",
    premium: "border-white/30 border-t-white",
    outlineLight: "border-white/30 border-t-white",
    white: "border-slate-300 border-t-slate-700",
    secondary: "border-slate-300 border-t-slate-700",
    ghost: "border-slate-300 border-t-slate-700",
    subtle: "border-slate-300 border-t-slate-700",
    danger: "border-red-200 border-t-red-600",
  };

  const spinnerClass =
    spinnerClassMap[variant] || "border-white/30 border-t-white";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading}
      className={`${base} ${sizes[size] || sizes.md} ${
        variants[variant] || variants.primary
      } ${widthClass} ${className}`}
    >
      <span className="flex items-center justify-center gap-2">
        {loading ? (
          <span
            className={`h-4 w-4 animate-spin rounded-full border-2 ${spinnerClass}`}
          />
        ) : leftIcon ? (
          <span className="inline-flex items-center">{leftIcon}</span>
        ) : null}

        <span className="inline-flex items-center">{children}</span>

        {!loading && rightIcon ? (
          <span className="inline-flex items-center">{rightIcon}</span>
        ) : null}
      </span>
    </button>
  );
}