/**
 * aQuery 打包脚本
 *
 * 产出两个互相独立的文件：
 *   aquery.min.js         核心 6 模块（core/utils/deferred/dom/events/ajax）
 *   aquery.qrcode.min.js  二维码插件（按需加载，不混进主包）
 *
 * 用法：
 *   node scripts/build-aquery.mjs           # 只产出 .min.js
 *   node scripts/build-aquery.mjs --map     # 额外产出 .map
 *
 * terser 可用时走 terser（强制 ES5 输出）；不可用时退回「去注释 + 去空行」的保守压缩。
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dir = path.join(root, "src/assets/aquery");

const withMap = process.argv.includes("--map");

const BUNDLES = [
  {
    name: "aquery.min.js",
    label: "aQuery",
    versionRe: /VERSION\s*=\s*"([^"]+)"/,
    modules: ["core", "utils", "deferred", "dom", "events", "ajax"]
  },
  {
    name: "aquery.qrcode.min.js",
    label: "aQuery.qrcode",
    versionRe: /qrcode\.version\s*=\s*"([^"]+)"/,
    modules: ["qrcode"]
  }
];

function naiveMinify(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .split("\n")
    .map(function (line) {
      return line.trim();
    })
    .filter(Boolean)
    .join("\n");
}

/* terser 配置：只做「安全压缩」，不做会改变语义的激进优化 */
function terserOptions(map, filename) {
  const options = {
    /* 输出目标：IE9 能解析的 ES5 */
    ecma: 5,
    module: false,
    ie8: false,
    safari10: false,

    compress: {
      ecma: 5,
      passes: 3,
      drop_debugger: true,
      dead_code: true,
      unused: true,
      keep_fargs: true,     // 保留形参个数，避免 fn.length 变化影响调用方
      pure_getters: false,  // 不假设 getter 无副作用（我们大量读 getBoundingClientRect 等）
      unsafe: false,
      unsafe_methods: false,
      toplevel: false,
      drop_console: false
    },

    mangle: {
      /* 关键：属性名绝不能改 —— 公共 API、__aEvents、__aData 都在属性上 */
      properties: false,
      keep_fnames: false,
      toplevel: false
    },

    format: {
      ecma: 5,
      comments: false,      // banner 由脚本自己拼
      ascii_only: true,
      semicolons: true,
      quote_style: 0
    }
  };

  if (map) {
    options.sourceMap = {
      filename: filename,
      url: filename + ".map",
      includeSources: true
    };
  }

  return options;
}

async function build(bundle) {
  const parts = [];

  for (const name of bundle.modules) {
    parts.push(await readFile(path.join(dir, `aquery.${name}.js`), "utf8"));
  }

  const source = parts.join("\n");
  const versionMatch = bundle.versionRe.exec(source);
  const version = versionMatch ? versionMatch[1] : "0.0.0";

  let code = "";
  let mapJson = null;
  let engine = "terser";

  try {
    const { minify } = await import("terser");
    const result = await minify(source, terserOptions(withMap, bundle.name));

    if (!result || !result.code) throw new Error("terser 返回空结果");

    code = result.code;
    mapJson = result.map || null;

    /* 兜底检查：ES5 目标下不应该出现箭头函数 / const / let */
    if (/(^|[^=!<>])=>(?!=)/.test(code) || /\b(?:const|let)\s/.test(code)) {
      console.warn(`[${bundle.label}] 警告：产物里出现了 ES6 语法，检查 terser 配置`);
    }
  } catch (err) {
    engine = "fallback（仅去注释）";
    code = naiveMinify(source);
  }

  const banner =
    `/*! ${bundle.label} v${version} | Copyright ${new Date().getFullYear()} AeYunDian | MIT License | ` +
    `${bundle.modules.length} module${bundle.modules.length > 1 ? "s" : ""} | official */\n`;
  const output = banner + code + "\n";
  const outFile = path.join(dir, bundle.name);

  await writeFile(outFile, output, "utf8");

  if (withMap && mapJson) {
    await writeFile(outFile + ".map", mapJson, "utf8");
  }

  const raw = Buffer.byteLength(output, "utf8");
  const gz = gzipSync(output).length;
  const kb = (n) => (n / 1024).toFixed(1);

  console.log(
    `[${bundle.label}] ${bundle.name}  ${kb(raw)} KB / gzip ${kb(gz)} KB  ` +
      `(${engine}${withMap ? ", + map" : ""})`
  );
}

async function main() {
  for (const bundle of BUNDLES) {
    await build(bundle);
  }
}

main().catch(function (err) {
  console.error("[aQuery] 打包失败：", err);
  process.exit(1);
});
