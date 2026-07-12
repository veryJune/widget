const EPSILON = 0.000001;
const MAX_PREVIEW_WIDTH = 320;
const MAX_PREVIEW_HEIGHT = 180;
const TEXT_CHARS_PER_MINUTE = 300;
const HISTORY_LIMIT = 10;

const guideMessages = {
  ratio: ["Fill any 3 values, then Calculate.", "Use presets to set Input 1:Input 2.", "− / × / + adjusts one field.", "↔ swaps width and height."],
  percent: ["Choose the percent formula first.", "The sentence and use cases explain when to use it.", "Enter A and B values.", "The result updates instantly."],
  text: ["Paste or type text.", "Move the Text speed slider.", "100% uses 300 Korean chars per minute.", "Stats update instantly."],
  fuel: ["Enter distance, efficiency, and fuel price.", "Choose one-way or round trip.", "Fuel prices are manually entered."],
  estimate: ["Video estimate is a rough freelancer helper.", "Adjust baseline rates when needed.", "Low/Standard/High are proposal ranges."],
  unit: ["Enter two products.", "Use g/kg/ml/L/ea units.", "The cheaper unit price is highlighted."]
};

const percentHelp = {
  part: {
    labels: ["Value A", "Percent B"],
    description: "전체 금액이나 수량에서 특정 퍼센트만큼의 값을 구할 때 사용합니다.",
    uses: ["할인 금액", "세금/수수료", "목표 달성분", "예산 일부"]
  },
  rate: {
    labels: ["Whole A", "Part B"],
    description: "전체 중 일부가 몇 퍼센트인지 확인할 때 사용합니다.",
    uses: ["출석률", "진행률", "점유율", "달성률"]
  },
  change: {
    labels: ["Before A", "After B"],
    description: "값이 A에서 B로 바뀌었을 때 증가율 또는 감소율을 구합니다.",
    uses: ["가격 상승률", "매출 감소율", "조회수 증가율", "방문자 변화"]
  },
  adjust: {
    labels: ["Value A", "Percent B"],
    description: "값에 특정 퍼센트를 더하거나 빼서 최종 금액을 계산합니다.",
    uses: ["할인 후 가격", "인상 후 금액", "세금 포함 금액", "견적 조정"]
  },
  whole: {
    labels: ["Percent A", "Part B"],
    description: "일부 값과 그 퍼센트만 알 때 전체 값을 역산합니다.",
    uses: ["원래 가격 역산", "전체 예산 추정", "모집 정원 계산", "전체 매출 추정"]
  }
};

const estimateTypeSettings = {
  short: {
    label: "Short/SNS",
    labelKr: "Short/SNS",
    multiplier: 0.85,
    motionFactor: 0.2,
    note: {
      en: "Short/SNS work is usually short and edit-driven, so the base estimate starts lower.",
      kr: "Short/SNS는 짧은 러닝타임과 빠른 편집 중심이라 기본 견적을 낮게 잡습니다."
    }
  },
  promo: {
    label: "Promo video",
    labelKr: "홍보 영상",
    multiplier: 1.15,
    motionFactor: 0.35,
    note: {
      en: "Promo videos need stronger planning, filming quality, and post work, so the estimate rises.",
      kr: "Promo video는 기획, 촬영 완성도, 후반 보정 비중이 커져 표준보다 높게 잡습니다."
    }
  },
  interview: {
    label: "Interview",
    labelKr: "인터뷰",
    multiplier: 1,
    motionFactor: 0.15,
    note: {
      en: "Interview projects balance filming and editing. Adjust edit days for subtitles and cuts.",
      kr: "Interview는 촬영/편집 균형형입니다. 자막과 컷 편집 분량에 따라 편집일을 조정하세요."
    }
  },
  event: {
    label: "Event recap",
    labelKr: "행사 스케치",
    multiplier: 1.2,
    motionFactor: 0.2,
    note: {
      en: "Event recaps have more on-site variables, so shoot days and staff costs matter more.",
      kr: "Event recap은 현장 변수와 촬영 시간이 커서 촬영일/스태프 비용 영향이 큽니다."
    }
  },
  editing: {
    label: "Editing only",
    labelKr: "편집 전용",
    multiplier: 0.9,
    motionFactor: 0,
    forceShootZero: true,
    note: {
      en: "Editing only excludes filming and focuses on cut editing, subtitles, and delivery polish.",
      kr: "Editing only는 촬영 없이 컷 편집, 자막, 납품 정리에 집중하는 견적입니다."
    }
  },
  motion: {
    label: "Motion graphic",
    labelKr: "모션그래픽",
    multiplier: 1.35,
    motionFactor: 1,
    forceShootZero: true,
    note: {
      en: "Motion graphic work is driven by motion days more than filming. Tune motion rate and difficulty.",
      kr: "Motion graphic은 촬영보다 모션 작업일 영향이 큽니다. 모션 단가와 난이도를 꼭 조정하세요."
    }
  }
};

let activeTab = "ratio";
let activePercentMode = "part";
let isBootstrapping = true;
let currentLanguage = "en";

const localizedGuides = {
  en: guideMessages,
  kr: {
    ratio: ["값 3개를 입력한 뒤 Calculate를 누르세요.", "프리셋은 Input 1:Input 2 비율을 설정합니다.", "− / × / +로 각 입력값을 조정합니다.", "↔는 가로/세로를 바꿉니다."],
    percent: ["먼저 백분율 공식을 선택하세요.", "설명과 예시가 쓰임새를 알려줍니다.", "A와 B 값을 입력하세요.", "결과는 즉시 갱신됩니다."],
    text: ["텍스트를 붙여넣거나 입력하세요.", "Text speed 슬라이더를 조정하세요.", "100%는 한국어 기준 분당 300자입니다.", "통계는 즉시 갱신됩니다."],
    fuel: ["거리, 연비, 유가를 입력하세요.", "편도 또는 왕복을 선택하세요.", "유가는 직접 입력합니다."],
    estimate: ["영상 프리랜서 견적 보조 도구입니다.", "필요하면 기준 단가를 조정하세요.", "Low/Standard/High는 제안 범위입니다."],
    unit: ["두 제품을 입력하세요.", "g/kg, ml/L, 개 단위로 비교합니다.", "더 저렴한 단가를 강조합니다."]
  }
};

const percentLocale = {
  en: {
    part: { labels: ["Value A", "Percent B"], description: "Use this to find a specific percent of a total amount.", uses: ["Discount amount", "Tax/fee", "Goal portion", "Budget share"] },
    rate: { labels: ["Whole A", "Part B"], description: "Use this to see what percent a part is of the whole.", uses: ["Attendance rate", "Progress", "Market share", "Achievement"] },
    change: { labels: ["Before A", "After B"], description: "Use this to calculate increase or decrease from A to B.", uses: ["Price increase", "Sales drop", "View growth", "Traffic change"] },
    adjust: { labels: ["Value A", "Percent B"], description: "Use this to add or subtract a percent from a value.", uses: ["Discounted price", "Raised amount", "Tax included", "Estimate adjustment"] },
    whole: { labels: ["Percent A", "Part B"], description: "Use this to reverse-calculate the whole from a part and percent.", uses: ["Original price", "Total budget", "Capacity", "Total sales"] }
  },
  kr: percentHelp
};

const estimateTooltips = {
  en: {
    "estimate-type": "Choose the kind of video. It changes the cost multiplier and work mix.",
    "estimate-runtime": "Final video length in minutes.",
    "estimate-shoot-days": "Number of days needed for actual filming.",
    "estimate-edit-days": "Days for cut editing, subtitles, and basic post-production.",
    "estimate-difficulty": "Work complexity and quality target.",
    "estimate-urgency": "How fast the project must be delivered.",
    "estimate-revisions": "Total revision rounds requested by the client.",
    "estimate-options": "Additional equipment, props, color, sound, or motion costs.",
    "rate-plan": "Planning or project management day rate.",
    "rate-shoot": "Director or camera operator day rate.",
    "rate-staff": "Assistant or production staff day rate.",
    "rate-edit": "Editing day rate.",
    "rate-motion": "Motion graphic day rate.",
    "rate-revision": "Fee for each revision beyond the included rounds."
  },
  kr: {
    "estimate-type": "영상 종류입니다. 견적 배수와 작업 비중에 반영됩니다.",
    "estimate-runtime": "완성 영상의 러닝타임(분)입니다.",
    "estimate-shoot-days": "실제 촬영이 필요한 일수입니다.",
    "estimate-edit-days": "컷 편집, 자막, 기본 후반 작업에 쓰는 일수입니다.",
    "estimate-difficulty": "요구 퀄리티와 작업 복잡도입니다.",
    "estimate-urgency": "납품 일정의 촉박함입니다.",
    "estimate-revisions": "클라이언트가 요청하는 총 수정 횟수입니다.",
    "estimate-options": "장비, 소품, 색보정, 사운드, 모션 등 추가 비용입니다.",
    "rate-plan": "기획 또는 프로젝트 관리 1일 단가입니다.",
    "rate-shoot": "연출 또는 촬영 1일 단가입니다.",
    "rate-staff": "보조 스태프 1일 단가입니다.",
    "rate-edit": "편집 1일 단가입니다.",
    "rate-motion": "모션그래픽 1일 단가입니다.",
    "rate-revision": "포함 수정 횟수를 넘긴 추가 수정 1회 비용입니다."
  }
};

const ratePresets = {
  entry: { plan: 180000, shoot: 300000, staff: 120000, edit: 220000, motion: 260000, revision: 50000 },
  standard: { plan: 250000, shoot: 400000, staff: 180000, edit: 300000, motion: 350000, revision: 80000 },
  premium: { plan: 400000, shoot: 650000, staff: 280000, edit: 500000, motion: 650000, revision: 150000 }
};

const inputElements = ["input1", "input2", "input3", "input4"].map((id) => document.getElementById(id));
const output = document.getElementById("output");
const simplifiedOutput = document.getElementById("simplified-output");
const preview = document.getElementById("ratio-preview");
const previewStage = document.querySelector(".preview-stage");
const previewBox = document.getElementById("preview-box");
const previewLabel = document.getElementById("preview-label");
const themeToggle = document.getElementById("theme-toggle");
const languageToggle = document.getElementById("language-toggle");
const guideToggle = document.getElementById("guide-toggle");
const historyToggle = document.getElementById("history-toggle");
const guidePopover = document.getElementById("guide-popover");
const historyPopover = document.getElementById("history-popover");
const historyList = document.getElementById("history-list");
const tabButtons = document.querySelectorAll("[data-tab]");
const tabPanels = document.querySelectorAll("[data-panel]");
const percentModeButtons = document.querySelectorAll("[data-percent-mode]");

function byId(id) {
  return document.getElementById(id);
}

function isNumber(value) {
  return !isNaN(value) && isFinite(value);
}

function readNumber(id) {
  return parseFloat(byId(id).value);
}

function formatNumber(value) {
  if (!isNumber(value)) return "";
  return parseFloat(value.toFixed(6)).toString();
}

function formatWon(value) {
  if (!isNumber(value)) return "0원";
  return Math.round(value).toLocaleString("ko-KR") + "원";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getValues() {
  return inputElements.map((input) => parseFloat(input.value));
}

function getDecimalPlaces(value) {
  const text = value.toString();
  if (text.indexOf("e-") !== -1) return parseInt(text.split("e-")[1], 10);
  if (text.indexOf(".") === -1) return 0;
  return text.split(".")[1].length;
}

function getGreatestCommonDivisor(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function getSimplifiedRatio(widthRatio, heightRatio) {
  const scale = Math.pow(10, Math.max(getDecimalPlaces(widthRatio), getDecimalPlaces(heightRatio)));
  const width = Math.round(Math.abs(widthRatio) * scale);
  const height = Math.round(Math.abs(heightRatio) * scale);
  const divisor = getGreatestCommonDivisor(width, height);
  if (!divisor) return null;
  return formatNumber(width / divisor) + ":" + formatNumber(height / divisor);
}

function ratiosMatch(a, b, c, d) {
  if (b === 0 || d === 0) return false;
  return Math.abs(a / b - c / d) < EPSILON;
}

function historyKey(tabName) {
  return "calcDeckHistory:" + tabName;
}

function getHistory(tabName) {
  try {
    return JSON.parse(localStorage.getItem(historyKey(tabName)) || "[]");
  } catch (error) {
    return [];
  }
}

function saveHistory(tabName, entry) {
  if (isBootstrapping || !entry) return;

  const normalizedEntry = typeof entry === "string" ? {
    label: entry,
    tab: tabName,
    values: collectTabValues(tabName),
    result: entry,
    createdAt: new Date().toISOString()
  } : entry;
  const history = getHistory(tabName).filter((item) => {
    const label = typeof item === "string" ? item : item.label;
    return label !== normalizedEntry.label;
  });
  history.unshift(normalizedEntry);
  try {
    localStorage.setItem(historyKey(tabName), JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  } catch (error) {
    return;
  }
}

function renderHistory() {
  const history = getHistory(activeTab);
  historyList.innerHTML = history.length ? history.map((item, index) => {
    const label = typeof item === "string" ? item : item.label;
    const disabled = typeof item === "string" ? " is-static" : "";
    return "<button type=\"button\" class=\"history-item" + disabled + "\" data-history-index=\"" + index + "\">" + escapeHtml(label) + "</button>";
  }).join("") : "<div class=\"history-empty\">" + (currentLanguage === "kr" ? "아직 기록이 없습니다." : "No history yet.") + "</div>";
}

function collectTabValues(tabName) {
  const panel = document.querySelector("[data-panel=\"" + tabName + "\"]");
  const values = {};

  if (!panel) return values;

  panel.querySelectorAll("input, select, textarea").forEach((field) => {
    if (field.id) values[field.id] = field.value;
  });

  if (tabName === "percent") values.activePercentMode = activePercentMode;

  return values;
}

function restoreHistoryItem(index) {
  const item = getHistory(activeTab)[index];

  if (!item || typeof item === "string" || !item.values) return;

  isBootstrapping = true;
  setActiveTab(item.tab || activeTab);

  Object.keys(item.values).forEach((id) => {
    if (id === "activePercentMode") return;
    const field = byId(id);
    if (field) field.value = item.values[id];
  });

  if (item.values.activePercentMode) setPercentMode(item.values.activePercentMode);
  recalculateTab(item.tab || activeTab);
  isBootstrapping = false;
  closePopovers();
}

function recalculateTab(tabName) {
  if (tabName === "ratio") updatePreview();
  if (tabName === "percent") updatePercent();
  if (tabName === "text") updateText();
  if (tabName === "fuel") updateFuel();
  if (tabName === "estimate") updateEstimate();
  if (tabName === "unit") updateUnitPrice();
}

function closePopovers() {
  guidePopover.classList.add("is-hidden");
  historyPopover.classList.add("is-hidden");
  guideToggle.setAttribute("aria-expanded", "false");
}

function updateGuide() {
  guidePopover.innerHTML = localizedGuides[currentLanguage][activeTab].map((message) => "<p>" + message + "</p>").join("");
}

function setActiveTab(tabName) {
  activeTab = tabName;
  tabButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tabName));
  tabPanels.forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === tabName));
  updateGuide();
  closePopovers();
  if (tabName === "ratio") updatePreview();
  if (tabName === "percent") updatePercent();
  if (tabName === "text") updateText();
  if (tabName === "fuel") updateFuel();
  if (tabName === "estimate") updateEstimate();
  if (tabName === "unit") updateUnitPrice();
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function applyLanguage(language) {
  const previousBootstrapState = isBootstrapping;

  isBootstrapping = true;
  currentLanguage = language;
  languageToggle.textContent = language === "kr" ? "EN" : "KR";
  byId("brand-reset").title = language === "kr" ? "전체 입력 초기화" : "Reset all inputs";
  byId("theme-toggle").setAttribute("aria-label", language === "kr" ? "테마 전환" : "Switch theme");
  byId("language-toggle").setAttribute("aria-label", language === "kr" ? "영어로 전환" : "Switch to Korean");
  byId("history-toggle").setAttribute("aria-label", language === "kr" ? "기록 보기" : "Show history");
  byId("guide-toggle").setAttribute("aria-label", language === "kr" ? "가이드 보기" : "Show guide");
  setText("[data-tab=\"ratio\"]", language === "kr" ? "비율" : "Ratio");
  setText("[data-tab=\"percent\"]", language === "kr" ? "퍼센트" : "Percent");
  setText("[data-tab=\"text\"]", language === "kr" ? "텍스트" : "Text");
  setText("[data-tab=\"estimate\"]", language === "kr" ? "견적" : "Estimate");
  setText("[data-tab=\"unit\"]", language === "kr" ? "단가비교" : "Unit Price");
  setText("[data-tab=\"fuel\"]", language === "kr" ? "연료비" : "Fuel");
  setText("#calculate-btn", language === "kr" ? "계산" : "CALCULATE");
  setText("#reset-btn", language === "kr" ? "초기화" : "RESET");
  setText("[data-percent-mode=\"part\"]", language === "kr" ? "A의 B%" : "A's B%");
  setText("[data-percent-mode=\"rate\"]", language === "kr" ? "일부는 몇 %" : "Part %");
  setText("[data-percent-mode=\"change\"]", language === "kr" ? "증감률" : "Change %");
  setText("[data-percent-mode=\"adjust\"]", language === "kr" ? "증가/감소" : "Adjust");
  setText("[data-percent-mode=\"whole\"]", language === "kr" ? "전체값" : "Whole");
  setText(".use-title", language === "kr" ? "활용 예시" : "Use cases");
  setText(".rate-editor summary", language === "kr" ? "기준 단가 편집" : "Editable baseline rates");
  setText("#history-copy", language === "kr" ? "복사" : "Copy");
  setText("#history-clear", language === "kr" ? "삭제" : "Clear");
  setText(".popover-title", language === "kr" ? "기록" : "History");
  ["input1", "input2", "input3", "input4"].forEach((id, index) => {
    setText("label[for=\"" + id + "\"]", language === "kr" ? "입력 " + (index + 1) : "Input " + (index + 1));
  });
  byId("flip-btn").title = language === "kr" ? "가로/세로 뒤집기" : "Flip width and height";
  byId("flip-btn").setAttribute("aria-label", byId("flip-btn").title);
  setText("label[for=\"percent-direction\"]", language === "kr" ? "방향" : "Direction");
  setText("#percent-direction option[value=\"increase\"]", language === "kr" ? "증가" : "Increase");
  setText("#percent-direction option[value=\"decrease\"]", language === "kr" ? "감소" : "Decrease");
  setText("label[for=\"text-input\"]", language === "kr" ? "텍스트" : "Text");
  setText("label[for=\"fuel-distance\"]", language === "kr" ? "거리 (km)" : "Distance (km)");
  setText("label[for=\"fuel-efficiency\"]", language === "kr" ? "연비 (km/L)" : "Fuel efficiency (km/L)");
  setText("label[for=\"fuel-price\"]", language === "kr" ? "유가 (원/L)" : "Fuel price (won/L)");
  setText("label[for=\"fuel-trip\"]", language === "kr" ? "이동" : "Trip");
  setText("#fuel-trip option[value=\"oneway\"]", language === "kr" ? "편도" : "One-way");
  setText("#fuel-trip option[value=\"round\"]", language === "kr" ? "왕복" : "Round trip");
  setText("label[for=\"estimate-type\"]", language === "kr" ? "영상 유형" : "Video type");
  setText("#estimate-type option[value=\"promo\"]", language === "kr" ? "홍보 영상" : "Promo video");
  setText("#estimate-type option[value=\"interview\"]", language === "kr" ? "인터뷰" : "Interview");
  setText("#estimate-type option[value=\"event\"]", language === "kr" ? "행사 스케치" : "Event recap");
  setText("#estimate-type option[value=\"editing\"]", language === "kr" ? "편집 전용" : "Editing only");
  setText("#estimate-type option[value=\"motion\"]", language === "kr" ? "모션그래픽" : "Motion graphic");
  setText("label[for=\"estimate-runtime\"]", language === "kr" ? "러닝타임(분)" : "Runtime (minutes)");
  setText("label[for=\"estimate-shoot-days\"]", language === "kr" ? "촬영일" : "Shoot days");
  setText("label[for=\"estimate-edit-days\"]", language === "kr" ? "편집일" : "Edit days");
  setText("label[for=\"estimate-difficulty\"]", language === "kr" ? "난이도" : "Difficulty");
  setText("label[for=\"estimate-urgency\"]", language === "kr" ? "긴급도" : "Urgency");
  setText("label[for=\"estimate-revisions\"]", language === "kr" ? "수정 횟수" : "Revision count");
  setText("label[for=\"estimate-options\"]", language === "kr" ? "옵션" : "Options");
  setText("#estimate-difficulty option[value=\"0.85\"]", language === "kr" ? "낮음" : "Low");
  setText("#estimate-difficulty option[value=\"1\"]", language === "kr" ? "표준" : "Standard");
  setText("#estimate-difficulty option[value=\"1.35\"]", language === "kr" ? "높음" : "High");
  setText("#estimate-difficulty option[value=\"1.7\"]", language === "kr" ? "전문가급" : "Expert");
  setText("#estimate-urgency option[value=\"1\"]", language === "kr" ? "보통" : "Normal");
  setText("#estimate-urgency option[value=\"1.25\"]", language === "kr" ? "빠름" : "Fast");
  setText("#estimate-urgency option[value=\"1.5\"]", language === "kr" ? "긴급" : "Rush");
  setText("#estimate-options option[value=\"0\"]", language === "kr" ? "없음" : "None");
  setText("#estimate-options option[value=\"150000\"]", language === "kr" ? "장비/소품" : "Equipment/props");
  setText("#estimate-options option[value=\"250000\"]", language === "kr" ? "색보정/사운드" : "Color/Sound");
  setText("#estimate-options option[value=\"500000\"]", language === "kr" ? "모션 + 색보정/사운드" : "Motion + Color/Sound");
  setText("#reset-rates", language === "kr" ? "단가 초기화" : "Reset rates");
  setText("label[for=\"rate-plan\"]", language === "kr" ? "기획/PM 1일" : "Planning/PM per day");
  setText("label[for=\"rate-shoot\"]", language === "kr" ? "연출/촬영 1일" : "Director/Shoot per day");
  setText("label[for=\"rate-staff\"]", language === "kr" ? "스태프 1일" : "Staff per day");
  setText("label[for=\"rate-edit\"]", language === "kr" ? "편집 1일" : "Editing per day");
  setText("label[for=\"rate-motion\"]", language === "kr" ? "모션 1일" : "Motion per day");
  setText("label[for=\"rate-revision\"]", language === "kr" ? "추가 수정비" : "Extra revision fee");
  ["a", "b"].forEach((suffix) => {
    setText("label[for=\"unit-name-" + suffix + "\"]", language === "kr" ? "이름" : "Name");
    setText("label[for=\"unit-price-" + suffix + "\"]", language === "kr" ? "가격" : "Price");
    setText("label[for=\"unit-amount-" + suffix + "\"]", language === "kr" ? "용량/수량" : "Amount");
    setText("label[for=\"unit-type-" + suffix + "\"]", language === "kr" ? "단위" : "Unit");
  });
  updateEstimateTooltips();
  updateGuide();
  updatePercent();
  updateEstimate();
  isBootstrapping = previousBootstrapState;

  try {
    localStorage.setItem("calcDeckLanguage", language);
  } catch (error) {
    return;
  }
}

function toggleLanguage() {
  applyLanguage(currentLanguage === "kr" ? "en" : "kr");
}

function updateEstimateTooltips() {
  const tooltips = estimateTooltips[currentLanguage];

  Object.keys(tooltips).forEach((id) => {
    const label = document.querySelector("label[for=\"" + id + "\"]");
    if (label) label.title = tooltips[id];
  });
}

function resetAllInputs() {
  isBootstrapping = true;
  document.querySelectorAll("input, select, textarea").forEach((field) => {
    if (field.type === "button") return;
    if (field.tagName === "SELECT") {
      field.selectedIndex = Array.from(field.options).findIndex((option) => option.defaultSelected);
      if (field.selectedIndex < 0) field.selectedIndex = 0;
    } else if (field.type === "range") {
      field.value = field.defaultValue || field.getAttribute("value") || "100";
    } else {
      field.value = field.defaultValue || "";
    }
  });
  activePercentMode = "part";
  setPercentMode("part");
  setRatioOutput("", true);
  closePopovers();
  updatePreview();
  updatePercent();
  updateText();
  updateFuel();
  updateEstimate();
  updateUnitPrice();
  isBootstrapping = false;
}

function applyRatePreset(name) {
  const preset = ratePresets[name];

  if (!preset) return;

  byId("rate-plan").value = preset.plan;
  byId("rate-shoot").value = preset.shoot;
  byId("rate-staff").value = preset.staff;
  byId("rate-edit").value = preset.edit;
  byId("rate-motion").value = preset.motion;
  byId("rate-revision").value = preset.revision;
  updateEstimate();
}

function updateTargetHighlight() {
  const values = getValues();
  const emptyIndexes = values.map((value, index) => isNumber(value) ? null : index).filter((index) => index !== null);
  inputElements.forEach((input) => input.closest(".input-field").classList.remove("is-target"));
  if (emptyIndexes.length === 1) inputElements[emptyIndexes[0]].closest(".input-field").classList.add("is-target");
}

function setRatioOutput(message, isHint) {
  output.textContent = message;
  output.className = isHint ? "result-panel hint" : "result-panel";
}

function updatePreview() {
  const values = getValues();
  const widthRatio = values[0];
  const heightRatio = values[1];
  updateTargetHighlight();
  if (!isNumber(widthRatio) || !isNumber(heightRatio) || widthRatio <= 0 || heightRatio <= 0) {
    preview.classList.add("is-hidden");
    simplifiedOutput.textContent = "";
    return;
  }
  preview.classList.remove("is-hidden");
  const stageWidth = previewStage ? previewStage.clientWidth - 30 : MAX_PREVIEW_WIDTH;
  const stageHeight = previewStage ? previewStage.clientHeight - 30 : MAX_PREVIEW_HEIGHT;
  const maxWidth = Math.min(MAX_PREVIEW_WIDTH, Math.max(stageWidth, 24));
  const maxHeight = Math.min(MAX_PREVIEW_HEIGHT, Math.max(stageHeight, 24));
  const scale = Math.min(maxWidth / widthRatio, maxHeight / heightRatio);
  previewBox.style.width = Math.max(widthRatio * scale, 24) + "px";
  previewBox.style.height = Math.max(heightRatio * scale, 24) + "px";
  previewLabel.textContent = formatNumber(widthRatio) + ":" + formatNumber(heightRatio);
  simplifiedOutput.textContent = "Simplified: " + getSimplifiedRatio(widthRatio, heightRatio);
}

function hasZeroDenominator(values, missingIndex) {
  if (missingIndex !== 1 && values[1] === 0) return true;
  if (missingIndex !== 3 && values[3] === 0) return true;
  if (missingIndex === 0 && values[3] === 0) return true;
  if (missingIndex === 2 && values[1] === 0) return true;
  if (missingIndex === 1 && values[2] === 0) return true;
  if (missingIndex === 3 && values[0] === 0) return true;
  return false;
}

function calculateRatio() {
  const values = getValues();
  const filledIndexes = values.map((value, index) => isNumber(value) ? index : null).filter((index) => index !== null);
  if (filledIndexes.length < 3) {
    setRatioOutput("Please enter at least 3 values.", false);
    updatePreview();
    return;
  }
  const missingIndex = values.findIndex((value) => !isNumber(value));
  if (hasZeroDenominator(values, missingIndex)) {
    setRatioOutput("Cannot divide by zero. Please change any zero denominator values.", false);
    updatePreview();
    return;
  }
  if (filledIndexes.length === 4 && !ratiosMatch(values[0], values[1], values[2], values[3])) {
    setRatioOutput("Inputs are not in the same ratio.", false);
    updatePreview();
    return;
  }
  if (missingIndex === 0) values[0] = values[1] * values[2] / values[3];
  if (missingIndex === 1) values[1] = values[0] * values[3] / values[2];
  if (missingIndex === 2) values[2] = values[0] * values[3] / values[1];
  if (missingIndex === 3) values[3] = values[1] * values[2] / values[0];
  if (missingIndex !== -1) inputElements[missingIndex].value = formatNumber(values[missingIndex]);
  const message = formatNumber(values[0]) + ":" + formatNumber(values[1]) + " = " + formatNumber(values[2]) + ":" + formatNumber(values[3]);
  setRatioOutput(message, false);
  updatePreview();
  saveHistory("ratio", message + " / " + simplifiedOutput.textContent);
}

function resetRatio() {
  inputElements.forEach((input) => input.value = "");
  setRatioOutput("", true);
  updatePreview();
}

function setPreset(width, height) {
  inputElements[0].value = width;
  inputElements[1].value = height;
  setRatioOutput("", true);
  updatePreview();
}

function flipPair(firstInput, secondInput) {
  const firstValue = firstInput.value;
  firstInput.value = secondInput.value;
  secondInput.value = firstValue;
}

function flipRatio() {
  flipPair(inputElements[0], inputElements[1]);
  if (inputElements[2].value !== "" || inputElements[3].value !== "") flipPair(inputElements[2], inputElements[3]);
  setRatioOutput("", true);
  updatePreview();
}

function setPercentMode(mode) {
  activePercentMode = mode;
  percentModeButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.percentMode === mode));
  byId("percent-direction-row").classList.toggle("is-hidden", mode !== "adjust");
  updatePercent();
}

function updatePercent() {
  const a = readNumber("percent-a");
  const b = readNumber("percent-b");
  const help = percentLocale[currentLanguage][activePercentMode];
  let result = "";
  let formula = "";
  byId("percent-label-a").textContent = help.labels[0];
  byId("percent-label-b").textContent = help.labels[1];
  byId("percent-description").textContent = help.description;
  byId("percent-use-cases").innerHTML = help.uses.map((item) => "<span>" + item + "</span>").join("");
  if (!isNumber(a) || !isNumber(b)) {
    byId("percent-result").textContent = "Enter both values.";
    byId("percent-formula").textContent = "";
    return;
  }
  if (activePercentMode === "part") {
    result = formatNumber(a * b / 100);
    formula = a + " × " + b + "% = " + result;
  } else if (activePercentMode === "rate") {
    result = a === 0 ? "Cannot divide by zero." : formatNumber(b / a * 100) + "%";
    formula = a === 0 ? "" : b + " ÷ " + a + " × 100";
  } else if (activePercentMode === "change") {
    if (a === 0) {
      result = "Cannot divide by zero.";
    } else {
      const change = (b - a) / a * 100;
      result = formatNumber(Math.abs(change)) + "% " + (change >= 0 ? "increase" : "decrease");
      formula = "(" + b + " − " + a + ") ÷ " + a + " × 100";
    }
  } else if (activePercentMode === "adjust") {
    const multiplier = byId("percent-direction").value === "increase" ? 1 + b / 100 : 1 - b / 100;
    result = formatNumber(a * multiplier);
    formula = byId("percent-direction").value === "increase" ? a + " × (1 + " + b + "%)" : a + " × (1 − " + b + "%)";
  } else if (activePercentMode === "whole") {
    result = a === 0 ? "Cannot divide by zero." : formatNumber(b / (a / 100));
    formula = a === 0 ? "" : b + " ÷ (" + a + "%)";
  }
  byId("percent-result").textContent = result;
  byId("percent-formula").textContent = formula;
  if (result && result !== "Cannot divide by zero.") saveHistory("percent", help.labels.join(" / ") + ": " + result);
}

function countBytes(text) {
  return new Blob([text]).size;
}

function formatDuration(totalSeconds) {
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = Math.round(totalSeconds % 60);
  if (seconds === 60) {
    minutes++;
    seconds = 0;
  }
  return minutes + ":" + seconds.toString().padStart(2, "0");
}

function updateText() {
  const text = byId("text-input").value;
  const speed = readNumber("text-speed");
  const charsWithSpaces = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const seconds = charsWithSpaces / (TEXT_CHARS_PER_MINUTE * (speed / 100)) * 60 || 0;
  byId("text-speed-label").textContent = speed + "%";
  byId("text-with-spaces").textContent = charsWithSpaces;
  byId("text-no-spaces").textContent = charsNoSpaces;
  byId("text-bytes").textContent = countBytes(text);
  byId("text-words").textContent = words;
  byId("text-result").textContent = "Estimated time: " + formatDuration(seconds);
  if (charsWithSpaces) saveHistory("text", charsWithSpaces + " chars / " + words + " words / " + formatDuration(seconds));
}

function updateFuel() {
  const distance = readNumber("fuel-distance");
  const efficiency = readNumber("fuel-efficiency");
  const price = readNumber("fuel-price");
  const tripMultiplier = byId("fuel-trip").value === "round" ? 2 : 1;
  if (!isNumber(distance) || !isNumber(efficiency) || !isNumber(price) || efficiency <= 0) {
    byId("fuel-result").textContent = currentLanguage === "kr" ? "거리, 연비, 유가를 올바르게 입력하세요." : "Enter valid distance, efficiency, and price.";
    return;
  }
  const totalDistance = distance * tripMultiplier;
  const liters = totalDistance / efficiency;
  const cost = liters * price;
  const message = formatNumber(liters) + " L / " + formatWon(cost);
  byId("fuel-result").textContent = message;
  saveHistory("fuel", totalDistance + "km → " + message);
}

function updateEstimate() {
  const shootDays = readNumber("estimate-shoot-days") || 0;
  const editDays = readNumber("estimate-edit-days") || 0;
  const runtime = readNumber("estimate-runtime") || 0;
  const difficulty = readNumber("estimate-difficulty") || 1;
  const urgency = readNumber("estimate-urgency") || 1;
  const revisions = readNumber("estimate-revisions") || 0;
  const optionFee = readNumber("estimate-options") || 0;
  const planRate = readNumber("rate-plan") || 0;
  const shootRate = readNumber("rate-shoot") || 0;
  const staffRate = readNumber("rate-staff") || 0;
  const editRate = readNumber("rate-edit") || 0;
  const motionRate = readNumber("rate-motion") || 0;
  const revisionRate = readNumber("rate-revision") || 0;
  const type = byId("estimate-type").value;
  const typeSetting = estimateTypeSettings[type] || estimateTypeSettings.short;
  if (typeSetting.forceShootZero && byId("estimate-shoot-days").value !== "0") {
    byId("estimate-shoot-days").value = "0";
  }
  const finalShootDays = typeSetting.forceShootZero ? 0 : shootDays;
  const planningDays = Math.max(0.5, runtime * 0.25);
  const motionDays = Math.max(0, runtime * typeSetting.motionFactor);
  const labor = planRate * planningDays + shootRate * finalShootDays + staffRate * finalShootDays + editRate * editDays + motionRate * motionDays;
  const revisionFee = Math.max(0, revisions - 2) * revisionRate;
  const standard = (labor + optionFee + revisionFee) * difficulty * urgency * typeSetting.multiplier;
  const spread = Math.min(0.42, 0.14 + (difficulty - 1) * 0.16 + (urgency - 1) * 0.18);
  byId("estimate-low").textContent = formatWon(standard * (1 - spread));
  byId("estimate-standard").textContent = formatWon(standard);
  byId("estimate-high").textContent = formatWon(standard * (1 + spread));
  byId("estimate-type-note").textContent = typeSetting.note[currentLanguage];
  const typeLabel = currentLanguage === "kr" ? typeSetting.labelKr : typeSetting.label;
  saveHistory("estimate", typeLabel + " / Standard " + formatWon(standard));
}

function normalizeUnit(amount, unit) {
  if (unit === "kg") return { amount: amount * 1000, base: "100g", divisor: 100 };
  if (unit === "g") return { amount: amount, base: "100g", divisor: 100 };
  if (unit === "l") return { amount: amount * 1000, base: "1L", divisor: 1000 };
  if (unit === "ml") return { amount: amount, base: "1L", divisor: 1000 };
  return { amount: amount, base: "1ea", divisor: 1 };
}

function getUnitFamily(unit) {
  if (unit === "g" || unit === "kg") return "weight";
  if (unit === "ml" || unit === "l") return "volume";
  return "count";
}

function syncComparableUnit(changedSuffix) {
  const source = byId("unit-type-" + changedSuffix);
  const targetSuffix = changedSuffix === "a" ? "b" : "a";
  const target = byId("unit-type-" + targetSuffix);

  if (getUnitFamily(source.value) === getUnitFamily(target.value)) return;

  if (source.value === "g" || source.value === "kg") target.value = source.value === "g" ? "kg" : "g";
  if (source.value === "ml" || source.value === "l") target.value = source.value === "ml" ? "l" : "ml";
  if (source.value === "ea") target.value = "ea";
}

function getUnitProduct(suffix) {
  const name = byId("unit-name-" + suffix).value || suffix.toUpperCase();
  const price = readNumber("unit-price-" + suffix);
  const amount = readNumber("unit-amount-" + suffix);
  const unit = byId("unit-type-" + suffix).value;
  if (!isNumber(price) || !isNumber(amount) || amount <= 0) return null;
  const normalized = normalizeUnit(amount, unit);
  return {
    name: name,
    base: normalized.base,
    unitPrice: price / normalized.amount * normalized.divisor
  };
}

function updateUnitPrice() {
  const a = getUnitProduct("a");
  const b = getUnitProduct("b");
  byId("unit-card-a").classList.remove("is-cheaper");
  byId("unit-card-b").classList.remove("is-cheaper");
  if (!a || !b || a.base !== b.base) {
    const invalidText = currentLanguage === "kr" ? "값을 입력하세요." : "Enter valid values.";
    byId("unit-result-a").textContent = a ? formatWon(a.unitPrice) + " / " + a.base : invalidText;
    byId("unit-result-b").textContent = b ? formatWon(b.unitPrice) + " / " + b.base : invalidText;
    byId("unit-winner").textContent = currentLanguage === "kr" ? "같은 기준끼리 비교하세요: 무게끼리, 부피끼리, 또는 개수끼리." : "Use comparable units: weight with weight, volume with volume, or ea with ea.";
    return;
  }
  byId("unit-result-a").textContent = formatWon(a.unitPrice) + " / " + a.base;
  byId("unit-result-b").textContent = formatWon(b.unitPrice) + " / " + b.base;
  const winner = a.unitPrice <= b.unitPrice ? a : b;
  byId(a.unitPrice <= b.unitPrice ? "unit-card-a" : "unit-card-b").classList.add("is-cheaper");
  byId("unit-winner").textContent = currentLanguage === "kr" ? winner.name + "이 더 저렴합니다." : winner.name + " is cheaper.";
  saveHistory("unit", currentLanguage === "kr" ? winner.name + " 저렴 / " + formatWon(winner.unitPrice) + " / " + winner.base : winner.name + " cheaper / " + formatWon(winner.unitPrice) + " per " + winner.base);
}

function handleUnitTypeChange(suffix) {
  syncComparableUnit(suffix);
  updateUnitPrice();
}

function setTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light-mode", isLight);
  byId("theme-toggle").textContent = isLight ? "☾" : "☀";
  try {
    localStorage.setItem("calcDeckTheme", isLight ? "light" : "dark");
  } catch (error) {
    return;
  }
}

function toggleTheme() {
  setTheme(document.body.classList.contains("light-mode") ? "dark" : "light");
}

function toggleGuide(event) {
  event.stopPropagation();
  historyPopover.classList.add("is-hidden");
  guidePopover.classList.toggle("is-hidden");
  guideToggle.setAttribute("aria-expanded", String(!guidePopover.classList.contains("is-hidden")));
}

function toggleHistory(event) {
  event.stopPropagation();
  guidePopover.classList.add("is-hidden");
  renderHistory();
  historyPopover.classList.toggle("is-hidden");
}

function bindLiveUpdate(selector, handler) {
  document.querySelectorAll(selector).forEach((element) => {
    element.addEventListener("input", handler);
    element.addEventListener("change", handler);
  });
}

inputElements.forEach((input) => {
  input.addEventListener("input", updatePreview);
  input.addEventListener("auxclick", (event) => {
    if (event.button === 1) {
      input.value = "";
      updatePreview();
    }
  });
});

document.querySelectorAll(".clear-input").forEach((button) => button.addEventListener("click", () => {
  const input = byId(button.dataset.clear);
  if (!input) return;
  input.value = "";
  input.focus();
  updatePreview();
}));

document.querySelectorAll(".step-input").forEach((button) => button.addEventListener("click", () => {
  const input = byId(button.dataset.target);
  const step = parseFloat(button.dataset.step);
  if (!input || !isNumber(step)) return;
  const currentValue = parseFloat(input.value);
  input.value = formatNumber((isNumber(currentValue) ? currentValue : 0) + step);
  input.focus();
  updatePreview();
}));

document.querySelectorAll("[data-preset-width][data-preset-height]").forEach((button) => button.addEventListener("click", () => setPreset(button.dataset.presetWidth, button.dataset.presetHeight)));
document.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => setActiveTab(button.dataset.tab)));
document.querySelectorAll("[data-percent-mode]").forEach((button) => button.addEventListener("click", () => setPercentMode(button.dataset.percentMode)));
bindLiveUpdate("#percent-a, #percent-b, #percent-direction", updatePercent);
bindLiveUpdate("#text-input, #text-speed", updateText);
bindLiveUpdate("#fuel-panel input, #fuel-panel select", updateFuel);
bindLiveUpdate("#estimate-panel input, #estimate-panel select", updateEstimate);
bindLiveUpdate("#unit-panel input", updateUnitPrice);
byId("unit-type-a").addEventListener("change", () => handleUnitTypeChange("a"));
byId("unit-type-b").addEventListener("change", () => handleUnitTypeChange("b"));

byId("calculate-btn").addEventListener("click", calculateRatio);
byId("reset-btn").addEventListener("click", resetRatio);
byId("flip-btn").addEventListener("click", flipRatio);
byId("theme-toggle").addEventListener("click", toggleTheme);
byId("language-toggle").addEventListener("click", toggleLanguage);
byId("brand-reset").addEventListener("click", resetAllInputs);
byId("guide-toggle").addEventListener("click", toggleGuide);
byId("history-toggle").addEventListener("click", toggleHistory);
byId("history-copy").addEventListener("click", () => {
  const text = getHistory(activeTab)
    .map((item) => typeof item === "string" ? item : item.label)
    .join("\n");

  if (navigator.clipboard) navigator.clipboard.writeText(text);
});
byId("history-clear").addEventListener("click", () => {
  localStorage.removeItem(historyKey(activeTab));
  renderHistory();
});
historyList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-history-index]");
  if (!item || item.classList.contains("is-static")) return;
  restoreHistoryItem(parseInt(item.dataset.historyIndex, 10));
});
document.querySelectorAll("[data-rate-preset]").forEach((button) => {
  button.addEventListener("click", () => applyRatePreset(button.dataset.ratePreset));
});
byId("reset-rates").addEventListener("click", () => applyRatePreset("standard"));
guidePopover.addEventListener("click", (event) => event.stopPropagation());
historyPopover.addEventListener("click", (event) => event.stopPropagation());

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && activeTab === "ratio") calculateRatio();
  if (event.key === "Escape") closePopovers();
});
document.addEventListener("click", closePopovers);
window.addEventListener("resize", updatePreview);

try {
  setTheme(localStorage.getItem("calcDeckTheme") === "light" ? "light" : "dark");
} catch (error) {
  setTheme("dark");
}

try {
  applyLanguage(localStorage.getItem("calcDeckLanguage") === "kr" ? "kr" : "en");
} catch (error) {
  applyLanguage("en");
}

updatePreview();
updatePercent();
updateText();
updateFuel();
updateEstimate();
updateUnitPrice();
isBootstrapping = false;
