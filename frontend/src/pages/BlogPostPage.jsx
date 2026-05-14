import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router-dom";
import MarketingShell from "../components/MarketingShell";
import {
  getBlogArticle,
  getBlogArticles,
  normalizeBlogLanguage,
} from "../data/blogArticles";
import { getAbsoluteUrl, setJsonLd, setSeoMetadata, SITE_URL } from "../utils/seo";

const postPageCopy = {
  en: {
    notFoundTitle: "Article Not Found",
    notFoundDescription:
      "Browse NorthBridgeAI articles about Canadian immigration planning, strategy, documents, forms, and AI support.",
    notFoundHeading: "Article not found",
    notFoundBody:
      "The guide you are looking for may have moved. Browse the latest NorthBridgeAI immigration articles instead.",
    backToBlog: "Back to blog",
    backToInsights: "Back to insights",
    importantNote: "Important note",
    importantNoteBody:
      "This article is informational only and is not legal advice. Applicants should verify requirements with official sources and speak with a licensed immigration professional when needed.",
    officialSources: "Official sources",
    startFree: "Start free",
    seePlans: "See plans",
    articleKeywords: "Article keywords",
    relatedGuides: "Related guides",
  },
  fr: {
    notFoundTitle: "Article introuvable",
    notFoundDescription:
      "Parcourez les articles NorthBridgeAI sur la planification de l'immigration canadienne, la strategie, les documents, les formulaires et l'assistance IA.",
    notFoundHeading: "Article introuvable",
    notFoundBody:
      "Le guide que vous cherchez a peut-etre ete deplace. Consultez plutot les derniers articles d'immigration de NorthBridgeAI.",
    backToBlog: "Retour au blog",
    backToInsights: "Retour aux articles",
    importantNote: "Note importante",
    importantNoteBody:
      "Cet article est fourni a titre informatif seulement et ne constitue pas un avis juridique. Les candidats devraient verifier les exigences aupres des sources officielles et consulter un professionnel autorise en immigration au besoin.",
    officialSources: "Sources officielles",
    startFree: "Commencer gratuitement",
    seePlans: "Voir les forfaits",
    articleKeywords: "Mots-cles de l'article",
    relatedGuides: "Guides connexes",
  },
};

export default function BlogPostPage() {
  const { slug } = useParams();
  const location = useLocation();
  const { i18n } = useTranslation();
  const routeLanguage = location.pathname.startsWith("/fr/") ? "fr" : null;
  const language =
    routeLanguage || normalizeBlogLanguage(i18n.resolvedLanguage || i18n.language);
  const blogBasePath = language === "fr" ? "/fr/blog" : "/blog";
  const copy = postPageCopy[language];
  const article = useMemo(() => getBlogArticle(slug, language), [slug, language]);
  const articles = useMemo(() => getBlogArticles(language), [language]);

  const relatedArticles = useMemo(() => {
    if (!article) return [];
    return articles
      .filter((item) => item.slug !== article.slug)
      .slice(0, 2);
  }, [article, articles]);

  useEffect(() => {
    if (!article) {
      setSeoMetadata({
        title: copy.notFoundTitle,
        description: copy.notFoundDescription,
        path: blogBasePath,
        keywords: ["NorthBridgeAI blog", "Canadian immigration planning"],
      });
      return undefined;
    }

    setSeoMetadata({
      title: article.title,
      description: article.description,
      path: `${blogBasePath}/${article.slug}`,
      keywords: article.keywords,
      type: "article",
    });

    return setJsonLd("northbridge-article-jsonld", {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: article.title,
      description: article.description,
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      inLanguage: language === "fr" ? "fr-CA" : "en-CA",
      mainEntityOfPage: getAbsoluteUrl(`${blogBasePath}/${article.slug}`),
      keywords: article.keywords.join(", "),
      author: {
        "@type": "Organization",
        name: "NorthBridgeAI",
        url: SITE_URL,
      },
      publisher: {
        "@type": "Organization",
        name: "NorthBridgeAI",
        url: SITE_URL,
      },
      citation: Array.isArray(article.sourceLinks)
        ? article.sourceLinks.map((source) => source.url)
        : undefined,
    });
  }, [article, blogBasePath, copy, language]);

  if (!article) {
    return (
      <MarketingShell>
        <section className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            Blog
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            {copy.notFoundHeading}
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            {copy.notFoundBody}
          </p>
          <Link
            to={blogBasePath}
            className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            {copy.backToBlog}
          </Link>
        </section>
      </MarketingShell>
    );
  }

  return (
    <MarketingShell>
      <article>
        <header className="bg-[#121417] text-white">
          <div className="mx-auto max-w-4xl px-4 py-14 md:px-6 md:py-20">
            <Link
              to={blogBasePath}
              className="inline-flex rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-stone-200 transition hover:bg-white/10 hover:text-white"
            >
              {copy.backToInsights}
            </Link>
            <div className="mt-8 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">
              <span>{article.category}</span>
              <span className="text-stone-500">/</span>
              <span>{article.readTime}</span>
              <span className="text-stone-500">/</span>
              <span>{article.displayDate}</span>
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight md:text-6xl">
              {article.title}
            </h1>
            <p className="mt-5 text-base leading-8 text-stone-300 md:text-lg">
              {article.description}
            </p>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:px-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(280px,0.28fr)]">
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-[0_14px_48px_rgba(15,23,42,0.06)] md:p-8">
            <div className="grid gap-3 border-b border-stone-200 pb-6 md:grid-cols-3">
              {article.summaryBullets.map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-stone-200 bg-stone-50 p-4"
                >
                  <p className="text-sm font-medium leading-6 text-slate-800">
                    {item}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-9">
              {article.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                    {section.heading}
                  </h2>
                  <div className="mt-4 space-y-4">
                    {section.paragraphs.map((paragraph) => (
                      <p
                        key={paragraph}
                        className="text-base leading-8 text-slate-600"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-10 rounded-lg border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-800">
                {copy.importantNote}
              </p>
              <p className="mt-2 text-sm leading-7 text-amber-950">
                {copy.importantNoteBody}
              </p>
            </div>

            {Array.isArray(article.sourceLinks) &&
            article.sourceLinks.length > 0 ? (
              <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                  {copy.officialSources}
                </p>
                <div className="mt-3 grid gap-2">
                  {article.sourceLinks.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-800 transition hover:border-amber-200 hover:bg-amber-50"
                    >
                      {source.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-5">
            <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-[0_14px_42px_rgba(15,23,42,0.05)]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                NorthBridgeAI
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                {article.ctaTitle}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {article.ctaBody}
              </p>
              <div className="mt-5 grid gap-3">
                <Link
                  to="/auth"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                >
                  {copy.startFree}
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-5 text-sm font-medium text-slate-800 transition hover:bg-stone-50"
                >
                  {copy.seePlans}
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                {copy.articleKeywords}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {article.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-slate-600"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {copy.relatedGuides}
              </p>
              <div className="mt-4 space-y-3">
                {relatedArticles.map((item) => (
                  <Link
                    key={item.slug}
                    to={`${blogBasePath}/${item.slug}`}
                    className="block rounded-lg border border-stone-200 bg-stone-50 p-4 transition hover:border-amber-200 hover:bg-amber-50"
                  >
                    <p className="text-sm font-semibold leading-6 text-slate-950">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.readTime}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </article>
    </MarketingShell>
  );
}
