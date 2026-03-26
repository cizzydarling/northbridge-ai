export default function Card({
  children,
  className = "",
  variant = "default",
  hover = false,
  padding = "md",
}) {
  const base =
    "rounded-2xl border border-slate-200 bg-white transition duration-200";

  const variants = {
    default: "shadow-sm",
    elevated: "shadow-md",
    soft: "bg-slate-50 border-slate-100 shadow-sm",
    glass:
      "bg-white/80 backdrop-blur border border-white/20 shadow-lg",
  };

  const paddings = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
    none: "",
  };

  const hoverStyles = hover
    ? "hover:shadow-lg hover:-translate-y-[1px]"
    : "";

  return (
    <div
      className={`${base} ${variants[variant] || variants.default} ${
        paddings[padding] || paddings.md
      } ${hoverStyles} ${className}`}
    >
      {children}
    </div>
  );
}