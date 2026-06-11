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
  b: ["8"],
  e: ["3"],
  i: ["1", "!"],
  o: ["0"],
  s: ["5", "$"],
  t: ["7"],
  l: ["1"],
  z: ["2"]
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
const personalControls = document.querySelector("#personalControls");
const customInput = document.querySelector("#customInput");
const customInputLabel = document.querySelector("#customInputLabel");
const serviceInput = document.querySelector("#serviceInput");
const serviceField = document.querySelector("#serviceField");
const personalHint = document.querySelector("#personalHint");
const variantPanel = document.querySelector("#variantPanel");
const variantList = document.querySelector("#variantList");
const variantToggle = document.querySelector("#variantToggle");
const variantCount = document.querySelector("#variantCount");
const variantToggleLabel = document.querySelector("#variantToggleLabel");

let copyResetTimer;
let currentMode = "random";
let latestVariations = [];
let manualLengthOverride = false;
let variantExpanded = false;
const modeInputValues = {
  random: "",
  memorable: "",
  phrase: ""
};

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
  if (currentMode === "phrase") {
    generatePhrasePassword();
    return;
  }

  if (currentMode === "memorable" && hasLetterOption()) {
    generateMemorablePassword();
    return;
  }

  generateRandomPassword();
}

function generateRandomPassword() {
  const length = Number(lengthRange.value);
  const variations = makeRandomVariations(length);
  const password = variations[0];

  passwordOutput.value = password;
  updateStrength(password.length, countCharacterGroups(password));
  renderVariations(variations);
}

function generateMemorablePassword() {
  const userWords = extractWords(customInput.value);
  const recommendedLength = recommendedMemorableLength(userWords);

  if (userWords.length > 0 && !manualLengthOverride && Number(lengthRange.value) !== recommendedLength) {
    setLength(recommendedLength, { skipGenerate: true });
  }

  const length = Number(lengthRange.value);
  const words = userWords.length > 0 ? pickWordsFromInput(userWords, length) : pickMemorableWords(length);
  const separator = optionIsChecked("symbols") && words.join("").length < length ? randomCharacter("-_.$") : "";
  let password = words.map(transformWord).join(separator);

  password = fitPersonalPassword(password, length);
  passwordOutput.value = password;
  updateStrength(password.length, countCharacterGroups(password));
  renderVariations(makeMemorableVariations(words, password, length));
}

function generatePhrasePassword() {
  const phrase = customInput.value.trim() || "Every small step matters";
  const recommendedLength = recommendedPhraseLength(phrase);

  if (!manualLengthOverride && Number(lengthRange.value) !== recommendedLength) {
    setLength(recommendedLength, { skipGenerate: true });
  }

  const length = Number(lengthRange.value);
  const variations = makePhraseVariations(phrase, length);
  const password = variations[0];

  passwordOutput.value = password;
  updateStrength(password.length, countCharacterGroups(password));
  renderVariations(variations);
}

function makeRandomVariations(length) {
  return uniqueValues(Array.from({ length: 4 }, () => generateRandomCandidate(length)));
}

function generateRandomCandidate(length) {
  const suffix = serviceSuffix({ includeFinalSymbols: true });
  const safeSuffix = suffix.length >= length ? suffix.slice(0, Math.max(0, length - 8)) : suffix;
  const baseLength = Math.max(8, length - safeSuffix.length);
  const basePassword = generateRandomCore(baseLength);

  return fitPassword(`${basePassword}${safeSuffix}`, length);
}

function generateRandomCore(length) {
  const sets = selectedSets();
  const combined = sets.map((set) => set.value).join("");
  const requiredCharacters = sets.map((set) => set.value[secureRandomIndex(set.value.length)]);
  const characters = [...requiredCharacters];

  while (characters.length < length) {
    characters.push(combined[secureRandomIndex(combined.length)]);
  }

  return shuffleCharacters(characters).slice(0, length);
}

function pickMemorableWords(length) {
  const count = length >= 14 ? 3 : length >= 8 ? 2 : 1;
  const words = [];

  while (words.join("").length < length && words.length < count) {
    words.push(memorableWords[secureRandomIndex(memorableWords.length)]);
  }

  return words;
}

function pickWordsFromInput(words, length) {
  const count = length >= 14 ? 3 : length >= 8 ? 2 : 1;
  const picked = shuffleArray(words).slice(0, Math.max(1, count));

  while (picked.join("").length < Math.min(length, 12) && picked.length < words.length) {
    const nextWord = words[secureRandomIndex(words.length)];

    if (!picked.includes(nextWord)) {
      picked.push(nextWord);
    }
  }

  return picked;
}

function transformWord(word) {
  const useUppercase = optionIsChecked("uppercase");
  const useLowercase = optionIsChecked("lowercase");
  const useNumbers = optionIsChecked("numbers");
  const useSymbols = optionIsChecked("symbols");

  let transformed = word
    .split("")
    .map((character) => {
      const choices = substitutions[character.toLowerCase()] || [];
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

function makeMemorableVariations(words, primaryPassword, length) {
  const compact = fitPersonalPassword(words.map((word) => transformWord(word).charAt(0)).join("") + randomNumberToken(), length);
  const dashed = fitPersonalPassword(words.map(transformWord).join(optionIsChecked("symbols") ? "-" : ""), length);
  const reversed = fitPersonalPassword([...words].reverse().map(transformWord).join(optionIsChecked("symbols") ? "_" : ""), length);

  return uniqueValues([primaryPassword, dashed, compact, reversed]).slice(0, 4);
}

function makePhraseVariations(phrase, length) {
  const words = extractWords(phrase);
  const safeWords = words.length > 0 ? words : ["make", "today", "count"];
  const separator = optionIsChecked("symbols") ? randomCharacter(["-", "_", ".", "!"].join("")) : "";
  const compactSeparator = optionIsChecked("symbols") ? randomCharacter("._") : "";
  const phraseNumber = String(Math.max(1, safeWords.length - 1));
  const candidates = [
    safeWords.map((word, index) => transformPhraseWord(word, index)).join(separator),
    safeWords.map((word, index) => transformPhraseWord(word, index)).join(""),
    safeWords.map((word, index) => transformPhraseWord(word, index).charAt(0)).join(compactSeparator) + randomNumberToken(),
    safeWords.map((word, index) => index === 0 ? transformPhraseWord(word, index) : titleCase(transformPhraseWord(word, index))).join(""),
    `${safeWords[0] || "secure"}${phraseNumber}${safeWords[safeWords.length - 1] || "key"}`
  ];

  return uniqueValues(candidates.map((candidate) => fitPersonalPassword(candidate, length))).slice(0, 4);
}

function recommendedPhraseLength(phrase) {
  const words = extractWords(phrase);
  const letterCount = words.join("").length;
  const separatorCount = Math.max(0, words.length - 1);
  const serviceLength = serviceSuffix().length;
  const readableLength = letterCount + separatorCount + serviceLength;

  return Math.min(32, Math.max(16, readableLength));
}

function recommendedMemorableLength(words) {
  const selectedWords = words.length > 0 ? words : memorableWords.slice(0, 2);
  const letterCount = selectedWords.join("").length;
  const separatorCount = Math.max(0, selectedWords.length - 1);
  const serviceLength = serviceSuffix().length;
  const readableLength = letterCount + separatorCount + serviceLength + 2;

  return Math.min(32, Math.max(16, readableLength));
}

function transformPhraseWord(word, index) {
  const trimmed = word.trim();

  if (trimmed.length === 0) {
    return "";
  }

  let transformed = [...trimmed]
    .map((character) => substituteCharacter(character, index === 0 ? 42 : 32))
    .join("");

  if (optionIsChecked("uppercase") && optionIsChecked("lowercase")) {
    transformed = index % 2 === 0 ? titleCase(transformed) : transformed.toLowerCase();
  } else if (optionIsChecked("uppercase")) {
    transformed = transformed.toUpperCase();
  } else if (optionIsChecked("lowercase")) {
    transformed = transformed.toLowerCase();
  }

  return transformed;
}

function substituteCharacter(character, chance) {
  const choices = substitutions[character.toLowerCase()] || [];
  const allowedChoices = choices.filter((choice) => {
    return (optionIsChecked("numbers") && /\d/.test(choice)) || (optionIsChecked("symbols") && /\D/.test(choice));
  });

  if (allowedChoices.length > 0 && secureRandomIndex(100) < chance) {
    return allowedChoices[secureRandomIndex(allowedChoices.length)];
  }

  return character;
}

function fitPassword(password, length, preferredFillerSet) {
  const fillerSet = preferredFillerSet || selectedSets().map((set) => set.value).join("") || characterSets.lowercase;
  const characters = [...password.replace(/\s+/g, "")].filter(Boolean);

  while (characters.length < length) {
    characters.push(fillerSet[secureRandomIndex(fillerSet.length)]);
  }

  if (characters.length > length) {
    characters.length = length;
  }

  enforceOption("uppercase", /[A-Z]/, characterSets.uppercase, characters);
  enforceOption("lowercase", /[a-z]/, characterSets.lowercase, characters);
  enforceOption("numbers", /\d/, characterSets.numbers, characters);
  enforceOption("symbols", /[^A-Za-z0-9]/, "!#$&?._-", characters);

  return characters.join("");
}

function enforceOption(key, pattern, characters, target) {
  if (!optionIsChecked(key) || pattern.test(target.join(""))) {
    return;
  }

  const index = secureRandomIndex(target.length);
  target[index] = randomCharacter(characters);
}

function fitPersonalPassword(password, length) {
  const suffix = serviceSuffix();
  const fillerSet = personalFillerSet();

  if (!suffix) {
    return fitPassword(password, length, fillerSet);
  }

  const safeSuffix = suffix.length >= length ? suffix.slice(0, Math.max(0, length - 4)) : suffix;
  const baseLength = Math.max(4, length - safeSuffix.length);

  return fitPassword(`${fitPassword(password, baseLength, fillerSet)}${safeSuffix}`, length, fillerSet);
}

function serviceSuffix(options = {}) {
  const includeFinalSymbols = options.includeFinalSymbols || false;
  const service = currentMode === "random" ? customInput.value.trim() : serviceInput.value.trim();

  if (service.length === 0) {
    return "";
  }

  const separator = optionIsChecked("symbols") ? randomCharacter("-_.") : "";
  const token = extractWords(service).join("").slice(0, 5) || service.slice(0, 5);
  const finalSymbols = includeFinalSymbols && optionIsChecked("symbols") ? randomSymbolTail() : "";

  return `${separator}${transformPhraseWord(token, 1)}${finalSymbols}`;
}

function randomSymbolTail() {
  const count = secureRandomIndex(2) + 1;
  let symbols = "";

  for (let index = 0; index < count; index += 1) {
    symbols += randomCharacter("!#$&?._-");
  }

  return symbols;
}

function personalFillerSet() {
  let filler = "";

  if (optionIsChecked("uppercase")) {
    filler += characterSets.uppercase;
  }

  if (optionIsChecked("lowercase")) {
    filler += characterSets.lowercase;
  }

  if (optionIsChecked("numbers")) {
    filler += characterSets.numbers;
  }

  if (optionIsChecked("symbols")) {
    filler += "!#$&?._-";
  }

  return filler || characterSets.lowercase;
}

function extractWords(value) {
  return value
    .trim()
    .split(/[\s,.;:/\\|()[\]{}"'`~]+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter(Boolean);
}

function randomNumberToken() {
  if (!optionIsChecked("numbers")) {
    return "";
  }

  return String(secureRandomIndex(90) + 10);
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shuffleArray(items) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function countCharacterGroups(password) {
  return [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;
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

function renderVariations(variations) {
  latestVariations = variations;
  variantList.innerHTML = "";
  variantExpanded = false;

  if (variations.length <= 1) {
    variantPanel.classList.add("hidden");
    return;
  }

  variations.forEach((variation) => {
    const button = document.createElement("button");
    const password = document.createElement("span");
    const action = document.createElement("span");

    button.className = "variant-button";
    button.type = "button";
    button.dataset.password = variation;
    password.className = "variant-password";
    password.textContent = variation;
    action.className = "variant-action";
    action.textContent = "Use";

    button.append(password, action);
    variantList.append(button);
  });

  variantPanel.classList.remove("hidden");
  updateVariantDisclosure();
}

function updateVariantDisclosure() {
  variantPanel.classList.toggle("collapsed", !variantExpanded);
  variantToggle.setAttribute("aria-expanded", String(variantExpanded));
  variantCount.textContent = String(latestVariations.length);
  variantToggleLabel.textContent = variantExpanded ? "Hide" : "Show";
}

function updatePersonalControls() {
  personalControls.classList.remove("hidden");
  variantPanel.classList.toggle("hidden", latestVariations.length <= 1);

  if (currentMode === "random") {
    customInputLabel.textContent = "Service";
    customInput.placeholder = "github, bank, mail";
    serviceField.classList.add("hidden");
    personalHint.textContent = "Optional. Adds a local site-specific token to each random password.";
    return;
  }

  if (currentMode === "memorable") {
    customInputLabel.textContent = "Your words";
    customInput.placeholder = "coffee moon river";
    serviceField.classList.remove("hidden");
    personalHint.textContent = "Use your own words for a memorable password. Inputs and results are not saved.";
    return;
  }

  if (currentMode === "phrase") {
    customInputLabel.textContent = "Base phrase";
    customInput.placeholder = "Every small step matters";
    serviceField.classList.remove("hidden");
    personalHint.textContent = "Turn a sentence into several password variations. Add a service name for a site-specific version.";
  }
}

function setLength(nextLength, options = {}) {
  const min = Number(lengthRange.min);
  const max = Number(lengthRange.max);
  const safeLength = Math.min(max, Math.max(min, nextLength));

  lengthRange.value = String(safeLength);
  lengthValue.textContent = String(safeLength);

  if (!options.skipGenerate) {
    generatePassword();
  }
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
  manualLengthOverride = true;
  lengthValue.textContent = lengthRange.value;
  generatePassword();
});

decreaseButton.addEventListener("click", () => {
  manualLengthOverride = true;
  setLength(Number(lengthRange.value) - 1);
});

increaseButton.addEventListener("click", () => {
  manualLengthOverride = true;
  setLength(Number(lengthRange.value) + 1);
});

refreshButton.addEventListener("click", generatePassword);
copyButton.addEventListener("click", copyPassword);

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    modeInputValues[currentMode] = customInput.value;
    currentMode = button.dataset.mode;
    customInput.value = modeInputValues[currentMode];
    modeButtons.forEach((modeButton) => {
      modeButton.classList.toggle("active", modeButton === button);
    });
    updatePersonalControls();

    if (currentMode === "phrase") {
      manualLengthOverride = false;
    }

    if (currentMode === "memorable") {
      manualLengthOverride = false;
    }

    generatePassword();
  });
});

optionInputs.forEach((input) => {
  input.addEventListener("change", () => {
    keepAtLeastOneOption(input);
    generatePassword();
  });
});

customInput.addEventListener("input", () => {
  modeInputValues[currentMode] = customInput.value;

  if (currentMode === "phrase" || currentMode === "memorable") {
    manualLengthOverride = false;
  }

  generatePassword();
});

serviceInput.addEventListener("input", () => {
  if (currentMode === "phrase" || currentMode === "memorable") {
    manualLengthOverride = false;
  }

  generatePassword();
});

variantToggle.addEventListener("click", () => {
  variantExpanded = !variantExpanded;
  updateVariantDisclosure();
});

variantList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-password]");

  if (!button) {
    return;
  }

  passwordOutput.value = button.dataset.password;
  updateStrength(passwordOutput.value.length, countCharacterGroups(passwordOutput.value));
});

updatePersonalControls();
setLength(Number(lengthRange.value));
