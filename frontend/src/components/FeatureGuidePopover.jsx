import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Button from "./ui/Button";
import Card from "./ui/Card";

const STARTER_GUIDE_KEY = "nbai_sop_guide_seen_v1";
const FEATURE_GUIDE_KEY_PREFIX = "nbai_feature_guide_seen_v1_";

const guideByPath = {
  "/strategy": "strategy",
  "/documents": "documents",
  "/documents/generator": "generator",
  "/forms": "forms",
};

function hasSeen(key) {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return true;
  }
}

function markSeen(key) {
  try {
    localStorage.setItem(key, "true");
  } catch {
    // Private browsing can prevent persistent guide state.
  }
}

function guideCopy(language) {
  const isFrench = language === "fr";

  return {
    strategy: isFrench
      ? {
          eyebrow: "Guide strategie",
          title: "Commencez par votre meilleur parcours",
          body: "Utilisez les onglets pour comparer vos priorites, les risques et les actions. Dans Intelligence IRCC Premium, lisez les sources officielles avant de modifier votre plan.",
          steps: ["Verifiez votre parcours recommande.", "Choisissez une prochaine action realiste.", "Gardez les donnees de profil et les documents a jour."],
        }
      : {
          eyebrow: "Strategy guide",
          title: "Start with your best-fit pathway",
          body: "Use the tabs to compare priorities, risks, and actions. In Premium IRCC Intelligence, read the official sources before changing your plan.",
          steps: ["Review the recommended pathway.", "Choose one realistic next action.", "Keep profile data and documents current."],
        },
    documents: isFrench
      ? {
          eyebrow: "Guide documents",
          title: "Avancez un document a la fois",
          body: "Commencez par le document prioritaire, ajoutez uniquement les fichiers necessaires et mettez son etat a jour a mesure que le dossier avance.",
          steps: ["Ouvrez le document prioritaire.", "Ajoutez ou verifiez les preuves pertinentes.", "Marquez les elements revises ou termines."],
        }
      : {
          eyebrow: "Documents guide",
          title: "Move one document forward at a time",
          body: "Start with the priority document, add only the evidence you need, and update its status as the case progresses.",
          steps: ["Open the priority document.", "Add or review the relevant evidence.", "Mark items reviewed or complete."],
        },
    generator: isFrench
      ? {
          eyebrow: "Guide generateur",
          title: "Utilisez le generateur comme un point de depart",
          body: "Choisissez le bon type de document, donnez des faits precis et relisez chaque brouillon avant de l'utiliser dans une demande.",
          steps: ["Choisissez le type de document.", "Ajoutez des details factuels et coherents.", "Revisez et personnalisez le brouillon."],
        }
      : {
          eyebrow: "Generator guide",
          title: "Use the generator as a starting point",
          body: "Choose the right document type, provide precise facts, and review every draft before using it in an application.",
          steps: ["Choose the document type.", "Add factual, consistent details.", "Review and personalize the draft."],
        },
    forms: isFrench
      ? {
          eyebrow: "Guide formulaires",
          title: "Remplissez les formulaires par sections",
          body: "Travaillez une section a la fois, conservez vos informations coherentes et comparez toujours le resultat avec les instructions officielles du formulaire.",
          steps: ["Choisissez le bon formulaire.", "Completez une section a la fois.", "Verifiez les reponses et les documents justificatifs."],
        }
      : {
          eyebrow: "Forms guide",
          title: "Complete forms one section at a time",
          body: "Work section by section, keep your information consistent, and always compare the final result with the form's official instructions.",
          steps: ["Choose the correct form.", "Complete one section at a time.", "Verify answers and supporting documents."],
        },
  };
}

export default function FeatureGuidePopover() {
  const location = useLocation();
  const { i18n } = useTranslation();
  const [activeGuide, setActiveGuide] = useState(null);
  const [dismissedThisVisit, setDismissedThisVisit] = useState([]);
  const [starterGuideCompleted, setStarterGuideCompleted] = useState(() =>
    hasSeen(STARTER_GUIDE_KEY)
  );
  const guideId = guideByPath[location.pathname];
  const language = i18n.language === "fr" ? "fr" : "en";
  const guides = useMemo(() => guideCopy(language), [language]);

  useEffect(() => {
    function handleStarterGuideCompleted() {
      setStarterGuideCompleted(true);
    }

    window.addEventListener("nbai-starter-guide-completed", handleStarterGuideCompleted);
    return () =>
      window.removeEventListener(
        "nbai-starter-guide-completed",
        handleStarterGuideCompleted
      );
  }, []);

  useEffect(() => {
    if (!guideId || dismissedThisVisit.includes(guideId)) return undefined;
    if (!starterGuideCompleted) return undefined;

    const storageKey = `${FEATURE_GUIDE_KEY_PREFIX}${guideId}`;
    if (hasSeen(storageKey)) return undefined;

    const timer = window.setTimeout(() => setActiveGuide(guideId), 900);
    return () => window.clearTimeout(timer);
  }, [dismissedThisVisit, guideId, location.pathname, starterGuideCompleted]);

  if (!activeGuide || activeGuide !== guideId) return null;

  const guide = guides[activeGuide];
  if (!guide) return null;

  function closeGuide(markAsSeen) {
    if (markAsSeen) {
      markSeen(`${FEATURE_GUIDE_KEY_PREFIX}${activeGuide}`);
    } else {
      setDismissedThisVisit((current) => [...new Set([...current, activeGuide])]);
    }
    setActiveGuide(null);
  }

  return (
    <div className="fixed bottom-4 right-3 z-[105] w-[calc(100%-1.5rem)] max-w-md sm:bottom-6 sm:right-6 sm:w-full">
      <Card className="rounded-2xl border border-blue-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
          {guide.eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
          {guide.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{guide.body}</p>
        <ol className="mt-4 space-y-2">
          {guide.steps.map((step, index) => (
            <li key={step} className="flex gap-2 text-sm leading-6 text-slate-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-800">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" size="sm" variant="secondary" onClick={() => closeGuide(false)}>
            {language === "fr" ? "Plus tard" : "Later"}
          </Button>
          <Button type="button" size="sm" onClick={() => closeGuide(true)}>
            {language === "fr" ? "Compris" : "Got it"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
