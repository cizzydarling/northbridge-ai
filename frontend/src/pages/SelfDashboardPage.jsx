import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Layout from "../components/Layout";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

export default function SelfDashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const quickActions = useMemo(
    () => [
      {
        title: t("dashboard.cards.profile.title", {
          defaultValue: "Complete Profile",
        }),
        description: t("dashboard.cards.profile.description", {
          defaultValue:
            "Add or update your immigration profile so strategy and guidance are more accurate.",
        }),
        cta: t("dashboard.cards.profile.cta", {
          defaultValue: "Open Profile",
        }),
        onClick: () => navigate("/profile"),
      },
      {
        title: t("dashboard.cards.strategy.title", {
          defaultValue: "View Strategy",
        }),
        description: t("dashboard.cards.strategy.description", {
          defaultValue:
            "Review your pathway recommendations, strengths, weaknesses, and next steps.",
        }),
        cta: t("dashboard.cards.strategy.cta", {
          defaultValue: "Open Strategy",
        }),
        onClick: () => navigate("/strategy"),
        featured: true,
      },
      {
        title: t("dashboard.cards.chat.title", {
          defaultValue: "Ask the AI Assistant",
        }),
        description: t("dashboard.cards.chat.description", {
          defaultValue:
            "Get guided answers based on your profile, strategy, and application context.",
        }),
        cta: t("dashboard.cards.chat.cta", {
          defaultValue: "Open Assistant",
        }),
        onClick: () => navigate("/chat"),
      },
      {
        title: t("dashboard.cards.application.title", {
          defaultValue: "Continue Application",
        }),
        description: t("dashboard.cards.application.description", {
          defaultValue:
            "Resume your saved application workflow and keep building your case step by step.",
        }),
        cta: t("dashboard.cards.application.cta", {
          defaultValue: "Open Application",
        }),
        onClick: () => navigate("/self/application"),
      },
      {
        title: t("dashboard.cards.documents.title", {
          defaultValue: "Manage Documents",
        }),
        description: t("dashboard.cards.documents.description", {
          defaultValue:
            "Track required files, uploads, and your document preparation progress.",
        }),
        cta: t("dashboard.cards.documents.cta", {
          defaultValue: "Open Documents",
        }),
        onClick: () => navigate("/self/documents"),
      },
      {
        title: t("dashboard.cards.disclosure.title", {
          defaultValue: "Review Disclosure",
        }),
        description: t("dashboard.cards.disclosure.description", {
          defaultValue:
            "Read and confirm important legal and informational disclosures for your journey.",
        }),
        cta: t("dashboard.cards.disclosure.cta", {
          defaultValue: "Open Disclosure",
        }),
        onClick: () => navigate("/legal/disclosure"),
      },
    ],
    [navigate, t]
  );

  const highlights = useMemo(
    () => [
      {
        value: t("dashboard.highlights.simple.value", {
          defaultValue: "Simple",
        }),
        label: t("dashboard.highlights.simple.label", {
          defaultValue: "Clear experience",
        }),
      },
      {
        value: t("dashboard.highlights.guided.value", {
          defaultValue: "Guided",
        }),
        label: t("dashboard.highlights.guided.label", {
          defaultValue: "Next best action",
        }),
      },
      {
        value: t("dashboard.highlights.trustworthy.value", {
          defaultValue: "Trusted",
        }),
        label: t("dashboard.highlights.trustworthy.label", {
          defaultValue: "Structured planning",
        }),
      },
    ],
    [t]
  );

  const journeyTips = useMemo(
    () => [
      t("dashboard.tips.one", {
        defaultValue:
          "Start with your profile so your strategy has the right foundation.",
      }),
      t("dashboard.tips.two", {
        defaultValue:
          "Review your strategy before spending time on lower-priority tasks.",
      }),
      t("dashboard.tips.three", {
        defaultValue:
          "Keep your documents organized early to reduce friction later.",
      }),
    ],
    [t]
  );

  return (
    <Layout>
      <div className="space-y-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 px-6 py-8 text-white shadow-xl md:px-8 md:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
                {t("dashboard.hero.eyebrow", {
                  defaultValue: "NorthBridgeAI Dashboard",
                })}
              </p>

              <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
                {t("dashboard.hero.title", {
                  defaultValue: "Your guided immigration workspace",
                })}
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-7 text-blue-100 md:text-lg">
                {t("dashboard.hero.subtitle", {
                  defaultValue:
                    "Move from uncertainty to action with a clearer profile, stronger strategy, and a more organized application workflow.",
                })}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  variant="white"
                  className="h-12 w-full sm:w-auto"
                  onClick={() => navigate("/profile")}
                >
                  {t("dashboard.hero.primaryCta", {
                    defaultValue: "Complete Profile",
                  })}
                </Button>

                <Button
                  variant="outlineLight"
                  className="h-12 w-full sm:w-auto"
                  onClick={() => navigate("/strategy")}
                >
                  {t("dashboard.hero.secondaryCta", {
                    defaultValue: "View Strategy",
                  })}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {highlights.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm"
                >
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="mt-2 text-sm text-blue-100">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-5">
            <h2 className="text-2xl font-bold text-slate-900">
              {t("dashboard.actions.title", {
                defaultValue: "Choose your next step",
              })}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {t("dashboard.actions.subtitle", {
                defaultValue:
                  "Everything you need is organized into clear actions so you always know where to go next.",
              })}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <DashboardActionCard
                key={action.title}
                title={action.title}
                description={action.description}
                cta={action.cta}
                onClick={action.onClick}
                featured={action.featured}
              />
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <Card variant="elevated" padding="lg">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t("dashboard.guidance.eyebrow", {
                defaultValue: "Planning guidance",
              })}
            </p>

            <h2 className="mt-3 text-2xl font-bold text-slate-900">
              {t("dashboard.guidance.title", {
                defaultValue: "Build momentum with the right order",
              })}
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              {t("dashboard.guidance.description", {
                defaultValue:
                  "The strongest workflow is usually: complete your profile, review your strategy, ask the AI assistant for clarification, and then organize your documents and application steps.",
              })}
            </p>

            <div className="mt-6 space-y-3">
              {journeyTips.map((tip, index) => (
                <div
                  key={index}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-900 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="text-sm text-slate-700">{tip}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card variant="elevated" padding="lg">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t("dashboard.legal.eyebrow", {
                defaultValue: "Important information",
              })}
            </p>

            <h2 className="mt-3 text-2xl font-bold text-slate-900">
              {t("dashboard.legal.title", {
                defaultValue: "Use the platform with confidence",
              })}
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              {t("dashboard.legal.description", {
                defaultValue:
                  "NorthBridgeAI is designed to support planning, organization, and educational guidance. It does not replace legal advice from a licensed lawyer or regulated consultant.",
              })}
            </p>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">
                {t("dashboard.legal.calloutTitle", {
                  defaultValue: "Best practice",
                })}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                {t("dashboard.legal.calloutText", {
                  defaultValue:
                    "Keep your profile current, review your strategy regularly, and use disclosures and document tools before taking major action.",
                })}
              </p>
            </div>

            <div className="mt-6">
              <Button
                variant="secondary"
                className="h-12"
                onClick={() => navigate("/legal/disclosure")}
              >
                {t("dashboard.legal.cta", {
                  defaultValue: "Review Disclosure",
                })}
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </Layout>
  );
}

function DashboardActionCard({
  title,
  description,
  cta,
  onClick,
  featured = false,
}) {
  return (
    <Card
      variant={featured ? "elevated" : "default"}
      padding="lg"
      hover
      className={`group h-full ${
        featured ? "ring-2 ring-blue-500/70 shadow-lg" : ""
      }`}
    >
      <div className="flex h-full flex-col">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

        <div className="mt-6">
          <Button className="h-12" onClick={onClick}>
            {cta}
          </Button>
        </div>
      </div>
    </Card>
  );
}