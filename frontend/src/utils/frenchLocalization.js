const PROGRAM_LABELS_FR = {
  "Express Entry": "Entrée express",
  "Express Entry (borderline, improve score if possible)":
    "Entrée express (profil limite, amélioration recommandée)",
  "Express Entry - Canadian Experience Class":
    "Entrée express - catégorie de l'expérience canadienne",
  "Express Entry - Federal Skilled Worker":
    "Entrée express - travailleurs qualifiés fédéral",
  "Express Entry - Provincial nominee":
    "Entrée express - candidat provincial",
  "Provincial Nominee Program": "Programme des candidats des provinces",
  "Provincial Nominee Program (PNP) pathways":
    "Volets des programmes des candidats des provinces (PCP)",
  "British Columbia Provincial Nominee Program":
    "Programme des candidats de la Colombie-Britannique",
  "BC Provincial Nominee Program":
    "Programme des candidats de la Colombie-Britannique",
  "Ontario Provincial Nominee Program":
    "Programme ontarien des candidats à l'immigration",
  "Alberta Provincial Nominee Program": "Programme des candidats de l'Alberta",
  "Manitoba Provincial Nominee Program": "Programme des candidats du Manitoba",
  "Saskatchewan Provincial Nominee Program":
    "Programme des candidats de la Saskatchewan",
  "Nova Scotia Provincial Nominee Program":
    "Programme des candidats de la Nouvelle-Écosse",
  "New Brunswick Provincial Nominee Program":
    "Programme des candidats du Nouveau-Brunswick",
  "Prince Edward Island Provincial Nominee Program":
    "Programme des candidats de l'Île-du-Prince-Édouard",
  "Newfoundland and Labrador Provincial Nominee Program":
    "Programme des candidats de Terre-Neuve-et-Labrador",
  "Yukon Provincial Nominee Program": "Programme des candidats du Yukon",
  "Francophone and bilingual pathways": "Voies francophones et bilingues",
  "Occupation-linked category-based selections":
    "Sélections par catégorie liées à la profession",
  "Category-based selections": "Sélections par catégorie",
  "Work Permit": "Permis de travail",
};

const STATUS_LABELS_FR = {
  active: "Actif",
  paid: "Actif",
  complete: "Actif",
  completed: "Actif",
  trialing: "Essai actif",
  inactive: "Inactif",
  canceling: "Annulation programmée",
  canceled: "Annulé",
  cancelled: "Annulé",
  past_due: "Paiement en retard",
  incomplete: "Incomplet",
  "not active": "Non actif",
};

const ROLE_LABELS_FR = {
  admin: "Administrateur",
  agent: "Agent",
  client: "Client",
  individual: "Particulier",
  user: "Utilisateur",
};

function normalizeText(value) {
  return String(value || "").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function translateProgramLabel(value, language) {
  const text = normalizeText(value);
  if (language !== "fr" || !text) return text;

  if (PROGRAM_LABELS_FR[text]) return PROGRAM_LABELS_FR[text];

  let translated = text;
  Object.entries(PROGRAM_LABELS_FR).forEach(([en, fr]) => {
    translated = translated.replace(new RegExp(`\\b${escapeRegExp(en)}\\b`, "g"), fr);
  });
  return translated;
}

export function translateStrategySummary(value, language) {
  const text = normalizeText(value);
  if (language !== "fr" || !text) return text;

  let translated = text
    .replace(
      /Based on your profile, your estimated CRS score is ([0-9-]+)\./gi,
      "Selon votre profil, votre score CRS estimé est de $1."
    )
    .replace(
      /Your strongest current options are ([^.]+)\./gi,
      (_, programs) =>
        `Vos options actuelles les plus solides sont ${translateProgramLabel(
          programs,
          "fr"
        )}.`
    )
    .replace(
      /Your strongest current pathway appears to be ([^.]+)\./gi,
      (_, program) =>
        `Votre voie actuelle la plus solide semble être ${translateProgramLabel(
          program,
          "fr"
        )}.`
    )
    .replace(
      /Your strongest pathway appears to be ([^.]+)\./gi,
      (_, program) =>
        `Votre voie la plus solide semble être ${translateProgramLabel(
          program,
          "fr"
        )}.`
    )
    .replace(
      /Key areas to improve include CRS score may still be below recent competitive draws\./gi,
      "Les points à améliorer incluent un score CRS qui pourrait encore être inférieur aux seuils compétitifs récents."
    )
    .replace(/Recommended next steps:/gi, "Prochaines étapes recommandées :")
    .replace(
      /Profile appears competitive for Express Entry\./gi,
      "Le profil semble compétitif pour Entrée express."
    )
    .replace(
      /Increase CRS and monitor Express Entry draw trends\./gi,
      "Augmentez le score CRS et suivez les tendances des rondes d'Entrée express."
    )
    .replace(
      /Compare Express Entry with province-specific pathways based on your target province\./gi,
      "Comparez Entrée express avec les voies propres aux provinces selon votre province cible."
    )
    .replace(
      /Francophone opportunities should be treated as a strategic priority\./gi,
      "Les possibilités francophones devraient être traitées comme une priorité stratégique."
    )
    .replace(
      /Your occupation also appears to merit targeted review of occupation-based pathways and provinces that favor this kind of profile\./gi,
      "Votre profession semble aussi mériter une analyse ciblée des voies par profession et des provinces qui recrutent ce type de profil."
    )
    .replace(
      /A likely NOC was also auto-detected to improve strategy precision\./gi,
      "Un code CNP probable a aussi été détecté automatiquement pour renforcer la précision de la stratégie."
    )
    .replace(
      /This strategy is based on your current profile, estimated CRS score, and improvement levers\./gi,
      "Cette stratégie est basée sur votre profil actuel, votre score CRS estimé et vos leviers d'amélioration."
    );

  Object.entries(PROGRAM_LABELS_FR).forEach(([en, fr]) => {
    translated = translated.replace(new RegExp(escapeRegExp(en), "g"), fr);
  });

  return translated.replace(/\s+/g, " ").trim();
}

export function translateStatusLabel(value, language) {
  const text = normalizeText(value);
  if (language !== "fr") return text;
  return STATUS_LABELS_FR[text.toLowerCase()] || text;
}

export function translateRoleLabel(value, language) {
  const text = normalizeText(value);
  if (language !== "fr") return text || "individual";
  return ROLE_LABELS_FR[text.toLowerCase()] || text || "Particulier";
}
