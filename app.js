const STORAGE_KEY = "vk-winner-mini-app:v4";
const META_KEY = "vk-winner-mini-app:meta";
const DEFAULT_VK_APP_ID = 54620998;
const VK_IMPORT_SCOPE = "wall,groups";
const VK_API_VERSION = "5.199";
const LOCAL_API_HOSTS = new Set(["localhost", "127.0.0.1", ""]);
const MAX_IMPORT_ITEMS = 50000;
const MAX_WINNERS = 10000;
const BRIDGE_MAX_CONCURRENT = 4;
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

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const els = {
  postUrl: $("#post-url"),
  modeBox: $("#entry-mode"),
  pinnedPost: $("#pinned-post"),
  winnersCount: $("#winners-count"),
  prizeList: $("#prize-list"),
  participantsCount: $("#participants-count"),
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
  restorePostUrl: $("#restore-post-url"),
  clearPostUrl: $("#clear-post-url"),
  loadDemo: $("#load-demo"),
  checkImport: $("#check-import"),
  importVk: $("#import-vk"),
  copyReport: $("#copy-report"),
  drawWinners: $("#draw-winners"),
  downloadReport: $("#download-report"),
  downloadImages: $$("#download-image, [data-action='download-image']"),
  useSample: $("#use-sample"),
  clearParticipants: $("#clear-participants"),
  jsonFile: $("#json-file"),
  canvas: $("#export-canvas"),
  excludedWinners: $("#excluded-winners"),
  backupWinnersCount: $("#backup-winners-count"),
  enableTickets: $("#enable-tickets"),
  ticketWeightsBox: $("#ticket-weights-box"),
  weightRepost: $("#weight-repost"),
  weightComment: $("#weight-comment"),
  weightLike: $("#weight-like"),
  commentFiltersBox: $("#comment-filters-box"),
  commentKeyword: $("#comment-keyword"),
  commentRequireMention: $("#comment-require-mention"),
  minAgeBox: $("#min-age-box"),
  minAgeDays: $("#min-age-days"),
  clearExcluded: $("#clear-excluded"),
  integrityBlock: $("#integrity-block"),
  integrityHashPreview: $("#integrity-hash-preview"),
  copyHashBtn: $("#copy-hash-btn"),
  downloadStory: $("#download-story"),
  shareVk: $("#share-vk"),
  storyCanvas: $("#story-canvas"),
  backupWinnersSection: $("#backup-winners-section"),
  backupWinnersList: $("#backup-winners-list"),
  confettiCanvas: $("#confetti-canvas"),
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
    canWritePm: true,
    hasPhoto: true,
    commentText: "Участвую в конкурсе! @friend",
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
    canWritePm: true,
    hasPhoto: true,
    commentText: "Отличный розыгрыш, участвую! [id1024|Анна]",
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
    canWritePm: true,
    hasPhoto: true,
    commentText: "Приз мне!",
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
    canWritePm: false,
    hasPhoto: false,
    commentText: "спам",
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
    canWritePm: true,
    hasPhoto: true,
    commentText: "Очень жду итоги конкурса! @club",
    wallText: "Книги, работа",
  },
];

const sampleTextParticipants = sampleParticipants.map(({ avatarUrl, ...rest }) => rest);


// --- Cryptography, Audio & Visual Effects ---
let currentDrawSeed = getRandomHex(16);


function sha256Sync(str) {
  const ascii = unescape(encodeURIComponent(str));
  function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
  const mathPow = Math.pow; const maxWord = mathPow(2, 32);
  let lengthProperty = 'length'; let i, j; let result = ''; const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8; let hash = []; const k = [];
  let primeCounter = 0; const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  hash = hash.slice(0, 8); let a = ascii + '\x80';
  while ((a[lengthProperty] % 64) - 56) a += '\x00';
  for (i = 0; i < a[lengthProperty]; i++) {
    j = a.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16)); const oldHash = hash; hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 = hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0);
      const temp2 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj;
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

function getRandomHex(len = 16) {
  if (window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint8Array(len);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}



let confettiAnimId = null;
function triggerConfetti(durationMs = 3500) {
  const canvas = els.confettiCanvas;
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");
  const colors = ["#2680eb", "#178c57", "#ffbe3b", "#ff4141", "#9c27b0", "#00bcd4"];
  const pieces = [];
  for (let i = 0; i < 110; i++) {
    pieces.push({
      x: window.innerWidth * (0.2 + Math.random() * 0.6),
      y: window.innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.8) * 18,
      size: Math.random() * 8 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
    });
  }

  const startTime = Date.now();
  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);

  function loop() {
    const elapsed = Date.now() - startTime;
    if (elapsed > durationMs) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;
      p.vx *= 0.98;
      p.rotation += p.rotSpeed;
      if (elapsed > durationMs - 1000) {
        p.opacity = Math.max(0, (durationMs - elapsed) / 1000);
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    confettiAnimId = requestAnimationFrame(loop);
  }
  confettiAnimId = requestAnimationFrame(loop);
}

let demoMode = false;
let demoParticipants = [];
let importedParticipants = null;
let importedMeta = (() => {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "null"); } catch { return null; }
})();
let importServerOk = false;
let autoImportTimer = null;
let importRequestSeq = 0;
let lastState = loadState();
let lastResult = null;

initBridge();
bindEvents();
hydrateState();
recomputeAndRender();
if (canUseBackendApi()) {
  checkImportServer();
} else {
  setApiStatus(isVkLaunchContext() ? "Нажми «Подвести итоги»." : "Открой приложение внутри VK, чтобы запросить доступ к стене.");
}

function initBridge() {
  const bridge = window.vkBridge;
  if (!bridge || typeof bridge.send !== "function") return;

  bridge.send("VKWebAppInit").catch(() => {});
  bridge.send("VKWebAppSetViewSettings", { status_bar_style: "light", action_bar_color: "#f5f8fc" }).catch(() => {});
}

function syncCommentFilterVisibility() {
  if (!els.commentFiltersBox) return;
  const commentChecked = Boolean(els.modeBox.querySelector('input[value="comment"]:checked, input[value="all"]:checked'));
  els.commentFiltersBox.style.display = commentChecked ? "block" : "none";
}

function syncMinAgeVisibility() {
  if (!els.minAgeBox) return;
  const minAgeChecked = Boolean(els.filters.querySelector('[data-filter="minAgeDays"]:checked'));
  els.minAgeBox.style.display = minAgeChecked ? "block" : "none";
}

function bindEvents() {
  els.modeBox.addEventListener("change", (e) => {
    handleModeChange(e);
    syncCommentFilterVisibility();
  });
  els.filters.addEventListener("change", () => {
    syncMinAgeVisibility();
    persistAndRefresh();
  });

  if (els.enableTickets) {
    els.enableTickets.addEventListener("change", () => {
      els.ticketWeightsBox.style.display = els.enableTickets.checked ? "grid" : "none";
      persistAndRefresh();
    });
  }

  [
    els.pinnedPost,
    els.maxContests,
    els.backupWinnersCount,
    els.weightRepost,
    els.weightComment,
    els.weightLike,
    els.commentKeyword,
    els.commentRequireMention,
    els.minAgeDays,
  ].filter(Boolean).forEach((node) => node.addEventListener("input", persistAndRefresh));

  if (els.excludedWinners) {
    els.excludedWinners.addEventListener("input", persistAndRefresh);
  }
  if (els.clearExcluded) {
    els.clearExcluded.addEventListener("click", () => {
      if (els.excludedWinners) els.excludedWinners.value = "";
      persistAndRefresh();
    });
  }

  const syncPrizesAndRefresh = () => {
    renderPrizeInputs();
    persistAndRefresh();
  };
  els.winnersCount.addEventListener("input", syncPrizesAndRefresh);
  els.winnersCount.addEventListener("change", syncPrizesAndRefresh);
  els.prizeList.addEventListener("input", persistAndRefresh);

  els.postUrl.addEventListener("input", () => {
    importedParticipants = null;
    importedMeta = null;
    updatePostMemoryControls();
    persistAndRefresh();
  });
  els.restorePostUrl.addEventListener("click", () => {
    const postUrl = getRememberedPostUrl();
    if (!postUrl) return;
    importedParticipants = null;
    importedMeta = null;
    els.postUrl.value = postUrl;
    updatePostMemoryControls();
    persistAndRefresh();
  });
  els.clearPostUrl.addEventListener("click", () => {
    importedParticipants = null;
    importedMeta = null;
    els.postUrl.value = "";
    updatePostMemoryControls();
    persistAndRefresh();
  });
  els.importScanDepth.addEventListener("input", persistAndRefresh);

  els.participants.addEventListener("input", () => {
    demoMode = false;
    demoParticipants = [];
    importedParticipants = null;
    importedMeta = null;
    persistAndRefresh();
  });

  els.loadDemo.addEventListener("click", () => {
    demoMode = true;
    demoParticipants = sampleParticipants;
    importedParticipants = null;
    importedMeta = null;
    els.participants.value = "";
    persistAndRefresh();
  });

  els.useSample.addEventListener("click", () => {
    demoMode = false;
    demoParticipants = [];
    importedParticipants = null;
    importedMeta = null;
    els.participants.value = JSON.stringify(sampleTextParticipants, null, 2);
    persistAndRefresh();
  });

  els.clearParticipants.addEventListener("click", () => {
    demoMode = false;
    demoParticipants = [];
    importedParticipants = null;
    importedMeta = null;
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
      const state = collectState();
      const hasParticipants = Array.isArray(state.participantsData) && state.participantsData.length > 0;

      if (!hasParticipants && state.postUrl) {
        setApiStatus("Импортирую участников из VK...");
        await importFromVkFresh();
      } else if (!hasParticipants) {
        setApiStatus("Сначала загрузите участников или нажмите «Демо».");
        return;
      }

      // Generate fresh Provably Fair Seed for the draw
      currentDrawSeed = getRandomHex(16);
      recomputeAndRender();
      triggerConfetti(3500);

      const winCount = lastResult?.winners?.length || 0;
      const backupCount = lastResult?.backupWinners?.length || 0;
      const backupMsg = backupCount > 0 ? ` (и ${backupCount} в резерве)` : "";
      setApiStatus(`Итоги подведены! Выбрано победителей: ${winCount}${backupMsg}`);
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

  els.downloadImages.forEach((button) => {
    button.addEventListener("click", async () => {
      const result = lastResult ?? recompute();
      await downloadResultImage(result);
    });
  });

  if (els.downloadStory) {
    els.downloadStory.addEventListener("click", async () => {
      const result = lastResult ?? recompute();
      await downloadStoryImage(result);
    });
  }

  if (els.shareVk) {
    els.shareVk.addEventListener("click", async () => {
      const result = lastResult ?? recompute();
      await shareResultToVk(result);
    });
  }

  if (els.copyHashBtn) {
    els.copyHashBtn.addEventListener("click", async () => {
      if (lastResult?.integrityHash) {
        await navigator.clipboard.writeText(lastResult.integrityHash);
        flashButton(els.copyHashBtn, "Скопирован!");
      }
    });
  }

  

  els.jsonFile.addEventListener("change", async () => {
    const file = els.jsonFile.files?.[0];
    if (!file) return;
    demoMode = false;
    demoParticipants = [];
    importedParticipants = null;
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
  importedParticipants = null;
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
  if (!canUseBackendApi()) {
    importServerOk = false;
    setApiStatus(isVkLaunchContext() ? "Нажми «Подвести итоги»." : "Открой приложение внутри VK, чтобы запросить доступ к стене.");
    return { ready: false, skipped: true };
  }
  setApiStatus("Проверяю доступ...");
  try {
    const response = await fetch(apiUrl("/api/status"));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    importServerOk = Boolean(payload.ready);
    setApiStatus(payload.ready ? "Нажми «Подвести итоги»." : "Сервер не готов. Проверь токены.");
    if (!payload.ready && !silent) {
      setApiStatus("Сервер не готов. Запусти `node server.js`.");
    }
    return payload;
  } catch (error) {
    importServerOk = false;
    setApiStatus("Сервер недоступен. Запусти `node server.js`.");
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
    importedParticipants = payload.participants ?? [];
    importedMeta = payload.meta ?? null;
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
    }), canUseBackendApi() ? 1500 : 12000, "VK Bridge не ответил. Открой приложение внутри VK.");
    const grantedScopes = new Set(String(authPayload?.scope || "").split(",").map((scope) => scope.trim()));
    if (!grantedScopes.has("wall")) {
      throw new Error("VK не выдал доступ wall. Разреши доступ к стене, чтобы проверить репосты.");
    }
    return String(authPayload?.access_token || "");
  } catch (error) {
    if (!canUseBackendApi()) {
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

  if (!canUseBackendApi() && !isVkLaunchContext()) {
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
    const payload = shouldUseServerImport()
      ? await importFromServer(state, userToken)
      : await importFromVkBridge(state, userToken);
    if (payload.error) throw new Error(payload.error);
    if (requestSeq !== importRequestSeq) return;

    demoMode = false;
    demoParticipants = [];
    importedParticipants = payload.participants ?? [];
    importedMeta = payload.meta ?? null;
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
      canUseBackendApi() ? 1500 : 12000,
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
  if (!canUseBackendApi()) {
    throw new Error("Backend /api недоступен на GitHub Pages. Открой приложение внутри VK, чтобы импорт шел через VK Bridge.");
  }

  const response = await fetch(apiUrl("/api/import"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postUrl: state.postUrl,
      entryModes: state.entryModes,
      scanDepth: state.importScanDepth,
      strictPrizeHunter: Boolean(state.filters?.strictPrizeHunter),
      requirePinned: Boolean(state.pinnedPost),
      userToken,
      launchParams: getLaunchParamsString(),
    }),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  rewriteApiImageUrls(payload);
  return payload;
}

async function importFromVkBridge(state, userToken) {
  const parsed = parseWallUrl(state.postUrl);
  if (!parsed) throw new Error("Не удалось распознать ссылку на пост VK.");

  const actionMap = new Map();
  const modes = state.entryModes.includes("all") ? ["repost", "comment", "like"] : state.entryModes;
  const sourceCounts = {};
  const tasks = [];

  let officialCounts = { repost: 0, comment: 0, like: 0 };
  let debugNote = "";
  try {
    const postRes = await vkApiCall("wall.getById", {
      posts: `${parsed.ownerId}_${parsed.postId}`
    }, userToken);
    const posts = postRes?.items || postRes;
    if (posts && posts[0]) {
      const post = posts[0];
      officialCounts.repost = post.reposts?.count ?? 0;
      officialCounts.comment = post.comments?.count ?? 0;
      officialCounts.like = post.likes?.count ?? 0;
      debugNote = `[VK API OK: R=${officialCounts.repost}, C=${officialCounts.comment}, L=${officialCounts.like}]`;
    } else {
      debugNote = `[VK API Empty: ${JSON.stringify(postRes)}]`;
    }
  } catch (e) {
    console.error("Failed to fetch official post counts via wall.getById", e);
    debugNote = `[VK API Error: ${e.message || e}]`;
  }

  if (modes.includes("repost")) {
    tasks.push(async () => {
      setApiStatus("Собираю репосты из VK...");
      const data = await getBridgeRepostData(parsed, userToken);
      sourceCounts.repost = Math.max(data.total, officialCounts.repost);
      data.ids.forEach((id) => ensureActionRow(actionMap, id).repost = true);
    });
  }

  if (modes.includes("comment")) {
    tasks.push(async () => {
      setApiStatus("Собираю комментарии из VK...");
      const data = await paginateVkBridgeIdsDetailed((offset, count) =>
        vkApiCall("wall.getComments", {
          owner_id: parsed.ownerId,
          post_id: parsed.postId,
          count,
          offset,
          sort: "desc",
        }, userToken),
      );
      sourceCounts.comment = Math.max(data.total, officialCounts.comment);
      data.ids.forEach((id) => ensureActionRow(actionMap, id).comment = true);
      if (Array.isArray(data.items)) {
        data.items.forEach((c) => {
          if (c.from_id && c.text) {
            const r = ensureActionRow(actionMap, c.from_id);
            if (!r.commentText) r.commentText = String(c.text);
          }
        });
      }
    });
  }

  if (modes.includes("like")) {
    tasks.push(async () => {
      setApiStatus("Собираю лайки из VK...");
      const data = await paginateVkBridgeIdsDetailed((offset, count) =>
        vkApiCall("likes.getList", {
          type: "post",
          owner_id: parsed.ownerId,
          item_id: parsed.postId,
          filter: "likes",
          count,
          offset,
        }, userToken),
      );
      sourceCounts.like = Math.max(data.total, officialCounts.like);
      data.ids.forEach((id) => ensureActionRow(actionMap, id).like = true);
    });
  }

  await runBridgeLimited(tasks, Math.min(BRIDGE_MAX_CONCURRENT, tasks.length || 1));

  const payload = buildBridgeImportPayload({
    state,
    parsed,
    actionMap,
    selectedModes: modes,
    sourceCounts,
    userToken,
  });

  return payload;
}

function getApiBaseUrl() {
  return String(window.VK_WINNER_API_BASE_URL || "").replace(/\/+$/, "");
}

function apiUrl(path) {
  return `${getApiBaseUrl()}${path}`;
}

function canUseBackendApi() {
  if (getApiBaseUrl()) return true;
  if (window.location.protocol === "file:") return false;
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith("github.io") || host.includes("vk-apps.com") || host.includes("userapi.com")) {
    return false;
  }
  return true;
}

function shouldUseServerImport() {
  return canUseBackendApi() && importServerOk;
}

function getLaunchParamsString() {
  return getLaunchParams().toString();
}

function rewriteApiImageUrls(payload) {
  if (!Array.isArray(payload?.participants)) return;
  payload.participants.forEach((participant) => {
    if (participant.avatarUrl) {
      participant.avatarUrl = extractCleanImageUrl(participant.avatarUrl);
    }
  });
}

async function buildBridgeImportPayload({ state, parsed, actionMap, selectedModes, sourceCounts = {}, userToken }) {
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
        sourceCounts,
        totalParticipants: totalFromSourceCounts(sourceCounts, 0),
        clientBridgeImport: true,
        note: "Участники по выбранным условиям не найдены.",
      },
    };
  }

  setApiStatus(`VK найдено ID: ${ids.length}. Загружаю профили...`);
  const groupId = parsed.ownerId < 0 ? Math.abs(parsed.ownerId) : null;
  const strictPrizeHunter = Boolean(state.filters?.strictPrizeHunter);
  const requirePinned = Boolean(state.pinnedPost);
  // For pinned check, count=5 is enough: VK always returns the pinned post first with is_pinned=1
  const wallScanDepth = strictPrizeHunter ? state.importScanDepth : 5;
  const [users, memberMap, wallMap] = await Promise.all([
    getBridgeUsers(ids, userToken),
    groupId ? getBridgeMemberMap(groupId, ids, userToken) : new Map(),
    (strictPrizeHunter || requirePinned) ? getBridgeWallSignals(ids, wallScanDepth, userToken, parsed.ownerId, parsed.postId) : new Map(),
  ]);

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
      canWritePm: user.canWritePm ?? null,
      commentText: actionMap.get(user.id)?.commentText || "",
      hasPinnedTargetPost: wallSignals.hasPinnedTargetPost ?? null,
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
      sourceCounts,
      totalParticipants: totalFromSourceCounts(sourceCounts, participants.length),
      scanDepth: state.importScanDepth,
      clientBridgeImport: true,
      repostImportAvailable: true,
      strictPrizeHunter,
    },
  };
}

async function getBridgeRepostIds(parsed, userToken) {
  return (await getBridgeRepostData(parsed, userToken)).ids;
}

async function getBridgeRepostData(parsed, userToken) {
  const [copiesIds, wallIds] = await Promise.all([
    paginateVkBridgeIdsDetailed((offset, count) =>
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

  const ids = Array.from(new Set([...copiesIds.ids, ...wallIds.ids]));
  return { ids, total: Math.max(ids.length, copiesIds.total, wallIds.total) };
}

async function fetchBridgeWallRepostIds(parsed, userToken, pageSize = 100, maxItems = MAX_IMPORT_ITEMS) {
  const results = [];
  let offset = 0;
  let total = null;
  while (offset < maxItems) {
    const count = Math.min(pageSize, maxItems - offset);
    const data = await safeVkApiCall("wall.getReposts", {
      owner_id: parsed.ownerId,
      post_id: parsed.postId,
      count,
      offset,
    }, userToken);
    if (!data) break;
    if (Number.isFinite(data.count)) total = data.count;
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) break;
    const pageIds = items
      .map((item) => Number(item.owner_id))
      .filter((id) => Number.isInteger(id) && id > 0);
    results.push(...pageIds);
    if (items.length < count || (Number.isFinite(total) && offset + items.length >= total)) break;
    offset += items.length;
  }
  const ids = Array.from(new Set(results)).slice(0, maxItems);
  return { ids, total: Math.max(ids.length, total || 0) };
}

async function getBridgeUsers(ids, userToken) {
  const rows = [];
  await runBridgeLimited(
    chunkItems(ids, 100).map((batch) => async () => {
      const data = await vkApiCall("users.get", {
        user_ids: batch.join(","),
        fields: [
          "counters",
          "domain",
          "photo_50",
          "photo_100",
          "photo_200",
          "has_photo",
          "can_write_private_message",
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
          canWritePm: user.can_write_private_message === 1,
          hasPhoto: user.has_photo === 1,
          isPrivate: Boolean(user.is_closed),
          bioText: [user.about, user.status].filter(Boolean).join(" ").trim(),
        });
      });
    }),
    BRIDGE_MAX_CONCURRENT,
  );
  return rows;
}

async function getBridgeMemberMap(groupId, ids, userToken) {
  const result = new Map();
  setApiStatus("Проверяю подписку на сообщество...");

  await runBridgeLimited(
    chunkItems(ids, 500).map((batch) => async () => {
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
    }),
    BRIDGE_MAX_CONCURRENT,
  );
  return result;
}

/**
 * Recursively searches copy_history (and nested copy_history entries) for a post
 * that matches the given targetOwnerId + targetPostId.
 * VK sometimes nests reposts (repost of a repost), so we need to go deeper.
 */
function copyHistoryContainsTarget(copyHistory, targetOwnerId, targetPostId) {
  if (!Array.isArray(copyHistory)) return false;
  for (const copy of copyHistory) {
    const oid = Number(copy.owner_id);
    // VK uses both 'id' and 'post_id' in copy_history entries depending on context
    const pid = Number(copy.id ?? copy.post_id);
    if (oid === Number(targetOwnerId) && pid === Number(targetPostId)) return true;
    // Recurse into nested copy_history
    if (Array.isArray(copy.copy_history) && copy.copy_history.length > 0) {
      if (copyHistoryContainsTarget(copy.copy_history, targetOwnerId, targetPostId)) return true;
    }
  }
  return false;
}

/**
 * Returns true if the given wall post is, or contains, the target contest post:
 *  - direct copy_history match (recursive)
 *  - text contains the wall-link pattern like "-123456_789"
 */
function postIsRepostOfTarget(post, targetOwnerId, targetPostId) {
  if (targetOwnerId === undefined || targetPostId === undefined) return false;
  if (Array.isArray(post.copy_history) && post.copy_history.length > 0) {
    if (copyHistoryContainsTarget(post.copy_history, targetOwnerId, targetPostId)) return true;
  }
  // Fallback: text contains the wall-link pattern (e.g. shared via repost with link)
  if (String(post.text || "").includes(`${targetOwnerId}_${targetPostId}`)) return true;
  return false;
}

async function getBridgeWallSignals(ids, scanDepth, userToken, targetOwnerId, targetPostId) {
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
      let hasPinnedTargetPost = false;
      const wallTexts = [];

      // Separate pinned post from regular posts
      const pinnedPost = items.find((p) => p.is_pinned === 1);
      // The first non-pinned post (i.e. the topmost regular post)
      const firstRegularPost = items.find((p) => p.is_pinned !== 1);

      if (targetOwnerId !== undefined && targetPostId !== undefined) {
        // PRIMARY: check if the pinned post is a repost of the contest post
        if (pinnedPost && postIsRepostOfTarget(pinnedPost, targetOwnerId, targetPostId)) {
          hasPinnedTargetPost = true;
        }
        // SECONDARY: if there is NO pinned post at all, check if the topmost
        // regular post is a repost of the contest (user kept it at top manually)
        if (!hasPinnedTargetPost && !pinnedPost && firstRegularPost) {
          if (postIsRepostOfTarget(firstRegularPost, targetOwnerId, targetPostId)) {
            hasPinnedTargetPost = true;
          }
        }
      }

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
        hasPinnedTargetPost,
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

async function paginateVkBridgeIds(fetchPage, pageSize = 100, maxItems = MAX_IMPORT_ITEMS) {
  return (await paginateVkBridgeIdsDetailed(fetchPage, pageSize, maxItems)).ids;
}

async function paginateVkBridgeIdsDetailed(fetchPage, pageSize = 100, maxItems = MAX_IMPORT_ITEMS) {
  const results = [];
  let offset = 0;
  let total = null;
  while (offset < maxItems) {
    const count = Math.min(pageSize, maxItems - offset);
    const data = await fetchPage(offset, count);
    if (Number.isFinite(data?.count)) total = data.count;
    const page = Array.isArray(data) ? data : data?.items || [];
    if (!page.length) break;
    results.push(...extractVkIdsFromPage(page));
    offset += page.length;
    if (page.length < count || (Number.isFinite(total) && offset >= total)) break;
  }
  const ids = Array.from(new Set(results.filter((id) => Number.isInteger(id) && id > 0))).slice(0, maxItems);
  return { ids, total: Math.max(ids.length, total || 0), items: results };
}

function extractVkIdsFromPage(page) {
  return page
    .map((item) => {
      if (Number.isInteger(item)) return item;
      const fromId = Number(item?.from_id);
      if (Number.isInteger(fromId) && fromId > 0) return fromId;
      const ownerId = Number(item?.owner_id);
      if (Number.isInteger(ownerId) && ownerId > 0) return ownerId;
      const id = Number(item?.id);
      return Number.isInteger(id) && id > 0 ? id : null;
    })
    .filter((id) => Number.isInteger(id) && id > 0);
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
  els.postUrl.value = "";
  els.pinnedPost.checked = lastState.pinnedPost ?? true;
  els.winnersCount.value = String(lastState.winnersCount ?? 3);
  if (els.backupWinnersCount) els.backupWinnersCount.value = String(lastState.backupWinnersCount ?? 0);
  if (els.enableTickets) {
    els.enableTickets.checked = Boolean(lastState.enableTickets);
    if (els.ticketWeightsBox) els.ticketWeightsBox.style.display = els.enableTickets.checked ? "grid" : "none";
  }
  if (els.weightRepost) els.weightRepost.value = String(lastState.weightRepost ?? 3);
  if (els.weightComment) els.weightComment.value = String(lastState.weightComment ?? 2);
  if (els.weightLike) els.weightLike.value = String(lastState.weightLike ?? 1);
  if (els.commentKeyword) els.commentKeyword.value = lastState.commentKeyword ?? "";
  if (els.commentRequireMention) els.commentRequireMention.checked = Boolean(lastState.commentRequireMention);
  if (els.minAgeDays) els.minAgeDays.value = String(lastState.minAgeDays ?? 30);

  renderPrizeInputs(normalizePrizeList(lastState.prizes, lastState.prizeText));
  els.importScanDepth.value = String(lastState.importScanDepth ?? 60);
  els.maxContests.value = String(lastState.maxContests ?? 3);
  els.participants.value = lastState.participantsText ?? "";
  if (els.excludedWinners) els.excludedWinners.value = lastState.excludedWinnersText ?? "";
  updatePostMemoryControls();
  syncCommentFilterVisibility();
  syncMinAgeVisibility();

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

function getRememberedPostUrl() {
  return String(lastState.recentPostUrl || lastState.postUrl || "").trim();
}

function updatePostMemoryControls() {
  const rememberedPostUrl = getRememberedPostUrl();
  const hasCurrentPostUrl = Boolean(els.postUrl.value.trim());
  els.restorePostUrl.disabled = !rememberedPostUrl || els.postUrl.value.trim() === rememberedPostUrl;
  els.clearPostUrl.disabled = !hasCurrentPostUrl;
  els.restorePostUrl.title = rememberedPostUrl || "";
}

function normalizePrizeList(prizes, legacyPrizeText = "") {
  const list = Array.isArray(prizes) ? prizes.map((item) => String(item || "").trim()) : [];
  if (!list.length && legacyPrizeText) list.push(String(legacyPrizeText).trim());
  return list;
}

function getCurrentPrizes() {
  return $$(".prize-input", els.prizeList).map((input) => input.value.trim());
}

function getPrizeFieldCount() {
  return clampInt(els.winnersCount.value, 1, MAX_WINNERS, 3);
}

function ensurePrizeInputCount() {
  if (els.prizeList.children.length !== getPrizeFieldCount()) {
    renderPrizeInputs();
  }
}

function renderPrizeInputs(prizes = getCurrentPrizes()) {
  const count = getPrizeFieldCount();
  const shouldApplyValues = arguments.length > 0;

  while (els.prizeList.children.length > count) {
    els.prizeList.lastElementChild.remove();
  }

  for (let index = 0; index < count; index += 1) {
    const place = index + 1;
    let row = els.prizeList.children[index];

    if (!row) {
      row = document.createElement("label");
      row.className = "prize-row";
      row.innerHTML = '<span></span><input class="prize-input" type="text" autocomplete="off" />';
      els.prizeList.appendChild(row);
    }

    const label = row.querySelector("span");
    const input = row.querySelector(".prize-input");
    label.textContent = `${place} место`;
    input.placeholder = `Приз для ${place} места`;
    if (shouldApplyValues || !input.dataset.ready) {
      input.value = prizes[index] || "";
      input.dataset.ready = "true";
    }
  }
}

function saveState() {
  const state = collectState();
  const { participantsData, importMeta, ...persistable } = state;
  persistable.recentPostUrl = state.postUrl || getRememberedPostUrl();
  persistable.postUrl = "";
  if (importedParticipants) {
    persistable.participantsText = "";
  }
  lastState = persistable;
  updatePostMemoryControls();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    if (importedMeta) {
      localStorage.setItem(META_KEY, JSON.stringify(importedMeta));
    } else {
      localStorage.removeItem(META_KEY);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(META_KEY);
  }
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      postUrl: "",
      recentPostUrl: "",
      entryModes: ["repost", "comment", "like"],
      pinnedPost: true,
      winnersCount: 3,
      prizeText: "",
      prizes: [],
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
      excludedWinnersText: "",
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {
      postUrl: "",
      recentPostUrl: "",
      entryModes: ["repost", "comment", "like"],
      pinnedPost: true,
      winnersCount: 3,
      prizeText: "",
      prizes: [],
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
      excludedWinnersText: "",
    };
  }
}

/**
 * Parses lines from the "exclude past winners" textarea into a Set of
 * normalized identifiers (numeric IDs and VK screen-name slugs).
 * Accepts lines like:
 *   https://vk.com/id12345
 *   https://vk.com/some_name
 *   id12345
 *   12345
 */
function parseExcludedWinners(text) {
  const set = new Set();
  if (!text) return set;
  for (const line of text.split(/[\n,;]+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Extract slug from URL: vk.com/id123 or vk.com/name
    const urlMatch = trimmed.match(/vk\.com\/([^/?&#\s]+)/i);
    const slug = urlMatch ? urlMatch[1] : trimmed;
    // numeric id
    const numMatch = slug.match(/^id(\d+)$/i);
    if (numMatch) {
      set.add(numMatch[1]); // store as string "123"
    } else if (/^\d+$/.test(slug)) {
      set.add(slug);
    } else {
      set.add(slug.toLowerCase()); // screen name
    }
  }
  return set;
}

function collectState() {
  const entryModes = $$('input[type="checkbox"]', els.modeBox)
    .filter((box) => box.checked)
    .map((box) => box.value);

  const filters = {};
  $$('#filters input[type="checkbox"]').forEach((box) => {
    filters[box.dataset.filter] = box.checked;
  });
  ensurePrizeInputCount();
  const winnersCount = getPrizeFieldCount();
  const prizes = getCurrentPrizes().slice(0, winnersCount);

  const excludedWinnersText = els.excludedWinners ? els.excludedWinners.value.trim() : "";
  const backupWinnersCount = els.backupWinnersCount ? clampInt(els.backupWinnersCount.value, 0, 100, 0) : 0;
  const enableTickets = Boolean(els.enableTickets?.checked);
  const weightRepost = els.weightRepost ? clampInt(els.weightRepost.value, 1, 100, 3) : 3;
  const weightComment = els.weightComment ? clampInt(els.weightComment.value, 1, 100, 2) : 2;
  const weightLike = els.weightLike ? clampInt(els.weightLike.value, 1, 100, 1) : 1;
  const commentKeyword = els.commentKeyword ? els.commentKeyword.value.trim() : "";
  const commentRequireMention = Boolean(els.commentRequireMention?.checked);
  const minAgeDays = els.minAgeDays ? clampInt(els.minAgeDays.value, 1, 5000, 30) : 30;

  return {
    postUrl: els.postUrl.value.trim(),
    entryModes: entryModes.length ? entryModes : ["repost", "comment", "like"],
    pinnedPost: els.pinnedPost.checked,
    winnersCount,
    backupWinnersCount,
    enableTickets,
    weightRepost,
    weightComment,
    weightLike,
    commentKeyword,
    commentRequireMention,
    minAgeDays,
    prizeText: prizes.find(Boolean) || "",
    prizes,
    importScanDepth: clampInt(els.importScanDepth.value, 10, 200, 60),
    filters,
    maxContests: clampInt(els.maxContests.value, 0, 1000, 3),
    participantsText: demoMode || importedParticipants ? "" : els.participants.value,
    participantsData: demoMode ? demoParticipants : importedParticipants ?? parseParticipants(els.participants.value),
    importMeta: importedMeta || null,
    excludedWinnersText,
    excludedWinners: parseExcludedWinners(excludedWinnersText),
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

  eligible.forEach((p) => {
    if (state.enableTickets) {
      let t = 0;
      if (p.actions?.repost) t += state.weightRepost;
      if (p.actions?.comment) t += state.weightComment;
      if (p.actions?.like) t += state.weightLike;
      p.tickets = Math.max(1, t);
    } else {
      p.tickets = 1;
    }
  });

  const winnerCount = Math.min(state.winnersCount, eligible.length);
  let winners = [];
  let backupWinners = [];

  if (state.enableTickets) {
    const pool = [...eligible];
    winners = weightedPickWithoutReplacement(pool, winnerCount);
    const backupTarget = Math.min(state.backupWinnersCount, pool.length);
    backupWinners = weightedPickWithoutReplacement(pool, backupTarget);
  } else {
    const shuffled = shuffle([...eligible]);
    winners = shuffled.slice(0, winnerCount);
    const backupTarget = Math.min(state.backupWinnersCount, Math.max(0, shuffled.length - winnerCount));
    backupWinners = shuffled.slice(winnerCount, winnerCount + backupTarget);
  }

  const reasonCounts = tallyReasons(excluded);

  const eligibleIdsStr = eligible.map((p) => String(p.id)).sort().join(",");
  const integrityPayload = `seed:${currentDrawSeed}|post:${state.postUrl}|modes:${requiredActions.join(',')}|eligible:${eligibleIdsStr}`;
  const integrityHash = sha256Sync(integrityPayload);

  // Участников всего = минимум из сырых счётчиков VK API по каждому условию.
  // Например: 11 лайков, 9 комментов, 10 репостов → 9.
  // Это самый точный показатель: VK знает точное кол-во, а загруженные профили могут быть неполными.
  const importMeta = state.importMeta || {};
  let totalParticipants;
  if (importMeta.sourceCounts && Object.keys(importMeta.sourceCounts).length > 0) {
    // Берём только счётчики для выбранных режимов
    const relevantCounts = requiredActions
      .map((action) => importMeta.sourceCounts[action])
      .filter(Number.isFinite);
    totalParticipants = relevantCounts.length > 0
      ? Math.min(...relevantCounts)
      : evaluated.filter((item) => requiredActions.every((a) => item.actions?.[a] === true)).length;
  } else {
    // Если sourceCounts недоступны — считаем из загруженных данных
    totalParticipants = evaluated.filter((item) =>
      requiredActions.every((action) => item.actions?.[action] === true)
    ).length;
  }

  return {
    ...state,
    participants: evaluated,
    eligible,
    excluded,
    winners,
    backupWinners,
    integrityHash,
    integritySeed: currentDrawSeed,
    reasonCounts,
    totalParticipants,
    requiredActions,
  };
}

function getTotalParticipantsCount(result) {
  const meta = result.importMeta || {};
  if (meta.sourceCounts && Object.keys(meta.sourceCounts).length > 0) {
    const minCount = totalFromSourceCounts(meta.sourceCounts, result.participants?.length || 0);
    return minCount;
  }
  if (toNum(meta.totalParticipants) > 0) {
    return toNum(meta.totalParticipants);
  }
  return result.participants?.length || 0;
}

function totalFromSourceCounts(sourceCounts, fallback) {
  const counts = Object.values(sourceCounts || {}).filter(Number.isFinite);
  if (counts.length === 0) return fallback;
  return Math.min(...counts);
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
      hasPinnedTargetPost: null,
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
    canWritePm: participant.canWritePm !== undefined ? Boolean(participant.canWritePm) : null,
    commentText: String(participant.commentText || ""),
    hasPinnedTargetPost: toBool(participant.hasPinnedTargetPost),
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

  // Check excluded past winners first
  if (state.excludedWinners && state.excludedWinners.size > 0) {
    const pid = String(participant.id || "");
    // Also extract screen name from profileUrl if present
    const profileUrl = String(participant.profileUrl || "");
    const urlSlugMatch = profileUrl.match(/vk\.com\/([^/?&#\s]+)/i);
    const screenSlug = urlSlugMatch ? urlSlugMatch[1].toLowerCase() : null;
    const idSlugFromUrl = screenSlug ? (screenSlug.match(/^id(\d+)$/i)?.[1] ?? null) : null;

    const isExcluded =
      state.excludedWinners.has(pid) ||
      (screenSlug && state.excludedWinners.has(screenSlug)) ||
      (idSlugFromUrl && state.excludedWinners.has(idSlugFromUrl));

    if (isExcluded) {
      reasons.push("прошлый победитель");
    }
  }

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

  if (filters.requireOpenPm && participant.canWritePm === false) {
    reasons.push("закрыты ЛС");
  }

  if (filters.minAgeDays && participant.ageDays !== null && participant.ageDays < state.minAgeDays) {
    reasons.push(`аккаунт свежий (${participant.ageDays}д < ${state.minAgeDays}д)`);
  }

  if (state.commentKeyword && participant.actions?.comment) {
    const text = String(participant.commentText || "").toLowerCase();
    if (!text.includes(state.commentKeyword.toLowerCase())) {
      reasons.push(`нет слова "${state.commentKeyword}"`);
    }
  }

  if (state.commentRequireMention && participant.actions?.comment) {
    const text = String(participant.commentText || "");
    const hasMention = /@|\[id\d+\|/i.test(text);
    if (!hasMention) {
      reasons.push("нет отметки друга");
    }
  }

  if (state.pinnedPost) {
    // Only disqualify if we actually fetched wall data and pin was definitively absent.
    // null means wall wasn't fetched (e.g. no strictPrizeHunter and requirePinned was off during that import).
    if (participant.hasPinnedTargetPost === false) {
      reasons.push("нет закрепленного поста");
    }
    // Do NOT disqualify for null — that would unfairly penalize people whose walls weren't scanned.
  }

  const strictPrizeHunter = Boolean(filters.strictPrizeHunter);

  if (strictPrizeHunter && participant.wallContestCount !== null && participant.wallContestCount > state.maxContests) {
    reasons.push(`конкурсов на стене ${participant.wallContestCount} > ${state.maxContests}`);
  }

  return [...new Set(reasons)];
}


function weightedPickWithoutReplacement(pool, count) {
  const selected = [];
  for (let step = 0; step < count; step++) {
    if (!pool.length) break;
    const totalWeight = pool.reduce((acc, curr) => acc + (curr.tickets || 1), 0);
    if (totalWeight <= 0) break;
    let rand = Math.random() * totalWeight;
    for (let i = 0; i < pool.length; i++) {
      rand -= (pool[i].tickets || 1);
      if (rand <= 0 || i === pool.length - 1) {
        selected.push(pool[i]);
        pool.splice(i, 1);
        break;
      }
    }
  }
  return selected;
}

function renderBackupWinners(result) {
  if (!els.backupWinnersSection || !els.backupWinnersList) return;
  const backups = result.backupWinners || [];
  if (!backups.length) {
    els.backupWinnersSection.style.display = "none";
    els.backupWinnersList.innerHTML = "";
    return;
  }

  els.backupWinnersSection.style.display = "block";
  els.backupWinnersList.innerHTML = backups
    .map((winner, index) => {
      const initial = getInitials(winner.name);
      const cleanAvatar = extractCleanImageUrl(winner.avatarUrl);
      const ticketPill = result.enableTickets && winner.tickets ? `<span class="ticket-badge">🎫 ${winner.tickets} ${ticketWord(winner.tickets)}</span>` : "";
      return `
        <div class="winner-card">
          ${
            cleanAvatar
              ? `<img class="avatar" src="${escapeAttr(cleanAvatar)}" alt="${escapeAttr(winner.name)}" onerror="this.onerror=null;this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='grid';" /><div class="avatar avatar-fallback" style="display:none">${escapeHtml(initial)}</div>`
              : `<div class="avatar avatar-fallback">${escapeHtml(initial)}</div>`
          }
          <div class="winner-meta">
            <div class="winner-name">${escapeHtml(winner.name)} ${ticketPill}</div>
            <div class="winner-sub">id${escapeHtml(winner.id)} · ${escapeHtml(shortUrl(winner.profileUrl))}</div>
          </div>
          <div class="winner-status backup-badge">Резерв #${index + 1}</div>
        </div>
      `;
    })
    .join("");
}

function ticketWord(num) {
  const n = Math.abs(num) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "билетов";
  if (n1 > 1 && n1 < 5) return "билета";
  if (n1 === 1) return "билет";
  return "билетов";
}

function render(result) {
  els.participantsCount.textContent = String(result.totalParticipants);
  els.eligibleCount.textContent = String(result.eligible.length);
  els.excludedCount.textContent = String(result.excluded.length);

  if (els.integrityHashPreview) {
    els.integrityHashPreview.textContent = result.integrityHash ? `SHA-256: ${result.integrityHash}` : "Хэш формируется при розыгрыше";
    els.integrityHashPreview.title = result.integrityHash ? `Seed: ${result.integritySeed}\nPayload SHA-256: ${result.integrityHash}` : "";
  }

  els.reportPreview.textContent = buildReportText(result);

  renderWinners(result);
  renderBackupWinners(result);
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
      const cleanAvatar = extractCleanImageUrl(winner.avatarUrl);
      const ticketPill = result.enableTickets && winner.tickets ? `<span class="ticket-badge">🎫 ${winner.tickets} ${ticketWord(winner.tickets)}</span>` : "";
      return `
        <div class="winner-card">
          ${
            cleanAvatar
              ? `<img class="avatar" src="${escapeAttr(cleanAvatar)}" alt="${escapeAttr(winner.name)}" onerror="this.onerror=null;this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='grid';" /><div class="avatar avatar-fallback" style="display:none">${escapeHtml(initial)}</div>`
              : `<div class="avatar avatar-fallback">${escapeHtml(initial)}</div>`
          }
          <div class="winner-meta">
            <div class="winner-name">${escapeHtml(winner.name)} ${ticketPill}</div>
          <div class="winner-sub">id${escapeHtml(winner.id)} · ${escapeHtml(shortUrl(winner.profileUrl))}</div>
          </div>
          <div class="winner-status">${index + 1} место</div>
        </div>
      `;
    })
    .join("");
}

function renderAudit(result) {
  if (!els.auditLog) return;
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
    "🎉 Итоги конкурса",
    "",
    `🔗 Пост: ${result.postUrl || "не указан"}`,
  ];

  lines.push("", result.winners.length > 1 ? "🏆 Победители:" : "🏆 Победитель:");

  if (result.winners.length) {
    result.winners.forEach((winner, index) => {
      const prize = getPrizeForPlace(result, index);
      const ticketsInfo = result.enableTickets && winner.tickets ? ` (🎫 ${winner.tickets} ${ticketWord(winner.tickets)})` : "";
      lines.push(`${index + 1}. [id${winner.id}|${winner.name}]${ticketsInfo} - ${winner.profileUrl}${prize ? ` - 🎁 ${prize}` : ""}`);
    });
  } else {
    lines.push("Пока не выбран");
  }

  if (result.backupWinners && result.backupWinners.length > 0) {
    lines.push("", "📋 Резервные победители:");
    result.backupWinners.forEach((backup, index) => {
      lines.push(`Резерв #${index + 1}: [id${backup.id}|${backup.name}] - ${backup.profileUrl}`);
    });
  }

  if (result.integrityHash) {
    lines.push("", `🛡️ Контроль честности (SHA-256): ${result.integrityHash}`);
    lines.push(`🎲 Зерно (Seed): ${result.integritySeed || ""}`);
  }

  lines.push("", "✨ Подведено с помощью: Рандомайзер для конкурсов");

  return lines.join("\n");
}

function getPrizeForPlace(result, index) {
  const prizes = Array.isArray(result.prizes) ? result.prizes : [];
  return String(prizes[index] || (!index ? result.prizeText || "" : "")).trim();
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
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 60000);
}

async function downloadResultImage(result) {
  const canvas = els.canvas;
  canvas.width = 1600;
  const backupCount = result.backupWinners?.length || 0;
  canvas.height = Math.max(1160, 680 + result.winners.length * 205 + (backupCount > 0 ? 160 : 0) + 140);
  const ctx = canvas.getContext("2d");

  const avatarImages = await Promise.all(
    result.winners.map(async (winner) => {
      if (!winner.avatarUrl) return null;
      return await loadAvatarImage(winner.avatarUrl);
    })
  );

  try {
    drawResultCanvas(ctx, result, avatarImages);
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, "vk-results.png");
  } catch (err) {
    console.warn("Canvas export fallback:", err);
    drawResultCanvas(ctx, result, []);
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
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 60000);
}

function drawResultCanvas(ctx, result, avatarImages = []) {
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
  ctx.fillText(String(result.totalParticipants), statsX + 36, panelY + 88);
  ctx.fillText(`${result.winners.length}/${result.winnersCount}`, statsX + 250, panelY + 88);
  ctx.font = "600 18px Manrope, sans-serif";
  ctx.fillStyle = "#5f708a";
  ctx.fillText("участников всего", statsX + 36, panelY + 124);
  ctx.fillText("победителей", statsX + 250, panelY + 124);

  const winnersPanelY = panelY + 220;
  const rowHeight = 172;
  const rowStep = 202;
  drawPanel(ctx, 70, winnersPanelY, w - 140, Math.max(430, result.winners.length * rowStep + 70), "Победители");
  const startY = winnersPanelY + 85;
  for (let i = 0; i < result.winners.length; i += 1) {
    const winner = result.winners[i];
    const prize = getPrizeForPlace(result, i);
    const rowY = startY + i * rowStep;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 100, rowY, w - 200, rowHeight, 24);
    ctx.fill();
    ctx.strokeStyle = "rgba(28,57,91,0.12)";
    ctx.stroke();

    const avatarImage = avatarImages[i] || null;
    drawAvatar(ctx, winner, avatarImage, 128, rowY + 24, 104);

    ctx.fillStyle = "#10233d";
    ctx.font = "800 30px Manrope, sans-serif";
    const ticketInfo = result.enableTickets && winner.tickets ? ` (🎫 ${winner.tickets} ${ticketWord(winner.tickets)})` : "";
    ctx.fillText(`${winner.name}${ticketInfo}`, 260, rowY + 56);

    ctx.font = "600 20px Manrope, sans-serif";
    ctx.fillStyle = "#5f708a";
    ctx.fillText(`id${winner.id}`, 260, rowY + 90);
    ctx.fillText(shortUrl(winner.profileUrl), 260, rowY + 118);
    if (prize) {
      ctx.fillStyle = "#1763c4";
      ctx.font = "700 20px Manrope, sans-serif";
      ctx.fillText(`Приз: ${shortenText(prize, 72)}`, 260, rowY + 148);
    }
    drawWinnerBadge(ctx, w - 270, rowY + 62, i + 1);
  }

  let nextY = startY + result.winners.length * rowStep + 40;

  // Draw backup winners on canvas if present
  if (result.backupWinners && result.backupWinners.length > 0) {
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, 70, nextY, w - 140, 110, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(240,141,47,0.3)";
    ctx.stroke();

    ctx.fillStyle = "#e07810";
    ctx.font = "800 22px Manrope, sans-serif";
    ctx.fillText("📋 Резервные победители:", 100, nextY + 44);

    ctx.fillStyle = "#5f708a";
    ctx.font = "600 19px Manrope, sans-serif";
    const backupLine = result.backupWinners.map((b, idx) => `#${idx + 1} ${b.name} (id${b.id})`).join("   ·   ");
    ctx.fillText(shortenText(backupLine, 95), 100, nextY + 80);

    nextY += 140;
  }

  // Provably Fair SHA-256 footer
  const footerY = Math.max(1110, nextY + 10);
  ctx.fillStyle = "#5f708a";
  ctx.font = "600 19px Manrope, sans-serif";
  const hashNote = result.integrityHash ? ` · SHA-256: ${shortenText(result.integrityHash, 32)}` : "";
  ctx.fillText(`Рандомайзер для конкурсов. Участников: ${result.totalParticipants}${hashNote}`, 70, footerY);
}

function drawMetaChips(ctx, x, y, maxWidth, labels) {
  let cursorX = x;
  let cursorY = y;
  const gap = 14;
  const height = 46;

  labels.forEach((label) => {
    ctx.font = "700 20px Manrope, sans-serif";
    const width = Math.min(maxWidth, Math.max(96, ctx.measureText(label).width + 34));
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
  const chipWidth = width ?? Math.max(96, ctx.measureText(text).width + 34);
  ctx.fillStyle = "rgba(38,128,235,0.1)";
  roundRect(ctx, x, y, chipWidth, 46, 999);
  ctx.fill();
  ctx.fillStyle = "#1763c4";
  ctx.font = "700 20px Manrope, sans-serif";
  ctx.fillText(text, x + 18, y + 30);
}

function shortenText(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
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

function drawAvatar(ctx, winner, avatarImage, x, y, size) {
  if (avatarImage) {
    try {
      ctx.save();
      roundRect(ctx, x, y, size, size, size / 2);
      ctx.clip();
      ctx.drawImage(avatarImage, x, y, size, size);
      ctx.restore();
      return;
    } catch (e) {
      console.warn("Failed to render avatar image:", e);
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

function extractCleanImageUrl(rawUrl) {
  if (!rawUrl) return "";
  let url = String(rawUrl).trim();
  while (url.includes("url=")) {
    try {
      const match = url.match(/[?&]url=([^&]+)/);
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1]);
        if (/^https?:\/\//i.test(decoded)) {
          url = decoded;
          continue;
        }
      }
    } catch {}
    break;
  }
  return url;
}

function getCandidateAvatarUrls(rawUrl) {
  const cleanUrl = extractCleanImageUrl(rawUrl);
  if (!cleanUrl) return [];
  if (/^data:|^blob:/i.test(cleanUrl)) return [cleanUrl];

  const candidates = [];

  // 1. Backend proxy if actively verified ready or configured
  if (canUseBackendApi() && (importServerOk || getApiBaseUrl())) {
    candidates.push(apiUrl(`/api/image?url=${encodeURIComponent(cleanUrl)}`));
  }

  // 2. wsrv.nl CDN proxy
  candidates.push(`https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}`);

  // 3. images.weserv.nl mirror
  candidates.push(`https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}`);

  // 4. Direct URL
  candidates.push(cleanUrl);

  return [...new Set(candidates)];
}

async function loadAvatarImage(rawUrl) {
  const candidates = getCandidateAvatarUrls(rawUrl);
  if (!candidates.length) return null;

  for (const candidate of candidates) {
    const img = await fetchImageSafely(candidate, 4000);
    if (img) return img;
  }
  return null;
}

async function fetchImageSafely(url, timeoutMs = 4000) {
  if (!url) return null;

  if (/^data:|^blob:/i.test(url)) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => controller && controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      mode: "cors",
      signal: controller ? controller.signal : undefined,
    });
    clearTimeout(timer);
    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob || blob.size === 0) return null;

    // Convert blob to Data URL to avoid premature URL.revokeObjectURL bugs & ensure 100% clean canvas
    const dataUrl = await blobToDataUrl(blob);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  } catch {
    clearTimeout(timer);
    // Direct Image element fallback with crossOrigin
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const imgTimer = setTimeout(() => {
        img.src = "";
        resolve(null);
      }, timeoutMs);
      img.onload = () => {
        clearTimeout(imgTimer);
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(imgTimer);
        resolve(null);
      };
      img.src = url;
    });
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("blob read error"));
    reader.readAsDataURL(blob);
  });
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


// --- Stories 9:16 Canvas Generator ---
async function downloadStoryImage(result) {
  const canvas = els.storyCanvas;
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");

  const avatarImages = await Promise.all(
    result.winners.slice(0, 5).map(async (winner) => {
      if (!winner.avatarUrl) return null;
      return await loadAvatarImage(winner.avatarUrl);
    })
  );

  await drawStoryCanvas(ctx, result, avatarImages);
  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, "vk-results-story.png");
}

async function drawStoryCanvas(ctx, result, avatarImages = []) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#0e1c31");
  bg.addColorStop(0.5, "#152a48");
  bg.addColorStop(1, "#0d1829");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  drawSoftOrb(ctx, 160, 200, 320, "rgba(38,128,235,0.22)");
  drawSoftOrb(ctx, 920, 1600, 360, "rgba(23,140,87,0.18)");

  ctx.fillStyle = "rgba(38,128,235,0.18)";
  roundRect(ctx, w / 2 - 200, 90, 400, 52, 999);
  ctx.fill();
  ctx.fillStyle = "#5ba2f8";
  ctx.font = "800 22px Manrope, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ИТОГИ РОЗЫГРЫША", w / 2, 124);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 68px Manrope, sans-serif";
  ctx.fillText("🏆 Победители", w / 2, 220);

  ctx.fillStyle = "#8fa7c7";
  ctx.font = "600 26px Manrope, sans-serif";
  const postLine = result.postUrl ? `Пост: ${shortUrl(result.postUrl)}` : "Конкурс ВКонтакте";
  ctx.fillText(shortenText(postLine, 45), w / 2, 275);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, 80, 320, w - 160, 90, 24);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 36px Manrope, sans-serif";
  ctx.fillText(String(result.totalParticipants), 240, 368);
  ctx.fillText(String(result.winners.length), w - 240, 368);
  ctx.fillStyle = "#8fa7c7";
  ctx.font = "600 20px Manrope, sans-serif";
  ctx.fillText("участников всего", 240, 395);
  ctx.fillText("победителей", w - 240, 395);
  ctx.textAlign = "start";

  const displayWinners = result.winners.slice(0, 4);
  const cardYStart = 450;
  const cardHeight = 220;
  const cardGap = 28;

  for (let i = 0; i < displayWinners.length; i++) {
    const winner = displayWinners[i];
    const prize = getPrizeForPlace(result, i);
    const cardY = cardYStart + i * (cardHeight + cardGap);

    ctx.fillStyle = "rgba(255,255,255,0.96)";
    roundRect(ctx, 80, cardY, w - 160, cardHeight, 32);
    ctx.fill();

    const avatarImg = avatarImages[i] || null;
    drawAvatar(ctx, winner, avatarImg, 116, cardY + 36, 148);

    ctx.fillStyle = "#10233d";
    ctx.font = "800 40px Manrope, sans-serif";
    ctx.fillText(shortenText(winner.name, 18), 296, cardY + 84);

    ctx.fillStyle = "#5f708a";
    ctx.font = "600 26px Manrope, sans-serif";
    ctx.fillText(`id${winner.id}`, 296, cardY + 128);

    if (prize) {
      ctx.fillStyle = "#1763c4";
      ctx.font = "700 26px Manrope, sans-serif";
      ctx.fillText(`🎁 ${shortenText(prize, 32)}`, 296, cardY + 174);
    }

    const placeBadgeX = w - 240;
    const placeBadgeY = cardY + 40;
    ctx.fillStyle = i === 0 ? "rgba(240,141,47,0.16)" : "rgba(23,140,87,0.14)";
    roundRect(ctx, placeBadgeX, placeBadgeY, 130, 48, 999);
    ctx.fill();
    ctx.fillStyle = i === 0 ? "#e07810" : "#178c57";
    ctx.font = "800 24px Manrope, sans-serif";
    ctx.fillText(`${i + 1} место`, placeBadgeX + 18, placeBadgeY + 33);
  }

  if (result.backupWinners && result.backupWinners.length > 0) {
    const backupY = cardYStart + displayWinners.length * (cardHeight + cardGap) + 10;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, 80, backupY, w - 160, 90, 20);
    ctx.fill();
    ctx.fillStyle = "#8fa7c7";
    ctx.font = "600 22px Manrope, sans-serif";
    const backupNames = result.backupWinners.slice(0, 3).map((b, idx) => `#${idx + 1} ${b.name}`).join(" · ");
    ctx.fillText(`Резерв: ${shortenText(backupNames, 46)}`, 110, backupY + 54);
  }

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  roundRect(ctx, 80, h - 220, w - 160, 130, 24);
  ctx.fill();
  ctx.fillStyle = "#5ba2f8";
  ctx.font = "700 22px Manrope, sans-serif";
  ctx.fillText("🛡️ Контроль честности (SHA-256)", 110, h - 170);
  ctx.fillStyle = "#8fa7c7";
  ctx.font = "600 18px monospace";
  ctx.fillText(result.integrityHash ? shortenText(result.integrityHash, 48) : "Provably Fair Verified", 110, h - 125);
}

// --- VK Bridge Post Sharing ---
async function shareResultToVk(result) {
  const bridge = window.vkBridge;
  const text = buildReportText(result);

  if (bridge && typeof bridge.send === "function") {
    try {
      await bridge.send("VKWebAppShowWallPostBox", { message: text });
      return;
    } catch (e) {
      console.warn("VKWebAppShowWallPostBox failed, falling back to copy", e);
    }
  }

  await navigator.clipboard.writeText(text);
  if (els.shareVk) flashButton(els.shareVk, "Текст скопирован!");
}

