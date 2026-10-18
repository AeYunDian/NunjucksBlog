// 繁中目录下的文章页：正文沿用简体原文，界面外壳用繁体。
// 这样从 /zh-hk/posts/ 点进文章不会掉回简中导航。
module.exports = {
  layout: "layouts/post.njk",
  i18nPage: true,
  pagination: {
    data: "collections.posts",
    size: 1,
    alias: "post",
  },
  eleventyComputed: {
    title: (data) => data.post.data.title,
    description: (data) => data.post.data.description,
    date: (data) => data.post.data.date,
    tags: (data) => data.post.data.tags,
    cover: (data) => data.post.data.cover,
    authors: (data) => data.post.data.authors,
  },
};
