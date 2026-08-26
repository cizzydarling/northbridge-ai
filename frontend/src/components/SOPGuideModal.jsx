import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "./ui/Button";
import Card from "./ui/Card";

const GUIDE_KEY = "nbai_sop_guide_seen_v1";

function getGuideSeen() {
  try {
    return localStorage.getItem(GUIDE_KEY) === "true";
  } catch {
    return true;
  }
}

function setGuideSeen() {
  try {
    localStorage.setItem(GUIDE_KEY, "true");
    window.dispatchEvent(new Event("nbai-starter-guide-completed"));
  } catch {
    // localStorage can be unavailable in private browsing.
  }
}

export default function SOPGuideModal({ forceOpen = false, onClose }) {
  const { i18n } = useTranslation();
  const language = i18n.language === "fr" ? "fr" : "en";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) return;

    const timer = window.setTimeout(() => {
      if (!getGuideSeen()) setOpen(true);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [forceOpen]);

  const isOpen = forceOpen || open;

  const text = useMemo(() => {
    if (language === "fr") {
      return {
        eyebrow: "Guide de demarrage",
        title: "Comment trouver rapidement les bonnes informations",
        body:
          "NorthBridgeAI organise votre dossier autour du profil, de la strategie, des documents et des outils d'execution.",
        close: "Compris",
        later: "Plus tard",
        steps: [
          {
            title: "Profil",
            body:
              "Gardez vos renseignements a jour, y compris les scores d'anglais et de francais separes.",
          },
          {
            title: "Strategie",
            body:
              "Consultez le meilleur parcours, les risques, les priorites et les prochaines actions.",
          },
          {
            title: "Documents",
            body:
              "Suivez les pieces requises, ajoutez des fichiers et utilisez les outils de generation ou de revision.",
          },
          {
            title: "Recherche",
            body:
              "Utilisez le menu de gauche pour revenir aux modules: demandes, formulaires, carriere, citoyennete et famille.",
          },
        ],
      };
    }

    return {
      eyebrow: "Starter guide",
      title: "How to find the right information fast",
      body:
        "NorthBridgeAI organizes your case around profile data, strategy, documents, and execution tools.",
      close: "Got it",
      later: "Later",
      steps: [
        {
          title: "Profile",
          body:
            "Keep your details current, including separate English and French language scores.",
        },
        {
          title: "Strategy",
          body:
            "Review your best pathway, risks, priorities, and recommended next actions.",
        },
        {
          title: "Documents",
          body:
            "Track required items, upload files, and use generation or review tools.",
        },
        {
          title: "Navigation",
          body:
            "Use the left menu to return to applications, forms, career, citizenship, and household tools.",
        },
      ],
    };
  }, [language]);

  function closeGuide(markSeen = true) {
    if (markSeen) setGuideSeen();
    setOpen(false);
    onClose?.();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-slate-950/45 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-4">
      <Card className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-0 shadow-[0_20px_80px_rgba(15,23,42,0.18)]">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
            {text.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            {text.title}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">{text.body}</p>
        </div>

        <div className="grid gap-3 px-5 py-5 sm:px-6">
          {text.steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
            >
              <p className="text-sm font-semibold text-slate-950">
                {index + 1}. {step.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {step.body}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="secondary" onClick={() => closeGuide(false)}>
            {text.later}
          </Button>
          <Button type="button" onClick={() => closeGuide(true)}>
            {text.close}
          </Button>
        </div>
      </Card>
    </div>
  );
}
