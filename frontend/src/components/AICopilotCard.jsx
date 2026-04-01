import { useNavigate } from "react-router-dom";
import Card from "./ui/Card";
import Button from "./ui/Button";

export default function AICopilotCard({
  title,
  description,
  buttonLabel,
  prompt,
  language = "en",
}) {
  const navigate = useNavigate();

  function handleOpenCopilot() {
    navigate("/chat", {
      state: {
        initialPrompt: prompt,
        source: "ai_copilot_card",
        language,
        title,
      },
    });
  }

  return (
    <Card variant="elevated" padding="lg">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            {language === "fr" ? "Copilote IA" : "AI Copilot"}
          </p>

          <h2 className="mt-2 text-2xl font-bold text-slate-900">{title}</h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            {description}
          </p>
        </div>

        <div className="shrink-0">
          <Button className="h-12" onClick={handleOpenCopilot}>
            {buttonLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}