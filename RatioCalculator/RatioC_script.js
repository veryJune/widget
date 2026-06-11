const EPSILON = 0.000001;
const MAX_PREVIEW_WIDTH = 320;
const MAX_PREVIEW_HEIGHT = 180;
const DEFAULT_HINT = "";

const inputElements = [
  document.getElementById("input1"),
  document.getElementById("input2"),
  document.getElementById("input3"),
  document.getElementById("input4")
];
const output = document.getElementById("output");
const simplifiedOutput = document.getElementById("simplified-output");
const preview = document.getElementById("ratio-preview");
const previewStage = document.querySelector(".preview-stage");
const previewBox = document.getElementById("preview-box");
const previewLabel = document.getElementById("preview-label");
const themeToggle = document.getElementById("theme-toggle");
const guideToggle = document.getElementById("guide-toggle");
const guidePopover = document.getElementById("guide-popover");

function getValues() {
  return inputElements.map(function (input) {
    return parseFloat(input.value);
  });
}

function isNumber(value) {
  return !isNaN(value) && isFinite(value);
}

function formatNumber(value) {
  return parseFloat(value.toFixed(6)).toString();
}

function getDecimalPlaces(value) {
  var text = value.toString();

  if (text.indexOf("e-") !== -1) {
    return parseInt(text.split("e-")[1], 10);
  }

  if (text.indexOf(".") === -1) return 0;

  return text.split(".")[1].length;
}

function getGreatestCommonDivisor(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);

  while (b) {
    var next = a % b;
    a = b;
    b = next;
  }

  return a;
}

function getSimplifiedRatio(widthRatio, heightRatio) {
  var scale = Math.pow(10, Math.max(getDecimalPlaces(widthRatio), getDecimalPlaces(heightRatio)));
  var width = Math.round(Math.abs(widthRatio) * scale);
  var height = Math.round(Math.abs(heightRatio) * scale);
  var divisor = getGreatestCommonDivisor(width, height);

  if (!divisor) return null;

  return formatNumber(width / divisor) + ":" + formatNumber(height / divisor);
}

function ratiosMatch(a, b, c, d) {
  if (b === 0 || d === 0) return false;
  return Math.abs(a / b - c / d) < EPSILON;
}

function setOutput(message, isHint) {
  output.textContent = message;
  output.className = isHint ? "hint" : "";
}

function updateTargetHighlight() {
  var values = getValues();
  var emptyIndexes = values
    .map(function (value, index) {
      return isNumber(value) ? null : index;
    })
    .filter(function (index) {
      return index !== null;
    });

  inputElements.forEach(function (input) {
    input.closest(".input-field").classList.remove("is-target");
  });

  if (emptyIndexes.length === 1) {
    inputElements[emptyIndexes[0]].closest(".input-field").classList.add("is-target");
  }
}

function updatePreview() {
  var values = getValues();
  var widthRatio = values[0];
  var heightRatio = values[1];

  updateTargetHighlight();

  if (!isNumber(widthRatio) || !isNumber(heightRatio) || widthRatio <= 0 || heightRatio <= 0) {
    preview.classList.add("is-hidden");
    simplifiedOutput.textContent = "";
    return;
  }

  preview.classList.remove("is-hidden");

  var stageWidth = previewStage ? previewStage.clientWidth - 30 : MAX_PREVIEW_WIDTH;
  var stageHeight = previewStage ? previewStage.clientHeight - 30 : MAX_PREVIEW_HEIGHT;
  var maxWidth = Math.min(MAX_PREVIEW_WIDTH, Math.max(stageWidth, 24));
  var maxHeight = Math.min(MAX_PREVIEW_HEIGHT, Math.max(stageHeight, 24));
  var scale = Math.min(maxWidth / widthRatio, maxHeight / heightRatio);
  var previewWidth = Math.max(widthRatio * scale, 24);
  var previewHeight = Math.max(heightRatio * scale, 24);

  previewBox.style.width = previewWidth + "px";
  previewBox.style.height = previewHeight + "px";
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

function calculate() {
  var values = getValues();
  var filledIndexes = values
    .map(function (value, index) {
      return isNumber(value) ? index : null;
    })
    .filter(function (index) {
      return index !== null;
    });

  if (filledIndexes.length < 3) {
    setOutput("Please enter at least 3 values.", false);
    updatePreview();
    return;
  }

  var missingIndex = values.findIndex(function (value) {
    return !isNumber(value);
  });

  if (hasZeroDenominator(values, missingIndex)) {
    setOutput("Cannot divide by zero. Please change any zero denominator values.", false);
    updatePreview();
    return;
  }

  if (filledIndexes.length === 4 && !ratiosMatch(values[0], values[1], values[2], values[3])) {
    setOutput("Inputs are not in the same ratio.", false);
    updatePreview();
    return;
  }

  if (missingIndex === 0) {
    values[0] = values[1] * values[2] / values[3];
  } else if (missingIndex === 1) {
    values[1] = values[0] * values[3] / values[2];
  } else if (missingIndex === 2) {
    values[2] = values[0] * values[3] / values[1];
  } else if (missingIndex === 3) {
    values[3] = values[1] * values[2] / values[0];
  }

  if (missingIndex !== -1) {
    inputElements[missingIndex].value = formatNumber(values[missingIndex]);
  }

  if (ratiosMatch(values[0], values[1], values[2], values[3])) {
    setOutput(
      formatNumber(values[0]) + ":" + formatNumber(values[1]) + " = " +
      formatNumber(values[2]) + ":" + formatNumber(values[3]),
      false
    );
  } else {
    setOutput("Inputs are not in the same ratio.", false);
  }

  updatePreview();
}

function reset() {
  inputElements.forEach(function (input) {
    input.value = "";
  });
  setOutput(DEFAULT_HINT, true);
  updatePreview();
}

function setPreset(width, height) {
  inputElements[0].value = width;
  inputElements[1].value = height;
  setOutput(DEFAULT_HINT, true);
  updatePreview();
}

function flipPair(firstInput, secondInput) {
  var firstValue = firstInput.value;
  firstInput.value = secondInput.value;
  secondInput.value = firstValue;
}

function flipRatio() {
  flipPair(inputElements[0], inputElements[1]);

  if (inputElements[2].value !== "" || inputElements[3].value !== "") {
    flipPair(inputElements[2], inputElements[3]);
  }

  setOutput(DEFAULT_HINT, true);
  updatePreview();
}

inputElements.forEach(function (input) {
  input.addEventListener("input", updatePreview);
  input.addEventListener("auxclick", function (event) {
    if (event.button === 1) {
      input.value = "";
      updatePreview();
    }
  });
});

document.querySelectorAll(".clear-input").forEach(function (button) {
  button.addEventListener("click", function () {
    var input = document.getElementById(button.dataset.clear);

    if (!input) return;

    input.value = "";
    input.focus();
    updatePreview();
  });
});

document.querySelectorAll(".step-input").forEach(function (button) {
  button.addEventListener("click", function () {
    var input = document.getElementById(button.dataset.target);
    var step = parseFloat(button.dataset.step);

    if (!input || !isNumber(step)) return;

    var currentValue = parseFloat(input.value);

    input.value = formatNumber((isNumber(currentValue) ? currentValue : 0) + step);
    input.focus();
    updatePreview();
  });
});

document.querySelectorAll("[data-preset-width][data-preset-height]").forEach(function (button) {
  button.addEventListener("click", function () {
    setPreset(button.dataset.presetWidth, button.dataset.presetHeight);
  });
});

function setTheme(theme) {
  var isLight = theme === "light";

  document.body.classList.toggle("light-mode", isLight);
  themeToggle.textContent = isLight ? "☾" : "☀";
  themeToggle.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");

  try {
    localStorage.setItem("ratioCalculatorTheme", isLight ? "light" : "dark");
  } catch (error) {
    return;
  }
}

function toggleTheme() {
  setTheme(document.body.classList.contains("light-mode") ? "dark" : "light");
}

function closeGuide() {
  guidePopover.classList.add("is-hidden");
  guideToggle.setAttribute("aria-expanded", "false");
}

function toggleGuide() {
  var isHidden = guidePopover.classList.contains("is-hidden");

  guidePopover.classList.toggle("is-hidden", !isHidden);
  guideToggle.setAttribute("aria-expanded", isHidden ? "true" : "false");
}

document.getElementById("calculate-btn").addEventListener("click", calculate);
document.getElementById("reset-btn").addEventListener("click", reset);
document.getElementById("flip-btn").addEventListener("click", flipRatio);
themeToggle.addEventListener("click", toggleTheme);
guideToggle.addEventListener("click", function (event) {
  event.stopPropagation();
  toggleGuide();
});
guidePopover.addEventListener("click", function (event) {
  event.stopPropagation();
});

document.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    calculate();
  } else if (event.key === "Escape") {
    closeGuide();
  }
});

document.addEventListener("click", closeGuide);
window.addEventListener("resize", updatePreview);

try {
  setTheme(localStorage.getItem("ratioCalculatorTheme") === "light" ? "light" : "dark");
} catch (error) {
  setTheme("dark");
}

updatePreview();
