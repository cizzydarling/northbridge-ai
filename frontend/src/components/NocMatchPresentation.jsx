import { useId } from "react";

const OFFICIAL_NOC_URL = "https://noc.esdc.gc.ca/"; // Existing source in data/blogArticles.js.

function wording(language) {
  return String(language).startsWith("fr")
    ? {
        label: "Correspondance du texte et des fonctions",
        qualification: "Signal heuristique de similarité avec les renseignements de la CNP. Comparez vos fonctions principales réelles à la description officielle avant d’utiliser cette suggestion. Ce score ne confirme pas votre code CNP officiel et ne détermine pas votre admissibilité à l’immigration.",
        action: "Comparez vos fonctions avec la description officielle de la CNP",
      }
    : {
        label: "Text & duties match",
        qualification: "Heuristic similarity signal based on NOC information. Compare your actual main duties with the official description before using this suggestion. This score does not confirm your official NOC or determine immigration eligibility.",
        action: "Compare your duties with the official NOC description",
      };
}

export function NocMatchSignal({ confidence, language, describedBy }) {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return null;
  const fr = String(language).startsWith("fr");
  return <span data-testid="noc-match-signal" aria-describedby={describedBy} className="block text-sm font-semibold text-slate-700">
    {Math.round(confidence * 100)}{fr ? " %" : "%"} — {wording(language).label}
  </span>;
}

export function NocMatchQualification({ language, id }) {
  const text = wording(language);
  return <div id={id} data-testid="noc-match-qualification" className="space-y-2 text-sm leading-6 text-slate-700">
    <p>{text.qualification}</p>
    <a href={OFFICIAL_NOC_URL} target="_blank" rel="noopener noreferrer" className="inline-block underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">{text.action}</a>
  </div>;
}

// Always qualify suggestions, including clients with absent/unknown status metadata.
export default function NocMatchPresentation({ confidence, language }) {
  const id = useId();
  return <div data-testid="noc-match-result" className="min-w-0 space-y-2">
    <NocMatchSignal confidence={confidence} language={language} describedBy={id} />
    <NocMatchQualification language={language} id={id} />
  </div>;
}
