const workspaces = {
  home: {
    eyebrow: "Home Base",
    title: "오늘의 흐름을 한 화면에서 정리하세요.",
    description:
      "링크, 메모, 작업, 프롬프트, 유틸 도구를 블록처럼 배치하는 개인용 모듈러 대시보드입니다.",
  },
  creator: {
    eyebrow: "Creator Desk",
    title: "영상 제작에 필요한 시작점을 한곳에 모으세요.",
    description:
      "편집 도구, 레퍼런스, 자막 정리, 생성형 AI 프롬프트를 프로젝트 단위로 빠르게 꺼낼 수 있습니다.",
  },
  utility: {
    eyebrow: "Utility Dock",
    title: "작은 계산과 정리를 빠르게 처리하세요.",
    description:
      "글자 수, 발표 시간, 비율, 텍스트 정리, 네이밍처럼 자주 쓰는 미니 도구를 블록으로 둡니다.",
  },
  business: {
    eyebrow: "Business Lab",
    title: "수익화 아이디어와 실행 항목을 가볍게 실험하세요.",
    description:
      "프리랜서 링크, 견적 계산, 콘텐츠 주제, 웹앱 아이디어를 부담 없이 쌓아두는 공간입니다.",
  },
};

const typeMeta = {
  link: { label: "Link", dna: "Link", color: "#69e5d2", size: "size-medium" },
  note: { label: "Note", dna: "Think", color: "#9b8cff", size: "size-medium" },
  task: { label: "Task", dna: "Do", color: "#68f2a8", size: "size-tall" },
  prompt: { label: "Prompt", dna: "Create", color: "#79a7ff", size: "size-wide" },
  utility: { label: "Utility", dna: "Utility", color: "#ff8db7", size: "size-small" },
};

const seedBlocks = [
  {
    id: "today-flow",
    workspace: "home",
    type: "task",
    title: "오늘의 작업",
    content: "Base Grid 첫 화면 정리\n영상 아이디어 3개 적기\n자주 쓰는 링크 정리",
    priority: "High",
  },
  {
    id: "daily-links",
    workspace: "home",
    type: "link",
    title: "자주 쓰는 링크",
    content: "Vercel\nGitHub\nGoogle Drive\nChatGPT",
    priority: "Core",
  },
  {
    id: "quick-note",
    workspace: "home",
    type: "note",
    title: "빠른 메모",
    content: "떠오른 생각을 일단 여기에 적고, 나중에 프로젝트 블록으로 옮깁니다.",
    priority: "Capture",
  },
  {
    id: "editing-launchpad",
    workspace: "creator",
    type: "link",
    title: "Editing Launchpad",
    content: "Premiere Pro\nAfter Effects\n프로젝트 폴더\n렌더 출력 폴더",
    priority: "Start",
  },
  {
    id: "caption-toolkit",
    workspace: "creator",
    type: "utility",
    title: "Caption Toolkit",
    content: "자막 문장을 짧게 나누고, 말맛은 살리되 읽기 편하게 다듬기",
    priority: "Utility",
  },
  {
    id: "prompt-shelf",
    workspace: "creator",
    type: "prompt",
    title: "Prompt Shelf",
    content: "이미지 생성\n영상 기획\n자막 원고\n네이밍\n썸네일 문구",
    priority: "Create",
  },
  {
    id: "ratio-calc",
    workspace: "utility",
    type: "utility",
    title: "Ratio Calculator",
    content: "16:9, 9:16, 4:5 비율과 자막바 영역을 빠르게 계산",
    priority: "Tool",
  },
  {
    id: "text-cleaner",
    workspace: "utility",
    type: "utility",
    title: "Text Cleaner",
    content: "복사한 텍스트에서 불필요한 공백, 이상한 줄바꿈, 지저분한 기호를 정리",
    priority: "Tool",
  },
  {
    id: "idea-incubator",
    workspace: "business",
    type: "note",
    title: "Idea Incubator",
    content: "작게 만들 수 있는 웹앱, 자동화, 콘텐츠 상품 아이디어를 카드처럼 저장",
    priority: "Think",
  },
  {
    id: "action-stack",
    workspace: "business",
    type: "task",
    title: "Action Stack",
    content: "오늘 30분 안에 할 수 있는 일\n견적 템플릿 정리\n랜딩 문구 5개 쓰기",
    priority: "Do",
  },
];

const storageKey = "base-grid-blocks-v1";
const appShell = document.querySelector(".app-shell");
const gridCanvas = document.querySelector("#gridCanvas");
const workspaceTitle = document.querySelector("#workspaceTitle");
const workspaceEyebrow = document.querySelector("#workspaceEyebrow");
const workspaceDescription = document.querySelector("#workspaceDescription");
const searchInput = document.querySelector("#searchInput");
const composer = document.querySelector("#composer");
const composerForm = document.querySelector("#composerForm");
const closeComposer = document.querySelector("#closeComposer");
const cancelComposer = document.querySelector("#cancelComposer");
const blockType = document.querySelector("#blockType");
const blockTitle = document.querySelector("#blockTitle");
const blockContent = document.querySelector("#blockContent");
const blockUrlField = document.querySelector("#blockUrlField");
const blockUrl = document.querySelector("#blockUrl");
const inspectorTitle = document.querySelector("#inspectorTitle");
const inspectorText = document.querySelector("#inspectorText");
const inspectorMeta = document.querySelector("#inspectorMeta");
const inspector = document.querySelector("#inspector");
const duplicateBlock = document.querySelector("#duplicateBlock");
const deleteBlock = document.querySelector("#deleteBlock");
const commandPalette = document.querySelector("#commandPalette");
const commandSearch = document.querySelector("#commandSearch");
const commandResults = document.querySelector("#commandResults");
const closeCommand = document.querySelector("#closeCommand");

let activeWorkspace = "home";
let selectedBlockId = null;
let focusMode = false;
let draggedBlockId = null;
let blocks = loadBlocks();

function loadBlocks() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) {
    return seedBlocks;
  }

  try {
    const parsed = JSON.parse(saved);
    const migrated = parsed.filter(
      (block) => block.id !== "ai-clean" && block.title !== "AI Quick Clean",
    );
    if (migrated.length !== parsed.length) {
      localStorage.setItem(storageKey, JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return seedBlocks;
  }
}

function saveBlocks() {
  localStorage.setItem(storageKey, JSON.stringify(blocks));
}

function setWorkspace(workspaceId) {
  activeWorkspace = workspaceId;
  selectedBlockId = null;

  document.querySelectorAll(".workspace-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.workspace === workspaceId);
  });

  const workspace = workspaces[workspaceId];
  workspaceEyebrow.textContent = workspace.eyebrow;
  workspaceTitle.textContent = workspace.title;
  workspaceDescription.textContent = workspace.description;

  renderBlocks();
  clearInspector();
}

function renderBlocks() {
  const visibleBlocks = blocks.filter((block) => block.workspace === activeWorkspace);

  gridCanvas.innerHTML = "";

  if (visibleBlocks.length === 0) {
    const empty = document.createElement("article");
    empty.className = "block-card size-full";
    empty.style.setProperty("--block-color", "#9b8cff");
    empty.innerHTML = `
      <div class="block-top">
        <div>
          <span class="block-type">Empty</span>
          <h3>표시할 블록이 없습니다</h3>
        </div>
      </div>
      <p>새 블록을 추가해 주세요.</p>
    `;
    gridCanvas.append(empty);
    return;
  }

  visibleBlocks.forEach((block) => {
    const meta = typeMeta[block.type] ?? typeMeta.note;
    const card = document.createElement("article");
    card.className = `block-card ${meta.size}`;
    card.dataset.id = block.id;
    card.draggable = true;
    card.style.setProperty("--block-color", meta.color);
    card.classList.toggle("selected", selectedBlockId === block.id);
    card.classList.toggle("focus-hidden", focusMode && block.priority !== "High" && block.priority !== "Core");

    card.innerHTML = `
      <div class="drag-grip" aria-hidden="true">⋮⋮</div>
      <div class="block-top">
        <div>
          <span class="block-type">${meta.label}</span>
          <h3>${escapeHtml(block.title)}</h3>
        </div>
        <span class="chip">${meta.dna}</span>
      </div>
      ${renderContent(block)}
      <div class="block-footer">
        <span class="chip">${escapeHtml(block.priority)}</span>
        ${renderBlockAction(block)}
      </div>
    `;

    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-link-action]")) {
        return;
      }

      selectBlock(block.id);
    });
    card.addEventListener("dragstart", handleDragStart);
    card.addEventListener("dragover", handleDragOver);
    card.addEventListener("dragleave", handleDragLeave);
    card.addEventListener("drop", handleDrop);
    card.addEventListener("dragend", handleDragEnd);
    gridCanvas.append(card);
  });
}

function renderContent(block) {
  const lines = block.content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    return `<ul class="block-list">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
  }

  return `<p>${escapeHtml(block.content)}</p>`;
}

function renderBlockAction(block) {
  if (block.type === "link" && block.url) {
    return `<a class="block-action" href="${escapeHtml(normalizeUrl(block.url))}" target="_blank" rel="noreferrer" data-link-action="true">열기</a>`;
  }

  return `<button class="block-action" type="button">선택</button>`;
}

function selectBlock(blockId) {
  selectedBlockId = blockId;
  inspector.classList.remove("is-hidden");
  appShell.classList.remove("inspector-collapsed");
  const block = blocks.find((item) => item.id === blockId);
  if (!block) {
    clearInspector();
    return;
  }

  const meta = typeMeta[block.type] ?? typeMeta.note;
  inspectorTitle.textContent = block.title;
  inspectorText.textContent = block.content.replaceAll("\n", " · ");
  inspectorMeta.innerHTML = `
    <div class="meta-item"><span>Type</span><strong>${meta.label}</strong></div>
    <div class="meta-item"><span>DNA</span><strong>${meta.dna}</strong></div>
    <div class="meta-item"><span>Workspace</span><strong>${workspaces[block.workspace].eyebrow}</strong></div>
    <div class="meta-item"><span>Priority</span><strong>${block.priority}</strong></div>
    ${block.url ? `<div class="meta-item"><span>URL</span><strong>${escapeHtml(block.url)}</strong></div>` : ""}
  `;
  duplicateBlock.disabled = false;
  deleteBlock.disabled = false;
  renderBlocks();
}

function clearInspector() {
  inspectorTitle.textContent = "블록을 선택해 주세요";
  inspectorText.textContent =
    "각 블록은 Link, Think, Do, Create, Utility 같은 성격을 가지고 있어 나중에 검색과 필터링이 쉬워집니다.";
  inspectorMeta.innerHTML = "";
  duplicateBlock.disabled = true;
  deleteBlock.disabled = true;
}

function addBlock(type, title = "", content = "", url = "") {
  const meta = typeMeta[type] ?? typeMeta.note;
  const newBlock = {
    id: createId(),
    workspace: activeWorkspace,
    type,
    title: title || `${meta.label} Block`,
    content: content || (type === "link" ? "링크 설명을 입력해 주세요." : "새 블록 내용을 입력해 주세요."),
    url: type === "link" ? url.trim() : "",
    priority: type === "task" ? "High" : "New",
  };

  blocks = [newBlock, ...blocks];
  saveBlocks();
  selectBlock(newBlock.id);
}

function openComposerForType(type = "link") {
  blockType.value = type;
  blockTitle.value = "";
  blockContent.value = "";
  blockUrl.value = "";
  syncComposerFields();
  openComposerModal();
  blockTitle.focus();
}

function syncComposerFields() {
  const isLink = blockType.value === "link";
  blockUrlField.hidden = !isLink;
  blockUrl.required = isLink;
  blockContent.required = !isLink;
  blockContent.placeholder = isLink
    ? "링크 설명이나 함께 기억할 메모를 적어 주세요."
    : "링크, 메모, 할 일, 프롬프트 등을 적어 주세요.";
}

function openCommandPalette() {
  commandSearch.value = "";
  renderCommandResults("");
  openDialog(commandPalette);
  commandSearch.focus();
}

function renderCommandResults(query) {
  const normalizedQuery = query.trim().toLowerCase();
  const workspaceResults = Object.entries(workspaces)
    .filter(([id, workspace]) =>
      `${id} ${workspace.eyebrow} ${workspace.title}`.toLowerCase().includes(normalizedQuery),
    )
    .map(([id, workspace]) => ({
      type: "workspace",
      id,
      title: workspace.eyebrow,
      detail: workspace.title,
      badge: "Workspace",
    }));

  const blockResults = blocks
    .filter((block) =>
      `${block.title} ${block.content} ${block.url ?? ""} ${block.type} ${block.priority}`
        .toLowerCase()
        .includes(normalizedQuery),
    )
    .slice(0, 8)
    .map((block) => ({
      type: "block",
      id: block.id,
      title: block.title,
      detail: workspaces[block.workspace].eyebrow,
      badge: typeMeta[block.type]?.label ?? "Block",
    }));

  const actionResults = [
    { type: "action", id: "add-link", title: "새 링크 블록 추가", detail: "URL을 입력할 수 있는 링크 블록", badge: "Action" },
    { type: "action", id: "add-note", title: "새 메모 블록 추가", detail: "빠르게 생각을 저장", badge: "Action" },
  ].filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(normalizedQuery));

  const results = [...workspaceResults, ...blockResults, ...actionResults].slice(0, 10);

  if (results.length === 0) {
    commandResults.innerHTML = `
      <div class="palette-empty">
        <strong>검색 결과가 없습니다</strong>
        <span>Enter를 누르면 새 메모 블록으로 만들 수 있습니다.</span>
      </div>
    `;
    return;
  }

  commandResults.innerHTML = results
    .map(
      (result) => `
        <button class="palette-result" type="button" data-type="${result.type}" data-id="${result.id}">
          <span>
            <strong>${escapeHtml(result.title)}</strong>
            <small>${escapeHtml(result.detail)}</small>
          </span>
          <em>${escapeHtml(result.badge)}</em>
        </button>
      `,
    )
    .join("");
}

function runCommand(type, id) {
  commandPalette.close();

  if (type === "workspace") {
    setWorkspace(id);
    return;
  }

  if (type === "block") {
    const block = blocks.find((item) => item.id === id);
    if (block) {
      setWorkspace(block.workspace);
      selectBlock(block.id);
    }
    return;
  }

  if (id === "add-link") {
    openComposerForType("link");
    return;
  }

  if (id === "add-note") {
    openComposerForType("note");
  }
}

function handleDragStart(event) {
  draggedBlockId = event.currentTarget.dataset.id;
  event.currentTarget.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedBlockId);
}

function handleDragOver(event) {
  event.preventDefault();
  if (event.currentTarget.dataset.id !== draggedBlockId) {
    event.currentTarget.classList.add("drag-over");
  }
}

function handleDragLeave(event) {
  event.currentTarget.classList.remove("drag-over");
}

function handleDrop(event) {
  event.preventDefault();
  const targetId = event.currentTarget.dataset.id;
  event.currentTarget.classList.remove("drag-over");
  if (!draggedBlockId || draggedBlockId === targetId) {
    return;
  }

  reorderBlocks(draggedBlockId, targetId);
  draggedBlockId = null;
}

function handleDragEnd() {
  document.querySelectorAll(".block-card").forEach((card) => {
    card.classList.remove("is-dragging", "drag-over");
  });
  draggedBlockId = null;
}

function reorderBlocks(sourceId, targetId) {
  const sourceIndex = blocks.findIndex((block) => block.id === sourceId);
  const targetIndex = blocks.findIndex((block) => block.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) {
    return;
  }

  const [moved] = blocks.splice(sourceIndex, 1);
  const nextTargetIndex = blocks.findIndex((block) => block.id === targetId);
  blocks.splice(nextTargetIndex, 0, moved);
  saveBlocks();
  renderBlocks();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeUrl(url) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `https://${url}`;
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }

  dialog.setAttribute("open", "");
}

function openComposerModal() {
  openDialog(composer);
}

document.querySelectorAll(".workspace-item").forEach((button) => {
  button.addEventListener("click", () => setWorkspace(button.dataset.workspace));
});

document.querySelectorAll(".quick-add button").forEach((button) => {
  button.addEventListener("click", () => openComposerForType(button.dataset.type));
});

document.querySelector("#openComposer").addEventListener("click", () => openComposerForType("link"));

blockType.addEventListener("change", syncComposerFields);

composerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addBlock(blockType.value, blockTitle.value.trim(), blockContent.value.trim(), blockUrl.value.trim());
  composer.close();
});

closeComposer.addEventListener("click", () => composer.close());
cancelComposer.addEventListener("click", () => composer.close());

composer.addEventListener("click", (event) => {
  if (event.target === composer) {
    composer.close();
  }
});

searchInput.addEventListener("click", openCommandPalette);

commandSearch.addEventListener("input", () => renderCommandResults(commandSearch.value));

commandSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const firstResult = commandResults.querySelector(".palette-result");
    if (firstResult) {
      runCommand(firstResult.dataset.type, firstResult.dataset.id);
      return;
    }

    addBlock("note", commandSearch.value.trim(), "Command Palette에서 빠르게 만든 메모입니다.");
    commandPalette.close();
  }
});

commandResults.addEventListener("click", (event) => {
  const result = event.target.closest(".palette-result");
  if (!result) {
    return;
  }

  runCommand(result.dataset.type, result.dataset.id);
});

closeCommand.addEventListener("click", () => commandPalette.close());

commandPalette.addEventListener("click", (event) => {
  if (event.target === commandPalette) {
    commandPalette.close();
  }
});

document.querySelector("#themeButton").addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
});

document.querySelector("#focusButton").addEventListener("click", () => {
  focusMode = !focusMode;
  renderBlocks();
});

duplicateBlock.addEventListener("click", () => {
  const block = blocks.find((item) => item.id === selectedBlockId);
  if (!block) {
    return;
  }

  const cloned = {
    ...block,
    id: createId(),
    title: `${block.title} Copy`,
  };
  blocks = [cloned, ...blocks];
  saveBlocks();
  selectBlock(cloned.id);
});

deleteBlock.addEventListener("click", () => {
  if (!selectedBlockId) {
    return;
  }

  blocks = blocks.filter((block) => block.id !== selectedBlockId);
  selectedBlockId = null;
  saveBlocks();
  clearInspector();
  renderBlocks();
});

document.querySelector("#closeInspector").addEventListener("click", () => {
  clearInspector();
  inspector.classList.add("is-hidden");
  appShell.classList.add("inspector-collapsed");
});

document.addEventListener("keydown", (event) => {
  const isCommandSearch =
    (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";

  if (isCommandSearch) {
    event.preventDefault();
    openCommandPalette();
  }

  if (event.key === "Escape" && commandPalette.open) {
    commandPalette.close();
  }
});

setWorkspace(activeWorkspace);
