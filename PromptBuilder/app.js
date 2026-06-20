const STORAGE_KEY = "prompt-dock-v1";
const THEME_KEY = "prompt-dock-theme";
const CLOUD_SAVE_DELAY = 700;
const DEFAULT_SETTINGS = {
  hoverPreview: true,
  blobWeeklyBackup: false,
  favoritesCollapsed: false,
  popularCollapsed: false,
  archiveCollapsed: false,
};
const PLATFORM_ORDER = ["Any", "Perplexity", "ChatGPT", "Gemini", "Claude", "Other"];
const PLATFORM_BY_TYPE = {
  text_prompt: "Any",
  gpt: "ChatGPT",
  gem: "Gemini",
};
const LEGACY_PLATFORM_MAP = {
  GPTs: "ChatGPT",
  Gems: "Gemini",
};
const SEARCH_SCOPES = [
  { key: "title", label: "제목" },
  { key: "tags", label: "태그" },
  { key: "body", label: "내용" },
  { key: "prompt", label: "프롬프트" },
];
const DEFAULT_CATEGORIES = ["요약", "글쓰기", "리서치", "업무", "코딩", "마케팅", "이미지", "학습"];

const platformClass = {
  Any: "platform-any",
  Perplexity: "platform-perplexity",
  ChatGPT: "platform-chatgpt",
  Gemini: "platform-gemini",
  Claude: "platform-claude",
  Other: "platform-other",
};

const tagAliases = {
  요약: ["summary", "summarize", "brief", "정리"],
  회의: ["meeting", "minutes", "회의록"],
  글쓰기: ["writing", "copywriting", "draft", "초안"],
  리서치: ["research", "조사", "분석"],
  코딩: ["coding", "code", "dev", "개발"],
  마케팅: ["marketing", "sales", "세일즈"],
  이미지: ["image", "visual", "design", "디자인"],
  업무: ["work", "productivity", "생산성"],
  이메일: ["email", "mail", "메일"],
  번역: ["translation", "translate", "영어"],
};

const sampleItems = [
  {
    id: makeId(),
    title: "회의록 핵심 요약",
    type: "text_prompt",
    platform: "Any",
    categories: ["요약", "업무"],
    tags: ["회의록", "요약", "액션아이템"],
    summary: "회의 내용을 핵심 요약, 결정사항, 할 일로 정리합니다.",
    useCase: "회의 후 빠르게 공유할 정리본이 필요할 때 사용합니다.",
    prompt:
      "다음 회의 내용을 읽고 1) 핵심 요약 2) 결정사항 3) 액션아이템 4) 추가 질문으로 정리해줘.\n\n회의 내용:\n{회의내용}\n\n원하는 톤: {톤}",
    url: "",
    notes: "회의내용과 톤 변수만 채우면 바로 복사할 수 있습니다.",
    favorite: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    lastUsedAt: "",
  },
  {
    id: makeId(),
    title: "블로그 초안 생성",
    type: "text_prompt",
    platform: "Any",
    categories: ["글쓰기", "마케팅"],
    tags: ["블로그", "SEO", "초안"],
    summary: "주제와 독자에 맞춰 블로그 글 초안을 만듭니다.",
    useCase: "콘텐츠 초안을 빠르게 만든 뒤 직접 다듬을 때 좋습니다.",
    prompt:
      "너는 전문 콘텐츠 에디터야. {주제}에 대해 {대상독자}가 이해하기 쉬운 블로그 글 초안을 작성해줘. 구조는 제목, 도입, 본문 소제목 4개, 마무리로 구성해줘. 톤은 {톤}으로 해줘.",
    url: "",
    notes: "",
    favorite: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    lastUsedAt: "",
  },
  {
    id: makeId(),
    title: "시장 리서치 GPT",
    type: "gpt",
    platform: "GPTs",
    categories: ["리서치", "마케팅"],
    tags: ["시장조사", "경쟁사", "리서치"],
    summary: "시장, 경쟁사, 고객 관점을 빠르게 정리하는 GPT 링크입니다.",
    useCase: "새 아이템을 검토하거나 콘텐츠 방향을 잡을 때 사용합니다.",
    prompt: "",
    url: "https://chatgpt.com/g/",
    notes: "실제 GPTs 링크로 바꿔서 쓰세요.",
    favorite: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    lastUsedAt: "",
  },
  {
    id: makeId(),
    title: "메일 정리 Gem",
    type: "gem",
    platform: "Gems",
    categories: ["업무", "요약"],
    tags: ["메일", "답장", "정리"],
    summary: "긴 이메일을 요약하고 답장 초안을 만듭니다.",
    useCase: "메일 처리 시간을 줄이고 싶을 때 사용합니다.",
    prompt: "",
    url: "https://gemini.google.com/gems/",
    notes: "실제 Gem 링크로 교체하세요.",
    favorite: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    lastUsedAt: "",
  },
  {
    id: makeId(),
    title: "Perplexity 자료 조사",
    type: "link",
    platform: "Perplexity",
    categories: ["리서치", "학습"],
    tags: ["출처", "조사", "팩트체크"],
    summary: "출처가 필요한 자료 조사에 바로 접근합니다.",
    useCase: "최신 정보나 근거 링크가 필요한 질문을 할 때 좋습니다.",
    prompt: "다음 주제에 대해 신뢰할 수 있는 출처 중심으로 조사해줘: {주제}",
    url: "https://www.perplexity.ai/",
    notes: "",
    favorite: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    lastUsedAt: "",
  },
];

let state = loadState();
let filters = {
  query: "",
  platform: "전체",
  categories: [],
  favoriteOnly: false,
  view: "card",
  sort: "recent",
  searchScopes: {
    title: true,
    tags: true,
    body: true,
    prompt: true,
  },
};
let formDraft = {
  categories: [],
  tags: [],
};
let hoverTimer = null;
let platformExpanded = false;
let currentTheme = localStorage.getItem(THEME_KEY) || "dark";
let draggedCategory = "";
let draggedSummaryCategory = "";
let suppressCategoryClick = false;
let cloudSaveTimer = null;
let cloudReady = false;
let cloudStatus = "checking";
let applyingRemoteState = false;
let pendingRemoteState = null;
let pendingRemoteUpdatedAt = "";
let statusCheckTimer = null;
let confirmResolver = null;
let duplicateCheckBypassId = "";
let tagInputTouched = false;
let categoryInputTouched = false;

const $ = (selector) => document.querySelector(selector);

const elements = {
  search: $("#searchInput"),
  searchBtn: $("#searchBtn"),
  searchScopeControls: $("#searchScopeControls"),
  summaryChips: $("#summaryChips"),
  platformFilters: $("#platformFilters"),
  categoryFilters: $("#categoryFilters"),
  sort: $("#sortSelect"),
  viewButtons: document.querySelectorAll(".seg"),
  itemsView: $("#itemsView"),
  favoriteSection: $("#favoriteSection"),
  popularSection: $("#popularSection"),
  searchResultsSection: $("#searchResultsSection"),
  resultCount: $("#resultCount"),
  hoverPreview: $("#hoverPreview"),
  toast: $("#toast"),
  importBtn: $("#importBtn"),
  importInput: $("#importInput"),
  exportBtn: $("#exportBtn"),
  exportDialog: $("#exportDialog"),
  closeExportBtn: $("#closeExportBtn"),
  downloadJsonBtn: $("#downloadJsonBtn"),
  downloadCsvBtn: $("#downloadCsvBtn"),
  newItemBtn: $("#newItemBtn"),
  itemDialog: $("#itemDialog"),
  itemForm: $("#itemForm"),
  dialogTitle: $("#dialogTitle"),
  itemId: $("#itemId"),
  titleInput: $("#titleInput"),
  typeInput: $("#typeInput"),
  platformInput: $("#platformInput"),
  summaryInput: $("#summaryInput"),
  formCategories: $("#formCategories"),
  quickCategoryBtn: $("#quickCategoryBtn"),
  selectedTags: $("#selectedTags"),
  tagInput: $("#tagInput"),
  tagSuggestions: $("#tagSuggestions"),
  urlField: $("#urlField"),
  urlInput: $("#urlInput"),
  promptField: $("#promptField"),
  promptInput: $("#promptInput"),
  useCaseInput: $("#useCaseInput"),
  notesInput: $("#notesInput"),
  saveItemBtn: $("#saveItemBtn"),
  deleteItemBtn: $("#deleteItemBtn"),
  closeItemBtn: $("#closeItemBtn"),
  cancelItemBtn: $("#cancelItemBtn"),
  detailDialog: $("#detailDialog"),
  detailTitle: $("#detailTitle"),
  detailBody: $("#detailBody"),
  closeDetailBtn: $("#closeDetailBtn"),
  categoryBtn: $("#categoryBtn"),
  syncBtn: $("#syncBtn"),
  themeToggleBtn: $("#themeToggleBtn"),
  themeIcon: $("#themeIcon"),
  categoryDialog: $("#categoryDialog"),
  closeCategoryBtn: $("#closeCategoryBtn"),
  categoryNameInput: $("#categoryNameInput"),
  categoryColorInput: $("#categoryColorInput"),
  addCategoryBtn: $("#addCategoryBtn"),
  categoryList: $("#categoryList"),
  summaryCategorySelect: $("#summaryCategorySelect"),
  addSummaryCategoryBtn: $("#addSummaryCategoryBtn"),
  summaryCategoryList: $("#summaryCategoryList"),
  tagManageSelect: $("#tagManageSelect"),
  tagRenameInput: $("#tagRenameInput"),
  renameTagBtn: $("#renameTagBtn"),
  syncDialog: $("#syncDialog"),
  closeSyncBtn: $("#closeSyncBtn"),
  cloudReloadBtn: $("#cloudReloadBtn"),
  cloudSaveBtn: $("#cloudSaveBtn"),
  blobBackupNowBtn: $("#blobBackupNowBtn"),
  diagnosticsBtn: $("#diagnosticsBtn"),
  diagnosticsPanelBtn: $("#diagnosticsPanelBtn"),
  closeDiagnosticsBtn: $("#closeDiagnosticsBtn"),
  logoutBtn: $("#logoutBtn"),
  hoverPreviewToggle: $("#hoverPreviewToggle"),
  blobBackupToggle: $("#blobBackupToggle"),
  syncStatusText: $("#syncStatusText"),
  diagnosticsPanel: $("#diagnosticsPanel"),
  snapshotPanel: $("#snapshotPanel"),
  cloudStatusChip: $("#cloudStatusChip"),
  conflictDialog: $("#conflictDialog"),
  closeConflictBtn: $("#closeConflictBtn"),
  localCompareTitle: $("#localCompareTitle"),
  localCompareMeta: $("#localCompareMeta"),
  remoteCompareTitle: $("#remoteCompareTitle"),
  remoteCompareMeta: $("#remoteCompareMeta"),
  useRemoteBtn: $("#useRemoteBtn"),
  keepLocalBtn: $("#keepLocalBtn"),
  confirmDialog: $("#confirmDialog"),
  confirmEyebrow: $("#confirmEyebrow"),
  confirmTitle: $("#confirmTitle"),
  confirmMessage: $("#confirmMessage"),
  confirmCloseBtn: $("#confirmCloseBtn"),
  confirmCancelBtn: $("#confirmCancelBtn"),
  confirmExtraBtn: $("#confirmExtraBtn"),
  confirmOkBtn: $("#confirmOkBtn"),
  authGate: $("#authGate"),
  authForm: $("#authForm"),
  passwordInput: $("#passwordInput"),
  authMessage: $("#authMessage"),
  resetSampleBtn: $("#resetSampleBtn"),
};

bindEvents();
applyTheme(currentTheme);
render();
initCloudSession();

function bindEvents() {
  elements.platformInput.innerHTML = PLATFORM_ORDER.map((platform) => `<option value="${platform}">${platform}</option>`).join("");
  renderSearchScopeControls();

  elements.search.addEventListener("input", () => {
    filters.query = elements.search.value.trim();
    renderItems();
  });
  elements.search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }
  });
  elements.searchBtn.addEventListener("click", runSearch);

  elements.sort.addEventListener("change", () => {
    filters.sort = elements.sort.value;
    renderItems();
  });
  elements.typeInput.addEventListener("change", () => {
    elements.platformInput.value = getDefaultPlatformForType(elements.typeInput.value);
    updateTypeFields();
  });

  elements.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      filters.view = button.dataset.view;
      elements.viewButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderItems();
    });
  });

  elements.newItemBtn.addEventListener("click", () => openItemDialog());
  elements.themeToggleBtn.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(currentTheme);
  });
  elements.closeItemBtn.addEventListener("click", () => elements.itemDialog.close());
  elements.cancelItemBtn.addEventListener("click", () => elements.itemDialog.close());
  elements.saveItemBtn.addEventListener("click", saveItemFromForm);
  elements.deleteItemBtn.addEventListener("click", deleteCurrentItem);
  elements.quickCategoryBtn.addEventListener("click", () => openCategoryDialog());
  elements.categoryBtn.addEventListener("click", openCategoryDialog);
  elements.syncBtn.addEventListener("click", openSyncDialog);
  elements.closeCategoryBtn.addEventListener("click", () => elements.categoryDialog.close());
  elements.addCategoryBtn.addEventListener("click", addCategoryFromInput);
  elements.addSummaryCategoryBtn.addEventListener("click", addSummaryCategoryFromSelect);
  elements.renameTagBtn.addEventListener("click", renameOrMergeTag);
  elements.categoryNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addCategoryFromInput();
    }
  });

  elements.hoverPreview.addEventListener("mouseenter", () => {
    window.clearTimeout(hoverTimer);
  });
  elements.hoverPreview.addEventListener("mouseleave", scheduleHoverHide);

  elements.tagInput.addEventListener("input", renderTagSuggestions);
  [elements.titleInput, elements.summaryInput, elements.promptInput, elements.useCaseInput].forEach((input) => {
    input.addEventListener("input", handleTagContextChange);
  });
  elements.tagInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(elements.tagInput.value);
    }
    if (event.key === "Backspace" && !elements.tagInput.value && formDraft.tags.length) {
      tagInputTouched = true;
      formDraft.tags.pop();
      renderSelectedTags();
    }
  });

  elements.importBtn.addEventListener("click", () => elements.importInput.click());
  elements.importInput.addEventListener("change", importFile);
  elements.exportBtn.addEventListener("click", () => showDialog(elements.exportDialog));
  elements.closeExportBtn.addEventListener("click", () => elements.exportDialog.close());
  elements.downloadJsonBtn.addEventListener("click", exportJson);
  elements.downloadCsvBtn.addEventListener("click", exportCsv);
  elements.closeDetailBtn.addEventListener("click", () => elements.detailDialog.close());
  elements.closeSyncBtn.addEventListener("click", () => elements.syncDialog.close());
  elements.cloudReloadBtn.addEventListener("click", () => loadCloudState({ manual: true }));
  elements.cloudSaveBtn.addEventListener("click", () => saveCloudState({ manual: true }));
  elements.blobBackupNowBtn.addEventListener("click", createBlobBackupNow);
  elements.diagnosticsBtn.addEventListener("click", runDiagnostics);
  elements.diagnosticsPanelBtn.addEventListener("click", runDiagnostics);
  elements.closeDiagnosticsBtn.addEventListener("click", closeDiagnostics);
  elements.logoutBtn.addEventListener("click", logoutCloud);
  elements.hoverPreviewToggle.addEventListener("change", () => {
    state.settings.hoverPreview = elements.hoverPreviewToggle.checked;
    saveState();
    render();
  });
  elements.blobBackupToggle.addEventListener("change", () => {
    state.settings.blobWeeklyBackup = elements.blobBackupToggle.checked;
    saveState();
    renderSettingsControls();
  });
  elements.authForm.addEventListener("submit", loginCloud);
  elements.closeConflictBtn.addEventListener("click", () => elements.conflictDialog.close());
  elements.useRemoteBtn.addEventListener("click", useRemoteState);
  elements.keepLocalBtn.addEventListener("click", keepLocalState);
  elements.confirmCloseBtn.addEventListener("click", () => resolveConfirm(false));
  elements.confirmCancelBtn.addEventListener("click", () => resolveConfirm(false));
  elements.confirmExtraBtn.addEventListener("click", () => resolveConfirm("extra"));
  elements.confirmOkBtn.addEventListener("click", () => resolveConfirm(true));
  elements.confirmDialog.addEventListener("close", () => resolveConfirm(false));
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.addEventListener("click", () => switchSettingsTab(button.dataset.settingsTab));
  });
  bindBackdropClose(elements.itemDialog);
  bindBackdropClose(elements.categoryDialog);
  bindBackdropClose(elements.exportDialog);
  bindBackdropClose(elements.detailDialog);
  bindBackdropClose(elements.syncDialog);
  bindBackdropClose(elements.conflictDialog);
  bindBackdropClose(elements.confirmDialog);

  elements.resetSampleBtn.addEventListener("click", async () => {
    const confirmed = await askConfirm({
      eyebrow: "Sample Restore",
      title: "샘플 데이터를 다시 불러올까요?",
      message: "현재 데이터가 샘플 데이터로 교체됩니다. 먼저 파일로 저장해두는 것을 권장합니다.",
      okText: "샘플 복원",
    });
    if (!confirmed) return;
    state = normalizeState({ categories: DEFAULT_CATEGORIES, items: sampleItems.map(cloneItem) });
    saveState();
    render();
    showToast("샘플 데이터를 다시 불러왔습니다.");
  });
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return normalizeState({ categories: DEFAULT_CATEGORIES, items: sampleItems.map(cloneItem) });
  try {
    return normalizeState(JSON.parse(stored));
  } catch {
    return normalizeState({ categories: DEFAULT_CATEGORIES, items: sampleItems.map(cloneItem) });
  }
}

function normalizeState(input) {
  const items = Array.isArray(input?.items) ? input.items : Array.isArray(input) ? input : sampleItems;
  const normalizedItems = items.map(normalizeItem);
  const discoveredCategories = [...new Set(items.flatMap((item) => splitList(item.categories)))];
  const inputCategories = Array.isArray(input?.categories) ? input.categories : splitList(input?.categories);
  const categories = [...new Set([...(inputCategories.length ? inputCategories : DEFAULT_CATEGORIES), ...discoveredCategories])].filter(Boolean);
  const summaryCategories = [...new Set(splitList(input?.summaryCategories))].filter((category) => categories.includes(category));
  const categoryColors = input?.categoryColors && typeof input.categoryColors === "object" ? input.categoryColors : {};
  const itemIds = new Set(normalizedItems.map((item) => item.id));
  const favoriteOrder = splitList(input?.favoriteOrder).filter((id) => itemIds.has(id));
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(input?.settings && typeof input.settings === "object" ? input.settings : {}),
  };
  return {
    categories,
    categoryColors,
    items: normalizedItems,
    summaryCategories,
    favoriteOrder,
    variableHistory: input?.variableHistory && typeof input.variableHistory === "object" ? input.variableHistory : {},
    settings,
    updatedAt: input?.updatedAt || new Date().toISOString(),
  };
}

function normalizeItem(item = {}) {
  item = item || {};
  const now = new Date().toISOString();
  const type = item.type || "text_prompt";
  const platform = normalizePlatform(item.platform, type);
  const categories = Array.isArray(item.categories) ? item.categories.filter(Boolean) : splitList(item.categories);
  const tags = cleanTags(Array.isArray(item.tags) ? item.tags.filter(Boolean) : splitList(item.tags), categories);
  return {
    id: item.id || makeId(),
    title: String(item.title || "제목 없음").trim(),
    type,
    platform,
    categories,
    tags,
    summary: item.summary || "",
    useCase: item.useCase || "",
    prompt: item.prompt || "",
    url: item.url || "",
    notes: item.notes || "",
    favorite: Boolean(item.favorite),
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
    lastUsedAt: item.lastUsedAt || "",
    useCount: Number(item.useCount || 0),
  };
}

function getDefaultPlatformForType(type) {
  return PLATFORM_BY_TYPE[type] || "Any";
}

function normalizePlatform(platform, type = "text_prompt") {
  const mappedPlatform = LEGACY_PLATFORM_MAP[platform] || platform;
  return PLATFORM_ORDER.includes(mappedPlatform) ? mappedPlatform : getDefaultPlatformForType(type);
}

function cleanTags(tags = [], categories = []) {
  const categorySet = new Set(categories.map(normalizeText));
  const duplicateCategoryTags = new Set(["기획", "아이디어"].map(normalizeText));
  return [...new Set(tags)]
    .map((tag) => String(tag || "").trim().replace(/^#/, ""))
    .filter(Boolean)
    .filter((tag) => !categorySet.has(normalizeText(tag)))
    .filter((tag) => !duplicateCategoryTags.has(normalizeText(tag)));
}

function updateTypeFields() {
  const type = elements.typeInput.value;
  const needsPrompt = type === "text_prompt" || type === "workflow";
  const needsUrl = type === "gpt" || type === "gem" || type === "link" || type === "workflow";
  elements.promptField.classList.toggle("hidden", !needsPrompt);
  elements.urlField.classList.toggle("hidden", !needsUrl);
  elements.promptInput.disabled = !needsPrompt;
  elements.urlInput.disabled = !needsUrl;
  if (!needsPrompt) elements.promptInput.value = "";
  if (!needsUrl) elements.urlInput.value = "";
  renderTagSuggestions();
}

function saveState(options = {}) {
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!options.skipSync) scheduleCloudSave();
  } catch {
    showToast("저장 공간이 부족합니다. 먼저 파일로 저장해주세요.", "error");
  }
}

function initCloudSession() {
  updateCloudStatus("로그인 확인 중...");
  setSaveStatus("확인 중", "auth");
  loadCloudState({ silent: true });
}

function openSyncDialog() {
  updateCloudStatus();
  showDialog(elements.syncDialog);
}

function switchSettingsTab(tab) {
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsTab === tab);
  });
  document.querySelectorAll("[data-settings-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.settingsPanel !== tab);
  });
  if (tab === "backup") runDiagnostics();
}

async function loginCloud(event) {
  event.preventDefault();
  const password = elements.passwordInput.value;
  elements.authMessage.textContent = "";
  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    if (!response.ok) throw new Error("AUTH_FAILED");
    elements.passwordInput.value = "";
    hideAuthGate();
    await loadCloudState({ manual: true });
  } catch {
    elements.authMessage.textContent = "비밀번호를 확인해주세요.";
  }
}

async function logoutCloud() {
  await fetch("/api/auth", { method: "DELETE", credentials: "include" }).catch(() => {});
  cloudReady = false;
  cloudStatus = "signed-out";
  showAuthGate();
  updateCloudStatus("로그아웃되었습니다.");
  setSaveStatus("로그인 필요", "auth");
}

async function loadCloudState(options = {}) {
  try {
    const response = await fetch("/api/data", { credentials: "include" });
    if (response.status === 401) {
      cloudReady = false;
      showAuthGate();
      updateCloudStatus("로그인이 필요합니다.");
      setSaveStatus("로그인 필요", "auth");
      return;
    }
    if (!response.ok) throw new Error("LOAD_FAILED");
    const payload = await response.json();
    cloudReady = true;
    hideAuthGate();
    if (payload.data) {
      const remoteState = normalizeState(payload.data);
      const remoteUpdatedAt = payload.data.updatedAt || payload.updatedAt || remoteState.updatedAt;
      const localIsNewer = compareDate(state.updatedAt, remoteUpdatedAt) > 1000;
      if (localIsNewer) {
        pendingRemoteState = remoteState;
        pendingRemoteUpdatedAt = remoteUpdatedAt;
        updateCloudStatus("이 PC 데이터가 DB보다 최신입니다. 필요하면 DB에 지금 저장하세요.");
        setSaveStatus("로컬 최신", "local");
        if (options.manual) openConflictDialog(remoteState, remoteUpdatedAt);
        return;
      }
      applyRemoteState(remoteState, payload.updatedAt || state.updatedAt);
      if (options.manual) showToast("DB 데이터를 불러왔습니다.");
    } else {
      updateCloudStatus("DB가 비어 있어 현재 데이터를 저장합니다.");
      await saveCloudState({ silent: true });
    }
  } catch {
    cloudReady = false;
    if (!options.silent) showToast("클라우드 데이터를 불러오지 못했습니다.");
    updateCloudStatus("Vercel 배포와 DB 연결을 확인해주세요.");
    setSaveStatus("연결 실패", "error");
  }
}

function applyRemoteState(remoteState, updatedAt = "") {
  applyingRemoteState = true;
  state = normalizeState(remoteState);
  saveState({ skipSync: true });
  applyingRemoteState = false;
  render();
  updateCloudStatus(`DB에서 불러옴 ${formatCloudTime(updatedAt || state.updatedAt)}`);
  setSaveStatus(`DB 최신 ${formatCloudTime(updatedAt || state.updatedAt)}`, "saved");
}

function openConflictDialog(remoteState, remoteUpdatedAt) {
  const localSummary = summarizeState(state);
  const remoteSummary = summarizeState(remoteState);
  elements.localCompareTitle.textContent = `${localSummary.itemCount}개 항목`;
  elements.localCompareMeta.textContent = `${localSummary.categoryCount}개 카테고리 · ${formatCloudTime(state.updatedAt)}`;
  elements.remoteCompareTitle.textContent = `${remoteSummary.itemCount}개 항목`;
  elements.remoteCompareMeta.textContent = `${remoteSummary.categoryCount}개 카테고리 · ${formatCloudTime(remoteUpdatedAt || remoteState.updatedAt)}`;
  showDialog(elements.conflictDialog);
}

function summarizeState(data = {}) {
  return {
    itemCount: Array.isArray(data.items) ? data.items.length : 0,
    categoryCount: Array.isArray(data.categories) ? data.categories.length : 0,
  };
}

function useRemoteState() {
  if (!pendingRemoteState) return;
  applyRemoteState(pendingRemoteState, pendingRemoteUpdatedAt);
  pendingRemoteState = null;
  pendingRemoteUpdatedAt = "";
  elements.conflictDialog.close();
  showToast("DB 데이터를 적용했습니다.", "success");
}

function keepLocalState() {
  elements.conflictDialog.close();
  saveCloudState({ manual: true });
}

function scheduleCloudSave() {
  if (applyingRemoteState || !cloudReady) return;
  setSaveStatus("저장 중", "saving");
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(() => saveCloudState({ silent: true }), CLOUD_SAVE_DELAY);
}

async function runDiagnostics() {
  elements.closeDiagnosticsBtn.classList.remove("hidden");
  elements.diagnosticsPanel.classList.remove("hidden");
  elements.diagnosticsPanel.innerHTML = `<p class="help-text">상태 확인 중...</p>`;
  try {
    const [diagnosticsResponse, snapshotsResponse, blobResponse] = await Promise.all([
      fetch("/api/diagnostics", { credentials: "include" }),
      fetch("/api/snapshots", { credentials: "include" }),
      fetch("/api/blob-backups", { credentials: "include" }),
    ]);
    if (diagnosticsResponse.status === 401 || snapshotsResponse.status === 401 || blobResponse.status === 401) {
      showAuthGate();
      elements.diagnosticsPanel.innerHTML = `<p class="help-text">로그인이 필요합니다.</p>`;
      return;
    }
    const diagnostics = await diagnosticsResponse.json();
    const snapshots = await snapshotsResponse.json();
    const blobBackups = await blobResponse.json();
    renderDiagnostics(diagnostics);
    renderBackups(snapshots.snapshots || [], blobBackups);
  } catch {
    elements.diagnosticsPanel.innerHTML = `<p class="help-text">상태 진단에 실패했습니다.</p>`;
  }
}

function closeDiagnostics() {
  elements.closeDiagnosticsBtn.classList.add("hidden");
  elements.diagnosticsPanel.classList.add("hidden");
  elements.snapshotPanel.classList.add("hidden");
  elements.diagnosticsPanel.innerHTML = "";
  elements.snapshotPanel.innerHTML = "";
}

function renderDiagnostics(diagnostics) {
  const checks = diagnostics.checks || {};
  elements.diagnosticsPanel.innerHTML = `
    <div class="status-grid">
      <span>DB 연결</span><strong>${checks.dbConnected ? "정상" : "확인 필요"}</strong>
      <span>항목</span><strong>${checks.itemCount || 0}개</strong>
      <span>카테고리</span><strong>${checks.categoryCount || 0}개</strong>
      <span>스냅샷</span><strong>${checks.snapshotCount || 0}개</strong>
      <span>최근 저장</span><strong>${formatCloudTime(checks.dataUpdatedAt) || "-"}</strong>
      <span>저장 기기</span><strong>${escapeHtml(checks.lastDevice || "-")}</strong>
      <span>Blob 백업</span><strong>${checks.blobConfigured ? "연결됨" : "미설정"}</strong>
      <span>마지막 Blob</span><strong>${formatCloudTime(checks.blobLastBackupAt) || "-"}</strong>
    </div>
  `;
}

function renderBackups(snapshots, blobBackups = {}) {
  elements.snapshotPanel.classList.remove("hidden");
  elements.snapshotPanel.innerHTML = `
    <div class="backup-groups">
      <section>
        <div class="field-head">
          <span>최근 DB 스냅샷</span>
          <small>최근 5개</small>
        </div>
        ${renderSnapshotList(snapshots)}
      </section>
      <section>
        <div class="field-head">
          <span>Blob 장기 백업</span>
          <small>${blobBackups.configured ? "최근 파일" : "미설정"}</small>
        </div>
        ${renderBlobBackupList(blobBackups)}
      </section>
    </div>
  `;

  elements.snapshotPanel.querySelectorAll("[data-snapshot-id]").forEach((button) => {
    button.addEventListener("click", () => restoreSnapshot(button.dataset.snapshotId));
  });
  elements.snapshotPanel.querySelectorAll("[data-blob-url]").forEach((button) => {
    button.addEventListener("click", () => restoreBlobBackup(button.dataset.blobUrl));
  });
}

function renderSnapshotList(snapshots) {
  return snapshots.length
    ? `
      <div class="snapshot-list">
        ${snapshots.map((snapshot) => `
          <button class="snapshot-item" data-snapshot-id="${escapeAttribute(snapshot.id)}" type="button">
            <strong>${formatCloudTime(snapshot.createdAt) || "스냅샷"}</strong>
            <span>${snapshot.itemCount || 0}개 항목 · ${snapshot.categoryCount || 0}개 카테고리</span>
          </button>
        `).join("")}
      </div>
    `
    : `<p class="help-text">아직 스냅샷이 없습니다. DB 저장 후 자동으로 최근 5개가 보관됩니다.</p>`;
}

function renderBlobBackupList(blobBackups = {}) {
  if (!blobBackups.configured) {
    return `<p class="help-text">Vercel Blob 토큰이 설정되면 주 1회 백업 목록이 여기에 표시됩니다.</p>`;
  }
  const backups = blobBackups.backups || [];
  return backups.length
    ? `
      <div class="snapshot-list">
        ${backups.map((backup) => `
          <button class="snapshot-item" data-blob-url="${escapeAttribute(backup.url)}" type="button">
            <strong>${formatCloudTime(backup.uploadedAt) || "Blob 백업"}</strong>
            <span>${escapeHtml(formatBytes(backup.size))} · ${escapeHtml(shorten(backup.pathname || "", 58))}</span>
          </button>
        `).join("")}
      </div>
    `
    : `<p class="help-text">아직 Blob 백업 파일이 없습니다. 주 1회 Blob 백업을 켠 뒤 DB 저장이 필요합니다.</p>`;
}

async function restoreSnapshot(id) {
  const confirmed = await askConfirm({
    eyebrow: "Snapshot Restore",
    title: "DB 스냅샷에서 복원할까요?",
    message: "선택한 스냅샷의 내용으로 DB와 현재 화면을 복원합니다.",
    okText: "복원",
  });
  if (!confirmed) return;
  try {
    await createPreRestoreSnapshot();
    const response = await fetch("/api/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    if (!response.ok) throw new Error("RESTORE_FAILED");
    const payload = await response.json();
    applyRemoteState(payload.data, payload.updatedAt);
    showToast("스냅샷을 복원했습니다.", "success");
    runDiagnostics();
  } catch {
    showToast("스냅샷 복원에 실패했습니다.", "error");
  }
}

async function restoreBlobBackup(url) {
  const confirmed = await askConfirm({
    eyebrow: "Blob Restore",
    title: "Blob 백업에서 복원할까요?",
    message: "선택한 JSON 백업 파일의 내용으로 DB와 현재 화면을 복원합니다.",
    okText: "복원",
  });
  if (!confirmed) return;
  try {
    await createPreRestoreSnapshot();
    const response = await fetch("/api/blob-backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ url }),
    });
    if (!response.ok) throw new Error("BLOB_RESTORE_FAILED");
    const payload = await response.json();
    applyRemoteState(payload.data, payload.updatedAt);
    showToast("Blob 백업에서 복원했습니다.", "success");
    runDiagnostics();
  } catch {
    showToast("Blob 백업 복원에 실패했습니다.", "error");
  }
}

async function createPreRestoreSnapshot() {
  await fetch("/api/snapshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ action: "create", data: getCloudPayload() }),
  }).catch(() => {});
}

async function createBlobBackupNow() {
  setCloudBusy(true);
  try {
    const response = await fetch("/api/blob-backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "create", data: getCloudPayload() }),
    });
    if (response.status === 401) {
      showAuthGate();
      return;
    }
    const payload = await response.json();
    if (!response.ok || payload.configured === false) throw new Error("BLOB_NOT_READY");
    showToast("Blob 백업을 만들었습니다.", "success");
    runDiagnostics();
  } catch {
    showToast("Blob 백업 생성에 실패했습니다. Vercel Blob 토큰을 확인해주세요.", "error");
  } finally {
    setCloudBusy(false);
  }
}

async function saveCloudState(options = {}) {
  if (!cloudReady && !options.manual) return;
  setCloudBusy(true);
  setSaveStatus("저장 중", "saving");
  try {
    const response = await fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ data: getCloudPayload() }),
    });
    if (response.status === 401) {
      cloudReady = false;
      showAuthGate();
      updateCloudStatus("로그인이 필요합니다.");
      setSaveStatus("로그인 필요", "auth");
      return;
    }
    if (!response.ok) throw new Error("SAVE_FAILED");
    const payload = await response.json();
    cloudReady = true;
    updateCloudStatus(`DB에 저장됨 ${formatCloudTime(payload.updatedAt)}`);
    setSaveStatus(`DB 저장됨 ${formatCloudTime(payload.updatedAt)}`, "saved");
    if (options.manual) showToast("DB에 저장했습니다.", "success");
  } catch {
    if (!options.silent) showToast("DB 저장에 실패했습니다.", "error");
    updateCloudStatus("DB 저장 실패");
    setSaveStatus("저장 실패", "error");
  } finally {
    setCloudBusy(false);
  }
}

function getCloudPayload() {
  return {
    app: "prompt-dock",
    version: 2,
    categories: state.categories,
    categoryColors: state.categoryColors || {},
    summaryCategories: state.summaryCategories || [],
    favoriteOrder: state.favoriteOrder || [],
    variableHistory: state.variableHistory || {},
    settings: state.settings || DEFAULT_SETTINGS,
    deviceInfo: getClientInfo(),
    items: state.items,
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
}

function updateCloudStatus(message = "") {
  if (elements.syncBtn) {
    elements.syncBtn.classList.toggle("active", cloudReady);
  }
  if (!elements.syncStatusText) return;
  if (message) {
    cloudStatus = message;
    elements.syncStatusText.textContent = message;
    return;
  }
  elements.syncStatusText.textContent = cloudStatus || (cloudReady ? "DB 연결됨" : "로그인이 필요합니다.");
}

function setSaveStatus(text, mode = "saved") {
  if (!elements.cloudStatusChip) return;
  elements.cloudStatusChip.innerHTML = `<span class="status-text">${escapeHtml(text)}</span>`;
  elements.cloudStatusChip.title = text;
  elements.cloudStatusChip.className = `cloud-status-chip status-${mode}`;
  if (mode === "saved") {
    window.clearTimeout(statusCheckTimer);
    elements.cloudStatusChip.classList.add("just-saved");
    statusCheckTimer = window.setTimeout(() => {
      elements.cloudStatusChip.classList.remove("just-saved");
    }, 950);
  }
}

function setCloudBusy(isBusy) {
  [elements.cloudReloadBtn, elements.cloudSaveBtn, elements.blobBackupNowBtn, elements.logoutBtn].forEach((button) => {
    button.disabled = isBusy;
  });
}

function showAuthGate() {
  elements.authGate.classList.remove("hidden");
  elements.passwordInput.focus();
}

function hideAuthGate() {
  elements.authGate.classList.add("hidden");
}

function formatCloudTime(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("ko-KR", {
      year: "2-digit",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getClientInfo() {
  const ua = navigator.userAgent || "";
  const browser =
    ua.includes("Edg/")
      ? "Edge"
      : ua.includes("Chrome/")
        ? "Chrome"
        : ua.includes("Firefox/")
          ? "Firefox"
          : ua.includes("Safari/")
            ? "Safari"
            : "Browser";
  const platform = navigator.platform || "현재 PC";
  return {
    label: `${platform} · ${browser}`,
    browser,
    platform,
    userAgent: ua.slice(0, 180),
    savedAt: new Date().toISOString(),
  };
}

function render() {
  renderFilters();
  renderItems();
  renderUtilityControls();
  renderSettingsControls();
  if (elements.categoryDialog.open) {
    renderCategoryEditor();
    renderTagManager();
  }
}

function renderUtilityControls() {
  elements.resetSampleBtn.classList.toggle("hidden", state.items.length > 0);
}

function renderSettingsControls() {
  elements.hoverPreviewToggle.checked = state.settings?.hoverPreview !== false;
  elements.blobBackupToggle.checked = state.settings?.blobWeeklyBackup === true;
}

function renderFilters() {
  const primaryPlatforms = ["전체", "Any", "ChatGPT", "Gemini"];
  const extraPlatforms = PLATFORM_ORDER.filter((platform) => !primaryPlatforms.includes(platform));
  const platformOptions = platformExpanded ? [...primaryPlatforms, ...extraPlatforms] : primaryPlatforms;
  elements.platformFilters.innerHTML = [
    ...platformOptions.map((platform) => {
      const label = platform === "전체" ? "모두" : platform;
      return `<button class="chip ${filters.platform === platform ? "active" : ""}" data-platform="${escapeAttribute(platform)}" type="button">${escapeHtml(label)}</button>`;
    }),
    `<button class="chip more-chip" data-platform-more="true" type="button">${platformExpanded ? "접기" : "..."}</button>`,
  ].join("");
  elements.platformFilters.querySelectorAll("[data-platform]").forEach((button) => {
    button.addEventListener("click", () => {
      filters.platform = button.dataset.platform;
      render();
    });
  });
  elements.platformFilters.querySelector("[data-platform-more]")?.addEventListener("click", () => {
    platformExpanded = !platformExpanded;
    renderFilters();
  });

  const categoryOptions = ["전체", ...state.categories];
  elements.categoryFilters.innerHTML = categoryOptions.map((category) => {
    const active = category === "전체" ? filters.categories.length === 0 : filters.categories.includes(category);
    const label = category === "전체" ? "모두" : category;
    const orderAttrs = category === "전체" ? "" : ` draggable="true" data-category-order="${escapeAttribute(category)}"`;
    const style = category === "전체" ? "" : categoryStyleAttribute(category);
    return `<button class="chip category-chip ${active ? "active" : ""}" data-category="${escapeAttribute(category)}" type="button"${orderAttrs}${style}>${escapeHtml(label)}</button>`;
  }).join("");
  elements.categoryFilters.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (suppressCategoryClick) {
        event.preventDefault();
        return;
      }
      const category = button.dataset.category;
      if (category === "전체") {
        filters.categories = [];
      } else if (filters.categories.includes(category)) {
        filters.categories = filters.categories.filter((item) => item !== category);
      } else {
        filters.categories.push(category);
      }
      render();
    });
  });
  bindCategoryFilterDrag();
}

function runSearch() {
  filters.query = elements.search.value.trim();
  renderItems();
  elements.search.focus();
}

function renderSearchScopeControls() {
  elements.searchScopeControls.innerHTML = SEARCH_SCOPES.map((scope) => `
    <button class="scope-chip ${filters.searchScopes[scope.key] ? "active" : ""}" data-search-scope="${scope.key}" type="button">
      ${escapeHtml(scope.label)}
    </button>
  `).join("");
  elements.searchScopeControls.querySelectorAll("[data-search-scope]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.searchScope;
      const enabledCount = Object.values(filters.searchScopes).filter(Boolean).length;
      if (filters.searchScopes[key] && enabledCount === 1) return;
      filters.searchScopes[key] = !filters.searchScopes[key];
      renderSearchScopeControls();
      renderItems();
    });
  });
}

function renderItems() {
  renderSummaryChips();
  const baseItems = getBaseVisibleItems();
  const searching = Boolean(filters.query.trim());
  const searchMatches = searching ? baseItems.filter((item) => itemMatchesSearch(item, filters.query)) : [];
  const archiveItems = searching ? baseItems.filter((item) => !itemMatchesSearch(item, filters.query)) : baseItems;
  elements.resultCount.textContent = `${searching ? searchMatches.length : archiveItems.length}개 항목`;

  const favorites = getFavoriteItems().slice(0, 8);
  elements.favoriteSection.innerHTML = favorites.length
    ? renderFavoriteDock(favorites)
    : "";
  const popularItems = getPopularItems().slice(0, 6);
  elements.popularSection.innerHTML = popularItems.length ? renderPopularDock(popularItems) : "";
  elements.searchResultsSection.innerHTML = searching ? renderSearchResultsDock(searchMatches) : "";

  elements.itemsView.className = "archive-shell";
  elements.itemsView.innerHTML = renderArchiveDock(archiveItems);
  attachItemEvents();
  bindDockControls();
}

function getBaseVisibleItems() {
  return [...state.items]
    .filter((item) => filters.platform === "전체" || item.platform === filters.platform)
    .filter((item) => !filters.favoriteOnly || item.favorite)
    .filter((item) => !filters.categories.length || filters.categories.some((category) => item.categories.includes(category)))
    .sort(sortItems);
}

function getVisibleItems() {
  const baseItems = getBaseVisibleItems();
  if (!filters.query.trim()) return baseItems;
  return baseItems.filter((item) => itemMatchesSearch(item, filters.query));
}

function getFavoriteItems() {
  const order = new Map((state.favoriteOrder || []).map((id, index) => [id, index]));
  return state.items
    .filter((item) => item.favorite)
    .sort((a, b) => {
      const aOrder = order.has(a.id) ? order.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bOrder = order.has(b.id) ? order.get(b.id) : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || compareDate(b.lastUsedAt || b.updatedAt, a.lastUsedAt || a.updatedAt);
    });
}

function getPopularItems() {
  return [...state.items]
    .filter((item) => Number(item.useCount || 0) > 0)
    .sort((a, b) => Number(b.useCount || 0) - Number(a.useCount || 0) || compareDate(b.lastUsedAt, a.lastUsedAt));
}

function renderSummaryChips() {
  const stats = getSummaryStats();
  const categorySource = state.summaryCategories.length
    ? state.summaryCategories.map((category) => ({ category, count: stats.categoryCounts.get(category) || 0 }))
    : stats.topCategories;
  const categoryChips = categorySource.map(({ category, count }) => {
    const active = filters.categories.includes(category);
    return `
      <button class="summary-chip ${active ? "active" : ""}" data-summary-category="${escapeAttribute(category)}" type="button"${categoryStyleAttribute(category)}>
        <span class="summary-dot"></span>
        <span>자주 쓰는 ${escapeHtml(category)}</span>
        <strong>${count}</strong>
      </button>
    `;
  }).join("");

  elements.summaryChips.innerHTML = `
    <button class="summary-chip ${filters.sort === "recent" && !filters.favoriteOnly ? "active" : ""}" data-summary-action="recent" type="button">
      <span class="summary-icon">↺</span>
      <span>최근 사용</span>
      <strong>${stats.recentCount || stats.total}</strong>
    </button>
    <button class="summary-chip ${filters.favoriteOnly ? "active" : ""}" data-summary-action="favorite" type="button">
      <span class="summary-icon">★</span>
      <span>즐겨찾기</span>
      <strong>${stats.favoriteCount}</strong>
    </button>
    ${categoryChips}
  `;

  elements.summaryChips.querySelector("[data-summary-action='recent']")?.addEventListener("click", () => {
    filters.favoriteOnly = false;
    filters.sort = "recent";
    elements.sort.value = "recent";
    renderItems();
  });
  elements.summaryChips.querySelector("[data-summary-action='favorite']")?.addEventListener("click", () => {
    filters.favoriteOnly = !filters.favoriteOnly;
    if (filters.favoriteOnly) {
      filters.sort = "favorite";
      elements.sort.value = "favorite";
    }
    renderItems();
  });
  elements.summaryChips.querySelectorAll("[data-summary-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.summaryCategory;
      if (filters.categories.includes(category)) {
        filters.categories = filters.categories.filter((item) => item !== category);
      } else {
        filters.categories = [category];
      }
      render();
    });
  });
}

function getSummaryStats() {
  const categoryCounts = new Map();
  state.items.forEach((item) => {
    item.categories.forEach((category) => {
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });
  });

  return {
    total: state.items.length,
    favoriteCount: state.items.filter((item) => item.favorite).length,
    recentCount: state.items.filter((item) => item.lastUsedAt).length,
    categoryCounts,
    topCategories: [...categoryCounts.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, "ko"))
      .slice(0, 3),
  };
}

function sortItems(a, b) {
  if (filters.sort === "favorite") return Number(b.favorite) - Number(a.favorite) || compareDate(b.updatedAt, a.updatedAt);
  if (filters.sort === "updated") return compareDate(b.updatedAt, a.updatedAt);
  if (filters.sort === "title") return a.title.localeCompare(b.title, "ko");
  return compareDate(b.lastUsedAt || b.updatedAt, a.lastUsedAt || a.updatedAt);
}

function renderCard(item) {
  const summary = item.summary || item.useCase || item.prompt || item.url || "요약을 추가하면 더 빠르게 찾을 수 있습니다.";
  const id = escapeAttribute(item.id);
  const platformName = escapeHtml(item.platform);
  const platformBadgeClass = platformClass[item.platform] || platformClass.Other;
  return `
    <article class="prompt-card" data-id="${id}" tabindex="0">
      <div class="card-top">
        <span class="platform-badge ${platformBadgeClass}">${platformName}</span>
        <button class="star-button ${item.favorite ? "active" : ""}" data-action="favorite" data-id="${id}" type="button" aria-label="${item.favorite ? "즐겨찾기 해제" : "즐겨찾기"}">${item.favorite ? "★" : "☆"}</button>
      </div>
      <div>
        <h3>${highlightMatches(item.title)}</h3>
        <p>${highlightMatches(shorten(summary, 74))}</p>
      </div>
      <div class="meta-line">
        ${item.categories.slice(0, 3).map(renderCategoryPill).join("")}
        <span class="stat-pill">사용 ${Number(item.useCount || 0)}회</span>
      </div>
      <div class="card-actions">
        ${item.prompt ? `<button class="tool-button" data-action="copy" data-id="${id}" type="button" aria-label="프롬프트 복사">⧉</button>` : ""}
        ${item.url ? `<button class="tool-button" data-action="open" data-id="${id}" type="button" aria-label="링크 열기">↗</button>` : ""}
        ${item.url ? `<button class="tool-button" data-action="copyLink" data-id="${id}" type="button" aria-label="링크 복사">⌁</button>` : ""}
        <button class="tool-button" data-action="detail" data-id="${id}" type="button" aria-label="상세 보기">i</button>
        <button class="tool-button" data-action="edit" data-id="${id}" type="button" aria-label="편집">✎</button>
      </div>
    </article>
  `;
}

function renderFavoriteTile(item) {
  const id = escapeAttribute(item.id);
  const platformBadgeClass = platformClass[item.platform] || platformClass.Other;
  const summary = item.summary || item.useCase || item.prompt || item.url || "요약 없음";
  return `
    <article class="favorite-tile" data-id="${id}" tabindex="0" draggable="true" aria-label="즐겨찾기 ${escapeAttribute(item.title)}">
      <span class="platform-badge ${platformBadgeClass}">${escapeHtml(item.platform)}</span>
      <strong>${highlightMatches(item.title)}</strong>
      <small>${highlightMatches(shorten(summary, 46))}</small>
      <div class="favorite-tile-actions">
        ${item.prompt ? `<button class="tool-button" data-action="copy" data-id="${id}" type="button" aria-label="프롬프트 복사">⧉</button>` : ""}
        ${item.url ? `<button class="tool-button" data-action="open" data-id="${id}" type="button" aria-label="링크 열기">↗</button>` : ""}
        <button class="tool-button" data-action="detail" data-id="${id}" type="button" aria-label="상세 보기">i</button>
      </div>
    </article>
  `;
}

function renderFavoriteDock(favorites) {
  const collapsed = state.settings?.favoritesCollapsed === true;
  return `
    <div class="favorite-dock ${collapsed ? "collapsed" : ""}">
      <div class="dock-title">
        <h3>즐겨찾기 <small>${favorites.length}개</small></h3>
        <button class="subtle-button" id="favoriteToggleBtn" type="button">${collapsed ? "펼치기" : "접기"}</button>
      </div>
      <div class="favorite-rail">${favorites.map(renderFavoriteTile).join("")}</div>
    </div>
  `;
}

function renderPopularDock(items) {
  const collapsed = state.settings?.popularCollapsed === true;
  return `
    <div class="popular-dock ${collapsed ? "collapsed" : ""}">
      <div class="dock-title">
        <h3>자주 쓰는 프롬프트 <small>${items.length}개</small></h3>
        <button class="subtle-button" id="popularToggleBtn" type="button">${collapsed ? "펼치기" : "접기"}</button>
      </div>
      <div class="popular-list">
        ${items.map((item) => `
          <button class="popular-item" data-popular-open="${escapeAttribute(item.id)}" type="button">
            <strong>${escapeHtml(item.title)}</strong>
            <span>사용 ${Number(item.useCount || 0)}회 · ${item.lastUsedAt ? formatCloudTime(item.lastUsedAt) : "최근 기록 없음"}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderSearchResultsDock(items) {
  return `
    <div class="search-results-dock">
      <div class="dock-title">
        <h3>검색 결과 <small>${items.length}개</small></h3>
      </div>
      ${items.length ? renderItemCollection(items) : `<div class="empty-state compact"><p>검색어와 맞는 항목이 없습니다.</p></div>`}
    </div>
  `;
}

function renderArchiveDock(items) {
  const collapsed = state.settings?.archiveCollapsed === true;
  return `
    <div class="archive-dock ${collapsed ? "collapsed" : ""}">
      <div class="dock-title">
        <h3>보관함 <small>${items.length}개</small></h3>
        <button class="subtle-button" id="archiveToggleBtn" type="button">${collapsed ? "펼치기" : "접기"}</button>
      </div>
      ${collapsed ? "" : items.length ? renderItemCollection(items) : `<div class="empty-state compact"><p>조건에 맞는 항목이 없습니다.</p></div>`}
    </div>
  `;
}

function renderItemCollection(items) {
  const viewClass = `items-grid ${filters.view === "list" ? "list-view" : ""}`;
  const renderer = filters.view === "list" ? renderListRow : renderCard;
  return `<div class="${viewClass}">${items.map(renderer).join("")}</div>`;
}

function renderCategoryPill(category) {
  return `<span class="category-pill" ${categoryStyleAttribute(category)}>${escapeHtml(category)}</span>`;
}

function renderListRow(item) {
  const id = escapeAttribute(item.id);
  const platformBadgeClass = platformClass[item.platform] || platformClass.Other;
  return `
    <article class="list-row" data-id="${id}" tabindex="0">
      <div class="row-title">
        <strong>${highlightMatches(item.title)}</strong>
        <small>${highlightMatches(item.summary || item.useCase || "요약 없음")} · 사용 ${Number(item.useCount || 0)}회</small>
      </div>
      <span class="platform-badge ${platformBadgeClass}">${escapeHtml(item.platform)}</span>
      <div class="meta-line">${item.categories.slice(0, 2).map(renderCategoryPill).join("")}</div>
      <div class="row-actions">
        <button class="star-button ${item.favorite ? "active" : ""}" data-action="favorite" data-id="${id}" type="button" aria-label="${item.favorite ? "즐겨찾기 해제" : "즐겨찾기"}">${item.favorite ? "★" : "☆"}</button>
        ${item.prompt ? `<button class="tool-button" data-action="copy" data-id="${id}" type="button" aria-label="프롬프트 복사">⧉</button>` : ""}
        ${item.url ? `<button class="tool-button" data-action="open" data-id="${id}" type="button" aria-label="링크 열기">↗</button>` : ""}
        ${item.url ? `<button class="tool-button" data-action="copyLink" data-id="${id}" type="button" aria-label="링크 복사">⌁</button>` : ""}
        <button class="tool-button" data-action="detail" data-id="${id}" type="button" aria-label="상세 보기">i</button>
        <button class="tool-button" data-action="edit" data-id="${id}" type="button" aria-label="편집">✎</button>
      </div>
    </article>
  `;
}

function attachItemEvents() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const item = findItem(button.dataset.id);
      if (!item) return;
      const action = button.dataset.action;
      if (action === "favorite") toggleFavorite(item.id);
      if (action === "copy") copyPrompt(item);
      if (action === "open") openUrl(item);
      if (action === "copyLink") copyLink(item);
      if (action === "detail") openDetail(item);
      if (action === "edit") openItemDialog(item);
    });
  });

  document.querySelectorAll("[data-id].prompt-card, [data-id].list-row, [data-id].favorite-tile").forEach((card) => {
    card.addEventListener("mouseenter", (event) => {
      if (!isHoverPreviewEnabled()) return;
      const item = findItem(card.dataset.id);
      if (item) showHoverPreview(item, card, event);
    });
    card.addEventListener("mouseleave", scheduleHoverHide);
    card.addEventListener("focus", () => {
      if (!isHoverPreviewEnabled()) return;
      const item = findItem(card.dataset.id);
      if (item) showHoverPreview(item, card);
    });
    card.addEventListener("blur", scheduleHoverHide);
    card.addEventListener("click", () => {
      const item = findItem(card.dataset.id);
      if (item) openDetail(item);
    });
  });
  document.querySelectorAll("[data-popular-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = findItem(button.dataset.popularOpen);
      if (item) openDetail(item);
    });
  });
  bindFavoriteDrag();
}

function showHoverPreview(item, anchor, pointerEvent = null) {
  window.clearTimeout(hoverTimer);
  const variables = extractVariables(item.prompt);
  const id = escapeAttribute(item.id);
  const platformBadgeClass = platformClass[item.platform] || platformClass.Other;
  elements.hoverPreview.innerHTML = `
    <div class="preview-card">
      <div class="card-top">
        <span class="platform-badge ${platformBadgeClass}">${escapeHtml(item.platform)}</span>
        <span class="type-badge">${escapeHtml(typeLabel(item.type))}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary || item.useCase || "상세 설명 없음")}</p>
      <div class="meta-line">${item.categories.map(renderCategoryPill).join("")}</div>
      ${variables.length ? `<div class="preview-section"><strong>변수</strong><p>${variables.map((name) => `{${escapeHtml(name)}}`).join(" ")}</p></div>` : ""}
      ${item.prompt ? `<div class="preview-section"><strong>프롬프트</strong><p>${escapeHtml(shorten(item.prompt, 170))}</p></div>` : ""}
      ${item.url ? `<div class="preview-section"><strong>링크</strong><p>${escapeHtml(shorten(item.url, 80))}</p></div>` : ""}
      <div class="card-actions preview-actions">
        ${item.prompt ? `<button class="tool-button" data-preview-copy="${id}" type="button" aria-label="프롬프트 복사">⧉</button>` : ""}
        ${item.url ? `<button class="tool-button" data-preview-open="${id}" type="button" aria-label="링크 열기">↗</button>` : ""}
        ${item.url ? `<button class="tool-button" data-preview-link-copy="${id}" type="button" aria-label="링크 복사">⌁</button>` : ""}
        <button class="tool-button" data-preview-detail="${id}" type="button" aria-label="상세 보기">i</button>
      </div>
    </div>
  `;
  elements.hoverPreview.querySelector("[data-preview-copy]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    copyPrompt(item);
    scheduleHoverHide();
  });
  elements.hoverPreview.querySelector("[data-preview-open]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    openUrl(item);
  });
  elements.hoverPreview.querySelector("[data-preview-link-copy]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    copyLink(item);
  });
  elements.hoverPreview.querySelector("[data-preview-detail]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    hideHoverPreview();
    openDetail(item);
  });

  const rect = anchor.getBoundingClientRect();
  elements.hoverPreview.classList.add("measuring");
  const previewRect = elements.hoverPreview.getBoundingClientRect();
  const previewWidth = Math.min(previewRect.width || 360, window.innerWidth - 24);
  const previewHeight = previewRect.height || 270;
  const targetX = pointerEvent?.clientX ?? rect.left + rect.width / 2;
  const left = Math.min(Math.max(12, targetX - previewWidth / 2), window.innerWidth - previewWidth - 12);
  const aboveTop = rect.top - previewHeight - 10;
  const belowTop = rect.bottom + 10;
  const top = aboveTop >= 12 ? aboveTop : Math.min(belowTop, window.innerHeight - previewHeight - 12);
  elements.hoverPreview.style.left = `${left}px`;
  elements.hoverPreview.style.top = `${top}px`;
  elements.hoverPreview.classList.remove("measuring");
  elements.hoverPreview.setAttribute("aria-hidden", "false");
  elements.hoverPreview.classList.add("visible");
}

function hideHoverPreview() {
  window.clearTimeout(hoverTimer);
  elements.hoverPreview.classList.remove("visible");
  elements.hoverPreview.setAttribute("aria-hidden", "true");
}

function scheduleHoverHide() {
  window.clearTimeout(hoverTimer);
  hoverTimer = window.setTimeout(hideHoverPreview, 260);
}

function openItemDialog(item = null) {
  const editing = Boolean(item);
  elements.dialogTitle.textContent = editing ? "항목 편집" : "새 항목";
  elements.itemId.value = item?.id || "";
  elements.titleInput.value = item?.title || "";
  elements.typeInput.value = item?.type || "text_prompt";
  elements.platformInput.value = normalizePlatform(item?.platform, elements.typeInput.value);
  elements.summaryInput.value = item?.summary || "";
  elements.urlInput.value = item?.url || "";
  elements.promptInput.value = item?.prompt || "";
  elements.useCaseInput.value = item?.useCase || "";
  elements.notesInput.value = item?.notes || "";
  elements.deleteItemBtn.style.visibility = editing ? "visible" : "hidden";
  formDraft = {
    categories: item?.categories ? [...item.categories] : [],
    tags: item?.tags ? [...item.tags] : [],
  };
  tagInputTouched = editing;
  categoryInputTouched = editing;
  updateTypeFields();
  renderFormCategories();
  autoFillCategoriesFromContext();
  autoFillTagsFromContext();
  renderFormCategories();
  renderSelectedTags();
  renderTagSuggestions();
  showDialog(elements.itemDialog);
  elements.titleInput.focus();
}

function isHoverPreviewEnabled() {
  return state.settings?.hoverPreview !== false && window.matchMedia("(hover: hover)").matches;
}

function renderFormCategories() {
  elements.formCategories.innerHTML = state.categories.map((category) => {
    const active = formDraft.categories.includes(category);
    return `<button class="chip category-chip ${active ? "active" : ""}" data-form-category="${escapeAttribute(category)}" type="button"${categoryStyleAttribute(category)}>${escapeHtml(category)}</button>`;
  }).join("");
  elements.formCategories.querySelectorAll("[data-form-category]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleFormCategory(button.dataset.formCategory);
    });
  });
}

function toggleFormCategory(category) {
  categoryInputTouched = true;
  if (formDraft.categories.includes(category)) {
    formDraft.categories = formDraft.categories.filter((item) => item !== category);
  } else {
    formDraft.categories.push(category);
  }
  renderFormCategories();
  handleTagContextChange();
}

function renderSelectedTags() {
  elements.selectedTags.innerHTML = formDraft.tags.map((tag) => {
    return `<button class="chip active" data-remove-tag="${escapeAttribute(tag)}" type="button">${escapeHtml(tag)} <span class="remove">×</span></button>`;
  }).join("");
  elements.selectedTags.querySelectorAll("[data-remove-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      formDraft.tags = formDraft.tags.filter((tag) => tag !== button.dataset.removeTag);
      tagInputTouched = true;
      renderSelectedTags();
      renderTagSuggestions();
    });
  });
}

function handleTagContextChange() {
  autoFillCategoriesFromContext();
  autoFillTagsFromContext();
  renderFormCategories();
  renderTagSuggestions();
}

function autoFillCategoriesFromContext() {
  if (categoryInputTouched) return;
  const context = getTagContext();
  if (!context.normalized) return;
  const suggestedCategories = getAutoCategorySuggestions(context).slice(0, 2);
  if (!suggestedCategories.length) return;
  if (suggestedCategories.join("|") === formDraft.categories.join("|")) return;
  formDraft.categories = suggestedCategories;
}

function autoFillTagsFromContext() {
  if (tagInputTouched || elements.tagInput.value.trim()) return;
  const autoTags = getAutoTagSuggestions();
  const nextTags = cleanTags([...new Set(autoTags)], formDraft.categories).slice(0, 3);
  if (nextTags.join("|") === formDraft.tags.join("|")) return;
  formDraft.tags = nextTags;
  renderSelectedTags();
}

function renderTagSuggestions() {
  const query = elements.tagInput.value.trim();
  const suggestions = getTagSuggestions(query).slice(0, 8);
  elements.tagSuggestions.innerHTML = suggestions.map((tag) => {
    return `<button class="suggestion" data-suggestion="${escapeAttribute(tag)}" type="button">${escapeHtml(tag)}</button>`;
  }).join("");
  elements.tagSuggestions.querySelectorAll("[data-suggestion]").forEach((button) => {
    button.addEventListener("click", () => addTag(button.dataset.suggestion));
  });
}

function getTagSuggestions(query) {
  const lowerQuery = normalizeText(query);
  const context = getTagContext();
  const candidates = buildTagCandidates();
  return candidates
    .filter((tag) => {
      if (formDraft.tags.includes(tag)) return false;
      if (!lowerQuery) return true;
      const blob = expandSearchText([tag, ...(tagAliases[tag] || [])].join(" "));
      return blob.includes(lowerQuery) || hasSemanticOverlap([tag, ...(tagAliases[tag] || [])].join(" "), query) || romanizeKorean(tag).includes(lowerQuery);
    })
    .sort((a, b) => tagScore(b, query, context) - tagScore(a, query, context) || a.localeCompare(b, "ko"));
}

function getAutoTagSuggestions() {
  const context = getTagContext();
  if (!context.normalized) return [];
  const inferredTags = inferContextTags(context.raw);
  return buildTagCandidates()
    .filter((tag) => isContextTagMatch(tag, context, inferredTags))
    .sort((a, b) => tagScore(b, "", context) - tagScore(a, "", context) || a.localeCompare(b, "ko"));
}

function getAutoCategorySuggestions(context = getTagContext()) {
  const inferredTags = inferContextTags(context.raw);
  return state.categories
    .filter((category) => isContextTagMatch(category, context, inferredTags))
    .sort((a, b) => tagScore(b, "", context) - tagScore(a, "", context) || a.localeCompare(b, "ko"));
}

function isContextTagMatch(tag, context, inferredTags = inferContextTags(context.raw)) {
  const normalized = normalizeText(tag);
  const tagText = [tag, ...(tagAliases[tag] || [])].join(" ");
  return context.normalized.includes(normalized) || hasSemanticOverlap(context.raw, tagText) || inferredTags.includes(tag);
}

function hasSemanticOverlap(left, right) {
  const leftWords = new Set(getSemanticWords(left).map(normalizeText));
  const rightWords = getSemanticWords(right).map(normalizeText);
  return rightWords.some((word) => word && leftWords.has(word));
}

function buildTagCandidates() {
  const existingTags = [...new Set(state.items.flatMap((item) => item.tags))].filter(Boolean);
  const categoryTags = state.categories.flatMap((category) => tagAliases[category] || []);
  const contextualTags = inferContextTags(getTagContext().raw);
  const aliasTags = Object.entries(tagAliases).flatMap(([tag, aliases]) => [tag, ...aliases]);
  return cleanTags([...new Set([...contextualTags, ...existingTags, ...categoryTags, ...aliasTags])], formDraft.categories).filter(Boolean);
}

function getAllTags() {
  return [...new Set(state.items.flatMap((item) => item.tags || []))]
    .filter(Boolean)
    .sort((a, b) => getTagUsage(b) - getTagUsage(a) || a.localeCompare(b, "ko"));
}

function getTagUsage(tag) {
  return state.items.filter((item) => item.tags.includes(tag)).length;
}

function getTagContext() {
  const raw = [
    elements.titleInput.value,
    elements.summaryInput.value,
    elements.promptInput.value,
    elements.useCaseInput.value,
    ...formDraft.categories,
  ].join(" ");
  return {
    raw,
    normalized: normalizeText(raw),
  };
}

function inferContextTags(text) {
  const rules = [
    { tags: ["요약", "회의록", "액션아이템"], words: ["회의", "회의록", "미팅", "요약", "정리"] },
    { tags: ["블로그", "SEO", "초안"], words: ["블로그", "콘텐츠", "seo", "검색", "원고"] },
    { tags: ["시장조사", "경쟁사", "리서치"], words: ["시장", "경쟁", "조사", "리서치", "분석"] },
    { tags: ["메일", "답장", "업무"], words: ["메일", "이메일", "답장", "회신"] },
    { tags: ["코드", "디버깅", "개발"], words: ["코드", "개발", "버그", "디버그", "api"] },
    { tags: ["이미지", "프롬프트", "비주얼"], words: ["이미지", "사진", "비주얼", "디자인"] },
    { tags: ["번역", "영어", "한국어"], words: ["번역", "영어", "한국어", "translation"] },
    { tags: ["전략", "제안"], words: ["기획", "아이디어", "전략", "제안"] },
  ];
  const normalized = normalizeText(text);
  return rules
    .filter((rule) => rule.words.some((word) => normalized.includes(normalizeText(word))))
    .flatMap((rule) => rule.tags);
}

function tagScore(tag, query, context = getTagContext()) {
  const usage = state.items.filter((item) => item.tags.includes(tag)).length;
  const normalized = normalizeText(tag);
  const lowerQuery = normalizeText(query);
  const starts = lowerQuery && normalized.startsWith(lowerQuery) ? 20 : 0;
  const exact = lowerQuery && normalized === lowerQuery ? 30 : 0;
  const aliasBlob = normalizeText([tag, ...(tagAliases[tag] || [])].join(" "));
  const semanticBlob = expandSearchText([tag, ...(tagAliases[tag] || [])].join(" "));
  const aliasMatch = lowerQuery && (aliasBlob.includes(lowerQuery) || semanticBlob.includes(lowerQuery) || hasSemanticOverlap([tag, ...(tagAliases[tag] || [])].join(" "), query)) ? 14 : 0;
  const contextMatch = isContextTagMatch(tag, context) ? 18 : 0;
  const categoryMatch = formDraft.categories.includes(tag) ? 16 : 0;
  return usage * 5 + starts + exact + aliasMatch + contextMatch + categoryMatch;
}

function addTag(value) {
  const tag = resolveTagValue(value);
  if (!tag) return;
  tagInputTouched = true;
  const nextTags = cleanTags([...formDraft.tags, tag], formDraft.categories);
  formDraft.tags = nextTags;
  elements.tagInput.value = "";
  renderSelectedTags();
  renderTagSuggestions();
}

function resolveTagValue(value) {
  const input = value.trim().replace(/^#/, "");
  if (!input) return "";
  const normalizedInput = normalizeText(input);
  const candidates = buildTagCandidates();
  const exact = candidates.find((tag) => normalizeText(tag) === normalizedInput);
  if (exact) return exact;
  const semantic = candidates.find((tag) => hasSemanticOverlap([tag, ...(tagAliases[tag] || [])].join(" "), input));
  return semantic || input;
}

async function saveItemFromForm() {
  const title = elements.titleInput.value.trim();
  if (!title) {
    elements.titleInput.focus();
    showToast("제목을 입력해주세요.");
    return;
  }

  const now = new Date().toISOString();
  const id = elements.itemId.value || makeId();
  const existing = findItem(id);
  const item = normalizeItem({
    id,
    title,
    type: elements.typeInput.value,
    platform: elements.platformInput.value,
    categories: formDraft.categories,
    tags: cleanTags(formDraft.tags, formDraft.categories),
    summary: elements.summaryInput.value.trim(),
    url: elements.urlInput.value.trim(),
    prompt: elements.promptInput.value.trim(),
    useCase: elements.useCaseInput.value.trim(),
    notes: elements.notesInput.value.trim(),
    favorite: existing?.favorite || false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastUsedAt: existing?.lastUsedAt || "",
    useCount: existing?.useCount || 0,
  });

  if (item.type === "text_prompt" && !item.prompt) {
    showToast("텍스트 프롬프트를 입력해주세요.");
    return;
  }

  if ((item.type === "gpt" || item.type === "gem" || item.type === "link") && !item.url) {
    showToast("링크를 입력해주세요.");
    return;
  }

  if (item.type === "workflow" && !item.prompt && !item.url) {
    showToast("프롬프트나 링크 중 하나는 입력해주세요.");
    return;
  }

  if (duplicateCheckBypassId !== id) {
    const duplicate = findDuplicatePrompt(item);
    if (duplicate) {
      const shouldContinue = await askDuplicateConfirm(item, duplicate);
      if (!shouldContinue) return;
      duplicateCheckBypassId = id;
    }
  }
  duplicateCheckBypassId = "";

  const index = state.items.findIndex((entry) => entry.id === id);
  if (index >= 0) state.items[index] = item;
  else state.items.unshift(item);

  item.categories.forEach((category) => {
    if (!state.categories.includes(category)) state.categories.push(category);
  });

  saveState();
  elements.itemDialog.close();
  render();
  showToast("저장했습니다.");
}

async function deleteCurrentItem() {
  const id = elements.itemId.value;
  if (!id) return;
  const item = findItem(id);
  if (!item) return;
  const confirmed = await askConfirm({
    eyebrow: "Delete Prompt",
    title: "프롬프트를 삭제할까요?",
    message: `"${item.title}" 항목은 삭제 후 스냅샷이나 파일 복원으로만 되돌릴 수 있습니다.`,
    okText: "삭제",
  });
  if (!confirmed) return;
  state.items = state.items.filter((entry) => entry.id !== id);
  state.favoriteOrder = (state.favoriteOrder || []).filter((entryId) => entryId !== id);
  saveState();
  elements.itemDialog.close();
  render();
  showToast("삭제했습니다.");
}

function openDetail(item) {
  if (!item) return;
  const variables = extractVariables(item.prompt);
  const similar = getSimilarItems(item).slice(0, 4);
  const id = escapeAttribute(item.id);
  const platformBadgeClass = platformClass[item.platform] || platformClass.Other;
  elements.detailTitle.textContent = item.title;
  elements.detailBody.innerHTML = `
    <div class="detail-grid">
      <div class="detail-panel">
        <div class="card-top">
          <div class="meta-line">
            <span class="platform-badge ${platformBadgeClass}">${escapeHtml(item.platform)}</span>
            <span class="type-badge">${escapeHtml(typeLabel(item.type))}</span>
          </div>
          <button class="star-button ${item.favorite ? "active" : ""}" data-detail-favorite="${id}" type="button">${item.favorite ? "★" : "☆"}</button>
        </div>
        <p>${escapeHtml(item.summary || item.useCase || "요약 없음")}</p>
        <div class="usage-stats">
          <span>사용 ${Number(item.useCount || 0)}회</span>
          <span>최근 사용 ${item.lastUsedAt ? formatCloudTime(item.lastUsedAt) : "-"}</span>
        </div>
        <div class="meta-line">${item.categories.map(renderCategoryPill).join("")}</div>
        <div class="meta-line">${item.tags.map((tag) => `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join("")}</div>
      </div>

      ${item.useCase ? `<div class="detail-panel"><h3>사용 목적</h3><p>${escapeHtml(item.useCase)}</p></div>` : ""}
      ${variables.length ? renderVariablePanel(item, variables) : ""}
      ${item.prompt ? `<div class="detail-panel copy-panel"><div class="panel-title-row"><h3>완성될 프롬프트</h3><button class="field-copy-button" data-field-copy="prompt" type="button">복사</button></div><div class="prompt-preview" id="filledPromptPreview">${escapeHtml(item.prompt)}</div></div>` : ""}
      ${item.url ? `<div class="detail-panel copy-panel"><div class="panel-title-row"><h3>링크</h3><button class="field-copy-button" data-field-copy="url" type="button">복사</button></div><p class="url-preview">${escapeHtml(item.url)}</p></div>` : ""}
      ${item.notes ? `<div class="detail-panel"><h3>메모</h3><p>${escapeHtml(item.notes)}</p></div>` : ""}
      ${similar.length ? `<div class="detail-panel"><h3>비슷한 항목</h3><div class="similar-list">${similar.map(renderSimilarItem).join("")}</div></div>` : ""}

      <div class="card-actions">
        ${item.prompt ? `<button class="primary-action" data-detail-copy="${id}" type="button">완성된 프롬프트 복사</button>` : ""}
        ${item.url ? `<button class="secondary-action" data-detail-open="${id}" type="button">링크 열기</button>` : ""}
        ${item.url ? `<button class="secondary-action" data-detail-link-copy="${id}" type="button">링크 복사</button>` : ""}
        <button class="secondary-action" data-detail-edit="${id}" type="button">편집</button>
      </div>
    </div>
  `;
  bindDetailEvents(item);
  showDialog(elements.detailDialog);
}

function renderVariablePanel(item, variables) {
  return `
    <div class="detail-panel">
      <h3>변수 입력</h3>
      <div class="variable-grid">
        ${variables.map((variable) => `
          <label>
            ${escapeHtml(variable)}
            <input data-variable="${escapeAttribute(variable)}" list="var-${escapeAttribute(slugify(variable))}" placeholder="${escapeAttribute(getVariablePlaceholder(variable))}" />
            ${renderVariableSuggestions(variable)}
          </label>
        `).join("")}
      </div>
    </div>
  `;
}

function renderSimilarItem(item) {
  const id = escapeAttribute(item.id);
  return `
    <div class="similar-item">
      <div class="row-title">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.platform)} · ${escapeHtml(item.categories.slice(0, 2).join(", "))}</small>
      </div>
      <button class="action-button" data-similar-open="${id}" type="button">보기</button>
    </div>
  `;
}

function bindDetailEvents(item) {
  elements.detailBody.querySelector("[data-detail-favorite]")?.addEventListener("click", () => {
    toggleFavorite(item.id);
    openDetail(findItem(item.id));
  });
  elements.detailBody.querySelector("[data-detail-copy]")?.addEventListener("click", () => copyFilledPrompt(item));
  elements.detailBody.querySelector("[data-detail-open]")?.addEventListener("click", () => openUrl(item));
  elements.detailBody.querySelector("[data-detail-link-copy]")?.addEventListener("click", () => copyLink(item));
  elements.detailBody.querySelector("[data-field-copy='prompt']")?.addEventListener("click", () => copyFilledPrompt(item));
  elements.detailBody.querySelector("[data-field-copy='url']")?.addEventListener("click", () => copyLink(item));
  elements.detailBody.querySelector("[data-detail-edit]")?.addEventListener("click", () => {
    elements.detailDialog.close();
    openItemDialog(item);
  });
  elements.detailBody.querySelectorAll("[data-similar-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = findItem(button.dataset.similarOpen);
      if (next) openDetail(next);
    });
  });
  elements.detailBody.querySelectorAll("[data-variable]").forEach((input) => {
    input.addEventListener("input", () => updateFilledPromptPreview(item));
  });
  updateFilledPromptPreview(item);
}

function bindBackdropClose(dialog) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function showDialog(dialog) {
  if (!dialog.open) dialog.showModal();
}

function askConfirm({ eyebrow = "확인", title = "계속할까요?", message = "", okText = "확인", cancelText = "취소", extraText = "" } = {}) {
  elements.confirmEyebrow.textContent = eyebrow;
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmOkBtn.textContent = okText;
  elements.confirmCancelBtn.textContent = cancelText;
  elements.confirmExtraBtn.textContent = extraText;
  elements.confirmExtraBtn.classList.toggle("hidden", !extraText);
  showDialog(elements.confirmDialog);
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function resolveConfirm(value) {
  const resolver = confirmResolver;
  confirmResolver = null;
  elements.confirmExtraBtn.classList.add("hidden");
  if (elements.confirmDialog.open) elements.confirmDialog.close();
  if (resolver) resolver(value);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  elements.themeIcon.textContent = theme === "dark" ? "☀" : "☾";
  elements.themeToggleBtn.setAttribute("aria-label", theme === "dark" ? "라이트 모드로 변경" : "다크 모드로 변경");
  elements.themeToggleBtn.setAttribute("title", theme === "dark" ? "라이트 모드" : "다크 모드");
}

async function copyPrompt(item) {
  if (!item.prompt) {
    showToast("복사할 프롬프트가 없습니다.");
    return;
  }
  await writeClipboard(item.prompt);
  markUsed(item.id);
  showToast("프롬프트를 복사했습니다.");
}

async function copyFilledPrompt(item) {
  const text = getFilledPromptText(item);
  rememberVariableValues();
  await writeClipboard(text);
  markUsed(item.id);
  showToast("채운 프롬프트를 복사했습니다.");
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = text;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.left = "-9999px";
    document.body.appendChild(fallback);
    fallback.select();
    document.execCommand("copy");
    fallback.remove();
  }
}

function openUrl(item) {
  if (!item.url) return;
  markUsed(item.id);
  window.open(item.url, "_blank", "noopener,noreferrer");
}

async function copyLink(item) {
  if (!item.url) {
    showToast("복사할 링크가 없습니다.");
    return;
  }
  await writeClipboard(item.url);
  showToast("링크를 복사했습니다.");
}

function markUsed(id) {
  const item = findItem(id);
  if (!item) return;
  item.lastUsedAt = new Date().toISOString();
  item.useCount = Number(item.useCount || 0) + 1;
  saveState();
  renderItems();
}

function toggleFavorite(id) {
  const item = findItem(id);
  if (!item) return;
  item.favorite = !item.favorite;
  item.updatedAt = new Date().toISOString();
  const order = state.favoriteOrder || [];
  if (item.favorite) {
    state.favoriteOrder = [item.id, ...order.filter((entryId) => entryId !== item.id)];
  } else {
    state.favoriteOrder = order.filter((entryId) => entryId !== item.id);
  }
  saveState();
  renderItems();
}

function openCategoryDialog() {
  renderCategoryEditor();
  renderTagManager();
  showDialog(elements.categoryDialog);
  elements.categoryNameInput.focus();
}

function renderCategoryEditor() {
  elements.categoryList.innerHTML = state.categories.map((category) => `
    <div class="category-edit-row" draggable="true" data-category-row="${escapeAttribute(category)}">
      <span class="drag-handle" aria-hidden="true">⋮⋮</span>
      <input value="${escapeAttribute(category)}" data-category-edit="${escapeAttribute(category)}" />
      <input class="category-color-input" type="color" value="${escapeAttribute(getCategoryColor(category))}" data-category-color="${escapeAttribute(category)}" aria-label="${escapeAttribute(category)} 색상" />
      <button class="danger-button" data-category-delete="${escapeAttribute(category)}" type="button">삭제</button>
    </div>
  `).join("");

  elements.categoryList.querySelectorAll("[data-category-row]").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      draggedCategory = row.dataset.categoryRow;
      row.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedCategory);
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      draggedCategory = "";
    });
    row.addEventListener("dragover", (event) => {
      if (!draggedCategory || draggedCategory === row.dataset.categoryRow) return;
      event.preventDefault();
      row.classList.add("drop-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      row.classList.remove("drop-target");
      reorderCategory(draggedCategory || event.dataTransfer.getData("text/plain"), row.dataset.categoryRow);
    });
  });

  elements.categoryList.querySelectorAll("[data-category-edit]").forEach((input) => {
    input.addEventListener("change", () => renameCategory(input.dataset.categoryEdit, input.value.trim()));
  });
  elements.categoryList.querySelectorAll("[data-category-color]").forEach((input) => {
    input.addEventListener("change", () => setCategoryColor(input.dataset.categoryColor, input.value));
  });
  elements.categoryList.querySelectorAll("[data-category-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteCategory(button.dataset.categoryDelete));
  });

  renderSummaryCategoryEditor();
}

function addCategoryFromInput() {
  const category = elements.categoryNameInput.value.trim();
  if (!category) return;
  if (!state.categories.includes(category)) state.categories.push(category);
  state.categoryColors = state.categoryColors || {};
  state.categoryColors[category] = elements.categoryColorInput.value || getCategoryColor(category);
  if (!state.summaryCategories.includes(category)) state.summaryCategories.push(category);
  if (!formDraft.categories.includes(category)) formDraft.categories.push(category);
  elements.categoryNameInput.value = "";
  saveState();
  render();
  renderFormCategories();
  showToast("카테고리를 추가했습니다.");
}

function renameCategory(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  if (state.categories.includes(newName)) {
    showToast("이미 있는 카테고리입니다.");
    renderCategoryEditor();
    return;
  }
  state.categories = state.categories.map((category) => category === oldName ? newName : category);
  state.summaryCategories = state.summaryCategories.map((category) => category === oldName ? newName : category);
  state.categoryColors = state.categoryColors || {};
  if (state.categoryColors[oldName]) {
    state.categoryColors[newName] = state.categoryColors[oldName];
    delete state.categoryColors[oldName];
  }
  state.items.forEach((item) => {
    item.categories = item.categories.map((category) => category === oldName ? newName : category);
  });
  filters.categories = filters.categories.map((category) => category === oldName ? newName : category);
  formDraft.categories = formDraft.categories.map((category) => category === oldName ? newName : category);
  saveState();
  render();
  renderFormCategories();
}

function setCategoryColor(category, color) {
  if (!category || !isHexColor(color)) return;
  state.categoryColors = state.categoryColors || {};
  state.categoryColors[category] = color;
  saveState();
  render();
  renderFormCategories();
}

async function deleteCategory(category) {
  const confirmed = await askConfirm({
    eyebrow: "Delete Category",
    title: "카테고리를 삭제할까요?",
    message: `"${category}" 카테고리가 목록과 항목에서 제거됩니다.`,
    okText: "삭제",
  });
  if (!confirmed) return;
  state.categories = state.categories.filter((item) => item !== category);
  if (state.categoryColors) delete state.categoryColors[category];
  state.summaryCategories = state.summaryCategories.filter((entry) => entry !== category);
  state.items.forEach((item) => {
    item.categories = item.categories.filter((entry) => entry !== category);
  });
  filters.categories = filters.categories.filter((entry) => entry !== category);
  formDraft.categories = formDraft.categories.filter((entry) => entry !== category);
  saveState();
  render();
  renderFormCategories();
  showToast("카테고리를 삭제했습니다.");
}

function renderSummaryCategoryEditor() {
  const available = state.categories.filter((category) => !state.summaryCategories.includes(category));
  elements.summaryCategorySelect.innerHTML = available.length
    ? available.map((category) => `<option value="${escapeAttribute(category)}">${escapeHtml(category)}</option>`).join("")
    : `<option value="">추가할 카테고리 없음</option>`;
  elements.addSummaryCategoryBtn.disabled = !available.length;

  elements.summaryCategoryList.innerHTML = state.summaryCategories.length
    ? state.summaryCategories.map((category) => `
      <div class="category-edit-row summary-edit-row" draggable="true" data-summary-row="${escapeAttribute(category)}">
        <span class="drag-handle" aria-hidden="true">⋮⋮</span>
        <span class="summary-row-label">${escapeHtml(category)}</span>
        <button class="danger-button" data-summary-delete="${escapeAttribute(category)}" type="button">제거</button>
      </div>
    `).join("")
    : `<p class="help-text">비워두면 사용 빈도순 카테고리가 자동으로 표시됩니다.</p>`;

  elements.summaryCategoryList.querySelectorAll("[data-summary-row]").forEach((row) => {
    row.addEventListener("dragstart", (event) => {
      draggedSummaryCategory = row.dataset.summaryRow;
      row.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedSummaryCategory);
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      draggedSummaryCategory = "";
    });
    row.addEventListener("dragover", (event) => {
      if (!draggedSummaryCategory || draggedSummaryCategory === row.dataset.summaryRow) return;
      event.preventDefault();
      row.classList.add("drop-target");
    });
    row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      row.classList.remove("drop-target");
      reorderSummaryCategory(draggedSummaryCategory || event.dataTransfer.getData("text/plain"), row.dataset.summaryRow);
    });
  });

  elements.summaryCategoryList.querySelectorAll("[data-summary-delete]").forEach((button) => {
    button.addEventListener("click", () => removeSummaryCategory(button.dataset.summaryDelete));
  });
}

function addSummaryCategoryFromSelect() {
  const category = elements.summaryCategorySelect.value;
  if (!category || state.summaryCategories.includes(category)) return;
  state.summaryCategories.push(category);
  saveState();
  render();
  renderSummaryCategoryEditor();
  showToast("상단 요약 카테고리에 추가했습니다.");
}

function removeSummaryCategory(category) {
  state.summaryCategories = state.summaryCategories.filter((entry) => entry !== category);
  saveState();
  render();
  renderSummaryCategoryEditor();
}

function reorderSummaryCategory(fromCategory, toCategory) {
  if (!fromCategory || !toCategory || fromCategory === toCategory) return;
  const fromIndex = state.summaryCategories.indexOf(fromCategory);
  const toIndex = state.summaryCategories.indexOf(toCategory);
  if (fromIndex < 0 || toIndex < 0) return;
  const [moved] = state.summaryCategories.splice(fromIndex, 1);
  state.summaryCategories.splice(toIndex, 0, moved);
  saveState();
  render();
  renderSummaryCategoryEditor();
}

function renderTagManager() {
  const tags = getAllTags();
  elements.tagManageSelect.innerHTML = tags.length
    ? tags.map((tag) => `<option value="${escapeAttribute(tag)}">${escapeHtml(tag)} (${getTagUsage(tag)})</option>`).join("")
    : `<option value="">태그 없음</option>`;
  elements.renameTagBtn.disabled = !tags.length;
}

function renameOrMergeTag() {
  const fromTag = elements.tagManageSelect.value;
  const toTag = elements.tagRenameInput.value.trim().replace(/^#/, "");
  if (!fromTag || !toTag) {
    showToast("바꿀 태그와 새 태그 이름을 입력해주세요.", "error");
    return;
  }
  if (fromTag === toTag) {
    showToast("같은 태그 이름입니다.");
    return;
  }
  let changed = 0;
  state.items.forEach((item) => {
    if (!item.tags.includes(fromTag)) return;
    item.tags = [...new Set(item.tags.map((tag) => (tag === fromTag ? toTag : tag)))];
    item.updatedAt = new Date().toISOString();
    changed += 1;
  });
  saveState();
  elements.tagRenameInput.value = "";
  renderTagManager();
  render();
  showToast(`${changed}개 항목의 태그를 정리했습니다.`, "success");
}

function bindCategoryFilterDrag() {
  elements.categoryFilters.querySelectorAll("[data-category-order]").forEach((button) => {
    button.addEventListener("dragstart", (event) => {
      draggedCategory = button.dataset.categoryOrder;
      suppressCategoryClick = true;
      button.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedCategory);
    });
    button.addEventListener("dragend", () => {
      button.classList.remove("dragging");
      draggedCategory = "";
      window.setTimeout(() => {
        suppressCategoryClick = false;
      }, 0);
    });
    button.addEventListener("dragover", (event) => {
      if (!draggedCategory || draggedCategory === button.dataset.categoryOrder) return;
      event.preventDefault();
      button.classList.add("drop-target");
    });
    button.addEventListener("dragleave", () => button.classList.remove("drop-target"));
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("drop-target");
      reorderCategory(draggedCategory || event.dataTransfer.getData("text/plain"), button.dataset.categoryOrder);
      window.setTimeout(() => {
        suppressCategoryClick = false;
      }, 0);
    });
  });
}

function bindFavoriteDrag() {
  let draggingId = "";
  document.querySelectorAll(".favorite-tile").forEach((tile) => {
    tile.addEventListener("dragstart", (event) => {
      draggingId = tile.dataset.id;
      tile.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggingId);
    });
    tile.addEventListener("dragend", () => {
      draggingId = "";
      tile.classList.remove("dragging");
      document.querySelectorAll(".favorite-tile.drop-target").forEach((item) => item.classList.remove("drop-target"));
    });
    tile.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (tile.dataset.id !== draggingId) tile.classList.add("drop-target");
    });
    tile.addEventListener("dragleave", () => tile.classList.remove("drop-target"));
    tile.addEventListener("drop", (event) => {
      event.preventDefault();
      tile.classList.remove("drop-target");
      const fromId = event.dataTransfer.getData("text/plain") || draggingId;
      const toId = tile.dataset.id;
      if (fromId && toId && fromId !== toId) reorderFavorites(fromId, toId);
    });
  });
}

function bindDockControls() {
  document.querySelector("#favoriteToggleBtn")?.addEventListener("click", () => {
    state.settings.favoritesCollapsed = state.settings?.favoritesCollapsed !== true;
    saveState();
    renderItems();
  });
  document.querySelector("#popularToggleBtn")?.addEventListener("click", () => {
    state.settings.popularCollapsed = state.settings?.popularCollapsed !== true;
    saveState();
    renderItems();
  });
  document.querySelector("#archiveToggleBtn")?.addEventListener("click", () => {
    state.settings.archiveCollapsed = state.settings?.archiveCollapsed !== true;
    saveState();
    renderItems();
  });
}

function reorderFavorites(fromId, toId) {
  const ids = getFavoriteItems().map((item) => item.id);
  const fromIndex = ids.indexOf(fromId);
  const toIndex = ids.indexOf(toId);
  if (fromIndex === -1 || toIndex === -1) return;
  ids.splice(toIndex, 0, ids.splice(fromIndex, 1)[0]);
  state.favoriteOrder = ids;
  saveState();
  renderItems();
}

function reorderCategory(fromCategory, toCategory) {
  if (!fromCategory || !toCategory || fromCategory === toCategory) return;
  const fromIndex = state.categories.indexOf(fromCategory);
  const toIndex = state.categories.indexOf(toCategory);
  if (fromIndex < 0 || toIndex < 0) return;
  const [moved] = state.categories.splice(fromIndex, 1);
  state.categories.splice(toIndex, 0, moved);
  saveState();
  render();
  renderFormCategories();
}

function exportJson() {
  downloadFile(
    `prompt-dock-${dateStamp()}.json`,
    JSON.stringify(state, null, 2),
    "application/json",
  );
  elements.exportDialog.close();
  showToast("JSON 파일을 저장했습니다.", "success");
}

function exportCsv() {
  const headers = ["title", "type", "platform", "categories", "tags", "summary", "useCase", "prompt", "url", "notes", "favorite", "useCount", "lastUsedAt"];
  const rows = state.items.map((item) => headers.map((key) => {
    const value = Array.isArray(item[key]) ? item[key].join("|") : item[key];
    return csvEscape(value ?? "");
  }).join(","));
  const csvContent = `\uFEFF${[headers.join(","), ...rows].join("\r\n")}`;
  downloadFile(`prompt-dock-${dateStamp()}.csv`, csvContent, "text/csv;charset=utf-8");
  elements.exportDialog.close();
  showToast("CSV 파일을 저장했습니다.", "success");
}

async function importFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const confirmed = await askConfirm({
    eyebrow: "File Restore",
    title: "파일에서 복원할까요?",
    message: "선택한 파일 내용으로 현재 데이터를 교체합니다.",
    okText: "복원",
  });
  if (!confirmed) {
    elements.importInput.value = "";
    return;
  }
  try {
    await createPreRestoreSnapshot();
    const text = await file.text();
    const imported = file.name.toLowerCase().endsWith(".csv") ? importCsvText(text) : JSON.parse(text);
    state = normalizeState(imported);
    saveState();
    render();
    showToast("파일에서 복원했습니다.", "success");
  } catch (error) {
    showToast("복원에 실패했습니다. 파일 형식을 확인해주세요.", "error");
  } finally {
    elements.importInput.value = "";
  }
}

function importCsvText(text) {
  const rows = parseCsv(text);
  const [headers, ...body] = rows;
  if (!headers?.length) return { categories: DEFAULT_CATEGORIES, items: [] };
  const items = body.filter((row) => row.some(Boolean)).map((row) => {
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]));
    return {
      ...record,
      categories: splitList(record.categories),
      tags: splitList(record.tags),
      favorite: record.favorite === "true",
      useCount: Number(record.useCount || 0),
      lastUsedAt: record.lastUsedAt || "",
    };
  });
  return { categories: DEFAULT_CATEGORIES, items };
}

function parseCsv(text) {
  text = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  row.push(value);
  rows.push(row);
  return rows.filter((entry) => entry.some((cell) => cell !== ""));
}

function getSimilarItems(item) {
  return state.items
    .filter((entry) => entry.id !== item.id)
    .map((entry) => ({
      item: entry,
      score:
        intersectionCount(item.categories, entry.categories) * 4 +
        intersectionCount(item.tags, entry.tags) * 3 +
        (item.platform === entry.platform ? 2 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}

function findDuplicatePrompt(item) {
  const itemPrompt = normalizePromptText(item.prompt);
  const itemTitle = normalizeText(item.title);
  const itemUrl = normalizeUrl(item.url);
  return state.items
    .filter((entry) => entry.id !== item.id)
    .map((entry) => {
      const promptScore = itemPrompt && normalizePromptText(entry.prompt) === itemPrompt ? 100 : 0;
      const urlScore = itemUrl && normalizeUrl(entry.url) === itemUrl ? 96 : 0;
      const titleScore = itemTitle && normalizeText(entry.title) === itemTitle ? 82 : 0;
      const nearPromptScore = getPromptSimilarity(item.prompt, entry.prompt) >= 0.92 ? 90 : 0;
      return { item: entry, score: Math.max(promptScore, urlScore, titleScore, nearPromptScore) };
    })
    .filter((entry) => entry.score >= 82)
    .sort((a, b) => b.score - a.score)[0]?.item;
}

async function askDuplicateConfirm(item, duplicate) {
  const choice = await askConfirm({
    eyebrow: "Duplicate Check",
    title: "비슷한 항목이 있습니다",
    message: `"${duplicate.title}" 항목과 내용이 비슷합니다. 새 항목으로 저장하거나 기존 항목에 정보를 병합할 수 있습니다.`,
    okText: "그래도 저장",
    cancelText: "기존 항목 보기",
    extraText: "기존 항목에 병합",
  });
  if (choice === "extra") {
    mergeDuplicateItem(duplicate.id, item);
    elements.itemDialog.close();
    openDetail(findItem(duplicate.id));
    return false;
  }
  if (!choice) {
    elements.itemDialog.close();
    openDetail(duplicate);
  }
  return choice === true;
}

function mergeDuplicateItem(targetId, source) {
  const target = findItem(targetId);
  if (!target) return;
  target.title = target.title || source.title;
  target.summary = target.summary || source.summary;
  target.useCase = target.useCase || source.useCase;
  target.prompt = target.prompt || source.prompt;
  target.url = target.url || source.url;
  target.notes = [target.notes, source.notes].filter(Boolean).join("\n\n");
  target.categories = [...new Set([...target.categories, ...source.categories])];
  target.tags = [...new Set([...target.tags, ...source.tags])];
  target.favorite = target.favorite || source.favorite;
  target.useCount = Number(target.useCount || 0) + Number(source.useCount || 0);
  target.updatedAt = new Date().toISOString();
  if (source.id && source.id !== targetId) {
    state.items = state.items.filter((item) => item.id !== source.id);
    state.favoriteOrder = (state.favoriteOrder || []).filter((id) => id !== source.id);
  }
  saveState();
  render();
  showToast("기존 항목에 병합했습니다.", "success");
}

function getFilledPromptText(item) {
  let text = item.prompt || "";
  elements.detailBody.querySelectorAll("[data-variable]").forEach((input) => {
    const key = input.dataset.variable;
    text = text.replaceAll(`{${key}}`, input.value || `{${key}}`);
  });
  return text;
}

function updateFilledPromptPreview(item) {
  const preview = elements.detailBody.querySelector("#filledPromptPreview");
  if (!preview) return;
  preview.textContent = getFilledPromptText(item);
}

function rememberVariableValues() {
  const values = state.variableHistory || {};
  elements.detailBody.querySelectorAll("[data-variable]").forEach((input) => {
    const value = input.value.trim();
    if (!value) return;
    const key = input.dataset.variable;
    values[key] = [value, ...(values[key] || []).filter((entry) => entry !== value)].slice(0, 6);
  });
  state.variableHistory = values;
  saveState();
}

function renderVariableSuggestions(variable) {
  const suggestions = getVariableSuggestions(variable);
  if (!suggestions.length) return "";
  return `
    <datalist id="var-${escapeAttribute(slugify(variable))}">
      ${suggestions.map((value) => `<option value="${escapeAttribute(value)}"></option>`).join("")}
    </datalist>
  `;
}

function getVariableSuggestions(variable) {
  const history = state.variableHistory?.[variable] || [];
  const fallback = {
    주제: ["신규 서비스 소개", "고객 후기 분석", "콘텐츠 캘린더"],
    톤: ["친근하게", "전문적으로", "간결하게"],
    대상독자: ["초보자", "실무자", "잠재 고객"],
    언어: ["한국어", "영어"],
    형식: ["표", "불릿", "체크리스트"],
  }[variable] || [];
  return [...new Set([...history, ...fallback])].slice(0, 8);
}

function getVariablePlaceholder(variable) {
  const suggestions = getVariableSuggestions(variable);
  return suggestions[0] ? `예: ${suggestions[0]}` : `${variable} 입력`;
}

function extractVariables(prompt) {
  const matches = [...String(prompt || "").matchAll(/\{([^{}\n]+)\}/g)].map((match) => match[1].trim()).filter(Boolean);
  return [...new Set(matches)];
}

function typeLabel(type) {
  return {
    text_prompt: "Prompt",
    gpt: "GPTs",
    gem: "Gems",
    link: "Link",
    workflow: "Workflow",
  }[type] || "Prompt";
}

function findItem(id) {
  return state.items.find((item) => item.id === id);
}

function searchBlob(item) {
  return getSearchScopeText(item, ["title", "tags", "body", "prompt"]);
}

function itemMatchesSearch(item, query) {
  const scopeKeys = SEARCH_SCOPES.filter((scope) => filters.searchScopes[scope.key]).map((scope) => scope.key);
  const haystack = getSearchScopeText(item, scopeKeys);
  const normalizedHaystack = expandSearchText(haystack);
  const terms = String(query || "").trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  return terms.every((term) => {
    const normalizedTerm = normalizeText(term);
    return normalizedHaystack.includes(normalizedTerm) || hasSemanticOverlap(haystack, term) || normalizeText(romanizeKorean(haystack)).includes(normalizedTerm);
  });
}

function getSearchScopeText(item, scopeKeys) {
  const fields = {
    title: [item.title],
    tags: [...(item.tags || []), ...(item.categories || [])],
    body: [item.summary, item.useCase, item.notes, item.platform, item.type, item.url],
    prompt: [item.prompt],
  };
  return scopeKeys.flatMap((key) => fields[key] || []).join(" ");
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function expandSearchText(value) {
  const raw = String(value || "");
  const normalized = normalizeText(raw);
  const semanticWords = getSemanticWords(raw);
  return normalizeText([raw, romanizeKorean(raw), ...semanticWords].join(" "));
}

function getSemanticWords(value) {
  const normalized = normalizeText(value);
  const groups = [
    ["요약", "summary", "summarize", "brief", "정리", "핵심"],
    ["회의", "회의록", "미팅", "meeting", "minutes", "actionitem", "액션아이템"],
    ["글쓰기", "writing", "copywriting", "draft", "초안", "원고", "블로그", "blog", "seo"],
    ["리서치", "research", "조사", "분석", "시장조사", "경쟁사", "market", "competitor"],
    ["코딩", "coding", "code", "dev", "개발", "디버깅", "debug", "api", "버그"],
    ["마케팅", "marketing", "sales", "세일즈", "광고", "ad", "campaign", "캠페인"],
    ["이미지", "image", "visual", "design", "비주얼", "디자인", "사진"],
    ["업무", "work", "productivity", "생산성", "자동화", "automation"],
    ["메일", "email", "mail", "이메일", "답장", "reply", "회신"],
    ["번역", "translation", "translate", "영어", "english", "한국어", "korean"],
    ["기획", "idea", "아이디어", "strategy", "전략", "제안", "proposal"],
  ];
  return groups
    .filter((group) => group.some((word) => normalized.includes(normalizeText(word))))
    .flat();
}

function getCategoryColor(category) {
  const saved = state.categoryColors?.[category];
  if (isHexColor(saved)) return saved;
  const palette = ["#3e73ff", "#18c884", "#f26a8d", "#8a72df", "#ff8b5d", "#1aa49b", "#c87832", "#6f8cff"];
  const index = Math.abs(String(category || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % palette.length;
  return palette[index];
}

function categoryStyleAttribute(category) {
  const color = getCategoryColor(category);
  return ` style="--category-color: ${escapeAttribute(color)}"`;
}

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

function normalizePromptText(value) {
  return normalizeText(value).replace(/[.,;:!?'"`~()[\]<>]/g, "");
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "").toLowerCase();
}

function getPromptSimilarity(a, b) {
  const left = new Set(normalizePromptText(a).match(/.{1,12}/g) || []);
  const right = new Set(normalizePromptText(b).match(/.{1,12}/g) || []);
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((part) => right.has(part)).length;
  return shared / Math.max(left.size, right.size);
}

function slugify(value) {
  return normalizeText(value).replace(/[^a-z0-9가-힣_-]/g, "") || "value";
}

function romanizeKorean(value) {
  const quick = {
    회의: "hoeui meeting",
    회의록: "hoeuirok meeting minutes",
    요약: "yoyak summary",
    글쓰기: "geulsseugi writing",
    리서치: "research",
    업무: "eopmu work",
    마케팅: "marketing",
    이미지: "image",
    코딩: "coding",
  };
  return Object.entries(quick)
    .filter(([key]) => String(value).includes(key))
    .map(([, roman]) => roman)
    .join(" ");
}

function splitList(value) {
  if (Array.isArray(value)) return value;
  return String(value || "")
    .split(/[|,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function intersectionCount(a = [], b = []) {
  const set = new Set(a);
  return b.filter((item) => set.has(item)).length;
}

function compareDate(a, b) {
  return new Date(a || 0).getTime() - new Date(b || 0).getTime();
}

function cloneItem(item) {
  return { ...item, id: makeId(), categories: [...item.categories], tags: [...item.tags] };
}

function makeId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function shorten(text, length) {
  const value = String(text || "");
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}...`;
}

function formatBytes(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function highlightMatches(text) {
  const value = String(text ?? "");
  const terms = getHighlightTerms();
  if (!terms.length) return escapeHtml(value);
  const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  return value.split(pattern).map((part) => {
    if (!part) return "";
    const matched = terms.some((term) => part.toLowerCase() === term.toLowerCase());
    return matched ? `<mark class="search-highlight">${escapeHtml(part)}</mark>` : escapeHtml(part);
  }).join("");
}

function getHighlightTerms() {
  const query = String(filters.query || "").trim();
  if (!query) return [];
  return [...new Set(query.split(/\s+/).concat(query).map((term) => term.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(text) {
  return escapeHtml(text).replaceAll("`", "&#096;");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(message, type = "") {
  const toastHost = document.querySelector("dialog[open] .dialog-inner") || document.body;
  if (elements.toast.parentElement !== toastHost) toastHost.appendChild(elements.toast);
  elements.toast.textContent = message;
  elements.toast.className = `toast visible ${type}`.trim();
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.className = "toast";
  }, 1800);
}
