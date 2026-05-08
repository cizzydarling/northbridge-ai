export const SITE_URL = "https://www.northbridgeia.com";
const SITE_NAME = "NorthBridgeAI";

function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).href;
}

function upsertMeta(attribute, key, content) {
  if (!content || typeof document === "undefined") return;

  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertCanonical(href) {
  if (typeof document === "undefined") return;

  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

export function setSeoMetadata({
  title,
  description,
  path = "/",
  keywords = [],
  type = "website",
}) {
  if (typeof document === "undefined") return;

  const pageTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const url = absoluteUrl(path);

  document.title = pageTitle;
  upsertCanonical(url);
  upsertMeta("name", "description", description);
  upsertMeta("name", "keywords", keywords.join(", "));
  upsertMeta("property", "og:title", pageTitle);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:type", type);
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:site_name", SITE_NAME);
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", pageTitle);
  upsertMeta("name", "twitter:description", description);
}

export function setJsonLd(id, data) {
  if (typeof document === "undefined") return () => {};

  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);

  return () => {
    element?.remove();
  };
}

export function getAbsoluteUrl(path) {
  return absoluteUrl(path);
}
