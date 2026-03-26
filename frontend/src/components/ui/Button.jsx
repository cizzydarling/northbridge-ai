export default function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  className = "",
  disabled = false,
}) {
  const base =
    "inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl px-5 text-sm font-medium leading-none transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60";

  const variants = {
    primary:
      "bg-blue-600 text-white shadow-sm hover:bg-blue-700",
    secondary:
      "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
    ghost:
      "text-slate-700 hover:bg-slate-100",
    danger:
      "border border-red-200 bg-white text-red-600 hover:bg-red-50",
    white: // ✅ NEW (this fixes your issue cleanly)
      "bg-white text-slate-900 hover:bg-slate-100",
    outlineLight: // ✅ NEW (for hero dark sections)
      "border border-white text-white hover:bg-white hover:text-slate-900",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant] || variants.primary} ${className}`}
    >
      <span className="flex items-center justify-center">{children}</span>
    </button>
  );
}