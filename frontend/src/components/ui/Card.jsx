export default function Card({
  children,
  className = "",
  variant = "default",
  hover = false,
  padding = "md",
  as: Component = "div",
  onClick,
  interactive = false,
}) {
  const base = "rounded-[28px] border transition-all duration-200";

  const variants = {
    default:
      "border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]",
    elevated:
      "border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.10)]",
    soft:
      "border-slate-200 bg-slate-50/80 shadow-[0_10px_30px_rgba(15,23,42,0.04)]",
    glass:
      "border-white/30 bg-white/80 backdrop-blur-xl shadow-[0_18px_60px_rgba(15,23,42,0.10)]",
    premium:
      "border-blue-100 bg-gradient-to-br from-white to-blue-50/40 shadow-[0_18px_60px_rgba(15,23,42,0.08)]",
    success:
      "border-emerald-200 bg-emerald-50/40 shadow-[0_12px_40px_rgba(15,23,42,0.05)]",
    warning:
      "border-amber-200 bg-amber-50/50 shadow-[0_12px_40px_rgba(15,23,42,0.05)]",
    danger:
      "border-red-200 bg-red-50/40 shadow-[0_12px_40px_rgba(15,23,42,0.05)]",
  };

  const paddings = {
    sm: "p-5",
    md: "p-6",
    lg: "p-8",
    xl: "p-10",
    none: "",
  };

  const hoverStyles =
    hover || interactive
      ? "hover:-translate-y-[2px] hover:shadow-[0_22px_70px_rgba(15,23,42,0.10)]"
      : "";

  const interactiveStyles =
    interactive || onClick
      ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200"
      : "";

  return (
    <Component
      onClick={onClick}
      className={`${base} ${variants[variant] || variants.default} ${
        paddings[padding] || paddings.md
      } ${hoverStyles} ${interactiveStyles} ${className}`}
    >
      {children}
    </Component>
  );
}