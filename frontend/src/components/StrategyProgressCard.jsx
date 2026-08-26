import Card from "./ui/Card";
import Button from "./ui/Button";

function MiniStat({ label, value }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 text-center">
      <p className="break-words text-[10px] uppercase leading-4 tracking-[0.1em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ReadinessRing({ progress, language }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress || 0)));
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeProgress / 100) * circumference;

  return (
    <div className="flex items-center justify-center">
      <div className="relative h-28 w-28">
        <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgb(226 232 240)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgb(30 64 175)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-slate-900">
            {safeProgress}%
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            {language === "fr" ? "Progression" : "Progress"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function StrategyProgressCard({
  language = "en",
  progress = 0,
  documentStats,
  priority,
  onOpenPriority,
  onAnalyzePriority,
}) {
  const isFrench = language === "fr";

  const text = isFrench
    ? {
        title: "Progression",
        subtitle:
          "Suivez l’avancement global de votre exécution stratégique.",
        completed: "Complétés",
        reviewed: "Révisés",
        total: "Suivis",
        next: "Prochaine meilleure action",
        open: "Ouvrir",
        analyze: "Analyser avec l’IA",
      }
    : {
        title: "Progress",
        subtitle: "Track the overall progress of your strategy execution.",
        completed: "Completed",
        reviewed: "Reviewed",
        total: "Tracked",
        next: "Next best action",
        open: "Open",
        analyze: "Analyze with AI",
      };

  return (
    <Card
      variant="soft"
      padding="md"
      className="overflow-hidden border-slate-200 bg-gradient-to-br from-white to-slate-50"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {text.title}
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-600">{text.subtitle}</p>

      <div className="mt-5">
        <ReadinessRing progress={progress} language={language} />
      </div>

      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-2">
        <MiniStat label={text.completed} value={documentStats.completed} />
        <MiniStat label={text.reviewed} value={documentStats.reviewed} />
        <MiniStat label={text.total} value={documentStats.total} />
      </div>

      {priority ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {text.next}
          </p>

          <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">
            {priority.title}
          </p>

          <div className="mt-4 grid gap-2">
            <Button size="sm" fullWidth onClick={onOpenPriority}>
              {text.open}
            </Button>

            <Button
              size="sm"
              variant="subtle"
              fullWidth
              onClick={onAnalyzePriority}
            >
              {text.analyze}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
