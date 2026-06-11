const EPSILON = 0.000001;
const MAX_PREVIEW_WIDTH = 320;
const MAX_PREVIEW_HEIGHT = 180;
const DEFAULT_HINT = "Middle click an input to clear it, or use Reset to clear all values.";

const inputElements = [
  document.getElementById("input1"),
  document.getElementById("input2"),
  document.getElementById("input3"),
  document.getElementById("input4")
];
const output = document.getElementById("output");
const preview = document.getElementById("ratio-preview");
const previewStage = document.querySelector(".preview-stage");
const previewBox = document.getElementById("preview-box");
const previewLabel = document.getElementById("preview-label");

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

function ratiosMatch(a, b, c, d) {
  if (b === 0 || d === 0) return false;
  return Math.abs(a / b - c / d) < EPSILON;
}

function setOutput(message, isHint) {
  output.textContent = message;
  output.className = isHint ? "hint" : "";
}

function updatePreview() {
  var values = getValues();
  var widthRatio = values[0];
  var heightRatio = values[1];

  if (!isNumber(widthRatio) || !isNumber(heightRatio) || widthRatio <= 0 || heightRatio <= 0) {
    preview.classList.add("is-hidden");
    return;
  }

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
  preview.classList.remove("is-hidden");
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

document.getElementById("calculate-btn").addEventListener("click", calculate);
document.getElementById("reset-btn").addEventListener("click", reset);
document.getElementById("preset-btn1").addEventListener("click", function () { setPreset("4", "3"); });
document.getElementById("preset-btn2").addEventListener("click", function () { setPreset("3", "2"); });
document.getElementById("preset-btn3").addEventListener("click", function () { setPreset("16", "9"); });
document.getElementById("preset-btn4").addEventListener("click", function () { setPreset("1.85", "1"); });
document.getElementById("preset-btn5").addEventListener("click", function () { setPreset("2.35", "1"); });
document.getElementById("preset-btn6").addEventListener("click", function () { setPreset("8", "1"); });
document.getElementById("flip-btn").addEventListener("click", flipRatio);

document.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    calculate();
  }
});

window.addEventListener("resize", updatePreview);

updatePreview();
