---
title: Node包管理器备忘录
date: 2026-09-25
tags: ["npm", "yarn", "pnpm", "包管理", "备忘录"]
---

日常高频命令 + 国内换源方案。命令对照无差异时只写 npm。

## 一、换源

### 1.1 一键切换：nrm

```bash
npm install -g nrm

nrm ls                            # 列出所有源
nrm use taobao                    # 切到淘宝源
nrm use npm                       # 切回官方
nrm current                       # 查看当前
nrm test                          # 测速
nrm add company http://npm.company.com/    # 加私有源
nrm del company
```

### 1.2 手动切换

```bash
# npm
npm config set registry https://registry.npmmirror.com
npm config get registry
npm config delete registry        # 恢复默认

# yarn v1
yarn config set registry https://registry.npmmirror.com
yarn config get registry
yarn config delete registry

# pnpm
pnpm config set registry https://registry.npmmirror.com
pnpm config get registry
```

### 1.3 常用镜像源

| 源                       | URL                                               |
| ------------------------ | ------------------------------------------------- |
| 官方                     | `https://registry.npmjs.org`                      |
| 淘宝 / npmmirror（推荐） | `https://registry.npmmirror.com`                  |
| 腾讯云                   | `https://mirrors.cloud.tencent.com/npm/`          |
| 华为云                   | `https://mirrors.huaweicloud.com/repository/npm/` |
| cnpmjs                   | `https://registry.cnpmjs.org`                     |

> 淘宝源域名 `registry.npm.taobao.org` 已废弃，新域名为 `registry.npmmirror.com`。

### 1.4 一次性使用（不改配置）

```bash
npm install --registry=https://registry.npmmirror.com
yarn add <pkg> --registry=https://registry.npmmirror.com
pnpm add <pkg> --registry=https://registry.npmmirror.com
```

### 1.5 项目级 .npmrc

**只在当前项目生效**，适合团队统一配置。放项目根目录：

```ini
# .npmrc
registry=https://registry.npmmirror.com
strict-ssl=true
save-exact=true
engine-strict=true
```

**提交到 Git**，让所有成员和 CI 用同一套源。

### 1.6 私有源 + 公共源混用（scoped registry）

公司包放私有源，公共包走镜像：

```ini
# .npmrc
registry=https://registry.npmmirror.com
@company:registry=https://npm.company.com/
//npm.company.com/:_authToken=${NPM_TOKEN}
//registry.npmmirror.com/:always-auth=false
```

`@company` 开头的包（如 `@company/ui`）走私有源，其余走淘宝源。

### 1.7 认证 Token 配置

```ini
# ~/.npmrc
//registry.npmjs.org/:_authToken=npm_xxxxxxxxxxxx
//npm.pkg.github.com/:_authToken=ghp_xxxxxxxxxxxx
```

或用环境变量（推荐 CI 使用）：

```bash
export NPM_TOKEN=xxxxx
# .npmrc 里写
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

### 1.8 换源失败的排查

```bash
# 1. 确认当前源
npm config get registry

# 2. 直接 curl 试
curl -I https://registry.npmmirror.com/vue

# 3. 清除 npm 缓存
npm cache clean --force

# 4. 检查是否有多个 .npmrc 冲突
npm config list --show-origin
```

## 二、其他 binary 镜像（换源只改 npm 包，不改 binary）

很多包在 `postinstall` 阶段会下载**非 npm 的二进制**，换 registry 没用。这些要单独配：

### 2.1 Node 版本管理器镜像

**nvm**：

```bash
export NVM_NODEJS_ORG_MIRROR=https://npmmirror.com/mirrors/node
nvm install 20
```

写入 `~/.bashrc` 或 `~/.zshrc` 永久生效。

**fnm**：

```bash
export FNM_NODE_DIST_MIRROR=https://npmmirror.com/mirrors/node
```

### 2.2 Electron

```bash
# 项目 .npmrc
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

### 2.3 Puppeteer / Playwright

```bash
# .npmrc 或环境变量
puppeteer_download_host=https://npmmirror.com/mirrors
PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright
```

### 2.4 node-sass / sass-embedded

```bash
# .npmrc
sass_binary_site=https://npmmirror.com/mirrors/node-sass
```

现在多用 `sass`（dart-sass 纯 JS 实现），无需 binary。

### 2.5 sharp / canvas

```bash
# .npmrc
sharp_binary_host=https://npmmirror.com/mirrors/sharp
sharp_libvips_binary_host=https://npmmirror.com/mirrors/sharp-libvips
canvas_binary_host_mirror=https://npmmirror.com/mirrors/node-canvas-prebuilt/
```

### 2.6 Cypress

```bash
export CYPRESS_DOWNLOAD_MIRROR=https://npmmirror.com/mirrors/cypress
```

### 2.7 全家桶模板

```ini
# ~/.npmrc 一份全搞定
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
puppeteer_download_host=https://npmmirror.com/mirrors
PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright
sass_binary_site=https://npmmirror.com/mirrors/node-sass
sharp_binary_host=https://npmmirror.com/mirrors/sharp
sharp_libvips_binary_host=https://npmmirror.com/mirrors/sharp-libvips
canvas_binary_host_mirror=https://npmmirror.com/mirrors/node-canvas-prebuilt/
CYPRESS_DOWNLOAD_MIRROR=https://npmmirror.com/mirrors/cypress
```

## 三、命令对照速查

| 操作               | npm                       | yarn (v1)                  | pnpm                   |
| ------------------ | ------------------------- | -------------------------- | ---------------------- |
| 安装全部           | `npm install`             | `yarn`                     | `pnpm install`         |
| 安装生产依赖       | `npm i <pkg>`             | `yarn add <pkg>`           | `pnpm add <pkg>`       |
| 安装开发依赖       | `npm i -D <pkg>`          | `yarn add -D <pkg>`        | `pnpm add -D <pkg>`    |
| 安装全局           | `npm i -g <pkg>`          | `yarn global add <pkg>`    | `pnpm add -g <pkg>`    |
| 安装指定版本       | `npm i <pkg>@1.2.3`       | 同                         | 同                     |
| 卸载               | `npm uninstall <pkg>`     | `yarn remove <pkg>`        | `pnpm remove <pkg>`    |
| 卸载全局           | `npm uninstall -g <pkg>`  | `yarn global remove <pkg>` | `pnpm remove -g <pkg>` |
| 更新全部           | `npm update`              | `yarn upgrade`             | `pnpm update`          |
| 运行脚本           | `npm run <s>`             | `yarn <s>`                 | `pnpm <s>`             |
| 执行本地二进制     | `npx <bin>`               | `yarn <bin>`               | `pnpm exec <bin>`      |
| 执行远程包         | `npx <pkg>`               | —                          | `pnpm dlx <pkg>`       |
| 查看顶层依赖       | `npm ls --depth=0`        | `yarn list --depth=0`      | `pnpm list --depth=0`  |
| 查过时依赖         | `npm outdated`            | `yarn outdated`            | `pnpm outdated`        |
| 清缓存             | `npm cache clean --force` | `yarn cache clean`         | `pnpm store prune`     |
| 查看为什么装了某包 | `npm why <pkg>`           | `yarn why <pkg>`           | `pnpm why <pkg>`       |

## 四、锁文件

| 包管理器 | 锁文件              | 提交 Git |
| -------- | ------------------- | -------- |
| npm      | `package-lock.json` | ✅       |
| yarn v1  | `yarn.lock`         | ✅       |
| pnpm     | `pnpm-lock.yaml`    | ✅       |

**同一仓库只保留一种锁文件**。混用会导致依赖树不一致。

### 清理重装

```bash
# npm
rm -rf node_modules package-lock.json && npm install

# yarn
rm -rf node_modules yarn.lock && yarn install

# pnpm
rm -rf node_modules pnpm-lock.yaml && pnpm install
```

### CI 严格安装

```bash
npm ci                            # 严格按 lock 装，不更新
pnpm install --frozen-lockfile
yarn install --frozen-lockfile
```

`npm ci` 要求 `package-lock.json` 与 `package.json` 完全一致，否则直接报错退出。

## 五、依赖版本语义

| 写法           | 允许升级范围                           |
| -------------- | -------------------------------------- |
| `1.2.3`        | 精确，不升级                           |
| `~1.2.3`       | `>=1.2.3 <1.3.0`                       |
| `^1.2.3`       | `>=1.2.3 <2.0.0`                       |
| `^0.2.3`       | `>=0.2.3 <0.3.0`（0.x 例外，锁次版本） |
| `*` / `latest` | 不限（不推荐）                         |

## 六、脚本（scripts）

### 钩子

| 钩子             | 触发时机                                    |
| ---------------- | ------------------------------------------- |
| `preinstall`     | install 之前                                |
| `postinstall`    | install 之后                                |
| `prepare`        | install 和 publish 之前都触发（husky 常用） |
| `prepublishOnly` | 仅 `npm publish` 之前                       |
| `pre<script>`    | `npm run <script>` 之前                     |
| `post<script>`   | 执行之后                                    |

### 传参与环境变量

```bash
npm run build -- --mode production
yarn build --mode production
pnpm build --mode production

# 跨平台环境变量
npm i -D cross-env
"build": "cross-env NODE_ENV=production vite build"
```

## 七、依赖管理

### overrides / resolutions（强制覆盖版本）

**npm (>= 8.3)**：

```json
{
  "overrides": {
    "lodash": "4.17.21",
    "some-pkg": { "lodash": "4.17.21" }
  }
}
```

**yarn v1**：

```json
{
  "resolutions": {
    "lodash": "4.17.21",
    "**/lodash": "4.17.21"
  }
}
```

**pnpm**：

```json
{
  "pnpm": {
    "overrides": {
      "lodash": "4.17.21"
    }
  }
}
```

### 依赖分析

```bash
npm ls <pkg>                      # 谁依赖了它
npm why <pkg>                     # 同上（npm 8+）
pnpm why <pkg>
yarn why <pkg>
```

## 八、npm 专属

```bash
npm view <pkg>                    # 包信息
npm view <pkg> versions           # 所有版本
npm view <pkg> dist-tags          # 标签
npm info <pkg> repository.url     # 仓库地址

npm login
npm publish                       # 发布
npm publish --access public       # scoped 包首次发布
npm publish --tag beta            # 打标签
npm unpublish <pkg>@1.0.0         # 撤销（24h 内）
```

## 九、yarn v1 专属

### workspaces

```json
{
  "private": true,
  "workspaces": ["packages/*"]
}
```

```bash
yarn workspace <pkg> add <dep>
yarn workspaces info
```

### 常用

```bash
yarn licenses list                # 许可证
yarn audit                        # 安全审计
yarn autoclean --init
```

> yarn v1 已停止新功能开发，长期建议迁移到 pnpm 或 yarn berry (v2+)。

## 十、pnpm 专属

### 核心优势

- **硬链接 + 内容寻址存储**：磁盘只存一份包实体，多项目共享。
- **非扁平化 node_modules**：只有直接依赖可见，杜绝幽灵依赖。
- **严格 peerDependencies**：不隐式提升未声明依赖。

### 常用

```bash
pnpm store path                   # store 位置
pnpm store prune                  # 清缓存
pnpm dedupe                       # 去重
pnpm patch <pkg>                  # 打补丁
pnpm patch-commit <path>

pnpm add -O <pkg>                 # optionalDependencies
pnpm add -P <pkg>                 # peerDependencies
```

### 工作区

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
```

```bash
pnpm -r build                     # 递归所有包
pnpm --filter web build           # 只跑 web
pnpm --filter "web..." build      # web 及其依赖
pnpm --filter "...web" build      # web 及其被依赖者
```

### .npmrc 常用

```ini
shamefully-hoist=true             # 兼容老包（临时用）
strict-peer-dependencies=false
auto-install-peers=true
node-linker=hoisted               # 扁平常见兼容方案
```

## 十一、常见问题

### 1. `ERR_OSSL_EVP_UNSUPPORTED`（Node 17+）

老项目 + 新 Node，OpenSSL 3 引起。

```bash
export NODE_OPTIONS=--openssl-legacy-provider
# 或降级 Node 16
```

### 2. `EACCES` 权限错误

**别用 sudo**，改 npm 全局目录：

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### 3. `peer dep` 冲突（npm 7+）

```bash
npm install --legacy-peer-deps    # 按 npm 6 行为忽略 peer 冲突
npm install --force               # 强制（危险）
```

### 4. 安装慢

先换源（见第一节）。如果还慢，看是不是在下载 binary：

```bash
npm install --verbose 2>&1 | grep -i "http"
```

看到下载 electron / puppeteer 之类的，就要配对应的 binary 镜像。

### 5. 幽灵依赖

代码用了没在 `package.json` 里声明的包（因为被提升到顶层才碰巧能用）。

**根治**：用 pnpm。**缓解**：`npm ls --depth=0` 核对，把用到的都显式声明。

### 6. CI 报 lock 不一致

用 `npm ci` / `pnpm install --frozen-lockfile` 时，`package.json` 与 lock 必须同步。本地改完 `package.json` 一定要重跑一次 `install` 让 lock 更新，再提交。

### 7. 强制项目使用某个包管理器

```json
{
  "scripts": {
    "preinstall": "npx only-allow pnpm"
  }
}
```

### 8. `npm audit fix --force` 引入 breaking change

`--force` 会跨越主版本升级。先看不 force 能修多少：

```bash
npm audit
npm audit fix
npm audit --production            # 只看生产依赖
```

## 十二、安全审计

```bash
npm audit
yarn audit
pnpm audit
```

---

## 参考

- npm 文档：https://docs.npmjs.com/
- yarn v1：https://classic.yarnpkg.com/
- pnpm：https://pnpm.io/zh/
- npmmirror：https://npmmirror.com/
