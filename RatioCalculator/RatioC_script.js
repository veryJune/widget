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
    multiplier: 0.85,
    motionFactor: 0.2,
    note: "Short/SNS는 짧은 러닝타임과 빠른 편집 중심이라 기본 견적을 낮게 잡습니다."
  },
  promo: {
    label: "Promo video",
    multiplier: 1.15,
    motionFactor: 0.35,
    note: "Promo video는 기획, 촬영 완성도, 후반 보정 비중이 커져 표준보다 높게 잡습니다."
  },
  interview: {
    label: "Interview",
    multiplier: 1,
    motionFactor: 0.15,
    note: "Interview는 촬영/편집 균형형입니다. 자막과 컷 편집 분량에 따라 편집일을 조정하세요."
  },
  event: {
    label: "Event recap",
    multiplier: 1.2,
    motionFactor: 0.2,
    note: "Event recap은 현장 변수와 촬영 시간이 커서 촬영일/스태프 비용 영향이 큽니다."
  },
  motion: {
    label: "Motion graphic",
    multiplier: 1.35,
    motionFactor: 1,
    note: "Motion graphic은 촬영보다 모션 작업일 영향이 큽니다. 모션 단가와 난이도를 꼭 조정하세요."
  }
};

let activeTab = "ratio";
let activePercentMode = "part";
let isBootstrapping = true;

const inputElements = ["input1", "input2", "input3", "input4"].map((id) => document.getElementById(id));
const output = document.getElementById("output");
const simplifiedOutput = document.getElementById("simplified-output");
const preview = document.getElementById("ratio-preview");
const previewStage = document.querySelector(".preview-stage");
const previewBox = document.getElementById("preview-box");
const previewLabel = document.getElementById("preview-label");
const themeToggle = document.getElementById("theme-toggle");
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

  const history = getHistory(tabName).filter((item) => item !== entry);
  history.unshift(entry);
  try {
    localStorage.setItem(historyKey(tabName), JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  } catch (error) {
    return;
  }
}

function renderHistory() {
  const history = getHistory(activeTab);
  historyList.innerHTML = history.length ? history.map((item) => "<div class=\"history-item\">" + item + "</div>").join("") : "<div class=\"history-empty\">No history yet.</div>";
}

function closePopovers() {
  guidePopover.classList.add("is-hidden");
  historyPopover.classList.add("is-hidden");
  guideToggle.setAttribute("aria-expanded", "false");
}

function updateGuide() {
  guidePopover.innerHTML = guideMessages[activeTab].map((message) => "<p>" + message + "</p>").join("");
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
  const help = percentHelp[activePercentMode];
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
    byId("fuel-result").textContent = "Enter valid distance, efficiency, and price.";
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
  const typeSetting = estimateTypeSettings[type];
  const planningDays = Math.max(0.5, runtime * 0.25);
  const motionDays = Math.max(0, runtime * typeSetting.motionFactor);
  const labor = planRate * planningDays + shootRate * shootDays + staffRate * shootDays + editRate * editDays + motionRate * motionDays;
  const revisionFee = Math.max(0, revisions - 2) * revisionRate;
  const standard = (labor + optionFee + revisionFee) * difficulty * urgency * typeSetting.multiplier;
  const spread = Math.min(0.42, 0.14 + (difficulty - 1) * 0.16 + (urgency - 1) * 0.18);
  byId("estimate-low").textContent = formatWon(standard * (1 - spread));
  byId("estimate-standard").textContent = formatWon(standard);
  byId("estimate-high").textContent = formatWon(standard * (1 + spread));
  byId("estimate-type-note").textContent = typeSetting.note;
  saveHistory("estimate", typeSetting.label + " / Standard " + formatWon(standard));
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
    byId("unit-result-a").textContent = a ? formatWon(a.unitPrice) + " / " + a.base : "Enter valid values.";
    byId("unit-result-b").textContent = b ? formatWon(b.unitPrice) + " / " + b.base : "Enter valid values.";
    byId("unit-winner").textContent = "Use comparable units: weight with weight, volume with volume, or ea with ea.";
    return;
  }
  byId("unit-result-a").textContent = formatWon(a.unitPrice) + " / " + a.base;
  byId("unit-result-b").textContent = formatWon(b.unitPrice) + " / " + b.base;
  const winner = a.unitPrice <= b.unitPrice ? a : b;
  byId(a.unitPrice <= b.unitPrice ? "unit-card-a" : "unit-card-b").classList.add("is-cheaper");
  byId("unit-winner").textContent = winner.name + " is cheaper.";
  saveHistory("unit", winner.name + " cheaper / " + formatWon(winner.unitPrice) + " per " + winner.base);
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
byId("guide-toggle").addEventListener("click", toggleGuide);
byId("history-toggle").addEventListener("click", toggleHistory);
byId("history-copy").addEventListener("click", () => navigator.clipboard && navigator.clipboard.writeText(getHistory(activeTab).join("\n")));
byId("history-clear").addEventListener("click", () => {
  localStorage.removeItem(historyKey(activeTab));
  renderHistory();
});
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

updateGuide();
updatePreview();
updatePercent();
updateText();
updateFuel();
updateEstimate();
updateUnitPrice();
isBootstrapping = false;
