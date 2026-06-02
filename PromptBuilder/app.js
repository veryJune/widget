const STORAGE_KEY = "prompt-dock-v1";
const THEME_KEY = "prompt-dock-theme";
const PLATFORM_ORDER = ["Any", "GPTs", "Gems", "Perplexity", "ChatGPT", "Gemini", "Claude", "Other"];
const DEFAULT_CATEGORIES = ["요약", "글쓰기", "리서치", "업무", "코딩", "마케팅", "이미지", "학습"];

const platformClass = {
  Any: "platform-any",
  GPTs: "platform-gpts",
  Gems: "platform-gems",
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
  view: "card",
  sort: "recent",
};
let formDraft = {
  categories: [],
  tags: [],
};
let hoverTimer = null;
let platformExpanded = false;
let currentTheme = localStorage.getItem(THEME_KEY) || "dark";
let draggedCategory = "";
let suppressCategoryClick = false;

const $ = (selector) => document.querySelector(selector);

const elements = {
  search: $("#searchInput"),
  searchBtn: $("#searchBtn"),
  platformFilters: $("#platformFilters"),
  categoryFilters: $("#categoryFilters"),
  sort: $("#sortSelect"),
  viewButtons: document.querySelectorAll(".seg"),
  itemsView: $("#itemsView"),
  favoriteSection: $("#favoriteSection"),
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
  urlInput: $("#urlInput"),
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
  themeToggleBtn: $("#themeToggleBtn"),
  themeIcon: $("#themeIcon"),
  categoryDialog: $("#categoryDialog"),
  closeCategoryBtn: $("#closeCategoryBtn"),
  categoryNameInput: $("#categoryNameInput"),
  addCategoryBtn: $("#addCategoryBtn"),
  categoryList: $("#categoryList"),
  resetSampleBtn: $("#resetSampleBtn"),
};

bindEvents();
applyTheme(currentTheme);
render();

function bindEvents() {
  elements.platformInput.innerHTML = PLATFORM_ORDER.map((platform) => `<option value="${platform}">${platform}</option>`).join("");

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
  elements.closeCategoryBtn.addEventListener("click", () => elements.categoryDialog.close());
  elements.addCategoryBtn.addEventListener("click", addCategoryFromInput);
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
  elements.tagInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(elements.tagInput.value);
    }
    if (event.key === "Backspace" && !elements.tagInput.value && formDraft.tags.length) {
      formDraft.tags.pop();
      renderSelectedTags();
    }
  });

  elements.importBtn.addEventListener("click", () => elements.importInput.click());
  elements.importInput.addEventListener("change", importFile);
  elements.exportBtn.addEventListener("click", () => elements.exportDialog.showModal());
  elements.closeExportBtn.addEventListener("click", () => elements.exportDialog.close());
  elements.downloadJsonBtn.addEventListener("click", exportJson);
  elements.downloadCsvBtn.addEventListener("click", exportCsv);
  elements.closeDetailBtn.addEventListener("click", () => elements.detailDialog.close());
  bindBackdropClose(elements.itemDialog);
  bindBackdropClose(elements.categoryDialog);
  bindBackdropClose(elements.exportDialog);
  bindBackdropClose(elements.detailDialog);

  elements.resetSampleBtn.addEventListener("click", () => {
    const confirmed = window.confirm("현재 데이터를 샘플 데이터로 교체할까요? 먼저 내보내기로 백업해두는 것을 권장합니다.");
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
  const discoveredCategories = [...new Set(items.flatMap((item) => splitList(item.categories)))];
  const inputCategories = Array.isArray(input?.categories) ? input.categories : splitList(input?.categories);
  const categories = [...new Set([...(inputCategories.length ? inputCategories : DEFAULT_CATEGORIES), ...discoveredCategories])].filter(Boolean);
  return {
    categories,
    items: items.map(normalizeItem),
  };
}

function normalizeItem(item) {
  const now = new Date().toISOString();
  const platform = PLATFORM_ORDER.includes(item.platform) ? item.platform : "Any";
  return {
    id: item.id || makeId(),
    title: String(item.title || "제목 없음").trim(),
    type: item.type || "text_prompt",
    platform,
    categories: Array.isArray(item.categories) ? item.categories.filter(Boolean) : splitList(item.categories),
    tags: Array.isArray(item.tags) ? item.tags.filter(Boolean) : splitList(item.tags),
    summary: item.summary || "",
    useCase: item.useCase || "",
    prompt: item.prompt || "",
    url: item.url || "",
    notes: item.notes || "",
    favorite: Boolean(item.favorite),
    createdAt: item.createdAt || now,
    updatedAt: item.updatedAt || now,
    lastUsedAt: item.lastUsedAt || "",
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  renderFilters();
  renderItems();
  renderCategoryEditor();
}

function renderFilters() {
  const primaryPlatforms = ["전체", "Any", "GPTs", "Gems"];
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
    return `<button class="chip category-chip ${active ? "active" : ""}" data-category="${escapeAttribute(category)}" type="button"${orderAttrs}>${escapeHtml(label)}</button>`;
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

function renderItems() {
  const visible = getVisibleItems();
  elements.resultCount.textContent = `${visible.length}개 항목`;

  const favorites = visible.filter((item) => item.favorite).slice(0, 4);
  elements.favoriteSection.innerHTML = favorites.length
    ? `<div class="dock-title"><h3>즐겨찾기</h3><small>${favorites.length}개</small></div><div class="items-grid">${favorites.map(renderCard).join("")}</div>`
    : "";

  elements.itemsView.className = `items-grid ${filters.view === "list" ? "list-view" : ""} ${filters.view === "compact" ? "compact-view" : ""}`;
  if (!visible.length) {
    elements.itemsView.innerHTML = `<div class="empty-state"><p>조건에 맞는 항목이 없습니다. 검색어를 줄이거나 새 항목을 추가해보세요.</p></div>`;
  } else if (filters.view === "list") {
    elements.itemsView.innerHTML = visible.map(renderListRow).join("");
  } else if (filters.view === "compact") {
    elements.itemsView.innerHTML = visible.map(renderCompactRow).join("");
  } else {
    elements.itemsView.innerHTML = visible.map(renderCard).join("");
  }
  attachItemEvents();
}

function getVisibleItems() {
  const query = normalizeText(filters.query);
  return [...state.items]
    .filter((item) => filters.platform === "전체" || item.platform === filters.platform)
    .filter((item) => !filters.categories.length || filters.categories.some((category) => item.categories.includes(category)))
    .filter((item) => {
      if (!query) return true;
      return normalizeText(searchBlob(item)).includes(query);
    })
    .sort(sortItems);
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
      <div class="meta-line">${item.categories.slice(0, 3).map((category) => `<span class="category-pill">${escapeHtml(category)}</span>`).join("")}</div>
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

function renderListRow(item) {
  const id = escapeAttribute(item.id);
  const platformBadgeClass = platformClass[item.platform] || platformClass.Other;
  return `
    <article class="list-row" data-id="${id}" tabindex="0">
      <div class="row-title">
        <strong>${highlightMatches(item.title)}</strong>
        <small>${highlightMatches(item.summary || item.useCase || "요약 없음")}</small>
      </div>
      <span class="platform-badge ${platformBadgeClass}">${escapeHtml(item.platform)}</span>
      <div class="meta-line">${item.categories.slice(0, 2).map((category) => `<span class="category-pill">${escapeHtml(category)}</span>`).join("")}</div>
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

function renderCompactRow(item) {
  const id = escapeAttribute(item.id);
  const platformBadgeClass = platformClass[item.platform] || platformClass.Other;
  return `
    <article class="compact-row" data-id="${id}" tabindex="0">
      <div class="row-title"><strong>${highlightMatches(item.title)}</strong><small>${highlightMatches(item.summary || item.useCase || "")}</small></div>
      <span class="platform-badge ${platformBadgeClass}">${escapeHtml(item.platform)}</span>
      <div class="meta-line">${item.categories.slice(0, 2).map((category) => `<span class="category-pill">${escapeHtml(category)}</span>`).join("")}</div>
      <div class="row-actions">
        <button class="star-button ${item.favorite ? "active" : ""}" data-action="favorite" data-id="${id}" type="button" aria-label="${item.favorite ? "즐겨찾기 해제" : "즐겨찾기"}">${item.favorite ? "★" : "☆"}</button>
        ${item.prompt ? `<button class="tool-button" data-action="copy" data-id="${id}" type="button" aria-label="프롬프트 복사">⧉</button>` : ""}
        ${item.url ? `<button class="tool-button" data-action="open" data-id="${id}" type="button" aria-label="링크 열기">↗</button>` : ""}
        ${item.url ? `<button class="tool-button" data-action="copyLink" data-id="${id}" type="button" aria-label="링크 복사">⌁</button>` : ""}
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

  document.querySelectorAll("[data-id].prompt-card, [data-id].list-row, [data-id].compact-row").forEach((card) => {
    card.addEventListener("mouseenter", (event) => {
      const item = findItem(card.dataset.id);
      if (item) showHoverPreview(item, card, event);
    });
    card.addEventListener("mouseleave", scheduleHoverHide);
    card.addEventListener("focus", () => {
      const item = findItem(card.dataset.id);
      if (item) showHoverPreview(item, card);
    });
    card.addEventListener("blur", scheduleHoverHide);
    card.addEventListener("click", () => {
      const item = findItem(card.dataset.id);
      if (item) openDetail(item);
    });
  });
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
      <div class="meta-line">${item.categories.map((category) => `<span class="category-pill">${escapeHtml(category)}</span>`).join("")}</div>
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
  elements.platformInput.value = item?.platform || "Any";
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
  renderFormCategories();
  renderSelectedTags();
  renderTagSuggestions();
  elements.itemDialog.showModal();
  elements.titleInput.focus();
}

function renderFormCategories() {
  elements.formCategories.innerHTML = state.categories.map((category) => {
    const active = formDraft.categories.includes(category);
    return `<button class="chip ${active ? "active" : ""}" data-form-category="${escapeAttribute(category)}" type="button">${escapeHtml(category)}</button>`;
  }).join("");
  elements.formCategories.querySelectorAll("[data-form-category]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleFormCategory(button.dataset.formCategory);
    });
  });
}

function toggleFormCategory(category) {
  if (formDraft.categories.includes(category)) {
    formDraft.categories = formDraft.categories.filter((item) => item !== category);
  } else {
    formDraft.categories.push(category);
  }
  renderFormCategories();
}

function renderSelectedTags() {
  elements.selectedTags.innerHTML = formDraft.tags.map((tag) => {
    return `<button class="chip active" data-remove-tag="${escapeAttribute(tag)}" type="button">${escapeHtml(tag)} <span class="remove">×</span></button>`;
  }).join("");
  elements.selectedTags.querySelectorAll("[data-remove-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      formDraft.tags = formDraft.tags.filter((tag) => tag !== button.dataset.removeTag);
      renderSelectedTags();
      renderTagSuggestions();
    });
  });
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
  const existingTags = [...new Set(state.items.flatMap((item) => item.tags))].filter(Boolean);
  const lowerQuery = normalizeText(query);
  const aliasMatches = Object.entries(tagAliases)
    .filter(([tag, aliases]) => {
      const blob = normalizeText([tag, ...aliases].join(" "));
      return lowerQuery && blob.includes(lowerQuery);
    })
    .flatMap(([tag, aliases]) => [tag, ...aliases]);

  const ranked = [...new Set([...existingTags, ...aliasMatches])].filter((tag) => {
    if (formDraft.tags.includes(tag)) return false;
    if (!lowerQuery) return true;
    const blob = normalizeText([tag, ...(tagAliases[tag] || [])].join(" "));
    return blob.includes(lowerQuery) || romanizeKorean(tag).includes(lowerQuery);
  });

  return ranked.sort((a, b) => tagScore(b, query) - tagScore(a, query) || a.localeCompare(b, "ko"));
}

function tagScore(tag, query) {
  const usage = state.items.filter((item) => item.tags.includes(tag)).length;
  const normalized = normalizeText(tag);
  const lowerQuery = normalizeText(query);
  const starts = lowerQuery && normalized.startsWith(lowerQuery) ? 20 : 0;
  return usage * 5 + starts;
}

function addTag(value) {
  const tag = value.trim().replace(/^#/, "");
  if (!tag) return;
  if (!formDraft.tags.includes(tag)) formDraft.tags.push(tag);
  elements.tagInput.value = "";
  renderSelectedTags();
  renderTagSuggestions();
}

function saveItemFromForm() {
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
    tags: formDraft.tags,
    summary: elements.summaryInput.value.trim(),
    url: elements.urlInput.value.trim(),
    prompt: elements.promptInput.value.trim(),
    useCase: elements.useCaseInput.value.trim(),
    notes: elements.notesInput.value.trim(),
    favorite: existing?.favorite || false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastUsedAt: existing?.lastUsedAt || "",
  });

  if (!item.prompt && !item.url) {
    showToast("프롬프트나 링크 중 하나는 입력해주세요.");
    return;
  }

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

function deleteCurrentItem() {
  const id = elements.itemId.value;
  if (!id) return;
  const item = findItem(id);
  if (!item) return;
  const confirmed = window.confirm(`"${item.title}" 항목을 삭제할까요?`);
  if (!confirmed) return;
  state.items = state.items.filter((entry) => entry.id !== id);
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
        <div class="meta-line">${item.categories.map((category) => `<span class="category-pill">${escapeHtml(category)}</span>`).join("")}</div>
        <div class="meta-line">${item.tags.map((tag) => `<span class="tag-pill">#${escapeHtml(tag)}</span>`).join("")}</div>
      </div>

      ${item.useCase ? `<div class="detail-panel"><h3>사용 목적</h3><p>${escapeHtml(item.useCase)}</p></div>` : ""}
      ${variables.length ? renderVariablePanel(item, variables) : ""}
      ${item.prompt ? `<div class="detail-panel copy-panel"><div class="panel-title-row"><h3>완성될 프롬프트</h3><button class="field-copy-button" data-field-copy="prompt" type="button">복사</button></div><div class="prompt-preview">${escapeHtml(item.prompt)}</div></div>` : ""}
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
  if (!elements.detailDialog.open) elements.detailDialog.showModal();
}

function renderVariablePanel(item, variables) {
  return `
    <div class="detail-panel">
      <h3>변수 입력</h3>
      <div class="variable-grid">
        ${variables.map((variable) => `
          <label>
            ${escapeHtml(variable)}
            <input data-variable="${escapeAttribute(variable)}" placeholder="${escapeAttribute(variable)} 입력" />
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
}

function bindBackdropClose(dialog) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
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
  let text = item.prompt;
  elements.detailBody.querySelectorAll("[data-variable]").forEach((input) => {
    const key = input.dataset.variable;
    text = text.replaceAll(`{${key}}`, input.value || `{${key}}`);
  });
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
  saveState();
  renderItems();
}

function toggleFavorite(id) {
  const item = findItem(id);
  if (!item) return;
  item.favorite = !item.favorite;
  item.updatedAt = new Date().toISOString();
  saveState();
  renderItems();
}

function openCategoryDialog() {
  renderCategoryEditor();
  elements.categoryDialog.showModal();
  elements.categoryNameInput.focus();
}

function renderCategoryEditor() {
  elements.categoryList.innerHTML = state.categories.map((category) => `
    <div class="category-edit-row" draggable="true" data-category-row="${escapeAttribute(category)}">
      <span class="drag-handle" aria-hidden="true">⋮⋮</span>
      <input value="${escapeAttribute(category)}" data-category-edit="${escapeAttribute(category)}" />
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
  elements.categoryList.querySelectorAll("[data-category-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteCategory(button.dataset.categoryDelete));
  });
}

function addCategoryFromInput() {
  const category = elements.categoryNameInput.value.trim();
  if (!category) return;
  if (!state.categories.includes(category)) state.categories.push(category);
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
  state.items.forEach((item) => {
    item.categories = item.categories.map((category) => category === oldName ? newName : category);
  });
  filters.categories = filters.categories.map((category) => category === oldName ? newName : category);
  formDraft.categories = formDraft.categories.map((category) => category === oldName ? newName : category);
  saveState();
  render();
  renderFormCategories();
}

function deleteCategory(category) {
  const confirmed = window.confirm(`"${category}" 카테고리를 삭제할까요? 항목에서는 이 카테고리만 제거됩니다.`);
  if (!confirmed) return;
  state.categories = state.categories.filter((item) => item !== category);
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
}

function exportCsv() {
  const headers = ["title", "type", "platform", "categories", "tags", "summary", "useCase", "prompt", "url", "notes", "favorite"];
  const rows = state.items.map((item) => headers.map((key) => {
    const value = Array.isArray(item[key]) ? item[key].join("|") : item[key];
    return csvEscape(value ?? "");
  }).join(","));
  const csvContent = `\uFEFF${[headers.join(","), ...rows].join("\r\n")}`;
  downloadFile(`prompt-dock-${dateStamp()}.csv`, csvContent, "text/csv;charset=utf-8");
  elements.exportDialog.close();
}

async function importFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = file.name.toLowerCase().endsWith(".csv") ? importCsvText(text) : JSON.parse(text);
    state = normalizeState(imported);
    saveState();
    render();
    showToast("가져오기가 완료되었습니다.");
  } catch (error) {
    showToast("가져오기에 실패했습니다. 파일 형식을 확인해주세요.");
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
  return [
    item.title,
    item.platform,
    item.type,
    item.summary,
    item.useCase,
    item.prompt,
    item.url,
    item.notes,
    ...item.categories,
    ...item.tags,
  ].join(" ");
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
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

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("visible");
  }, 1800);
}
