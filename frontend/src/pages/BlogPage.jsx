import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import MarketingShell from "../components/MarketingShell";
import {
  getBlogArticles,
  getFeaturedBlogArticle,
  normalizeBlogLanguage,
} from "../data/blogArticles";
import { getAbsoluteUrl, setJsonLd, setSeoMetadata, SITE_URL } from "../utils/seo";

const blogKeywords = [
  "NorthBridgeAI blog",
  "Canadian immigration AI",
  "Canada immigration planning",
  "immigration document checklist",
  "AI immigration copilot",
];

const blogPageCopy = {
  en: {
    seoTitle: "Canadian Immigration AI Blog",
    seoDescription:
      "Short, practical NorthBridgeAI articles about Canadian immigration planning, document readiness, forms, and AI-assisted strategy.",
    schemaName: "NorthBridgeAI Immigration Insights",
    schemaDescription:
      "Practical articles about AI-assisted Canadian immigration planning, documents, strategy, and application preparation.",
    heroKicker: "Immigration insights",
    heroTitle: "Short guides for a clearer Canadian immigration journey.",
    heroBody:
      "Practical articles from NorthBridgeAI on strategy, document readiness, forms, and how AI can support a more organized application workflow.",
    topics: "Topics",
    topicItems: [
      "AI immigration strategy",
      "Document readiness",
      "Application forms",
      "Case workspace",
    ],
    featured: "Featured article",
    readFeatured: "Read featured guide",
    latest: "Latest guides",
    latestTitle: "Learn before you apply",
    latestBody:
      "Each article is written to help applicants understand preparation, not to replace advice from a licensed immigration professional.",
    ready: "Ready to organize your case?",
    ctaTitle: "Move from research to a structured immigration workspace.",
    ctaBody:
      "NorthBridgeAI helps you connect profile details, strategy, documents, forms, and AI guidance so the next step is easier to see.",
    start: "Start free",
    pricing: "View pricing",
    readArticle: "Read article",
    readArticleAria: "Read",
  },
  fr: {
    seoTitle: "Blog IA immigration canadienne",
    seoDescription:
      "Articles courts et pratiques de NorthBridgeAI sur la planification de l'immigration canadienne, les documents, les formulaires et la strategie assistee par IA.",
    schemaName: "Conseils immigration NorthBridgeAI",
    schemaDescription:
      "Articles pratiques sur la planification de l'immigration canadienne assistee par IA, les documents, la strategie et la preparation des demandes.",
    heroKicker: "Conseils immigration",
    heroTitle: "Guides courts pour un parcours d'immigration canadienne plus clair.",
    heroBody:
      "Articles pratiques de NorthBridgeAI sur la strategie, la preparation documentaire, les formulaires et la facon dont l'IA peut soutenir un dossier mieux organise.",
    topics: "Sujets",
    topicItems: [
      "Strategie immigration IA",
      "Preparation documentaire",
      "Formulaires de demande",
      "Espace dossier",
    ],
    featured: "Article a la une",
    readFeatured: "Lire le guide",
    latest: "Derniers guides",
    latestTitle: "Comprendre avant de presenter une demande",
    latestBody:
      "Chaque article aide les candidats a mieux comprendre la preparation. Il ne remplace pas les conseils d'un professionnel autorise en immigration.",
    ready: "Pret a organiser votre dossier?",
    ctaTitle: "Passez de la recherche a un espace d'immigration structure.",
    ctaBody:
      "NorthBridgeAI relie votre profil, votre strategie, vos documents, vos formulaires et l'assistance IA pour rendre la prochaine etape plus claire.",
    start: "Commencer gratuitement",
    pricing: "Voir les tarifs",
    readArticle: "Lire l'article",
    readArticleAria: "Lire",
  },
};

export default function BlogPage() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const routeLanguage = location.pathname.startsWith("/fr/") ? "fr" : null;
  const language =
    routeLanguage || normalizeBlogLanguage(i18n.resolvedLanguage || i18n.language);
  const blogBasePath = language === "fr" ? "/fr/blog" : "/blog";
  const copy = blogPageCopy[language];
  const articles = useMemo(() => getBlogArticles(language), [language]);
  const featuredArticle = useMemo(
    () => getFeaturedBlogArticle(language),
    [language]
  );
  const supportingArticles = articles.filter(
    (article) => article.slug !== featuredArticle.slug
  );

  useEffect(() => {
    setSeoMetadata({
      title: copy.seoTitle,
      description: copy.seoDescription,
      path: blogBasePath,
      keywords: blogKeywords,
      type: "blog",
    });

    return setJsonLd("northbridge-blog-jsonld", {
      "@context": "https://schema.org",
      "@type": "Blog",
      inLanguage: language === "fr" ? "fr-CA" : "en-CA",
      name: copy.schemaName,
      description: copy.schemaDescription,
      url: getAbsoluteUrl(blogBasePath),
      publisher: {
        "@type": "Organization",
        name: "NorthBridgeAI",
        url: SITE_URL,
      },
      blogPost: articles.map((article) => ({
        "@type": "BlogPosting",
        headline: article.title,
        description: article.description,
        datePublished: article.publishedAt,
        inLanguage: language === "fr" ? "fr-CA" : "en-CA",
        url: getAbsoluteUrl(`${blogBasePath}/${article.slug}`),
      })),
    });
  }, [articles, blogBasePath, copy, language]);

  return (
    <MarketingShell>
      <section className="bg-[#172033] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
              {copy.heroKicker}
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
              {copy.heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-stone-300 md:text-lg">
              {copy.heroBody}
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-300">
              {copy.topics}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {copy.topicItems.map((topic) => (
                <div
                  key={topic}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-stone-100"
                >
                  {topic}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#172033] text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-6 lg:grid-cols-[0.88fr_1.12fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
              {copy.featured}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              {featuredArticle.title}
            </h2>
            <p className="mt-4 text-base leading-8 text-stone-300">
              {featuredArticle.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {featuredArticle.keywords.slice(0, 3).map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-stone-200"
                >
                  {keyword}
                </span>
              ))}
            </div>
            <Link
              to={`${blogBasePath}/${featuredArticle.slug}`}
              className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 shadow-sm shadow-amber-900/10 transition hover:bg-amber-300"
            >
              {copy.readFeatured}
            </Link>
          </div>

          <div className="grid gap-3">
            {featuredArticle.summaryBullets.map((item) => (
              <div
                key={item}
                className="rounded-lg border border-white/10 bg-white/[0.06] p-5"
              >
                <p className="text-sm font-medium leading-6 text-stone-100">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-stone-100">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                {copy.latest}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {copy.latestTitle}
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-slate-600">
              {copy.latestBody}
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {supportingArticles.map((article) => (
              <ArticleCard
                key={article.slug}
                article={article}
                basePath={blogBasePath}
                copy={copy}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#172033] text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:grid-cols-[1fr_auto] md:items-center md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
              {copy.ready}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              {copy.ctaTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-300">
              {copy.ctaBody}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/auth"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-300"
            >
              {copy.start}
            </Link>
            <Link
              to="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/60 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-white hover:text-slate-950"
            >
              {copy.pricing}
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function ArticleCard({ article, basePath, copy }) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-stone-300 bg-stone-50 p-5 shadow-[0_14px_42px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_18px_54px_rgba(15,23,42,0.12)]">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
        <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-800">
          {article.category}
        </span>
        <span>{article.readTime}</span>
      </div>
      <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">
        <Link to={`${basePath}/${article.slug}`} className="hover:text-slate-700">
          {article.title}
        </Link>
      </h3>
      <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
        {article.description}
      </p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-stone-200 pt-4 text-sm">
        <span className="text-slate-500">{article.displayDate}</span>
        <Link
          to={`${basePath}/${article.slug}`}
          className="font-semibold text-slate-950 hover:text-amber-700"
          aria-label={`${copy.readArticleAria} ${article.title}`}
        >
          {copy.readArticle}
        </Link>
      </div>
    </article>
  );
}
