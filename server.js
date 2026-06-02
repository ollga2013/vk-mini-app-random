const http = require("http");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const { URL } = require("url");
const { AsyncLocalStorage } = require("async_hooks");

const ROOT_DIR = __dirname;
loadEnvFile(path.join(ROOT_DIR, ".env.local"));
loadEnvFile(path.join(ROOT_DIR, ".env"));

const PORT = Number(process.env.PORT || 4173);
const API_VERSION = process.env.VK_API_VERSION || "5.199";
const USER_TOKEN = String(process.env.VK_USER_TOKEN || process.env.VK_TOKEN || "").trim();
const SERVICE_TOKEN = String(process.env.VK_SERVICE_TOKEN || "").trim();
const DEFAULT_SCAN_DEPTH = clampInt(process.env.VK_IMPORT_SCAN_DEPTH, 10, 200, 60);
const MAX_CONCURRENT = 6;
const vkTokenContext = new AsyncLocalStorage();
let tokenDiagnosticsPromise = null;

const CONTEST_KEYS = [
  "конкурс",
  "розыгрыш",
  "выиграй",
  "giveaway",
  "приз",
  "репост",
  "акция",
  "бесплатно",
  "итоги",
  "участвую",
  "подарок",
].map((item) => item.toLowerCase());

const SPAM_KEYS = [
  "ингредиенты",
  "рецепт",
  "приготовление",
  "подпишись",
  "советы",
  "лайфхак",
  "вкусно",
  "калорий",
  "рецепт:",
  "готовим",
].map((item) => item.toLowerCase());

start().catch((error) => {
  console.error(error);
  process.exit(1);
});

function loadEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) return;
  const content = fsSync.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key || process.env[key]) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function start() {
  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error(error);
      sendJson(res, 500, { error: "internal_error", message: String(error.message || error) });
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`VK winner mini app server: http://127.0.0.1:${PORT}`);
  });
}

async function handleRequest(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname.startsWith("/api/")) {
    if (pathname === "/api/status" && req.method === "GET") {
      const tokenDiagnostics = await getTokenDiagnostics();
      sendJson(res, 200, {
        ready: Boolean(USER_TOKEN || SERVICE_TOKEN),
        hasUserToken: Boolean(USER_TOKEN),
        hasServiceToken: Boolean(SERVICE_TOKEN),
        userTokenValid: tokenDiagnostics.userTokenValid,
        serviceTokenValid: tokenDiagnostics.serviceTokenValid,
        repostImportAvailable: tokenDiagnostics.userTokenValid,
        apiVersion: API_VERSION,
      });
      return;
    }

    if (pathname === "/api/import" && req.method === "POST") {
      const body = await readJson(req);
      const postUrl = String(body.postUrl || "").trim();
      const entryModes = Array.isArray(body.entryModes) ? body.entryModes : ["repost"];
      const scanDepth = clampInt(body.scanDepth, 10, 200, DEFAULT_SCAN_DEPTH);
      const strictPrizeHunter = Boolean(body.strictPrizeHunter);
      const requestUserToken = String(body.userToken || "").trim();
      const tokens = Array.from(new Set([requestUserToken, USER_TOKEN, SERVICE_TOKEN].filter(Boolean)));
      const result = await withVkTokens(tokens, () => importParticipants({ postUrl, entryModes, scanDepth, strictPrizeHunter, requestUserToken }));
      sendJson(res, 200, result);
      return;
    }

    if (pathname === "/api/enrich" && req.method === "POST") {
      const body = await readJson(req);
      const postUrl = String(body.postUrl || "").trim();
      const entryModes = Array.isArray(body.entryModes) ? body.entryModes : ["repost"];
      const scanDepth = clampInt(body.scanDepth, 10, 200, DEFAULT_SCAN_DEPTH);
      const strictPrizeHunter = Boolean(body.strictPrizeHunter);
      const actionRows = Array.isArray(body.actionRows) ? body.actionRows : [];
      const result = await enrichParticipants({ postUrl, entryModes, scanDepth, strictPrizeHunter, actionRows });
      sendJson(res, 200, result);
      return;
    }

    if (pathname === "/api/image" && req.method === "GET") {
      const remoteUrl = String(requestUrl.searchParams.get("url") || "").trim();
      if (!isSafeRemoteUrl(remoteUrl)) {
        sendJson(res, 400, { error: "invalid_image_url" });
        return;
      }
      const response = await fetch(remoteUrl);
      if (!response.ok) {
        sendJson(res, response.status, { error: "image_fetch_failed" });
        return;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      res.writeHead(200, {
        "content-type": response.headers.get("content-type") || "image/jpeg",
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*",
      });
      res.end(buffer);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
    return;
  }

  await serveStatic(pathname, res);
}

async function serveStatic(pathname, res) {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const absolute = path.resolve(ROOT_DIR, "." + rel);
  if (!absolute.startsWith(ROOT_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(absolute);
    const ext = path.extname(absolute).toLowerCase();
    res.writeHead(200, {
      "content-type": contentTypeFor(ext),
      "cache-control": "no-cache",
    });
    res.end(data);
  } catch {
    sendText(res, 404, "Not found");
  }
}

async function importParticipants({ postUrl, entryModes, scanDepth, strictPrizeHunter, requestUserToken }) {
  const parsed = parseWallUrl(postUrl);
  if (!parsed) {
    return { error: "Не удалось распознать ссылку на пост VK." };
  }

  const ownerId = parsed.ownerId;
  const postId = parsed.postId;
  const selectedModes = normalizeModes(entryModes);
  const envTokenDiagnostics = await getTokenDiagnostics();
  const requestUserTokenValid = await validateToken(requestUserToken);
  const requestRepostAccess = selectedModes.includes("repost")
    ? await validateRepostAccess(requestUserToken, ownerId, postId)
    : requestUserTokenValid;
  const envRepostAccess = selectedModes.includes("repost")
    ? await validateRepostAccess(USER_TOKEN, ownerId, postId)
    : envTokenDiagnostics.userTokenValid;
  const hasRepostAccess = requestRepostAccess || envRepostAccess;
  const sourceMaps = await collectSourceMaps(ownerId, postId, selectedModes);
  return buildParticipants({
    postUrl,
    ownerId,
    postId,
    selectedModes,
    sourceMaps,
    scanDepth,
    strictPrizeHunter,
    meta: {
      repostImportAvailable: hasRepostAccess,
      liveUserTokenUsed: requestUserTokenValid,
      liveUserRepostAccess: requestRepostAccess,
      note:
        selectedModes.includes("repost") && !hasRepostAccess
          ? "Для репостов нужен живой user token с wall-правами. Сейчас repost-часть недоступна."
          : undefined,
    },
  });
}

async function enrichParticipants({ postUrl, entryModes, scanDepth, strictPrizeHunter, actionRows }) {
  const parsed = parseWallUrl(postUrl);
  if (!parsed) {
    return { error: "Не удалось распознать ссылку на пост VK." };
  }

  const sourceMaps = new Map();
  for (const row of actionRows) {
    const id = Number(row?.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const entry = ensureAction(sourceMaps, id);
    entry.repost = Boolean(row.actions?.repost);
    entry.comment = Boolean(row.actions?.comment);
    entry.like = Boolean(row.actions?.like);
  }

  return buildParticipants({
    postUrl,
    ownerId: parsed.ownerId,
    postId: parsed.postId,
    selectedModes: normalizeModes(entryModes),
    sourceMaps,
    scanDepth,
    strictPrizeHunter,
    meta: {
      clientBridgeImport: true,
      repostImportAvailable: true,
    },
  });
}

async function buildParticipants({ postUrl, ownerId, postId, selectedModes, sourceMaps, scanDepth, strictPrizeHunter = false, meta = {} }) {
  const ids = Array.from(sourceMaps.keys());

  if (!ids.length) {
    return {
      participants: [],
      meta: {
        postUrl,
        ownerId,
        postId,
        selectedModes,
        importedCount: 0,
        note: "Не найдено участников по выбранным условиям.",
      },
    };
  }

  const users = await getUsers(ids);
  const groupId = ownerId < 0 ? Math.abs(ownerId) : null;
  const memberMap = groupId ? await getMemberMap(groupId, ids) : new Map();
  const wallMap = strictPrizeHunter ? await getWallSignals(ids, scanDepth) : new Map();

  const participants = users.map((user) => {
    const actionFlags = sourceMaps.get(user.id) || { repost: false, comment: false, like: false };
    const wallSignals = wallMap.get(user.id) || {};
    const photoUrl = user.avatarUrl ? `/api/image?url=${encodeURIComponent(user.avatarUrl)}` : "";
    return {
      id: user.id,
      name: user.name,
      profileUrl: user.profileUrl,
      avatarUrl: photoUrl,
      actions: actionFlags,
      member: groupId ? memberMap.get(user.id) ?? null : null,
      friends: user.friends,
      ageDays: wallSignals.ageDays ?? null,
      wallContestCount: wallSignals.wallContestCount ?? null,
      repostShare: wallSignals.repostShare ?? null,
      isCommunity: false,
      isPrivate: wallSignals.isPrivate ?? false,
      bioText: user.bioText || "",
      wallText: wallSignals.wallText || "",
    };
  });

  return {
    participants,
    meta: {
      postUrl,
      ownerId,
      postId,
      selectedModes,
      importedCount: participants.length,
      scanDepth,
      strictPrizeHunter,
      serviceTokenUsed: Boolean(SERVICE_TOKEN),
      ...meta,
    },
  };
}

async function collectSourceMaps(ownerId, postId, selectedModes) {
  const map = new Map();
  const tasks = [];

  if (selectedModes.includes("repost")) {
    tasks.push(async () => {
      const ids = await fetchReposters(ownerId, postId);
      ids.forEach((id) => {
        const entry = ensureAction(map, id);
        entry.repost = true;
      });
    });
  }

  if (selectedModes.includes("comment")) {
    tasks.push(async () => {
      const ids = await fetchCommenters(ownerId, postId);
      ids.forEach((id) => {
        const entry = ensureAction(map, id);
        entry.comment = true;
      });
    });
  }

  if (selectedModes.includes("like")) {
    tasks.push(async () => {
      const ids = await fetchLikers(ownerId, postId);
      ids.forEach((id) => {
        const entry = ensureAction(map, id);
        entry.like = true;
      });
    });
  }

  await runLimited(tasks, MAX_CONCURRENT);
  return map;
}

function ensureAction(map, id) {
  const key = Number(id);
  if (!map.has(key)) {
    map.set(key, { repost: false, comment: false, like: false });
  }
  return map.get(key);
}

async function fetchReposters(ownerId, postId) {
  const ids = new Set();

  try {
    const repostIds = await paginateIds(async (offset, count) => {
      const data = await vkCall("wall.getReposts", {
        owner_id: ownerId,
        post_id: postId,
        count,
        offset,
      });
      return extractRepostOwnerIds(data);
    });
    repostIds.forEach((id) => ids.add(id));
  } catch {}

  try {
    const copyIds = await paginateIds(async (offset, count) => {
      const data = await vkCall("likes.getList", {
        type: "post",
        owner_id: ownerId,
        item_id: postId,
        filter: "copies",
        count,
        offset,
      });
      return data.items || [];
    });
    copyIds.forEach((id) => ids.add(id));
  } catch {}

  return Array.from(ids);
}

async function fetchLikers(ownerId, postId) {
  return paginateIds(async (offset, count) => {
    const data = await vkCall("likes.getList", {
      type: "post",
      owner_id: ownerId,
      item_id: postId,
      filter: "likes",
      count,
      offset,
    });
    return data.items || [];
  });
}

async function fetchCommenters(ownerId, postId) {
  const results = [];
  let offset = 0;
  const count = 100;
  while (true) {
    const data = await vkCall("wall.getComments", {
      owner_id: ownerId,
      post_id: postId,
      count,
      offset,
      sort: "desc",
    });
    const items = data.items || [];
    results.push(
      ...items
        .map((comment) => comment.from_id)
        .filter((id) => Number.isInteger(id) && id > 0),
    );
    if (items.length < count) break;
    offset += count;
  }
  return uniqPositive(results);
}

function extractRepostOwnerIds(response) {
  const items = Array.isArray(response?.items) ? response.items : [];
  const ids = [];
  for (const item of items) {
    const ownerId = Number(item && item.owner_id);
    if (Number.isInteger(ownerId) && ownerId > 0) {
      ids.push(ownerId);
    }
  }
  return ids;
}

async function getUsers(ids) {
  const chunks = chunk(ids, 1000);
  const rows = [];
  for (const batch of chunks) {
    const data = await vkCall("users.get", {
      user_ids: batch.join(","),
      fields: [
        "counters",
        "photo_id",
        "has_photo",
        "screen_name",
        "domain",
        "photo_50",
        "photo_100",
        "photo_200",
        "bdate",
        "about",
        "status",
        "can_see_all_posts",
        "is_closed",
      ].join(","),
    });

    (data || []).forEach((u) => {
      rows.push({
        id: u.id,
        name: `${u.first_name || ""} ${u.last_name || ""}`.trim() || `id${u.id}`,
        profileUrl: `https://vk.com/${u.domain || `id${u.id}`}`,
        avatarUrl: u.photo_200 || u.photo_100 || u.photo_50 || "",
        friends: u.counters && Number.isFinite(u.counters.friends) ? u.counters.friends : null,
        bioText: [u.about, u.status].filter(Boolean).join(" ").trim(),
      });
    });
  }
  return rows;
}

async function getMemberMap(groupId, ids) {
  const result = new Map();
  for (const batch of chunk(ids, 500)) {
    let data = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        data = await vkCall("groups.isMember", {
          group_id: groupId,
          user_ids: batch.join(","),
        });
        break;
      } catch (error) {
        const message = String(error && error.message ? error.message : error);
        if (!message.includes("Too many requests per second") || attempt === 2) {
          data = null;
          break;
        }
        await sleep(250 * (attempt + 1));
      }
    }

    if (Array.isArray(data)) {
      data.forEach((row) => {
        if (!row || row.user_id === undefined) return;
        result.set(Number(row.user_id), Boolean(Number(row.member)));
      });
    } else if (typeof data === "object" && data !== null && "member" in data) {
      batch.forEach((id) => result.set(Number(id), Boolean(Number(data.member))));
    } else if (data !== null && data !== undefined) {
      batch.forEach((id) => result.set(Number(id), Boolean(data)));
    } else {
      batch.forEach((id) => result.set(Number(id), null));
    }
  }
  return result;
}

async function getWallSignals(ids, scanDepth) {
  const result = new Map();
  await runLimited(
    ids.map((id) => async () => {
      const wall = await safeVkCall("wall.get", {
        owner_id: id,
        count: scanDepth,
      });

      if (!wall || !Array.isArray(wall.items)) {
        result.set(id, { isPrivate: true, wallContestCount: null, repostShare: null, ageDays: null, wallText: "" });
        return;
      }

      const items = wall.items;
      const total = items.length || 1;
      let repostCount = 0;
      let contestCount = 0;
      let spamHitCount = 0;
      let oldestDate = null;
      const wallTexts = [];

      for (const post of items) {
        if (Number.isInteger(post.date)) {
          oldestDate = oldestDate === null ? post.date : Math.min(oldestDate, post.date);
        }
        const text = String(post.text || "").toLowerCase();
        wallTexts.push(String(post.text || ""));
        if (Array.isArray(post.copy_history) && post.copy_history.length) {
          repostCount += 1;
          if (containsAny(text, CONTEST_KEYS) || containsAny(flattenCopyHistory(post.copy_history), CONTEST_KEYS)) {
            contestCount += 1;
          }
        } else if (containsAny(text, CONTEST_KEYS)) {
          contestCount += 1;
        }
        if (containsAny(text, SPAM_KEYS)) {
          spamHitCount += 1;
        }
      }

      const now = Math.floor(Date.now() / 1000);
      const ageDays = oldestDate ? Math.max(0, Math.floor((now - oldestDate) / 86400)) : null;
      const repostShare = total ? repostCount / total : null;

      result.set(id, {
        isPrivate: false,
        wallContestCount: contestCount,
        repostShare,
        ageDays,
        wallText: wallTexts.join("\n").slice(0, 8000),
        spamHitCount,
      });
    }),
    MAX_CONCURRENT,
  );
  return result;
}

function flattenCopyHistory(copyHistory) {
  return copyHistory
    .map((entry) => String(entry.text || ""))
    .join(" ")
    .toLowerCase();
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

async function paginateIds(fetchPage) {
  const results = [];
  let offset = 0;
  const count = 1000;
  while (true) {
    const page = await fetchPage(offset, count);
    if (!page.length) break;
    results.push(...page);
    if (page.length < count) break;
    offset += count;
  }
  return uniqPositive(results);
}

function uniqPositive(items) {
  return Array.from(new Set(items.filter((id) => Number.isInteger(id) && id > 0)));
}

async function vkCall(method, params = {}) {
  const contextTokens = vkTokenContext.getStore();
  const tokens = Array.from(new Set((contextTokens?.length ? contextTokens : [USER_TOKEN, SERVICE_TOKEN]).filter(Boolean)));
  if (!tokens.length) {
    throw new Error("VK tokens are not configured.");
  }

  let lastError = null;
  for (const token of tokens) {
    try {
      return await vkCallWithToken(method, params, token);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`${method}: VK API error`);
}

async function vkCallWithToken(method, params = {}, token) {
  if (!token) {
    throw new Error("VK tokens are not configured.");
  }

  const data = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    data.set(key, String(value));
  }
  data.set("access_token", token);
  data.set("v", API_VERSION);

  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: data.toString(),
  });
  const payload = await response.json();
  if (!payload.error) {
    return payload.response;
  }
  throw new Error(`${method}: ${payload.error.error_msg || "VK API error"}`);
}

function withVkTokens(tokens, fn) {
  return vkTokenContext.run(tokens, fn);
}

async function getTokenDiagnostics() {
  if (tokenDiagnosticsPromise) return tokenDiagnosticsPromise;
  tokenDiagnosticsPromise = (async () => {
    const [userTokenValid, serviceTokenValid] = await Promise.all([
      validateToken(USER_TOKEN),
      validateToken(SERVICE_TOKEN),
    ]);
    return { userTokenValid, serviceTokenValid };
  })();
  return tokenDiagnosticsPromise;
}

async function validateToken(token) {
  if (!token) return false;
  try {
    await vkCallWithToken("users.get", { user_ids: 1 }, token);
    return true;
  } catch {
    return false;
  }
}

async function validateRepostAccess(token, ownerId, postId) {
  if (!token) return false;
  try {
    await vkCallWithToken(
      "likes.getList",
      {
        type: "post",
        owner_id: ownerId,
        item_id: postId,
        filter: "copies",
        count: 1,
        offset: 0,
      },
      token,
    );
    return true;
  } catch {
    return false;
  }
}

async function safeVkCall(method, params = {}) {
  try {
    return await vkCall(method, params);
  } catch {
    return null;
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function parseWallUrl(url) {
  if (!url) return null;
  const match = String(url).match(/wall(-?\d+)_([0-9]+)/i);
  if (!match) return null;
  return { ownerId: Number(match[1]), postId: Number(match[2]) };
}

function normalizeModes(entryModes) {
  const values = new Set((entryModes || []).map((item) => String(item).toLowerCase()));
  if (values.has("all")) return ["repost", "comment", "like"];
  return ["repost", "comment", "like"].filter((item) => values.has(item));
}

function clampInt(value, min, max, fallback) {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function isSafeRemoteUrl(raw) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function contentTypeFor(ext) {
  switch (ext) {
    case ".html":
      return "text/html;charset=utf-8";
    case ".css":
      return "text/css;charset=utf-8";
    case ".js":
      return "text/javascript;charset=utf-8";
    case ".json":
      return "application/json;charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json;charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "content-type": "text/plain;charset=utf-8",
    "access-control-allow-origin": "*",
  });
  res.end(text);
}

function chunk(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLimited(tasks, limit) {
  const queue = tasks.slice();
  const active = [];
  while (queue.length || active.length) {
    while (queue.length && active.length < limit) {
      const task = queue.shift();
      const job = Promise.resolve()
        .then(task)
        .catch(() => {})
        .finally(() => {
          const index = active.indexOf(job);
          if (index >= 0) active.splice(index, 1);
        });
      active.push(job);
    }
    if (active.length) {
      await Promise.race(active);
    }
  }
}
