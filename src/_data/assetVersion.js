/* 每次构建生成一个新的版本号，用于给 CSS / JS 加 cache-busting 查询串 */
module.exports = Date.now().toString(36);
