import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import MarketingShell from "../components/MarketingShell";
import { blogArticles, getBlogArticle } from "../data/blogArticles";
import { getAbsoluteUrl, setJsonLd, setSeoMetadata, SITE_URL } from "../utils/seo";

export default function BlogPostPage() {
  const { slug } = useParams();
  const article = getBlogArticle(slug);

  const relatedArticles = useMemo(() => {
    if (!article) return [];
    return blogArticles
      .filter((item) => item.slug !== article.slug)
      .slice(0, 2);
  }, [article]);

  useEffect(() => {
    if (!article) {
      setSeoMetadata({
        title: "Article Not Found",
        description:
          "Browse NorthBridgeAI articles about Canadian immigration planning, strategy, documents, forms, and AI support.",
        path: "/blog",
        keywords: ["NorthBridgeAI blog", "Canadian immigration planning"],
      });
      return undefined;
    }

    setSeoMetadata({
      title: article.title,
      description: article.description,
      path: `/blog/${article.slug}`,
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
      mainEntityOfPage: getAbsoluteUrl(`/blog/${article.slug}`),
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
    });
  }, [article]);

  if (!article) {
    return (
      <MarketingShell>
        <section className="mx-auto max-w-3xl px-4 py-20 text-center md:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            Blog
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
            Article not found
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600">
            The guide you are looking for may have moved. Browse the latest
            NorthBridgeAI immigration articles instead.
          </p>
          <Link
            to="/blog"
            className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            Back to blog
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
              to="/blog"
              className="inline-flex rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-stone-200 transition hover:bg-white/10 hover:text-white"
            >
              Back to insights
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
                Important note
              </p>
              <p className="mt-2 text-sm leading-7 text-amber-950">
                This article is informational only and is not legal advice.
                Applicants should verify requirements with official sources and
                speak with a licensed immigration professional when needed.
              </p>
            </div>
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
                  Start free
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-5 text-sm font-medium text-slate-800 transition hover:bg-stone-50"
                >
                  See plans
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                Article keywords
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
                Related guides
              </p>
              <div className="mt-4 space-y-3">
                {relatedArticles.map((item) => (
                  <Link
                    key={item.slug}
                    to={`/blog/${item.slug}`}
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
