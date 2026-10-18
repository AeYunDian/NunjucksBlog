// eleventy.config.mjs
import fs from "node:fs";
import path from "node:path";
import sitemap from "@quasibit/eleventy-plugin-sitemap";
import navigation from "@11ty/eleventy-navigation";
import rssPlugin from "@11ty/eleventy-plugin-rss";
import pinyin from "node-pinyin";
import htmlmin from "html-minifier-terser";
import { createRequire } from "module";
import postcss from "postcss";
import postcssImport from "postcss-import";
import postcssCustomProperties from "postcss-custom-properties";
import autoprefixer from "autoprefixer";
import cssnano from "cssnano";

const require = createRequire(import.meta.url);
const siteData = require("./src/_data/site.json");
const locales = require("./src/_data/locales.json");

const isProd = process.env.ELEVENTY_ENV === "production";

/* ------------------------------------------------------------------ */
/* 标签 slug（保持拼音，避免已收录 URL 变化）                          */
/* ------------------------------------------------------------------ */
let tagSlugMap = {};
const slugCache = new Map();

function baseSlug(tag) {
  const key = String(tag).trim();
  if (slugCache.has(key)) return slugCache.get(key);

  const result = pinyin(key, { style: "toneWithNumber" });
  const slug =
    result
      .map((item) => item[0])
      .filter(Boolean)
      .join("-")
      .toLowerCase() || "tag";

  slugCache.set(key, slug);
  return slug;
}

/* ------------------------------------------------------------------ */
/* 语言工具                                                            */
/* ------------------------------------------------------------------ */
function stripLocale(url) {
  if (typeof url !== "string") return "/";
  for (const l of locales) {
    if (!l.prefix) continue;
    if (url === `/${l.prefix}` || url.startsWith(`/${l.prefix}`)) {
      return `/${url.slice(l.prefix.length + 1)}`;
    }
  }
  return url;
}

function withLocale(url, locale) {
  const base = stripLocale(url);
  return `/${locale.prefix}${base.slice(1)}`;
}

/* ------------------------------------------------------------------ */
/* CSS：src/_css → dist/assets/css/main.css                            */
/* ------------------------------------------------------------------ */
async function buildCss() {
  const from = path.resolve("src/_css/main.css");
  const to = path.resolve("dist/assets/css/main.css");
  const source = fs.readFileSync(from, "utf8");

  const plugins = [
    postcssImport(),
    postcssCustomProperties({ preserve: false }),
    autoprefixer(),
  ];
  if (isProd) plugins.push(cssnano({ preset: "default" }));

  const result = await postcss(plugins).process(source, { from, to });
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, result.css);
}

/* ------------------------------------------------------------------ */
export default function (eleventyConfig) {
  eleventyConfig.addPlugin(navigation);
  eleventyConfig.addPlugin(rssPlugin);

  eleventyConfig.addPlugin(sitemap, {
    sitemap: { hostname: siteData.url },
  });

  /* ---------- 构建钩子 ---------- */
  eleventyConfig.on("eleventy.before", buildCss);
  eleventyConfig.addWatchTarget("src/_css/");

  /* ---------- 集合 ---------- */
  eleventyConfig.addCollection("posts", (api) =>
    api
      .getFilteredByGlob("src/posts/**/*.md")
      .sort((a, b) => new Date(b.data.date) - new Date(a.data.date))
  );

  eleventyConfig.addCollection("tagList", (api) => {
    const tags = new Set();
    api.getFilteredByGlob("src/posts/**/*.md").forEach((item) => {
      (item.data.tags || []).forEach((t) => tags.add(t));
    });
    return [...tags].sort((a, b) => String(a).localeCompare(String(b), "zh"));
  });

  eleventyConfig.addCollection("tagSlugInit", (api) => {
    const tags = new Set();
    api.getFilteredByGlob("src/posts/**/*.md").forEach((item) => {
      (item.data.tags || []).forEach((t) => tags.add(t));
    });

    const byBase = {};
    for (const tag of tags) {
      const base = baseSlug(tag);
      (byBase[base] = byBase[base] || []).push(tag);
    }

    const map = {};
    for (const [base, list] of Object.entries(byBase)) {
      if (list.length === 1) {
        map[list[0]] = base;
      } else {
        list.sort();
        list.forEach((tag, i) => {
          map[tag] = `${base}-${i + 1}`;
        });
      }
    }
    tagSlugMap = map;
    return map;
  });

  /* ---------- sitemap 集合 ---------- */
  eleventyConfig.addCollection("sitemapItems", (api) => {
    const out = [];
    for (const item of api.getAll()) {
      if (!item.outputPath || !item.outputPath.endsWith(".html")) continue;
      if (item.url === "/404.html" || item.url.startsWith("/share/")) continue;

      const urls = item.data?.pagination?.hrefs || [item.url];
      for (const url of urls) {
        let links;
        if (item.data.i18nPage && siteData.i18nReady) {
          links = locales.map((l) => ({
            url: siteData.url + withLocale(url, l),
            lang: l.hreflang,
          }));
          links.push({
            url: siteData.url + withLocale(url, locales[0]),
            lang: "x-default",
          });
        }

        out.push({
          url,
          date: item.date,
          data: {
            ...item.data,
            pagination: undefined,
            sitemap: { ...(item.data.sitemap || {}), links },
          },
        });
      }
    }
    return out;
  });

  /* ---------- 过滤器 ---------- */
  eleventyConfig.addFilter("dateFormat", (date, localeId = "zh-CN") => {
    const d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(localeId, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  });

  eleventyConfig.addFilter("dateToISO", (date) => new Date(date).toISOString());

  eleventyConfig.addFilter("filterByTag", (posts, tag) =>
    posts.filter((post) => (post.data.tags || []).includes(tag))
  );

  eleventyConfig.addFilter("tagSlug", (tag) =>
    tagSlugMap[tag] || baseSlug(tag)
  );

  eleventyConfig.addFilter("addOne", (n) => Number(n) + 1);

  eleventyConfig.addFilter("tagCounts", (posts) => {
    const counts = {};
    for (const post of posts) {
      for (const t of post.data.tags || []) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }
    return counts;
  });

  eleventyConfig.addFilter("groupPostsByYear", (posts) => {
    const groups = {};
    for (const post of posts) {
      const d = new Date(post.data.date);
      const year = String(d.getFullYear());
      (groups[year] = groups[year] || []).push(post);
    }
    const sorted = {};
    Object.keys(groups)
      .sort((a, b) => Number(b) - Number(a))
      .forEach((y) => (sorted[y] = groups[y]));
    return sorted;
  });

  eleventyConfig.addFilter("readingTime", (content = "") => {
    const text = String(content).replace(/<[^>]+>/g, "");
    const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const words = (text.match(/[A-Za-z0-9]+/g) || []).length;
    return Math.max(1, Math.round(cjk / 300 + words / 200));
  });

  // i18n：模板里优先用 ui.xxx；带占位符的字符串用 "key" | t(localeId)
  eleventyConfig.addFilter("t", (key, localeId = "zh-CN") => {
    try {
      const dict = require(`./src/_data/i18n/${localeId}.json`);
      const value = key
        .split(".")
        .reduce((o, k) => (o == null ? undefined : o[k]), dict);
      return value == null ? `⟦${key}⟧` : value;
    } catch {
      return `⟦${key}⟧`;
    }
  });

  eleventyConfig.addFilter("localeUrl", (url, locale) =>
    withLocale(url, locale)
  );

  eleventyConfig.addFilter("absoluteUrl", (url) => siteData.url + url);

  eleventyConfig.addFilter("navActive", (url, itemUrl) =>
    itemUrl === "/" ? url === "/" : url.indexOf(itemUrl) === 0
  );

  /* ---------- JSON-LD ---------- */
  const cleanJson = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");
  const absUrl = (url, base) =>
    !url ? undefined : /^https?:/i.test(url) ? url : base + url;

  eleventyConfig.addNunjucksGlobal("jsonldWebsite", (opts) =>
    cleanJson({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: opts.name,
      url: opts.url,
      description: opts.description,
      inLanguage: opts.lang,
      publisher: { "@type": "Organization", name: opts.name, url: opts.url },
    })
  );

  eleventyConfig.addNunjucksGlobal("jsonldPost", (opts) => {
    const authors = (Array.isArray(opts.authors) ? opts.authors : [opts.authors])
      .filter(Boolean)
      .map((name) => ({ "@type": "Person", name }));
    const image = absUrl(opts.image, opts.siteUrl);

    return cleanJson({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: opts.title,
      description: opts.description || undefined,
      datePublished: opts.date,
      dateModified: opts.modified || opts.date,
      inLanguage: opts.lang,
      author: authors.length ? authors : undefined,
      publisher: {
        "@type": "Organization",
        name: opts.siteName,
        url: opts.siteUrl,
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": opts.url },
      url: opts.url,
      image,
      keywords:
        opts.tags && opts.tags.length ? opts.tags.join(", ") : undefined,
    });
  });

  eleventyConfig.addNunjucksGlobal("jsonldBreadcrumb", (items) =>
    cleanJson({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: (items || []).map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: item.url,
      })),
    })
  );

  eleventyConfig.addFilter("relatedPosts", (posts, tags, url, limit = 3) => {
    const set = new Set(tags || []);
    return posts
      .filter(
        (p) =>
          p.url !== url && (p.data.tags || []).some((t) => set.has(t))
      )
      .slice(0, limit);
  });

  /* ---------- 短代码 ---------- */
  eleventyConfig.addShortcode("card", function (title, desc) {
    return `<div class="card"><h3>${title}</h3><p>${desc}</p></div>`;
  });

  eleventyConfig.addPairedShortcode("onlyJS", function (content, tag = "div") {
    return `<${tag} class="only-js">${content}</${tag}>`;
  });

  /* ---------- 转换 ---------- */
  eleventyConfig.addTransform("htmlmin", function (content, outputPath) {
    if (outputPath && outputPath.endsWith(".html") && isProd) {
      return htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
      });
    }
    return content;
  });

  eleventyConfig.addTransform("xmlPretty", function (content, outputPath) {
    if (outputPath && outputPath.endsWith(".xml")) {
      return content.replace(/></g, ">\n<");
    }
    return content;
  });

  /* ---------- 复制 ---------- */
  eleventyConfig.addPassthroughCopy({ "src/assets/images": "assets/images" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/vendor": "assets/vendor" });
  eleventyConfig.addPassthroughCopy({ "src/public": "/" });

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
