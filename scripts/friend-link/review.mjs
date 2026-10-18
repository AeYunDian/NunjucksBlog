// 友链自动审核：解析 Issue → 校验 → 写入 src/_data/links.json → 评论/关闭
// 只用 Node 20 内置能力，不依赖第三方包。
import dns from "node:dns/promises";
import net from "node:net";

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.REPO || "";
const ISSUE_NUMBER = process.env.ISSUE_NUMBER || "";
const FORCE = process.env.FORCE_APPROVE === "1";
const BRANCH = "main";
const FILE = "src/_data/links.json";
const API = "https://api.github.com";

const BLOCKLIST = [
  "赌博",
  "博彩",
  "色情",
  "成人",
  "代孕",
  "彩票",
  "私服",
  "外挂",
  "菠菜",
];

if (!TOKEN || !REPO || !ISSUE_NUMBER) {
  console.error("缺少 GITHUB_TOKEN / REPO / ISSUE_NUMBER");
  process.exit(1);
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "undz-friend-link-bot",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function clean(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sections(body) {
  const out = {};
  const parts = String(body || "")
    .split(/^###\s+/m)
    .slice(1);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    if (nl < 0) continue;
    out[part.slice(0, nl).trim()] = part.slice(nl + 1).trim();
  }
  return out;
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v = ip.toLowerCase();
  return (
    v === "::1" ||
    v.startsWith("fc") ||
    v.startsWith("fd") ||
    v.startsWith("fe80")
  );
}

async function assertPublicHost(hostname) {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("不接受本地/内网地址");
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("不接受内网 IP");
    return;
  }
  const records = await dns.lookup(host, { all: true });
  if (!records.length) throw new Error("域名无法解析");
  for (const r of records) {
    if (isPrivateIp(r.address)) throw new Error("域名解析到内网地址");
  }
}

async function readCapped(res, max) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      reader.cancel();
      throw new Error("页面体积超过限制");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function fetchHtml(rawUrl) {
  let current = rawUrl;
  for (let i = 0; i < 4; i += 1) {
    const parsed = new URL(current);
    await assertPublicHost(parsed.hostname);

    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; aeyundian-undz.cn-friend-link/1.0)",
      },
    });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) throw new Error("重定向缺少目标地址");
      current = new URL(location, current).toString();
      continue;
    }
    if (res.status !== 200) throw new Error(`站点返回 ${res.status}`);
    const type = res.headers.get("content-type") || "html";
    if (!type.includes("html")) throw new Error("目标不是 HTML 页面");
    const html = await readCapped(res, 512 * 1024);
    return { html, finalUrl: current };
  }
  throw new Error("重定向次数过多");
}

async function ensureLabel(name, color) {
  const res = await api(`/repos/${REPO}/labels/${encodeURIComponent(name)}`);
  if (res.status === 200) return;
  await api(`/repos/${REPO}/labels`, {
    method: "POST",
    body: { name, color },
  });
}

async function comment(number, body) {
  await api(`/repos/${REPO}/issues/${number}/comments`, {
    method: "POST",
    body: { body },
  });
}

async function addLabels(number, labels) {
  await api(`/repos/${REPO}/issues/${number}/labels`, {
    method: "POST",
    body: { labels },
  });
}

async function readLinks() {
  const res = await api(`/repos/${REPO}/contents/${FILE}?ref=${BRANCH}`);
  if (res.status !== 200) throw new Error("读取 links.json 失败");
  const json = Buffer.from(
    res.data.content,
    res.data.encoding || "base64",
  ).toString("utf8");
  return { links: JSON.parse(json), sha: res.data.sha };
}

async function writeLinks(links, sha, message) {
  const content = Buffer.from(`${JSON.stringify(links, null, 4)}\n`).toString(
    "base64",
  );
  return api(`/repos/${REPO}/contents/${FILE}`, {
    method: "PUT",
    body: { message, content, sha, branch: BRANCH },
  });
}

async function main() {
  const issueRes = await api(`/repos/${REPO}/issues/${ISSUE_NUMBER}`);
  if (issueRes.status !== 200) throw new Error("读取 Issue 失败");
  const issue = issueRes.data;
  const number = issue.number;

  if (issue.state === "closed" && !FORCE) return;

  const fields = sections(issue.body);
  const name = clean(fields["网站名称"]).slice(0, 40);
  const description = clean(fields["描述"] || fields["一句话介绍"]).slice(
    0,
    80,
  );
  const avatar = clean(fields["头像地址（可选）"]);
  const category = clean(fields["分类"]);
  const backlink = clean(
    fields["友链页面地址（可选）"] || fields["友链页面地址"],
  );
  let url = clean(fields["网站地址"]);
  const confirm = String(fields["确认"] || "")
    .toLowerCase()
    .includes("[x]");

  const errors = [];

  if (!name) errors.push("网站名称为空");
  if (!description) errors.push("描述为空");
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;

  let parsed = null;
  try {
    parsed = new URL(url);
  } catch {
    errors.push("网站地址不是合法 URL");
  }

  if (parsed) {
    if (parsed.protocol !== "https:") errors.push("只接受 HTTPS 地址");
    if (parsed.username || parsed.password) errors.push("地址不能包含账号密码");
    if (parsed.port && parsed.port !== "443") errors.push("只接受 443 端口");
  }

  if (!avatar && fields["头像地址（可选）"]) errors.push("头像地址格式不正确");
  if (avatar && !/^https:\/\//i.test(avatar))
    errors.push("头像必须是 HTTPS 地址");
  if (avatar && avatar.length > 500) errors.push("头像地址过长");
  if (!confirm) errors.push("需要勾选合规确认");
  if (!category) errors.push("缺少分类");

  const text = `${name} ${description}`.toLowerCase();
  if (BLOCKLIST.some((word) => text.includes(word.toLowerCase()))) {
    errors.push("内容命中关键词黑名单");
  }

  const accountAgeDays =
    (Date.now() - new Date(issue.user.created_at).getTime()) / 86400000;
  if (!FORCE && accountAgeDays < 30)
    errors.push("GitHub 账号注册不足 30 天，需人工审核");

  const open = await api(`/repos/${REPO}/issues?state=open&per_page=100`);
  if (Array.isArray(open.data)) {
    const pending = open.data.filter(
      (i) =>
        i.number !== number &&
        i.user &&
        i.user.login === issue.user.login &&
        (i.labels || []).some((l) => l.name === "friend-link"),
    );
    if (pending.length && !FORCE) errors.push("你已有一个待处理的友链申请");
  }

  let finalUrl = url;
  if (!FORCE && !errors.length) {
    try {
      const page = await fetchHtml(url);
      finalUrl = page.finalUrl;
      if (backlink && !/^https:\/\//i.test(backlink))
        errors.push("友链页面地址必须是 HTTPS");
    } catch (e) {
      errors.push(`站点检查失败：${e.message}`);
    }
  }

  if (!errors.length) {
    const { links, sha } = await readLinks();
    const host = new URL(finalUrl).hostname.replace(/^www\./, "");

    const exists = links.some(
      (item) => new URL(item.url).hostname.replace(/^www\./, "") === host,
    );
    if (exists) errors.push(`该站点已在友链里：${host}`);
  }

  if (errors.length) {
    await comment(
      number,
      [
        "自动审核没有通过，原因如下：",
        "",
        ...errors.map((e) => `- ${e}`),
        "",
        "请修改 Issue 内容后会自动重试；如果认为是误判，等待维护者人工处理即可。",
      ].join("\n"),
    );
    await ensureLabel("friend-link:needs-review", "fbca04");
    await addLabels(number, ["friend-link:needs-review"]);
    return;
  }

  // 写入数据
  let saved = false;
  for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
    const { links, sha } = await readLinks();
    const host = new URL(finalUrl).hostname.replace(/^www\./, "");
    if (
      links.some(
        (item) => new URL(item.url).hostname.replace(/^www\./, "") === host,
      )
    ) {
      await comment(number, `站点 ${host} 已在友链里，无需重复添加。`);
      await api(`/repos/${REPO}/issues/${number}`, {
        method: "PATCH",
        body: { state: "closed", state_reason: "completed" },
      });
      return;
    }

    links.push({
      name,
      url: finalUrl,
      description,
      avatar,
      host,
      category,
      added: new Date().toISOString().slice(0, 10),
    });

    const res = await writeLinks(links, sha, `chore(friend-link): add ${name}`);
    if (res.status === 200 || res.status === 201) {
      saved = true;
    } else if (res.status !== 409 && res.status !== 422) {
      throw new Error(`写入 links.json 失败：${res.status}`);
    }
  }

  if (!saved) throw new Error("写入 links.json 冲突，请重试");

  await ensureLabel("friend-link:approved", "0e8a16");
  await addLabels(number, ["friend-link:approved"]);
  await comment(
    number,
    [
      "已通过自动审核，友链已添加 ✅",
      "",
      `- 站点：${name}`,
      `- 地址：${finalUrl}`,
      "",
      "构建完成后会自动上线，感谢交换友链。",
    ].join("\n"),
  );
  await api(`/repos/${REPO}/issues/${number}`, {
    method: "PATCH",
    body: { state: "closed", state_reason: "completed" },
  });
}

main().catch(async (error) => {
  console.error(error);
  try {
    await comment(
      ISSUE_NUMBER,
      `自动处理失败：${error.message}\n\n请您至 https://console.undz.cn/console-panel/feedback-center 提交反馈工单。`,
    );
    await ensureLabel("friend-link:needs-review", "fbca04");
    await addLabels(ISSUE_NUMBER, ["friend-link:needs-review"]);
  } catch (e) {
    console.error(e);
  }
  process.exit(1);
});
