import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { blogArticles } from "../src/data/blogArticles.js";

const SITE_URL = "https://www.northbridgeia.com";

const staticRoutes = [
  { path: "/", priority: "1.0", changefreq: "weekly", lastmod: "2026-06-04" },
  { path: "/pricing", priority: "0.8", changefreq: "weekly", lastmod: "2026-06-04" },
  { path: "/blog", priority: "0.9", changefreq: "weekly", lastmod: "2026-06-04" },
  { path: "/fr/blog", priority: "0.8", changefreq: "weekly", lastmod: "2026-06-04" },
];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function absoluteUrl(path) {
  return `${SITE_URL}${path === "/" ? "/" : path}`;
}

function urlEntry({ path, lastmod, changefreq = "monthly", priority = "0.7" }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(absoluteUrl(path))}</loc>`,
    `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
    `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
    `    <priority>${escapeXml(priority)}</priority>`,
    "  </url>",
  ].join("\n");
}

const articleRoutes = blogArticles.flatMap((article) => {
  const lastmod = article.publishedAt || "2026-06-04";
  return [
    {
      path: `/blog/${article.slug}`,
      lastmod,
      changefreq: "monthly",
      priority: "0.7",
    },
    {
      path: `/fr/blog/${article.slug}`,
      lastmod,
      changefreq: "monthly",
      priority: "0.6",
    },
  ];
});

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...[...staticRoutes, ...articleRoutes].map(urlEntry),
  "</urlset>",
  "",
].join("\n");

await writeFile(resolve("public/sitemap.xml"), xml, "utf8");
console.log(`Generated sitemap.xml with ${staticRoutes.length + articleRoutes.length} URLs.`);
