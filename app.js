const STORAGE_KEY = "vk-winner-mini-app:v4";
const DEFAULT_VK_APP_ID = 54620998;
const VK_IMPORT_SCOPE = "wall,groups";
const VK_API_VERSION = "5.199";
const LOCAL_API_HOSTS = new Set(["localhost", "127.0.0.1", ""]);
const BRIDGE_CONTEST_KEYS = [
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
];

localStorage.removeItem("vk-winner-mini-app:v3");

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const els = {
  postUrl: $("#post-url"),
  modeBox: $("#entry-mode"),
  pinnedPost: $("#pinned-post"),
  winnersCount: $("#winners-count"),
  filters: $("#filters"),
  maxContests: $("#max-contests"),
  participants: $("#participants"),
  importScanDepth: $("#import-scan-depth"),
  eligibleCount: $("#eligible-count"),
  excludedCount: $("#excluded-count"),
  reportPreview: $("#report-preview"),
  winnersList: $("#winners-list"),
  auditLog: $("#audit-log"),
  apiStatus: $("#vk-api-status"),
  loadDemo: $("#load-demo"),
  checkImport: $("#check-import"),
  importVk: $("#import-vk"),
  copyReport: $("#copy-report"),
  drawWinners: $("#draw-winners"),
  downloadReport: $("#download-report"),
  downloadJson: $("#download-json"),
  downloadImage: $("#download-image"),
  useSample: $("#use-sample"),
  clearParticipants: $("#clear-participants"),
  jsonFile: $("#json-file"),
  canvas: $("#export-canvas"),
};

const actionLabels = {
  repost: "репост",
  comment: "комментарий",
  like: "лайк",
};

const sampleParticipants = [
  {
    id: 1024,
    name: "Анна Климова",
    profileUrl: "https://vk.com/id1024",
    avatarUrl: "https://picsum.photos/seed/anna/128",
    actions: { repost: true, comment: true, like: true },
    member: true,
    friends: 182,
    ageDays: 820,
    wallContestCount: 1,
    repostShare: 0.14,
    isCommunity: false,
    isPrivate: false,
    wallText: "Фото, работа, семья",
  },
  {
    id: 7846,
    name: "Иван Орлов",
    profileUrl: "https://vk.com/id7846",
    avatarUrl: "https://picsum.photos/seed/ivan/128",
    actions: { repost: true, comment: true, like: true },
    member: true,
    friends: 48,
    ageDays: 430,
    wallContestCount: 0,
    repostShare: 0.26,
    isCommunity: false,
    isPrivate: false,
    wallText: "Путешествия, техника",
  },
  {
    id: 5541,
    name: "Мария Соколова",
    profileUrl: "https://vk.com/id5541",
    avatarUrl: "https://picsum.photos/seed/maria/128",
    actions: { repost: true, comment: true, like: false },
    member: true,
    friends: 72,
    ageDays: 62,
    wallContestCount: 4,
    repostShare: 0.91,
    isCommunity: false,
    isPrivate: false,
    wallText: "конкурс giveaway приз",
  },
  {
    id: 9012,
    name: "Alex Promo",
    profileUrl: "https://vk.com/id9012",
    avatarUrl: "",
    actions: { repost: true, comment: true, like: true },
    member: false,
    friends: 7,
    ageDays: 12,
    wallContestCount: 9,
    repostShare: 0.97,
    isCommunity: false,
    isPrivate: true,
    wallText: "конкурс конкурс конкурс",
  },
  {
    id: 1177,
    name: "Екатерина Новикова",
    profileUrl: "https://vk.com/id1177",
    avatarUrl: "https://picsum.photos/seed/ekaterina/128",
    actions: { repost: true, comment: true, like: true },
    member: true,
    friends: 305,
    ageDays: 1400,
    wallContestCount: 0,
    repostShare: 0.03,
    isCommunity: false,
    isPrivate: false,
    wallText: "Книги, работа",
  },
];

const sampleTextParticipants = sampleParticipants.map(({ avatarUrl, ...rest }) => rest);

let demoMode = false;
let demoParticipants = [];
let importServerOk = false;
let autoImportTimer = null;
let importRequestSeq = 0;
let lastState = loadState();
let lastResult = null;

initBridge();
bindEvents();
hydrateState();
recomputeAndRender();
if (canUseLocalApi()) {
  checkImportServer();
} else {
  setApiStatus(isVkLaunchContext() ? "VK Bridge готов. Нажми «Подвести итоги»." : "Открой приложение внутри VK, чтобы запросить доступ к стене.");
}

function initBridge() {
  const bridge = window.vkBridge;
  if (!bridge || typeof bridge.send !== "function") return;

  bridge.send("VKWebAppInit").catch(() => {});
  bridge.send("VKWebAppSetViewSettings", { status_bar_style: "light", action_bar_color: "#f5f8fc" }).catch(() => {});
}

function bindEvents() {
  els.modeBox.addEventListener("change", handleModeChange);
  els.filters.addEventListener("change", persistAndRefresh);

  [
    els.pinnedPost,
    els.winnersCount,
    els.maxContests,
  ].forEach((node) => node.addEventListener("input", persistAndRefresh));

  [els.postUrl, els.importScanDepth].forEach((node) => node.addEventListener("input", persistAndRefresh));

  els.participants.addEventListener("input", () => {
    demoMode = false;
    demoParticipants = [];
    persistAndRefresh();
  });

  els.loadDemo.addEventListener("click", () => {
    demoMode = true;
    demoParticipants = sampleParticipants;
    els.participants.value = "";
    persistAndRefresh();
  });

  els.useSample.addEventListener("click", () => {
    demoMode = false;
    demoParticipants = [];
    els.participants.value = JSON.stringify(sampleTextParticipants, null, 2);
    persistAndRefresh();
  });

  els.clearParticipants.addEventListener("click", () => {
    demoMode = false;
    demoParticipants = [];
    els.participants.value = "";
    persistAndRefresh();
  });

  els.checkImport.addEventListener("click", checkImportServer);
  els.importVk.addEventListener("click", importFromVkFresh);

  els.copyReport.addEventListener("click", async () => {
    const text = buildReportText(lastResult ?? recompute());
    await navigator.clipboard.writeText(text);
    flashButton(els.copyReport, "Скопировано");
  });

  els.drawWinners.addEventListener("click", async () => {
    try {
      els.drawWinners.disabled = true;
      setApiStatus("Начинаю подведение итогов...");
      await importFromVkFresh();
      els.winnersList.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error("Draw failed", error);
      setApiStatus(`Подведение не удалось: ${formatVkError(error)}`);
    } finally {
      els.drawWinners.disabled = false;
    }
  });

  els.downloadReport.addEventListener("click", () => {
    const text = buildReportText(lastResult ?? recompute());
    downloadText("vk-results-report.txt", text);
  });

  els.downloadJson.addEventListener("click", () => {
    const payload = JSON.stringify(lastResult ?? recompute(), null, 2);
    downloadText("vk-results-report.json", payload);
  });

  els.downloadImage.addEventListener("click", async () => {
    const result = lastResult ?? recompute();
    await downloadResultImage(result);
  });

  els.jsonFile.addEventListener("change", async () => {
    const file = els.jsonFile.files?.[0];
    if (!file) return;
    demoMode = false;
    demoParticipants = [];
    const text = await file.text();
    els.participants.value = text;
    persistAndRefresh();
  });

  window.addEventListener("beforeunload", saveState);
}

function handleModeChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;

  if (target.value === "all") {
    const shouldSelectAll = target.checked;
    $$('input[type="checkbox"][value="repost"], input[type="checkbox"][value="comment"], input[type="checkbox"][value="like"]', els.modeBox).forEach(
      (box) => {
        box.checked = shouldSelectAll;
      },
    );
  } else {
    const actionBoxes = $$('input[type="checkbox"][value="repost"], input[type="checkbox"][value="comment"], input[type="checkbox"][value="like"]', els.modeBox);
    const allBox = $('input[type="checkbox"][value="all"]', els.modeBox);
    allBox.checked = actionBoxes.every((box) => box.checked);
  }
  persistAndRefresh();
}

function persistAndRefresh() {
  saveState();
  recomputeAndRender();
}

function scheduleAutoImport(delay = 700) {
  clearTimeout(autoImportTimer);
  demoMode = false;
  demoParticipants = [];
  els.participants.value = "";
  persistAndRefresh();
  setApiStatus("Ищу участников автоматически...");
  autoImportTimer = setTimeout(() => {
    const state = collectState();
    if (!state.postUrl) {
      setApiStatus("Нужна ссылка на пост для автоподтягивания участников.");
      return;
    }
    if (!importServerOk) {
      checkImportServer(true);
      return;
    }
    importFromVkFresh();
  }, delay);
}

async function checkImportServer(silent = false) {
  if (!canUseLocalApi()) {
    importServerOk = false;
    setApiStatus("Опубликованная версия работает через VK Bridge, без /api на GitHub Pages.");
    return { ready: false, skipped: true };
  }
  setApiStatus("Проверяю proxy...");
  try {
    const response = await fetch("/api/status");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    importServerOk = Boolean(payload.ready);
    const pieces = [];
    if (payload.hasUserToken) pieces.push("user token");
    if (payload.hasServiceToken) pieces.push("service token");
    const tokenText = pieces.length ? pieces.join(" + ") : "токены не заданы";
    const extra = payload.repostImportAvailable ? "" : " · repost нужен live user token";
    setApiStatus(payload.ready ? `Proxy готов · ${tokenText}${extra}` : `Proxy без токенов · ${tokenText}${extra}`);
    if (!payload.ready && !silent) {
      setApiStatus("Proxy не готов. Запусти `node server.js`.");
    }
    return payload;
  } catch (error) {
    importServerOk = false;
    setApiStatus("Proxy недоступен. Запусти `node server.js`.");
    return { ready: false, error: String(error) };
  }
}

async function importFromVk() {
  const state = collectState();
  if (!state.postUrl) {
    setApiStatus("Нужна ссылка на пост для импорта участников.");
    return;
  }

  setApiStatus("Импортирую участников из VK...");
  const requestSeq = ++importRequestSeq;

  try {
    const userToken = await requestVkUserToken();
    const payload = userToken
      ? await importFromVkBridge(state, userToken)
      : await importFromServer(state, "");
    if (payload.error) throw new Error(payload.error);
    if (requestSeq !== importRequestSeq) return;

    demoMode = false;
    demoParticipants = [];
    els.participants.value = JSON.stringify(payload.participants ?? [], null, 2);
    persistAndRefresh();
    setApiStatus(`Импорт готов · ${payload.participants?.length ?? 0} участников`);
  } catch (error) {
    if (requestSeq !== importRequestSeq) return;
    console.error("VK import failed", error);
    setApiStatus(`Импорт не удался: ${formatVkError(error)}`);
  }
}

async function requestVkUserToken() {
  const bridge = window.vkBridge;
  if (!bridge || typeof bridge.send !== "function") return "";

  try {
    const authPayload = await withTimeout(bridge.send("VKWebAppGetAuthToken", {
      app_id: getVkAppId(),
      scope: VK_IMPORT_SCOPE,
    }), canUseLocalApi() ? 1500 : 12000, "VK Bridge не ответил. Открой приложение внутри VK.");
    const grantedScopes = new Set(String(authPayload?.scope || "").split(",").map((scope) => scope.trim()));
    if (!grantedScopes.has("wall")) {
      throw new Error("VK не выдал доступ wall. Разреши доступ к стене, чтобы проверить репосты.");
    }
    return String(authPayload?.access_token || "");

    const scopeCheck = await bridge.send("VKWebAppCheckAllowedScopes", {
      scopes: VK_IMPORT_SCOPE,
    });
    const allowed = new Set((scopeCheck?.result || []).filter((item) => item.allowed).map((item) => item.scope));
    if (!allowed.has("wall")) {
      throw new Error("VK не дал доступ wall. Без него нельзя проверить репосты.");
    }

    const payload = await bridge.send("VKWebAppGetAuthToken", {
      app_id: getVkAppId(),
      scope: ["wall", allowed.has("groups") ? "groups" : ""].filter(Boolean).join(","),
    });
    return String(payload?.access_token || "");
  } catch (error) {
    if (!canUseLocalApi()) {
      throw error;
    }
    return "";
  }
}

async function importFromVkFresh() {
  const state = collectState();
  if (!state.postUrl) {
    setApiStatus("Нужна ссылка на пост для импорта участников.");
    return;
  }

  if (!canUseLocalApi() && !isVkLaunchContext()) {
    setApiStatus("Открой приложение внутри VK. Запрос `wall/groups` работает только в VK Mini App.");
    return;
  }

  setApiStatus("Импортирую участников из VK...");
  const requestSeq = ++importRequestSeq;

  try {
    setApiStatus(`Запрашиваю доступ VK к стене · app_id ${getVkAppId()}`);
    const userToken = await requestVkUserTokenFresh();
    if (!userToken) {
      throw new Error("VK не ответил на запрос токена. Открой приложение внутри VK Mini App.");
    }
    const payload = canUseLocalApi()
      ? await importFromServer(state, userToken)
      : await importFromVkBridge(state, userToken);
    if (payload.error) throw new Error(payload.error);
    if (requestSeq !== importRequestSeq) return;

    demoMode = false;
    demoParticipants = [];
    els.participants.value = JSON.stringify(payload.participants ?? [], null, 2);
    persistAndRefresh();
    const note = payload?.meta?.note ? ` · ${payload.meta.note}` : "";
    setApiStatus(`Импорт готов · ${payload.participants?.length ?? 0} участников${note}`);
  } catch (error) {
    if (requestSeq !== importRequestSeq) return;
    console.error("VK import failed", error);
    setApiStatus(`Импорт не удался: ${formatVkError(error)}`);
  }
}

async function requestVkUserTokenFresh() {
  const bridge = window.vkBridge;
  if (!bridge || typeof bridge.send !== "function") return "";

  try {
    const authPayload = await withTimeout(
      bridge.send("VKWebAppGetAuthToken", {
        app_id: getVkAppId(),
        scope: VK_IMPORT_SCOPE,
      }),
      canUseLocalApi() ? 1500 : 12000,
      "VK Bridge не ответил. Открой приложение внутри VK.",
    );
    const token = String(authPayload?.access_token || "");
    if (!token) {
      throw new Error(`VK не вернул access_token. ${formatVkError(authPayload)}`);
    }
    const grantedScopes = getGrantedScopes(authPayload?.scope);
    if (grantedScopes.size && !grantedScopes.has("wall")) {
      throw new Error("VK не выдал доступ wall. Разреши доступ к стене, чтобы проверить репосты.");
    }
    return token;
  } catch (error) {
    throw error;
  }
}

function getGrantedScopes(scope) {
  if (Array.isArray(scope)) {
    return new Set(scope.map((item) => String(item).trim()).filter(Boolean));
  }
  return new Set(String(scope || "").split(",").map((item) => item.trim()).filter(Boolean));
}

function getVkAppId() {
  const params = getLaunchParams();
  const appId = Number(params.get("vk_app_id"));
  return Number.isInteger(appId) && appId > 0 ? appId : DEFAULT_VK_APP_ID;
}

function isVkLaunchContext() {
  const params = getLaunchParams();
  return params.has("vk_user_id") || params.has("vk_app_id") || params.has("vk_platform");
}

function getLaunchParams() {
  const params = new URLSearchParams(window.location.search);
  if (!params.size && window.location.hash.includes("vk_app_id=")) {
    const hashParams = window.location.hash.slice(window.location.hash.indexOf("vk_app_id="));
    return new URLSearchParams(hashParams);
  }
  return params;
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function importFromServer(state, userToken) {
  if (!canUseLocalApi()) {
    throw new Error("Backend /api недоступен на GitHub Pages. Открой приложение внутри VK, чтобы импорт шел через VK Bridge.");
  }

  const response = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postUrl: state.postUrl,
      entryModes: state.entryModes,
      scanDepth: state.importScanDepth,
      strictPrizeHunter: Boolean(state.filters?.strictPrizeHunter),
      userToken,
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function importFromVkBridge(state, userToken) {
  const parsed = parseWallUrl(state.postUrl);
  if (!parsed) throw new Error("Не удалось распознать ссылку на пост VK.");

  const actionMap = new Map();
  const modes = state.entryModes.includes("all") ? ["repost", "comment", "like"] : state.entryModes;

  if (modes.includes("repost")) {
    setApiStatus("Собираю репосты из VK...");
    const ids = await getBridgeRepostIds(parsed, userToken);
    ids.forEach((id) => ensureActionRow(actionMap, id).repost = true);
  }

  if (modes.includes("comment")) {
    setApiStatus("Собираю комментарии из VK...");
    const ids = await paginateVkBridgeIds(async (offset) => {
      const data = await vkApiCall("wall.getComments", {
        owner_id: parsed.ownerId,
        post_id: parsed.postId,
        count: 100,
        offset,
        sort: "desc",
      }, userToken);
      return (data.items || [])
        .map((comment) => comment.from_id)
        .filter((id) => Number.isInteger(id) && id > 0);
    }, 100);
    ids.forEach((id) => ensureActionRow(actionMap, id).comment = true);
  }

  if (modes.includes("like")) {
    setApiStatus("Собираю лайки из VK...");
    const ids = await paginateVkBridgeIds((offset, count) =>
      vkApiCall("likes.getList", {
        type: "post",
        owner_id: parsed.ownerId,
        item_id: parsed.postId,
        filter: "likes",
        count,
        offset,
      }, userToken),
    );
    ids.forEach((id) => ensureActionRow(actionMap, id).like = true);
  }

  return buildBridgeImportPayload({
    state,
    parsed,
    actionMap,
    selectedModes: modes,
    userToken,
  });
}

function canUseLocalApi() {
  return LOCAL_API_HOSTS.has(window.location.hostname) && window.location.port === "4173";
}

async function buildBridgeImportPayload({ state, parsed, actionMap, selectedModes, userToken }) {
  const ids = Array.from(actionMap.keys());
  if (!ids.length) {
    return {
      participants: [],
      meta: {
        postUrl: state.postUrl,
        ownerId: parsed.ownerId,
        postId: parsed.postId,
        selectedModes,
        importedCount: 0,
        clientBridgeImport: true,
        note: "Участники по выбранным условиям не найдены.",
      },
    };
  }

  setApiStatus(`VK найдено ID: ${ids.length}. Загружаю профили...`);
  const users = await getBridgeUsers(ids, userToken);
  const groupId = parsed.ownerId < 0 ? Math.abs(parsed.ownerId) : null;
  const memberMap = groupId ? await getBridgeMemberMap(groupId, ids, userToken) : new Map();
  const strictPrizeHunter = Boolean(state.filters?.strictPrizeHunter);
  const wallMap = strictPrizeHunter ? await getBridgeWallSignals(ids, state.importScanDepth, userToken) : new Map();

  const participants = users.map((user) => {
    const wallSignals = wallMap.get(user.id) || {};
    return {
      id: user.id,
      name: user.name,
      profileUrl: user.profileUrl,
      avatarUrl: user.avatarUrl,
      actions: actionMap.get(user.id) || { repost: false, comment: false, like: false },
      member: groupId ? memberMap.get(user.id) ?? null : null,
      friends: user.friends,
      ageDays: wallSignals.ageDays ?? null,
      wallContestCount: wallSignals.wallContestCount ?? null,
      repostShare: wallSignals.repostShare ?? null,
      isCommunity: false,
      isPrivate: wallSignals.isPrivate ?? user.isPrivate ?? false,
      bioText: user.bioText || "",
      wallText: wallSignals.wallText || "",
    };
  });

  return {
    participants,
    meta: {
      postUrl: state.postUrl,
      ownerId: parsed.ownerId,
      postId: parsed.postId,
      selectedModes,
      importedCount: participants.length,
      scanDepth: state.importScanDepth,
      clientBridgeImport: true,
      repostImportAvailable: true,
      strictPrizeHunter,
    },
  };
}

async function getBridgeRepostIds(parsed, userToken) {
  const [copiesIds, wallIds] = await Promise.all([
    paginateVkBridgeIds((offset, count) =>
      vkApiCall("likes.getList", {
        type: "post",
        owner_id: parsed.ownerId,
        item_id: parsed.postId,
        filter: "copies",
        count,
        offset,
      }, userToken),
    ),
    fetchBridgeWallRepostIds(parsed, userToken),
  ]);

  return Array.from(new Set([...copiesIds, ...wallIds]));
}

async function fetchBridgeWallRepostIds(parsed, userToken, pageSize = 100, maxItems = 10000) {
  const results = [];
  let offset = 0;
  while (results.length < maxItems) {
    const count = Math.min(pageSize, maxItems - results.length);
    const data = await safeVkApiCall("wall.getReposts", {
      owner_id: parsed.ownerId,
      post_id: parsed.postId,
      count,
      offset,
    }, userToken);
    if (!data) break;
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) break;
    const pageIds = items
      .map((item) => Number(item.owner_id))
      .filter((id) => Number.isInteger(id) && id > 0);
    results.push(...pageIds);
    if (items.length < count) break;
    offset += items.length;
  }
  return Array.from(new Set(results)).slice(0, maxItems);
}

async function getBridgeUsers(ids, userToken) {
  const rows = [];
  for (const batch of chunkItems(ids, 1000)) {
    const data = await vkApiCall("users.get", {
      user_ids: batch.join(","),
      fields: [
        "counters",
        "domain",
        "photo_50",
        "photo_100",
        "photo_200",
        "about",
        "status",
        "is_closed",
      ].join(","),
    }, userToken);

    (data || []).forEach((user) => {
      rows.push({
        id: Number(user.id),
        name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || `id${user.id}`,
        profileUrl: `https://vk.com/${user.domain || `id${user.id}`}`,
        avatarUrl: user.photo_200 || user.photo_100 || user.photo_50 || "",
        friends: user.counters && Number.isFinite(user.counters.friends) ? user.counters.friends : null,
        isPrivate: Boolean(user.is_closed),
        bioText: [user.about, user.status].filter(Boolean).join(" ").trim(),
      });
    });
  }
  return rows;
}

async function getBridgeMemberMap(groupId, ids, userToken) {
  const result = new Map();
  setApiStatus("Проверяю подписку на сообщество...");

  for (const batch of chunkItems(ids, 500)) {
    const data = await safeVkApiCall("groups.isMember", {
      group_id: groupId,
      user_ids: batch.join(","),
    }, userToken);

    if (Array.isArray(data)) {
      data.forEach((row) => {
        if (row && row.user_id !== undefined) {
          result.set(Number(row.user_id), Boolean(Number(row.member)));
        }
      });
    } else {
      batch.forEach((id) => result.set(Number(id), null));
    }
  }
  return result;
}

async function getBridgeWallSignals(ids, scanDepth, userToken) {
  const result = new Map();
  let done = 0;
  const startedAt = Date.now();

  await runBridgeLimited(
    ids.map((id) => async () => {
      const wall = await safeVkApiCall("wall.get", {
        owner_id: id,
        count: scanDepth,
      }, userToken);

      done += 1;
      if (done % 10 === 0 || done === ids.length) {
        setApiStatus(`Проверяю стены: ${done}/${ids.length} · осталось примерно ${estimateRemainingTime(startedAt, done, ids.length)}`);
      }

      if (!wall || !Array.isArray(wall.items)) {
        result.set(id, { isPrivate: true, wallContestCount: null, repostShare: null, ageDays: null, wallText: "" });
        return;
      }

      const items = wall.items;
      const total = items.length || 1;
      let repostCount = 0;
      let contestCount = 0;
      let oldestDate = null;
      const wallTexts = [];

      for (const post of items) {
        if (Number.isInteger(post.date)) {
          oldestDate = oldestDate === null ? post.date : Math.min(oldestDate, post.date);
        }

        const text = String(post.text || "").toLowerCase();
        const copyText = Array.isArray(post.copy_history)
          ? post.copy_history.map((entry) => String(entry.text || "")).join(" ").toLowerCase()
          : "";
        wallTexts.push(String(post.text || ""));

        if (Array.isArray(post.copy_history) && post.copy_history.length) {
          repostCount += 1;
          if (containsBridgeContestText(text) || containsBridgeContestText(copyText)) {
            contestCount += 1;
          }
        } else if (containsBridgeContestText(text)) {
          contestCount += 1;
        }
      }

      const now = Math.floor(Date.now() / 1000);
      result.set(id, {
        isPrivate: false,
        wallContestCount: contestCount,
        repostShare: total ? repostCount / total : null,
        ageDays: oldestDate ? Math.max(0, Math.floor((now - oldestDate) / 86400)) : null,
        wallText: wallTexts.join("\n").slice(0, 8000),
      });
    }),
    6,
  );

  return result;
}

function estimateRemainingTime(startedAt, done, total) {
  if (!done || !total || done >= total) return "00:00";
  const elapsedMs = Date.now() - startedAt;
  const remainingMs = (elapsedMs / done) * (total - done);
  return formatDuration(remainingMs);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function safeVkApiCall(method, params, userToken) {
  try {
    return await vkApiCall(method, params, userToken);
  } catch {
    return null;
  }
}

async function vkApiCall(method, params, userToken) {
  try {
    const payload = await window.vkBridge.send("VKWebAppCallAPIMethod", {
      method,
      params: {
        ...params,
        access_token: userToken,
        v: VK_API_VERSION,
      },
    });
    if (payload?.error) {
      throw payload.error;
    }
    if (!payload || !Object.prototype.hasOwnProperty.call(payload, "response")) {
      throw new Error(`VK API ${method} вернул пустой ответ`);
    }
    return payload.response;
  } catch (error) {
    throw new Error(`${method}: ${formatVkError(error)}`);
  }
}

function formatVkError(error) {
  if (!error) return "неизвестная ошибка";
  if (typeof error === "string") return error.replace(/^Error:\s*/, "");
  if (error instanceof Error && error.message) return error.message.replace(/^Error:\s*/, "");

  const data = error.error_data || error.error || error.data || {};
  const fields = [
    error.error_type,
    error.error_code,
    error.error_msg,
    error.error_message,
    error.error_description,
    error.message,
    data.error_type,
    data.error_code,
    data.error_msg,
    data.error_message,
    data.error_description,
    data.error_reason,
    data.message,
  ]
    .filter((item) => item !== undefined && item !== null && String(item).trim())
    .map((item) => String(item).trim());

  if (fields.length) return [...new Set(fields)].join(" · ");

  try {
    return JSON.stringify(sanitizeVkError(error));
  } catch {
    return "объект ошибки VK Bridge";
  }
}

function sanitizeVkError(value) {
  if (Array.isArray(value)) return value.map(sanitizeVkError);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      key.toLowerCase().includes("token") ? "[hidden]" : sanitizeVkError(item),
    ]),
  );
}

async function runBridgeLimited(tasks, limit) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (index < tasks.length) {
      const current = index;
      index += 1;
      await tasks[current]();
    }
  });
  await Promise.all(workers);
}

function chunkItems(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function containsBridgeContestText(text) {
  const lower = String(text || "").toLowerCase();
  return BRIDGE_CONTEST_KEYS.some((key) => lower.includes(key));
}

async function paginateVkBridgeIds(fetchPage, pageSize = 100, maxItems = 10000) {
  const results = [];
  let offset = 0;
  while (results.length < maxItems) {
    const count = Math.min(pageSize, maxItems - results.length);
    const data = await fetchPage(offset, count);
    const page = Array.isArray(data) ? data : data.items || [];
    if (!page.length) break;
    results.push(...page);
    if (page.length < count) break;
    offset += page.length;
  }
  return Array.from(new Set(results.filter((id) => Number.isInteger(id) && id > 0))).slice(0, maxItems);
}

function ensureActionRow(map, id) {
  if (!map.has(id)) {
    map.set(id, { repost: false, comment: false, like: false });
  }
  return map.get(id);
}

function parseWallUrl(url) {
  const match = String(url || "").match(/wall(-?\d+)_([0-9]+)/i);
  if (!match) return null;
  return { ownerId: Number(match[1]), postId: Number(match[2]) };
}

function setApiStatus(text) {
  els.apiStatus.textContent = text;
}

function hydrateState() {
  els.postUrl.value = lastState.postUrl ?? "";
  els.pinnedPost.checked = lastState.pinnedPost ?? true;
  els.winnersCount.value = String(lastState.winnersCount ?? 3);
  els.importScanDepth.value = String(lastState.importScanDepth ?? 60);
  els.maxContests.value = String(lastState.maxContests ?? 3);
  els.participants.value = lastState.participantsText ?? "";

  $$('input[type="checkbox"]', els.modeBox).forEach((box) => {
    box.checked = lastState.entryModes?.includes(box.value) ?? box.checked;
  });

  if (lastState.entryModes?.includes("all")) {
    $$('input[type="checkbox"][value="repost"], input[type="checkbox"][value="comment"], input[type="checkbox"][value="like"]', els.modeBox).forEach(
      (box) => {
        box.checked = true;
      },
    );
  }

  $$('#filters input[type="checkbox"]').forEach((box) => {
    const key = box.dataset.filter;
    if (key) box.checked = lastState.filters?.[key] ?? box.checked;
  });
}

function saveState() {
  const state = collectState();
  const { participantsData, ...persistable } = state;
  lastState = persistable;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      postUrl: "",
      entryModes: ["repost", "comment", "like"],
      pinnedPost: true,
      winnersCount: 3,
      importScanDepth: 60,
      filters: {
        requireAvatar: false,
        requireGroupMember: false,
        excludeCommunities: true,
        excludePrivate: false,
        strictPrizeHunter: false,
      },
      maxContests: 3,
      participantsText: "",
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {
      postUrl: "",
      entryModes: ["repost", "comment", "like"],
      pinnedPost: true,
      winnersCount: 3,
      importScanDepth: 60,
      filters: {
        requireAvatar: false,
        requireGroupMember: false,
        excludeCommunities: true,
        excludePrivate: false,
        strictPrizeHunter: false,
      },
      maxContests: 3,
      participantsText: "",
    };
  }
}

function collectState() {
  const entryModes = $$('input[type="checkbox"]', els.modeBox)
    .filter((box) => box.checked)
    .map((box) => box.value);

  const filters = {};
  $$('#filters input[type="checkbox"]').forEach((box) => {
    filters[box.dataset.filter] = box.checked;
  });

  return {
    postUrl: els.postUrl.value.trim(),
    entryModes: entryModes.length ? entryModes : ["repost", "comment", "like"],
    pinnedPost: els.pinnedPost.checked,
    winnersCount: clampInt(els.winnersCount.value, 1, 100, 3),
    importScanDepth: clampInt(els.importScanDepth.value, 10, 200, 60),
    filters,
    maxContests: clampInt(els.maxContests.value, 0, 1000, 3),
    participantsText: demoMode ? "" : els.participants.value,
    participantsData: demoMode ? demoParticipants : parseParticipants(els.participants.value),
  };
}

function clampInt(value, min, max, fallback) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function recomputeAndRender() {
  lastResult = recompute();
  render(lastResult);
  saveState();
}

function recompute() {
  const state = collectState();
  const participants = state.participantsData || [];
  const normalizedModes = state.entryModes.includes("all")
    ? ["repost", "comment", "like"]
    : state.entryModes.filter((mode) => mode !== "all");
  const requiredActions = normalizedModes.length ? normalizedModes : ["repost"];
  const evaluated = participants.map((participant, index) => {
    const p = normalizeParticipant(participant, index);
    const reasons = evaluateParticipant(p, state, requiredActions);
    return {
      ...p,
      reasons,
      passed: reasons.length === 0,
    };
  });

  const eligible = evaluated.filter((item) => item.passed);
  const excluded = evaluated.filter((item) => !item.passed);
  const winnerCount = Math.min(state.winnersCount, eligible.length);
  const winners = shuffle([...eligible]).slice(0, winnerCount);
  const reasonCounts = tallyReasons(excluded);

  return {
    ...state,
    participants: evaluated,
    eligible,
    excluded,
    winners,
    reasonCounts,
    requiredActions,
  };
}

function normalizeParticipant(raw, index) {
  if (typeof raw === "number" || typeof raw === "string") {
    const id = String(raw).replace(/^id/i, "");
    return {
      id,
      name: `Участник ${index + 1}`,
      profileUrl: buildProfileUrl(id),
      avatarUrl: "",
      actions: {},
      member: null,
      friends: null,
      ageDays: null,
      wallContestCount: null,
      repostShare: null,
      isCommunity: null,
      isPrivate: null,
      bioText: "",
      wallText: "",
    };
  }

  const participant = raw && typeof raw === "object" ? raw : {};
  const name = [participant.first_name, participant.last_name].filter(Boolean).join(" ").trim();
  const id = participant.id ?? participant.userId ?? participant.uid ?? participant.vkId ?? index + 1;
  const normalizedId = String(id);
  const actions = participant.actions && typeof participant.actions === "object" ? participant.actions : {};

  return {
    id: normalizedId,
    name: participant.name || name || `Участник ${index + 1}`,
    profileUrl: participant.profileUrl || participant.url || participant.link || buildProfileUrl(normalizedId),
    avatarUrl: participant.avatarUrl || participant.photoUrl || participant.photo || participant.avatar || "",
    actions: {
      repost: toBool(actions.repost ?? participant.repost ?? participant.copy ?? participant.hasRepost),
      comment: toBool(actions.comment ?? participant.comment ?? participant.commented),
      like: toBool(actions.like ?? participant.like ?? participant.liked),
    },
    member: participant.member ?? participant.isMember ?? participant.subscribed ?? null,
    friends: toNum(participant.friends ?? participant.friendsCount ?? participant.friendCount),
    ageDays: toNum(participant.ageDays ?? participant.accountAgeDays ?? participant.daysOld),
    wallContestCount: toNum(participant.wallContestCount ?? participant.contestCount ?? participant.contestsOnWall),
    repostShare: toNum(participant.repostShare ?? participant.repostRate ?? participant.repostRatio),
    isCommunity: participant.isCommunity ?? participant.community ?? null,
    isPrivate: participant.isPrivate ?? participant.private ?? null,
    bioText: String(participant.bioText ?? participant.bio ?? participant.about ?? ""),
    wallText: String(participant.wallText ?? participant.wall ?? ""),
  };
}

function toNum(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toBool(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const lower = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "да"].includes(lower)) return true;
  if (["0", "false", "no", "нет"].includes(lower)) return false;
  return null;
}

function buildProfileUrl(id) {
  return /^\d+$/.test(String(id)) ? `https://vk.com/id${id}` : `https://vk.com/${id}`;
}

function parseParticipants(text) {
  const source = (text || "").trim();
  if (!source) return [];

  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.participants)) return parsed.participants;
    if (parsed && typeof parsed === "object") return [parsed];
  } catch {
    // fall through
  }

  return source
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => parseParticipantLine(line, index));
}

function parseParticipantLine(line, index) {
  if (line.startsWith("{") || line.startsWith("[")) {
    try {
      return JSON.parse(line);
    } catch {
      // fall through
    }
  }

  const keyValuePairs = line
    .split(/[;,]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => chunk.split("=").map((part) => part.trim()))
    .filter((pair) => pair.length === 2);

  if (keyValuePairs.length) {
    const result = {};
    for (const [key, value] of keyValuePairs) {
      const normalizedKey = key.toLowerCase();
      result[normalizedKey] = value;
    }
    return {
      id: result.id || result.user || result.userid || index + 1,
      name: result.name || result.title || `Участник ${index + 1}`,
      profileUrl: result.profileurl || result.url || buildProfileUrl(result.id || index + 1),
      avatarUrl: result.avatarurl || "",
      actions: {
        repost: toBool(result.repost),
        comment: toBool(result.comment),
        like: toBool(result.like),
      },
      member: toBool(result.member),
      friends: toNum(result.friends),
      ageDays: toNum(result.agedays),
      wallContestCount: toNum(result.wallcontestcount),
      repostShare: toNum(result.repostshare),
      isCommunity: toBool(result.iscommunity),
      isPrivate: toBool(result.isprivate),
      bioText: result.bio || "",
      wallText: result.wall || "",
    };
  }

  const maybeUrl = line.match(/https?:\/\/vk\.com\/([^\s/]+)/i);
  const maybeId = line.match(/(?:^|[^\d])(?:id)?(\d+)/i);

  return {
    id: maybeId ? maybeId[1] : String(index + 1),
    name: line,
    profileUrl: maybeUrl ? maybeUrl[0] : buildProfileUrl(maybeId ? maybeId[1] : index + 1),
    avatarUrl: "",
    actions: {},
    member: null,
    friends: null,
    ageDays: null,
    wallContestCount: null,
    repostShare: null,
    isCommunity: null,
    isPrivate: null,
    bioText: "",
    wallText: "",
  };
}

function evaluateParticipant(participant, state, requiredActions) {
  const reasons = [];
  const filters = state.filters || {};

  if (requiredActions.length) {
    for (const action of requiredActions) {
      if (participant.actions?.[action] === true) continue;
      if (participant.actions?.[action] === false) {
        reasons.push(`нет ${actionLabels[action] || action}`);
      } else {
        reasons.push(`нет данных по ${actionLabels[action] || action}`);
      }
    }
  }

  if (filters.requireAvatar && !participant.avatarUrl) {
    reasons.push("нет аватара");
  }

  if (filters.requireGroupMember && participant.member === false) {
    reasons.push("не подписан");
  }

  if (filters.excludeCommunities && participant.isCommunity === true) {
    reasons.push("сообщество");
  }

  if (filters.excludePrivate && participant.isPrivate === true) {
    reasons.push("закрытый профиль");
  }

  const strictPrizeHunter = Boolean(filters.strictPrizeHunter);

  if (strictPrizeHunter && participant.wallContestCount !== null && participant.wallContestCount > state.maxContests) {
    reasons.push(`конкурсов на стене ${participant.wallContestCount} > ${state.maxContests}`);
  }

  if (!strictPrizeHunter) {
    return [...new Set(reasons)];
  }

  return [...new Set(reasons)];
}

function render(result) {
  els.eligibleCount.textContent = String(result.eligible.length);
  els.excludedCount.textContent = String(result.excluded.length);

  els.reportPreview.textContent = buildReportText(result);

  renderWinners(result);
  renderAudit(result);
}

function renderWinners(result) {
  if (!result.winners.length) {
    let message = "Пока нет допущенных участников.";
    if (!result.participants.length) {
      message = "Импорт не дал участников. Проверь ссылку и доступ VK к стене.";
    } else if (result.reasonCounts?.["нет репоста"] > 0 && result.reasonCounts["нет репоста"] >= result.participants.length / 2) {
      message = "Участники есть, но репосты не подтянулись. Проверь доступ `wall/groups` и режим участия.";
    } else if (result.excluded.length === result.participants.length) {
      message = "Все участники отсеяны фильтрами. Сними лишние галочки или отключи строгую проверку.";
    }
    els.winnersList.innerHTML = `<div class="empty-state">${message}</div>`;
    return;
  }

  els.winnersList.innerHTML = result.winners
    .map((winner, index) => {
      const initial = getInitials(winner.name);
      return `
        <div class="winner-card">
          ${
            winner.avatarUrl
              ? `<img class="avatar" src="${escapeAttr(winner.avatarUrl)}" alt="${escapeAttr(winner.name)}" />`
              : `<div class="avatar avatar-fallback">${escapeHtml(initial)}</div>`
          }
          <div class="winner-meta">
            <div class="winner-name">${escapeHtml(winner.name)}</div>
          <div class="winner-sub">id${escapeHtml(winner.id)} · ${escapeHtml(shortUrl(winner.profileUrl))}</div>
          </div>
          <div class="winner-status">${index + 1} место</div>
        </div>
      `;
    })
    .join("");
}

function renderAudit(result) {
  const reasons = Object.entries(result.reasonCounts).sort((a, b) => b[1] - a[1]);
  if (!reasons.length) {
    els.auditLog.innerHTML = `<div class="empty-state">Исключений нет.</div>`;
    return;
  }

  els.auditLog.innerHTML = reasons
    .map(
      ([reason, count]) => `
        <div class="audit-item">
          <div>
            <strong>${escapeHtml(reason)}</strong>
            <span>${escapeHtml(describeReason(reason))}</span>
          </div>
          <div class="badge">${count}</div>
        </div>
      `,
    )
    .join("");
}

function describeReason(reason) {
  if (reason.includes("нет данных")) return "Нет данных в импорте. Лучше приложить JSON с полями профиля.";
  if (reason.includes("спам-слова")) return "Подозрительный профиль. Убрали из жеребьёвки.";
  if (reason.includes("репост")) return "Профиль слишком похож на конкурсный поток.";
  return "Фильтр антифрода сработал.";
}

function buildResultMetaLabels(result) {
  const labels = [];
  const modeText = result.requiredActions.map((action) => actionLabels[action]).join(", ");
  if (modeText) labels.push(`\u0423\u0441\u043b\u043e\u0432\u0438\u0435: ${modeText}`);
  if (result.pinnedPost) labels.push("\u041f\u043e\u0441\u0442 \u0437\u0430\u043a\u0440\u0435\u043f\u043b\u0435\u043d");
  return labels;
}

function buildEnabledFilterLines(result) {
  const lines = [];
  if (result.filters.requireAvatar) lines.push("- \u0410\u0432\u0430\u0442\u0430\u0440: \u0432\u043a\u043b");
  if (result.filters.requireGroupMember) lines.push("- \u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430: \u0432\u043a\u043b");
  if (result.filters.excludeCommunities) lines.push("- \u0421\u043e\u043e\u0431\u0449\u0435\u0441\u0442\u0432\u0430: \u0438\u0441\u043a\u043b\u044e\u0447\u0430\u0442\u044c");
  if (result.filters.excludePrivate) lines.push("- \u0417\u0430\u043a\u0440\u044b\u0442\u044b\u0435 \u043f\u0440\u043e\u0444\u0438\u043b\u0438: \u0438\u0441\u043a\u043b\u044e\u0447\u0430\u0442\u044c");
  if (result.filters.strictPrizeHunter) {
    lines.push("- \u0421\u0442\u0440\u043e\u0433\u0430\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u043f\u0440\u0438\u0437\u043e\u043b\u043e\u0432\u043e\u0432: \u0432\u043a\u043b");
    lines.push(`- \u041c\u0430\u043a\u0441. \u043a\u043e\u043d\u043a\u0443\u0440\u0441\u043e\u0432 \u043d\u0430 \u0441\u0442\u0435\u043d\u0435: ${result.maxContests}`);
  }
  return lines;
}

function buildReportText(result) {
  const lines = [
    "\u0418\u0442\u043e\u0433\u0438 \u0440\u043e\u0437\u044b\u0433\u0440\u044b\u0448\u0430",
    "",
    `\u041f\u043e\u0441\u0442: ${result.postUrl || "\u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d"}`,
    ...buildResultMetaLabels(result),
    `\u041f\u043e\u0431\u0435\u0434\u0438\u0442\u0435\u043b\u0435\u0439: ${result.winners.length}/${result.winnersCount}`,
    `\u0414\u043e\u043f\u0443\u0449\u0435\u043d\u043e: ${result.eligible.length}`,
    `\u0418\u0441\u043a\u043b\u044e\u0447\u0435\u043d\u043e: ${result.excluded.length}`,
  ];

  const filterLines = buildEnabledFilterLines(result);
  if (filterLines.length) {
    lines.push("", "\u0424\u0438\u043b\u044c\u0442\u0440\u044b:", ...filterLines);
  }

  lines.push("", "\u041f\u043e\u0431\u0435\u0434\u0438\u0442\u0435\u043b\u0438:");

  if (result.winners.length) {
    result.winners.forEach((winner, index) => {
      lines.push(`${index + 1}. ${winner.name} - id${winner.id} - ${winner.profileUrl}`);
    });
  } else {
    lines.push("\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043f\u043e\u0431\u0435\u0434\u0438\u0442\u0435\u043b\u0435\u0439");
  }

  lines.push("", "\u041b\u043e\u0433 \u0438\u0441\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0439:");
  const reasonEntries = Object.entries(result.reasonCounts).sort((a, b) => b[1] - a[1]);
  if (reasonEntries.length) {
    reasonEntries.forEach(([reason, count]) => {
      lines.push(`- ${reason}: ${count}`);
    });
  }

  return lines.join("\n");
}

function tallyReasons(excluded) {
  const map = {};
  excluded.forEach((participant) => {
    participant.reasons.forEach((reason) => {
      map[reason] = (map[reason] || 0) + 1;
    });
  });
  return map;
}

function shuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = secureRandomIndex(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function secureRandomIndex(maxExclusive) {
  if (maxExclusive <= 1) return 0;
  const bytes = new Uint32Array(1);
  if (window.crypto?.getRandomValues) {
    const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
    do {
      window.crypto.getRandomValues(bytes);
    } while (bytes[0] >= limit);
    return bytes[0] % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function downloadResultImage(result) {
  const canvas = els.canvas;
  canvas.width = 1600;
  canvas.height = Math.max(1120, 630 + result.winners.length * 178 + 140);
  const ctx = canvas.getContext("2d");

  try {
    await drawResultCanvas(ctx, result, true);
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, "vk-results.png");
  } catch {
    await drawResultCanvas(ctx, result, false);
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, "vk-results.png");
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to export canvas"));
    }, "image/png");
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function drawResultCanvas(ctx, result, allowRemoteImages) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#f7fbff");
  bg.addColorStop(1, "#eef4fb");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#10233d";
  ctx.font = "800 58px Manrope, sans-serif";
  ctx.fillText("Итоги розыгрыша", 70, 92);

  ctx.font = "600 24px Manrope, sans-serif";
  ctx.fillStyle = "#5f708a";
  wrapText(ctx, `Пост: ${result.postUrl || "не указан"}`, 70, 135, w - 140, 34);

  const chipsBottom = drawMetaChips(ctx, 70, 185, w - 140, buildResultMetaLabels(result));

  const panelY = chipsBottom + 34;
  const statsX = 70;
  const statsW = w - 140;
  drawPanel(ctx, statsX, panelY, statsW, 170, "Статистика");
  ctx.font = "800 42px Manrope, sans-serif";
  ctx.fillStyle = "#10233d";
  ctx.fillText(String(result.participants.length), statsX + 36, panelY + 88);
  ctx.fillText(`${result.winners.length}/${result.winnersCount}`, statsX + 250, panelY + 88);
  ctx.font = "600 18px Manrope, sans-serif";
  ctx.fillStyle = "#5f708a";
  ctx.fillText("участников всего", statsX + 36, panelY + 124);
  ctx.fillText("победителей", statsX + 250, panelY + 124);

  const winnersPanelY = panelY + 220;
  drawPanel(ctx, 70, winnersPanelY, w - 140, Math.max(430, result.winners.length * 170 + 70), "Победители");
  const startY = winnersPanelY + 85;
  for (let i = 0; i < result.winners.length; i += 1) {
    const winner = result.winners[i];
    const rowY = startY + i * 170;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 100, rowY, w - 200, 140, 24);
    ctx.fill();
    ctx.strokeStyle = "rgba(28,57,91,0.12)";
    ctx.stroke();

    await drawAvatar(ctx, winner, 128, rowY + 18, 104, allowRemoteImages);
    ctx.fillStyle = "#10233d";
    ctx.font = "800 30px Manrope, sans-serif";
    ctx.fillText(winner.name, 260, rowY + 60);
    ctx.font = "600 20px Manrope, sans-serif";
    ctx.fillStyle = "#5f708a";
    ctx.fillText(`id${winner.id}`, 260, rowY + 96);
    ctx.fillText(shortUrl(winner.profileUrl), 260, rowY + 124);
    drawWinnerBadge(ctx, w - 270, rowY + 48, i + 1);
  }

  const footerY = Math.max(1110, startY + result.winners.length * 170 + 20);
  ctx.fillStyle = "#5f708a";
  ctx.font = "600 19px Manrope, sans-serif";
  ctx.fillText(`Рандомайзер для конкурсов. Участников всего: ${result.participants.length}.`, 70, footerY);
}

function drawMetaChips(ctx, x, y, maxWidth, labels) {
  let cursorX = x;
  let cursorY = y;
  const gap = 14;
  const height = 46;

  labels.forEach((label) => {
    ctx.font = "700 20px Manrope, sans-serif";
    const width = Math.min(maxWidth, Math.max(210, ctx.measureText(label).width + 34));
    if (cursorX > x && cursorX + width > x + maxWidth) {
      cursorX = x;
      cursorY += height + gap;
    }
    drawMetaChip(ctx, cursorX, cursorY, label, width);
    cursorX += width + gap;
  });

  return cursorY + height;
}

function drawPanel(ctx, x, y, width, height, title) {
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  roundRect(ctx, x, y, width, height, 28);
  ctx.fill();
  ctx.strokeStyle = "rgba(28,57,91,0.12)";
  ctx.stroke();

  ctx.fillStyle = "#10233d";
  ctx.font = "800 28px Manrope, sans-serif";
  ctx.fillText(title, x + 28, y + 42);
}

function drawMetaChip(ctx, x, y, text, width = null) {
  ctx.font = "700 20px Manrope, sans-serif";
  const chipWidth = width ?? Math.max(250, ctx.measureText(text).width + 34);
  ctx.fillStyle = "rgba(38,128,235,0.1)";
  roundRect(ctx, x, y, chipWidth, 46, 999);
  ctx.fill();
  ctx.fillStyle = "#1763c4";
  ctx.font = "700 20px Manrope, sans-serif";
  ctx.fillText(text, x + 18, y + 30);
}

function shortenText(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function drawWinnerBadge(ctx, x, y, index) {
  ctx.fillStyle = "rgba(23,140,87,0.12)";
  roundRect(ctx, x, y, 130, 44, 999);
  ctx.fill();
  ctx.fillStyle = "#178c57";
  ctx.font = "800 20px Manrope, sans-serif";
  ctx.fillText(`${index} место`, x + 24, y + 29);
}

function drawSoftOrb(ctx, x, y, size, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, height / 2, width / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

async function drawAvatar(ctx, winner, x, y, size, allowRemoteImages) {
  if (allowRemoteImages && winner.avatarUrl) {
    const image = await loadImage(resolveAvatarSource(winner.avatarUrl));
    if (image) {
      ctx.save();
      roundRect(ctx, x, y, size, size, size / 2);
      ctx.clip();
      ctx.drawImage(image, x, y, size, size);
      ctx.restore();
      return;
    }
  }

  const base = ctx.createLinearGradient(x, y, x + size, y + size);
  base.addColorStop(0, "#dbeaff");
  base.addColorStop(1, "#dff6ed");
  ctx.fillStyle = base;
  roundRect(ctx, x, y, size, size, size / 2);
  ctx.fill();

  ctx.fillStyle = "#1763c4";
  ctx.font = "800 34px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(getInitials(winner.name), x + size / 2, y + size / 2 + 1);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function loadImage(url) {
  return new Promise(async (resolve) => {
    if (!url) {
      resolve(null);
      return;
    }

    try {
      if (/^data:|^blob:/i.test(url)) {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
        return;
      }

      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) {
        resolve(null);
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
      image.src = objectUrl;
    } catch {
      resolve(null);
    }
  });
}

function resolveAvatarSource(url) {
  if (!url) return "";
  if (/^data:|^blob:/i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=webp`;
  }
  return url;
}

function getInitials(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}

function shortUrl(url) {
  return String(url)
    .replace(/^https?:\/\/(m\.)?vk\.com\//i, "vk.com/")
    .replace(/^https?:\/\/(www\.)?/i, "");
}

function buildAvatarSvg(initials, accent, tint) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="${tint}" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="64" fill="url(#g)" />
      <circle cx="64" cy="64" r="48" fill="rgba(255,255,255,0.16)" />
      <text x="64" y="77" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="42" font-weight="800" fill="#ffffff">${initials}</text>
    </svg>
  `.trim();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  let line = "";
  let cursorY = y;
  for (let n = 0; n < words.length; n += 1) {
    const testLine = line ? `${line} ${words[n]}` : words[n];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = words[n];
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, cursorY);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function flashButton(button, label) {
  const old = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = old;
  }, 1200);
}
