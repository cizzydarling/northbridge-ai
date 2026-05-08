import { useEffect } from "react";
import { Link } from "react-router-dom";
import MarketingShell from "../components/MarketingShell";
import { blogArticles, featuredBlogArticle } from "../data/blogArticles";
import { getAbsoluteUrl, setJsonLd, setSeoMetadata, SITE_URL } from "../utils/seo";

const blogKeywords = [
  "NorthBridgeAI blog",
  "Canadian immigration AI",
  "Canada immigration planning",
  "immigration document checklist",
  "AI immigration copilot",
];

export default function BlogPage() {
  const supportingArticles = blogArticles.filter(
    (article) => article.slug !== featuredBlogArticle.slug
  );

  useEffect(() => {
    setSeoMetadata({
      title: "Canadian Immigration AI Blog",
      description:
        "Short, practical NorthBridgeAI articles about Canadian immigration planning, document readiness, forms, and AI-assisted strategy.",
      path: "/blog",
      keywords: blogKeywords,
      type: "blog",
    });

    return setJsonLd("northbridge-blog-jsonld", {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "NorthBridgeAI Immigration Insights",
      description:
        "Practical articles about AI-assisted Canadian immigration planning, documents, strategy, and application preparation.",
      url: `${SITE_URL}/blog`,
      publisher: {
        "@type": "Organization",
        name: "NorthBridgeAI",
        url: SITE_URL,
      },
      blogPost: blogArticles.map((article) => ({
        "@type": "BlogPosting",
        headline: article.title,
        description: article.description,
        datePublished: article.publishedAt,
        url: getAbsoluteUrl(`/blog/${article.slug}`),
      })),
    });
  }, []);

  return (
    <MarketingShell>
      <section className="bg-[#172033] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
              Immigration insights
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
              Short guides for a clearer Canadian immigration journey.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-stone-300 md:text-lg">
              Practical articles from NorthBridgeAI on strategy, document
              readiness, forms, and how AI can support a more organized
              application workflow.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-300">
              Topics
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "AI immigration strategy",
                "Document readiness",
                "Application forms",
                "Case workspace",
              ].map((topic) => (
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
              Featured article
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              {featuredBlogArticle.title}
            </h2>
            <p className="mt-4 text-base leading-8 text-stone-300">
              {featuredBlogArticle.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {featuredBlogArticle.keywords.slice(0, 3).map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-stone-200"
                >
                  {keyword}
                </span>
              ))}
            </div>
            <Link
              to={`/blog/${featuredBlogArticle.slug}`}
              className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 shadow-sm shadow-amber-900/10 transition hover:bg-amber-300"
            >
              Read featured guide
            </Link>
          </div>

          <div className="grid gap-3">
            {featuredBlogArticle.summaryBullets.map((item) => (
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
                Latest guides
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                Learn before you apply
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-slate-600">
              Each article is written to help applicants understand preparation,
              not to replace advice from a licensed immigration professional.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {supportingArticles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#172033] text-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:grid-cols-[1fr_auto] md:items-center md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">
              Ready to organize your case?
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Move from research to a structured immigration workspace.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-300">
              NorthBridgeAI helps you connect profile details, strategy,
              documents, forms, and AI guidance so the next step is easier to
              see.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/auth"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-300"
            >
              Start free
            </Link>
            <Link
              to="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/60 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-white hover:text-slate-950"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function ArticleCard({ article }) {
  return (
    <article className="flex h-full flex-col rounded-lg border border-stone-300 bg-stone-50 p-5 shadow-[0_14px_42px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_18px_54px_rgba(15,23,42,0.12)]">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
        <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-800">
          {article.category}
        </span>
        <span>{article.readTime}</span>
      </div>
      <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-950">
        <Link to={`/blog/${article.slug}`} className="hover:text-slate-700">
          {article.title}
        </Link>
      </h3>
      <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
        {article.description}
      </p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-stone-200 pt-4 text-sm">
        <span className="text-slate-500">{article.displayDate}</span>
        <Link
          to={`/blog/${article.slug}`}
          className="font-semibold text-slate-950 hover:text-amber-700"
          aria-label={`Read ${article.title}`}
        >
          Read article
        </Link>
      </div>
    </article>
  );
}
