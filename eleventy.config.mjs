// eleventy.config.mjs
import sitemap from "@quasibit/eleventy-plugin-sitemap";
import navigation from "@11ty/eleventy-navigation";
import rssPlugin from "@11ty/eleventy-plugin-rss";
import pinyin from "node-pinyin";
import htmlmin from "html-minifier-terser";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const siteData = require("./src/_data/site.json");

let tagSlugMap = {};

function baseSlug(tag) {
  const result = pinyin(String(tag).trim(), { style: "toneWithNumber" });
  const slug = result
    .map((item) => item[0])
    .filter(Boolean)
    .join("-")
    .toLowerCase();
  return slug || "tag"; // 兜底，避免空字符串
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(navigation);
  eleventyConfig.addPlugin(rssPlugin);
  eleventyConfig.addPlugin(sitemap, {
    sitemap: {
      hostname: siteData.url,
    },
  });
  eleventyConfig.addFilter("dateFormat", (date) => {
    const d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi
      .getFilteredByGlob("src/posts/**/*.md")
      .sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
  });
  eleventyConfig.addFilter("dateToISO", (date) => {
    return new Date(date).toISOString();
  });
  eleventyConfig.addCollection("tagList", function (collectionApi) {
    const tags = new Set();
    collectionApi.getFilteredByGlob("src/posts/**/*.md").forEach((item) => {
      (item.data.tags || []).forEach((t) => tags.add(t));
    });
    return [...tags];
  });
  eleventyConfig.addCollection("tagSlugInit", function (collectionApi) {
    const tags = new Set();
    collectionApi.getFilteredByGlob("src/posts/**/*.md").forEach((item) => {
      (item.data.tags || []).forEach((t) => tags.add(t));
    });

    const slugToTags = {};
    for (const tag of tags) {
      const base = baseSlug(tag);
      if (!slugToTags[base]) slugToTags[base] = [];
      slugToTags[base].push(tag);
    }

    const map = {};
    for (const [base, tagList] of Object.entries(slugToTags)) {
      if (tagList.length === 1) {
        map[tagList[0]] = base;
      } else {
        // 冲突：按原标签排序后加 -1、-2
        tagList.sort();
        tagList.forEach((tag, i) => {
          map[tag] = `${base}-${i + 1}`;
        });
      }
    }

    tagSlugMap = map;
    return map;
  });
  eleventyConfig.addFilter("filterByTag", (posts, tag) => {
    return posts.filter((post) => (post.data.tags || []).includes(tag));
  });
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addFilter("groupPostsByYear", (posts) => {
    const groups = {};
    for (const post of posts) {
      const d = new Date(post.data.date);
      const year = String(d.getFullYear());
      if (!groups[year]) groups[year] = [];
      groups[year].push(post);
    }
    const sorted = {};
    Object.keys(groups)
      .sort((a, b) => Number(b) - Number(a))
      .forEach((y) => {
        sorted[y] = groups[y];
      });
    return sorted;
  });
  eleventyConfig.addFilter("tagSlug", (tag) => {
    if (tagSlugMap[tag]) return tagSlugMap[tag];
    return baseSlug(tag);
  });
  eleventyConfig.addFilter("addOne", (n) => Number(n) + 1);
  //   eleventyConfig.addGlobalData("eleventyComputed", {
  //     permalink: (data) => {
  //       // 只处理 tags/tag.njk
  //       if (data.pagination && data.pagination.alias === "tag") {
  //         if (!data.tag) return false;
  //         const slug = tagSlugMap[data.tag] || baseSlug(data.tag);
  //         return `/tags/${slug}/`;
  //       }
  //       // 其他页面不要覆盖 permalink，什么都不返回
  //       // 不要写 return data.permalink
  //     },
  //   });
  eleventyConfig.addFilter("tagCounts", (posts) => {
    const counts = {};
    for (const post of posts) {
      const tags = post.data.tags || [];
      for (const t of tags) {
        counts[t] = (counts[t] || 0) + 1;
      }
    }
    return counts;
  });
  eleventyConfig.addShortcode("card", function (title, desc) {
    return `<div class="card"><h3>${title}</h3><p>${desc}</p></div>`;
  });
  eleventyConfig.addPairedShortcode("onlyJS", function (content, tag = "div") {
    return `<${tag} class="only-js">${content}</${tag}>`;
  });
  eleventyConfig.addTransform("htmlmin", function (content, outputPath) {
    if (
      outputPath &&
      outputPath.endsWith(".html") &&
      process.env.ELEVENTY_ENV === "production"
    ) {
      return htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
      });
    }
    return content;
  });

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
