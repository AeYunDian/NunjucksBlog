const locales = require("./locales.json");
const dict = {
  "zh-CN": require("./i18n/zh-CN.json"),
  "en-US": require("./i18n/en-US.json"),
  "zh-HK": require("./i18n/zh-HK.json"),
};

module.exports = {
  locale: (data) =>
    locales.find((l) => l.id === (data.localeId || "zh-CN")) || locales[0],
  ui: (data) => dict[data.localeId] || dict["zh-CN"],
};
