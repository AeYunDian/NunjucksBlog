// 英文目录下的文章页：正文仍是中文，只把界面外壳换成英文。
// 这样从 /en-us/posts/ 点进文章，导航、页脚、语言切换都还停在英文。
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
