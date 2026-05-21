const characterSets = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?"
};

const memorableWords = [
  "blue",
  "river",
  "mint",
  "solar",
  "cloud",
  "stone",
  "pixel",
  "lunar",
  "north",
  "spark",
  "clear",
  "forest",
  "orbit",
  "silver",
  "maple",
  "swift",
  "bright",
  "harbor",
  "field",
  "signal"
];

const substitutions = {
  a: ["4", "@"],
  e: ["3"],
  i: ["1", "!"],
  o: ["0"],
  s: ["5", "$"],
  t: ["7"],
  l: ["1"]
};

const passwordOutput = document.querySelector("#passwordOutput");
const strengthBadge = document.querySelector("#strengthBadge");
const lengthValue = document.querySelector("#lengthValue");
const lengthRange = document.querySelector("#lengthRange");
const decreaseButton = document.querySelector("#decreaseButton");
const increaseButton = document.querySelector("#increaseButton");
const refreshButton = document.querySelector("#refreshButton");
const copyButton = document.querySelector("#copyButton");
const optionInputs = Array.from(document.querySelectorAll("[data-set]"));
const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));

let copyResetTimer;
let currentMode = "random";

function secureRandomIndex(max) {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % max;
}

function shuffleCharacters(characters) {
  const result = [...characters];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result.join("");
}

function selectedSets() {
  return optionInputs
    .filter((input) => input.checked)
    .map((input) => ({
      key: input.dataset.set,
      value: characterSets[input.dataset.set]
    }));
}

function generatePassword() {
  if (currentMode === "memorable" && hasLetterOption()) {
    generateMemorablePassword();
    return;
  }

  generateRandomPassword();
}

function generateRandomPassword() {
  const length = Number(lengthRange.value);
  const sets = selectedSets();
  const combined = sets.map((set) => set.value).join("");
  const requiredCharacters = sets.map((set) => set.value[secureRandomIndex(set.value.length)]);
  const characters = [...requiredCharacters];

  while (characters.length < length) {
    characters.push(combined[secureRandomIndex(combined.length)]);
  }

  passwordOutput.value = shuffleCharacters(characters).slice(0, length);
  updateStrength(length, sets.length);
}

function generateMemorablePassword() {
  const length = Number(lengthRange.value);
  const words = pickMemorableWords(length);
  const separator = optionIsChecked("symbols") && words.join("").length < length ? randomCharacter("-_.$") : "";
  let password = words.map(transformWord).join(separator);

  password = fitMemorablePassword(password, length);
  passwordOutput.value = password;
  updateStrength(length, selectedSets().length + 1);
}

function pickMemorableWords(length) {
  const count = length >= 14 ? 3 : length >= 8 ? 2 : 1;
  const words = [];

  while (words.join("").length < length && words.length < count) {
    words.push(memorableWords[secureRandomIndex(memorableWords.length)]);
  }

  return words;
}

function transformWord(word) {
  const useUppercase = optionIsChecked("uppercase");
  const useLowercase = optionIsChecked("lowercase");
  const useNumbers = optionIsChecked("numbers");
  const useSymbols = optionIsChecked("symbols");

  let transformed = word
    .split("")
    .map((character) => {
      const choices = substitutions[character] || [];
      const allowedChoices = choices.filter((choice) => {
        return (useNumbers && /\d/.test(choice)) || (useSymbols && /\D/.test(choice));
      });

      if (allowedChoices.length > 0 && secureRandomIndex(100) < 34) {
        return allowedChoices[secureRandomIndex(allowedChoices.length)];
      }

      return character;
    })
    .join("");

  if (useUppercase && useLowercase) {
    transformed = transformed.charAt(0).toUpperCase() + transformed.slice(1);
  } else if (useUppercase) {
    transformed = transformed.toUpperCase();
  } else {
    transformed = transformed.toLowerCase();
  }

  return transformed;
}

function fitMemorablePassword(password, length) {
  let result = password;

  if (optionIsChecked("numbers") && result.length < length) {
    result += String(secureRandomIndex(90) + 10);
  }

  if (optionIsChecked("symbols") && result.length < length) {
    result += randomCharacter("!#$&?");
  }

  while (result.length < length) {
    const fillerSet = optionIsChecked("lowercase") ? characterSets.lowercase : characterSets.uppercase;
    result += randomCharacter(fillerSet);
  }

  return result.slice(0, length);
}

function hasLetterOption() {
  return optionIsChecked("uppercase") || optionIsChecked("lowercase");
}

function optionIsChecked(key) {
  return optionInputs.some((input) => input.dataset.set === key && input.checked);
}

function randomCharacter(characters) {
  return characters[secureRandomIndex(characters.length)];
}

function updateStrength(length, setCount) {
  let label = "Weak";
  let className = "weak";

  if (length >= 12 && setCount >= 3) {
    label = "Strong";
    className = "";
  } else if (length >= 8 && setCount >= 2) {
    label = "Medium";
    className = "medium";
  }

  strengthBadge.textContent = label;
  strengthBadge.className = `strength-badge ${className}`.trim();
}

function setLength(nextLength) {
  const min = Number(lengthRange.min);
  const max = Number(lengthRange.max);
  const safeLength = Math.min(max, Math.max(min, nextLength));

  lengthRange.value = String(safeLength);
  lengthValue.textContent = String(safeLength);
  generatePassword();
}

function keepAtLeastOneOption(changedInput) {
  if (selectedSets().length > 0) {
    return;
  }

  changedInput.checked = true;
}

async function copyPassword() {
  const password = passwordOutput.value;

  try {
    await navigator.clipboard.writeText(password);
    copyButton.textContent = "Copied!";
  } catch {
    copyButton.textContent = "Copy failed";
  }

  clearTimeout(copyResetTimer);
  copyResetTimer = window.setTimeout(() => {
    copyButton.textContent = "Copy";
  }, 1400);
}

lengthRange.addEventListener("input", () => {
  lengthValue.textContent = lengthRange.value;
  generatePassword();
});

decreaseButton.addEventListener("click", () => {
  setLength(Number(lengthRange.value) - 1);
});

increaseButton.addEventListener("click", () => {
  setLength(Number(lengthRange.value) + 1);
});

refreshButton.addEventListener("click", generatePassword);
copyButton.addEventListener("click", copyPassword);

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    modeButtons.forEach((modeButton) => {
      modeButton.classList.toggle("active", modeButton === button);
    });
    generatePassword();
  });
});

optionInputs.forEach((input) => {
  input.addEventListener("change", () => {
    keepAtLeastOneOption(input);
    generatePassword();
  });
});

setLength(Number(lengthRange.value));
