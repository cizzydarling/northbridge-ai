export const FREE_PLAN = "free";
export const PRO_PLAN = "pro";
export const PREMIUM_PLAN = "premium";

export function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();
  if ([FREE_PLAN, PRO_PLAN, PREMIUM_PLAN].includes(value)) {
    return value;
  }
  return FREE_PLAN;
}

export function getAccessState(userLike = {}) {
  const plan = normalizePlan(userLike?.plan);
  const features = userLike?.features || {};

  const isPro =
    Boolean(userLike?.is_pro) ||
    plan === PRO_PLAN ||
    plan === PREMIUM_PLAN;

  const isPremium =
    Boolean(userLike?.is_premium) ||
    plan === PREMIUM_PLAN;

  return {
    plan,
    isFree: !isPro,
    isPro,
    isPremium,
    features: {
      basicStrategy:
        features.basic_strategy !== undefined ? features.basic_strategy : true,
      fullStrategy:
        features.full_strategy !== undefined ? features.full_strategy : isPro,
      decisionEngine:
        features.decision_engine !== undefined ? features.decision_engine : isPro,
      documentGenerator:
        features.document_generator !== undefined
          ? features.document_generator
          : true,
      unlimitedDocumentGeneration:
        features.unlimited_document_generation !== undefined
          ? features.unlimited_document_generation
          : isPro,
      documentReview:
        features.document_review !== undefined ? features.document_review : isPro,
      advancedAICopilot:
        features.advanced_ai_copilot !== undefined
          ? features.advanced_ai_copilot
          : isPro,
      priorityAI:
        features.priority_ai !== undefined ? features.priority_ai : isPremium,
      exports:
        features.exports !== undefined ? features.exports : isPremium,
      clientWorkspace:
        features.client_workspace !== undefined
          ? features.client_workspace
          : isPremium,
    },
  };
}

export function buildUpgradeMessage({
  language = "en",
  requiredPlan = PRO_PLAN,
  featureLabelEn = "this feature",
  featureLabelFr = "cette fonctionnalité",
}) {
  const lang = String(language || "en").toLowerCase().startsWith("fr")
    ? "fr"
    : "en";

  if (lang === "fr") {
    return requiredPlan === PREMIUM_PLAN
      ? `Passez à Premium pour débloquer ${featureLabelFr}.`
      : `Passez à Pro pour débloquer ${featureLabelFr}.`;
  }

  return requiredPlan === PREMIUM_PLAN
    ? `Upgrade to Premium to unlock ${featureLabelEn}.`
    : `Upgrade to Pro to unlock ${featureLabelEn}.`;
}

export function canUseFeature(userLike, featureKey) {
  const access = getAccessState(userLike);
  return Boolean(access.features?.[featureKey]);
}