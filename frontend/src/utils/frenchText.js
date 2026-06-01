const FRENCH_REPLACEMENTS = [
  ["Ã©", "\u00e9"],
  ["Ã¨", "\u00e8"],
  ["Ãª", "\u00ea"],
  ["Ã´", "\u00f4"],
  ["Ã‰", "\u00c9"],
  ["Ã ", "\u00e0"],
  ["Ã§", "\u00e7"],
  ["citoyennete", "citoyennet\u00e9"],
  ["responsabilites", "responsabilit\u00e9s"],
  ["responsabilite", "responsabilit\u00e9"],
  ["democratiques", "d\u00e9mocratiques"],
  ["Revisez", "R\u00e9visez"],
  ["federalisme", "f\u00e9d\u00e9ralisme"],
  ["federale", "f\u00e9d\u00e9rale"],
  ["federales", "f\u00e9d\u00e9rales"],
  ["federal", "f\u00e9d\u00e9ral"],
  ["representants", "repr\u00e9sentants"],
  ["elections", "\u00e9lections"],
  ["Geographie", "G\u00e9ographie"],
  ["economie", "\u00e9conomie"],
  ["Etudiez", "\u00c9tudiez"],
  ["regions", "r\u00e9gions"],
  ["identite", "identit\u00e9"],
  ["Decouvrir", "D\u00e9couvrir"],
  ["educatif", "\u00e9ducatif"],
  ["themes", "th\u00e8mes"],
  ["etude", "\u00e9tude"],
  ["resultats", "r\u00e9sultats"],
  ["resultat", "r\u00e9sultat"],
  ["reponses", "r\u00e9ponses"],
  ["reponse", "r\u00e9ponse"],
  ["francais", "fran\u00e7ais"],
  ["Francais", "Fran\u00e7ais"],
  ["Preparez", "Pr\u00e9parez"],
  ["Repondez", "R\u00e9pondez"],
  ["Reussi", "R\u00e9ussi"],
  ["details", "d\u00e9tails"],
  ["reessayez", "r\u00e9essayez"],
  ["recente", "r\u00e9cente"],
  ["recentes", "r\u00e9centes"],
  ["enregistree", "enregistr\u00e9e"],
  ["envoye", "envoy\u00e9"],
  ["ete", "\u00e9t\u00e9"],
];

export function normalizeFrenchText(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFrenchText(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeFrenchText(item)])
    );
  }

  if (typeof value !== "string") {
    return value;
  }

  return FRENCH_REPLACEMENTS.reduce(
    (text, [source, replacement]) => text.replaceAll(source, replacement),
    value
  );
}
