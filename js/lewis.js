const loadingScreen = document.getElementById("loading-screen");
const errorEl = document.getElementById("lewis-error");
const errorMessageEl = document.getElementById("lewis-error-message");
const contentEl = document.getElementById("lewis-content");
const formulaEl = document.getElementById("lewis-formula");
const boardEl = document.getElementById("lewis-board");
const ionDisplayEl = document.getElementById("lewis-ion-display");
const ionChargeEl = document.getElementById("lewis-ion-charge");
const feedbackEl = document.getElementById("lewis-feedback");
const checkBtn = document.getElementById("lewis-check-btn");
const resetBtn = document.getElementById("lewis-reset-btn");
const continueBtn = document.getElementById("continue-btn");
const skipBtn = document.getElementById("skip-btn");
const progressBar = document.getElementById("progress-bar");
const questionProgress = document.getElementById("question-progress");
const scoreDisplay = document.getElementById("score");
const totalDisplay = document.getElementById("total");
const questionArea = document.getElementById("lewis-question-area");
const instructionContainer = document.querySelector(".instruction-container");
const finalScreen = document.getElementById("final-screen");
const finalHeading = document.getElementById("final-heading");
const finalTier = document.getElementById("final-tier");
const finalScore = document.getElementById("final-score");
const finalDetail = document.getElementById("final-detail");
const retryBtn = document.getElementById("retry-btn");

let toolData = null;
let molecules = [];
let current = 0;
let correctCount = 0;
let answeredCount = 0;
let skippedCount = 0;
let currentMolecule = null;
let bondState = {};
let loneState = {};
let selectedTool = null;
let questionLocked = false;

const MAX_BONDS = 3;
const MAX_DOTS = 8;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getScoreTier(percent) {
  if (percent >= 90) {
    return { emoji: "🌟", message: "Excellent work!" };
  }
  if (percent >= 70) {
    return {
      emoji: "👍",
      message: "Solid effort — review any misses to lock it in.",
    };
  }
  if (percent >= 50) {
    return {
      emoji: "📚",
      message: "Good progress — focus on the structures you missed.",
    };
  }
  return {
    emoji: "💪",
    message: "Keep going — practice builds fluency with Lewis diagrams.",
  };
}

function showError(message) {
  loadingScreen.classList.add("hidden");
  contentEl.classList.add("hidden");
  errorEl.classList.remove("hidden");
  errorMessageEl.textContent = message;
}

function atomHasLoneSlots(atom) {
  return atom.symbol !== "H";
}

function slotDirectionsForAtom(atom, index, atomCount) {
  if (!atomHasLoneSlots(atom)) return [];

  const dirs = ["north", "south"];

  if (index === 0) dirs.push("west");
  if (index === atomCount - 1) dirs.push("east");

  return dirs;
}

function loneDirectionsForAtom(atom, index, molecule) {
  return slotDirectionsForAtom(atom, index, molecule.atoms.length);
}

function buildAtomColumn(atom, index, molecule, readonly = false) {
  const column = document.createElement("div");
  column.className = "lewis-atom-column";

  const dirs = slotDirectionsForAtom(atom, index, molecule.atoms.length);
  const slotOptions = { readonly };

  column.appendChild(
    createSlot({
      kind: "lone",
      direction: "north",
      label: `Lone electrons above ${atom.symbol}`,
      dataset: { lone: loneKey(atom.id, "north") },
      ...slotOptions,
    })
  );

  if (dirs.includes("west")) {
    column.appendChild(
      createSlot({
        kind: "lone",
        direction: "west",
        label: `Lone electrons left of ${atom.symbol}`,
        dataset: { lone: loneKey(atom.id, "west") },
        ...slotOptions,
      })
    );
  }

  const atomEl = document.createElement("div");
  atomEl.className = "lewis-atom lewis-grid-atom";
  atomEl.textContent = atom.symbol;
  column.appendChild(atomEl);

  if (dirs.includes("east")) {
    column.appendChild(
      createSlot({
        kind: "lone",
        direction: "east",
        label: `Lone electrons right of ${atom.symbol}`,
        dataset: { lone: loneKey(atom.id, "east") },
        ...slotOptions,
      })
    );
  }

  column.appendChild(
    createSlot({
      kind: "lone",
      direction: "south",
      label: `Lone electrons below ${atom.symbol}`,
      dataset: { lone: loneKey(atom.id, "south") },
      ...slotOptions,
    })
  );

  return column;
}

function buildBoardRow(molecule, readonly = false) {
  const row = document.createElement("div");
  row.className = "lewis-linear-row";

  molecule.atoms.forEach((atom, index) => {
    row.appendChild(buildAtomColumn(atom, index, molecule, readonly));

    if (index < molecule.atoms.length - 1) {
      const left = molecule.atoms[index];
      const right = molecule.atoms[index + 1];
      const bondColumn = document.createElement("div");
      bondColumn.className = "lewis-bond-column";
      bondColumn.appendChild(
        createSlot({
          kind: "bond",
          label: `Bond between ${left.symbol} and ${right.symbol}`,
          dataset: { bond: bondKey(index) },
          readonly,
        })
      );
      row.appendChild(bondColumn);
    }
  });

  return row;
}

function getIonChargeSuperscript(charge) {
  if (charge === undefined || charge === null || charge === 0) {
    return null;
  }

  const sign = charge > 0 ? "+" : "−";
  const magnitude = Math.abs(charge);
  return magnitude === 1 ? sign : `${magnitude}${sign}`;
}

function applyIonDisplay(molecule, frameEl = ionDisplayEl, chargeEl = ionChargeEl) {
  if (!frameEl || !chargeEl) return;

  const label = getIonChargeSuperscript(molecule.charge);

  if (label) {
    frameEl.classList.add("lewis-ion-display--charged");
    chargeEl.textContent = label;
  } else {
    frameEl.classList.remove("lewis-ion-display--charged");
    chargeEl.textContent = "";
  }
}

function createDiagramFrame(molecule) {
  const frame = document.createElement("div");
  frame.className = "lewis-ion-display";

  const openBracket = document.createElement("span");
  openBracket.className = "lewis-ion-bracket";
  openBracket.setAttribute("aria-hidden", "true");
  openBracket.textContent = "[";

  const body = document.createElement("div");
  body.className = "lewis-ion-body";

  const closeBracket = document.createElement("span");
  closeBracket.className = "lewis-ion-bracket";
  closeBracket.setAttribute("aria-hidden", "true");
  closeBracket.textContent = "]";

  const charge = document.createElement("sup");
  charge.className = "lewis-ion-charge";

  frame.appendChild(openBracket);
  frame.appendChild(body);
  frame.appendChild(closeBracket);
  frame.appendChild(charge);

  applyIonDisplay(molecule, frame, charge);

  return { frame, body };
}

function populateBoard(targetEl, molecule, state, { readonly = false } = {}) {
  targetEl.replaceChildren();
  targetEl.className = "lewis-board lewis-board--linear";
  if (readonly) {
    targetEl.classList.add("lewis-board--example");
  }

  targetEl.appendChild(buildBoardRow(molecule, readonly));
  refreshBoard(targetEl, state);
}

function renderLinearBoard(molecule) {
  populateBoard(boardEl, molecule, { bonds: bondState, lones: loneState });
}

function getAnswerVariants(molecule) {
  const { answer } = molecule;

  if (Array.isArray(answer.variants) && answer.variants.length > 0) {
    return answer.variants;
  }

  return [{ bonds: answer.bonds, loneDots: answer.loneDots }];
}

function buildExampleState(molecule) {
  if (molecule.example) {
    const bonds = { ...(molecule.example.bonds || {}) };
    const lones = {};

    Object.entries(molecule.example.loneDots || {}).forEach(([atomId, entry]) => {
      if (typeof entry === "number") {
        distributeExampleLoneDots(atomId, entry, molecule, lones);
        return;
      }
      Object.entries(entry).forEach(([dir, count]) => {
        if (count > 0) {
          lones[loneKey(atomId, dir)] = count;
        }
      });
    });
    return { bonds, lones };
  }

  return buildStateFromVariant(getAnswerVariants(molecule)[0], molecule);
}

function buildStateFromVariant(variant, molecule) {
  const bonds = { ...variant.bonds };
  const lones = {};

  molecule.atoms.forEach((atom, index) => {
    const entry = variant.loneDots[atom.id];
    if (entry === undefined) return;

    if (typeof entry === "object" && typeof entry.total !== "number") {
      Object.entries(entry).forEach(([dir, count]) => {
        if (count > 0) {
          lones[loneKey(atom.id, dir)] = count;
        }
      });
      return;
    }

    distributeExampleLoneDots(
      atom.id,
      getExpectedLoneDots(atom.id, variant.loneDots),
      molecule,
      lones
    );
  });

  return { bonds, lones };
}

function distributeExampleLoneDots(atomId, total, molecule, lones) {
  if (total <= 0) return;

  const atomIndex = molecule.atoms.findIndex((a) => a.id === atomId);
  const dirs = slotDirectionsForAtom(
    molecule.atoms[atomIndex],
    atomIndex,
    molecule.atoms.length
  );
  let remaining = total;

  if (dirs.includes("north") && remaining >= 2) {
    lones[loneKey(atomId, "north")] = 2;
    remaining -= 2;
  }
  if (dirs.includes("south") && remaining >= 2) {
    lones[loneKey(atomId, "south")] = 2;
    remaining -= 2;
  }

  for (const dir of ["west", "east"]) {
    if (!dirs.includes(dir) || remaining <= 0) continue;
    const count = Math.min(remaining, 2);
    lones[loneKey(atomId, dir)] = count;
    remaining -= count;
  }
}

function bondKey(leftIndex) {
  return `${leftIndex}-${leftIndex + 1}`;
}

function loneKey(atomId, direction) {
  return `${atomId}:${direction}`;
}

function parseLoneKey(key) {
  const [atomId, direction] = key.split(":");
  return { atomId, direction };
}

function getExpectedLoneDots(atomId, loneDotsAnswer) {
  const entry = loneDotsAnswer[atomId];
  if (typeof entry === "number") return entry;
  if (entry && typeof entry.total === "number") return entry.total;
  if (entry && typeof entry === "object") {
    return Object.values(entry).reduce((sum, value) => sum + value, 0);
  }
  return 0;
}

function getActualLoneDots(atomId, molecule) {
  const atomIndex = molecule.atoms.findIndex((a) => a.id === atomId);
  if (atomIndex < 0) return 0;

  return slotDirectionsForAtom(
    molecule.atoms[atomIndex],
    atomIndex,
    molecule.atoms.length
  ).reduce(
    (sum, dir) => sum + (loneState[loneKey(atomId, dir)] || 0),
    0
  );
}

function getFilledLoneSlotCounts(atomId, molecule) {
  const atomIndex = molecule.atoms.findIndex((a) => a.id === atomId);
  if (atomIndex < 0) return [];

  return slotDirectionsForAtom(
    molecule.atoms[atomIndex],
    atomIndex,
    molecule.atoms.length
  )
    .map((dir) => loneState[loneKey(atomId, dir)] || 0)
    .filter((count) => count > 0);
}

function clearFeedback() {
  feedbackEl.replaceChildren();
  feedbackEl.classList.remove("show");
}

function resetState() {
  bondState = {};
  loneState = {};
  clearSelectedTool();

  if (!currentMolecule) return;

  const atoms = currentMolecule.atoms;
  for (let i = 0; i < atoms.length - 1; i++) {
    bondState[bondKey(i)] = 0;
  }

  atoms.forEach((atom, index) => {
    loneDirectionsForAtom(atom, index, currentMolecule).forEach((dir) => {
      loneState[loneKey(atom.id, dir)] = 0;
    });
  });
}

function renderBondSlotContent(count) {
  const wrap = document.createElement("span");
  wrap.className = "lewis-slot-bonds";

  if (count === 1) wrap.classList.add("lewis-slot-bonds--single");
  else if (count === 2) wrap.classList.add("lewis-slot-bonds--double");
  else if (count >= 3) wrap.classList.add("lewis-slot-bonds--triple");

  for (let i = 0; i < count; i++) {
    const line = document.createElement("span");
    line.className = "lewis-bond-line";
    wrap.appendChild(line);
  }

  return wrap;
}

function renderLoneSlotContent(count, direction) {
  const wrap = document.createElement("span");
  wrap.className = "lewis-slot-dots";

  if (direction === "west" || direction === "east") {
    wrap.classList.add("lewis-slot-dots--vertical");
  }

  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    dot.className = "lewis-dot";
    dot.textContent = "·";
    wrap.appendChild(dot);
  }

  return wrap;
}

function refreshSlotElement(slotEl, state = null) {
  const bonds = state?.bonds ?? bondState;
  const lones = state?.lones ?? loneState;
  const kind = slotEl.dataset.kind;
  slotEl.replaceChildren();

  if (kind === "bond") {
    const count = bonds[slotEl.dataset.bond] || 0;
    if (count > 0) {
      slotEl.appendChild(renderBondSlotContent(count));
    }
    slotEl.classList.toggle("lewis-slot--filled", count > 0);
    return;
  }

  const count = lones[slotEl.dataset.lone] || 0;
  if (count > 0) {
    const { direction } = parseLoneKey(slotEl.dataset.lone);
    slotEl.appendChild(renderLoneSlotContent(count, direction));
  }
  slotEl.classList.toggle("lewis-slot--filled", count > 0);
}

function refreshBoard(container = boardEl, state = null) {
  container.querySelectorAll(".lewis-slot").forEach((slotEl) => {
    refreshSlotElement(slotEl, state);
  });
}

function createSlot({
  kind,
  label,
  dataset,
  direction = null,
  readonly = false,
}) {
  const slot = document.createElement(readonly ? "div" : "button");
  if (!readonly) {
    slot.type = "button";
  }
  slot.className = `lewis-slot lewis-slot--${kind}`;
  if (readonly) {
    slot.classList.add("lewis-slot--readonly");
  }
  slot.dataset.kind = kind;
  slot.setAttribute("aria-label", label);

  if (direction) {
    slot.classList.add(`lewis-grid-${direction}`);
  }

  if (kind === "bond") {
    slot.classList.add("lewis-grid-bond");
  }

  Object.entries(dataset).forEach(([key, value]) => {
    slot.dataset[key] = value;
  });

  if (readonly) {
    return slot;
  }

  slot.addEventListener("click", () => handleSlotClick(slot));
  slot.addEventListener("dragover", (event) => {
    event.preventDefault();
    slot.classList.add("lewis-slot--dragover");
  });
  slot.addEventListener("dragleave", () => {
    slot.classList.remove("lewis-slot--dragover");
  });
  slot.addEventListener("drop", (event) => {
    event.preventDefault();
    slot.classList.remove("lewis-slot--dragover");
    const token = event.dataTransfer.getData("text/plain");
    if (token) addTokenToSlot(slot, token);
  });

  return slot;
}

function renderBoard(molecule) {
  if (molecule.layout !== "linear") {
    boardEl.textContent = "Unsupported layout.";
    return;
  }

  renderLinearBoard(molecule);
}

function lockQuestion() {
  questionLocked = true;
  clearSelectedTool();
  boardEl.classList.add("lewis-board--locked");
  checkBtn.disabled = true;
  skipBtn.disabled = true;
  resetBtn.disabled = true;

  document.querySelectorAll(".lewis-token").forEach((token) => {
    token.setAttribute("draggable", "false");
    token.classList.add("lewis-token--disabled");
  });
}

function unlockQuestion() {
  questionLocked = false;
  boardEl.classList.remove("lewis-board--locked");
  checkBtn.disabled = false;
  resetBtn.disabled = false;
  skipBtn.disabled = false;

  document.querySelectorAll(".lewis-token").forEach((token) => {
    token.setAttribute("draggable", "true");
    token.classList.remove("lewis-token--disabled");
  });
}

function addTokenToSlot(slot, token) {
  if (questionLocked) return;

  if (slot.dataset.kind === "bond" && token === "bond") {
    const key = slot.dataset.bond;
    bondState[key] = Math.min(MAX_BONDS, (bondState[key] || 0) + 1);
  } else if (slot.dataset.kind === "lone" && token === "dot") {
    const key = slot.dataset.lone;
    loneState[key] = Math.min(MAX_DOTS, (loneState[key] || 0) + 1);
  } else {
    return;
  }

  refreshSlotElement(slot);
}

function removeFromSlot(slot) {
  if (questionLocked) return;

  if (slot.dataset.kind === "bond") {
    const key = slot.dataset.bond;
    bondState[key] = Math.max(0, (bondState[key] || 0) - 1);
  } else {
    const key = slot.dataset.lone;
    loneState[key] = Math.max(0, (loneState[key] || 0) - 1);
  }

  refreshSlotElement(slot);
}

function clearSelectedTool() {
  selectedTool = null;
  document.querySelectorAll(".lewis-token").forEach((token) => {
    token.classList.remove("lewis-token--selected");
  });
  boardEl.classList.remove("lewis-board--erase");
}

function setSelectedTool(tool) {
  selectedTool = selectedTool === tool ? null : tool;
  document.querySelectorAll(".lewis-token").forEach((el) => {
    el.classList.toggle("lewis-token--selected", el.dataset.token === selectedTool);
  });
  boardEl.classList.toggle("lewis-board--erase", selectedTool === "erase");
}

function handleSlotClick(slot) {
  if (questionLocked) return;

  if (selectedTool === "erase") {
    removeFromSlot(slot);
    return;
  }

  if (selectedTool === "bond" || selectedTool === "dot") {
    addTokenToSlot(slot, selectedTool);
  }
}

function setupPalette() {
  document.querySelectorAll(".lewis-token").forEach((tokenEl) => {
    const token = tokenEl.dataset.token;

    tokenEl.addEventListener("dragstart", (event) => {
      if (questionLocked || token === "erase") {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData("text/plain", token);
      event.dataTransfer.effectAllowed = "copy";
    });

    tokenEl.addEventListener("click", () => {
      if (questionLocked) return;
      setSelectedTool(token);
    });

    tokenEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        tokenEl.click();
      }
    });
  });
}

function validateVariant(variant, molecule) {
  const issues = [];
  const { bonds, loneDots } = variant;

  Object.entries(bonds).forEach(([key, expected]) => {
    const actual = bondState[key] || 0;
    if (actual !== expected) {
      const [left, right] = key.split("-").map(Number);
      const leftSym = molecule.atoms[left].symbol;
      const rightSym = molecule.atoms[right].symbol;
      issues.push(
        `Bond between ${leftSym} and ${rightSym}: expected ${expected}, got ${actual}.`
      );
    }
  });

  Object.keys(bondState).forEach((key) => {
    if (!(key in bonds) && bondState[key] > 0) {
      issues.push(`Unexpected bond in slot ${key}.`);
    }
  });

  Object.entries(loneDots).forEach(([atomId]) => {
    const expected = getExpectedLoneDots(atomId, loneDots);
    const actual = getActualLoneDots(atomId, molecule);
    const symbol = molecule.atoms.find((a) => a.id === atomId)?.symbol;
    const pairCount = expected / 2;

    if (actual !== expected) {
      issues.push(
        `${symbol}: expected ${pairCount} lone pair${pairCount === 1 ? "" : "s"} (${expected} electrons), got ${actual}.`
      );
      return;
    }

    const slotCounts = getFilledLoneSlotCounts(atomId, molecule);
    if (slotCounts.some((count) => count % 2 !== 0)) {
      issues.push(
        `${symbol}: lone electrons must be placed in pairs (2 dots per pair).`
      );
    }
  });

  Object.entries(loneState).forEach(([key, count]) => {
    if (count === 0) return;
    const { atomId } = parseLoneKey(key);
    if (!(atomId in loneDots)) {
      const symbol = molecule.atoms.find((a) => a.id === atomId)?.symbol;
      issues.push(`Unexpected lone electrons on ${symbol}.`);
    }
  });

  return issues;
}

function compareAnswer() {
  const variants = getAnswerVariants(currentMolecule);

  for (const variant of variants) {
    if (validateVariant(variant, currentMolecule).length === 0) {
      return [];
    }
  }

  return validateVariant(variants[0], currentMolecule);
}

function showFeedback(
  headline,
  tone,
  detail = null,
  issues = [],
  showExample = false
) {
  feedbackEl.replaceChildren();

  const panel = document.createElement("div");
  panel.className = `feedback-panel feedback-panel--${tone}`;

  const main = document.createElement("p");
  main.className = "feedback-main";

  const headlineEl = document.createElement("span");
  headlineEl.className = "feedback-headline";
  headlineEl.textContent = headline;
  main.appendChild(headlineEl);

  if (detail) {
    const detailEl = document.createElement("span");
    detailEl.className = "feedback-detail";
    detailEl.textContent = detail;
    main.appendChild(detailEl);
  }

  panel.appendChild(main);

  if (currentMolecule.explanation) {
    const explanation = document.createElement("p");
    explanation.className = "feedback-explanation stem-text";
    setStemText(explanation, currentMolecule.explanation);
    panel.appendChild(explanation);
  }

  if (issues.length > 0) {
    const list = document.createElement("ul");
    list.className = "lewis-feedback-list";
    issues.forEach((issue) => {
      const item = document.createElement("li");
      item.textContent = issue;
      list.appendChild(item);
    });
    panel.appendChild(list);
  }

  if (showExample && currentMolecule) {
    const exampleSection = document.createElement("div");
    exampleSection.className = "lewis-example";

    const label = document.createElement("p");
    label.className = "lewis-example-label";
    label.textContent = "Example correct diagram";
    exampleSection.appendChild(label);

    const boardWrap = document.createElement("div");
    boardWrap.className = "lewis-board-wrap lewis-board-wrap--example";

    const { frame, body } = createDiagramFrame(currentMolecule);
    const exampleBoard = document.createElement("div");
    exampleBoard.setAttribute(
      "aria-label",
      "Example correct Lewis diagram"
    );
    populateBoard(exampleBoard, currentMolecule, buildExampleState(currentMolecule), {
      readonly: true,
    });
    body.appendChild(exampleBoard);
    boardWrap.appendChild(frame);
    exampleSection.appendChild(boardWrap);
    panel.appendChild(exampleSection);
  }

  feedbackEl.appendChild(panel);
  feedbackEl.classList.add("show");
}

function loadMolecule(molecule) {
  currentMolecule = molecule;
  resetState();
  formulaEl.textContent = molecule.formula;
  if (typeof setStemText === "function") {
    setStemText(formulaEl, molecule.formula);
  }
  renderBoard(molecule);
  applyIonDisplay(molecule);
}

function resetQuestionUI() {
  clearFeedback();
  clearSelectedTool();
  unlockQuestion();
  continueBtn.style.display = "none";
  skipBtn.style.display = "inline-block";
  skipBtn.disabled = false;
}

function updateProgress() {
  const percent = molecules.length
    ? (current / molecules.length) * 100
    : 0;
  progressBar.style.width = percent + "%";
  questionProgress.textContent = `Structure ${current + 1} of ${molecules.length}`;
}

function updateScoreDisplay() {
  scoreDisplay.textContent = correctCount;
  totalDisplay.textContent = answeredCount;
}

function loadQuestion() {
  if (current >= molecules.length) {
    endSession();
    return;
  }

  resetQuestionUI();
  updateProgress();
  loadMolecule(molecules[current]);
}

function revealAnswer() {
  lockQuestion();
  continueBtn.style.display = "inline-block";
  continueBtn.focus();
}

function handleCheck() {
  const issues = compareAnswer();
  const correct = issues.length === 0;

  answeredCount++;

  if (correct) {
    correctCount++;
    showFeedback("Correct!", "correct");
  } else {
    showFeedback("Not quite.", "incorrect", issues[0], issues.slice(1), true);
  }

  updateScoreDisplay();
  revealAnswer();
}

function handleSkip() {
  skippedCount++;
  showFeedback(
    "Skipped.",
    "skipped",
    `Correct structure: ${currentMolecule.formula}`,
    [],
    true
  );
  revealAnswer();
}

function hideActiveUI() {
  questionArea.style.display = "none";
  instructionContainer.style.display = "none";
  clearFeedback();
  continueBtn.style.display = "none";
  skipBtn.style.display = "none";
}

function showActiveUI() {
  questionArea.style.display = "";
  instructionContainer.style.display = "";
}

function endSession() {
  hideActiveUI();

  finalScreen.style.display = "block";

  const percent =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const tier = getScoreTier(percent);

  finalTier.textContent = `${tier.emoji} ${tier.message}`;
  finalScore.textContent = `${percent}%`;
  finalDetail.textContent = `${correctCount} of ${answeredCount} correct${skippedCount > 0 ? ` · ${skippedCount} skipped` : ""}`;

  progressBar.style.width = "100%";
  questionProgress.textContent = `Structure ${molecules.length} of ${molecules.length}`;

  finalHeading.focus();
}

function resetRunState() {
  current = 0;
  correctCount = 0;
  answeredCount = 0;
  skippedCount = 0;
}

async function init() {
  try {
    const res = await fetch("data/chemistry/lewis_structures.json");
    if (!res.ok) throw new Error("Could not load Lewis structure data.");

    toolData = await res.json();

    if (!Array.isArray(toolData.molecules) || toolData.molecules.length === 0) {
      throw new Error("No Lewis structures are available yet.");
    }

    molecules = shuffle([...toolData.molecules]);

    const titleEl = document.getElementById("lewis-title");
    if (titleEl) {
      titleEl.textContent = toolData.title;
    }

    loadQuestion();
    contentEl.classList.remove("hidden");

    setTimeout(() => {
      loadingScreen.classList.add("hidden");
    }, 150);
  } catch (error) {
    showError(error.message || "Something went wrong.");
  }
}

checkBtn.addEventListener("click", handleCheck);

resetBtn.addEventListener("click", () => {
  if (questionLocked) return;
  resetState();
  refreshBoard();
  clearFeedback();
});

continueBtn.addEventListener("click", () => {
  current++;
  loadQuestion();
});

skipBtn.addEventListener("click", handleSkip);

retryBtn.addEventListener("click", () => {
  resetRunState();
  molecules = shuffle([...toolData.molecules]);

  finalScreen.style.display = "none";
  showActiveUI();
  scoreDisplay.textContent = "0";
  totalDisplay.textContent = "0";
  skipBtn.style.display = "inline-block";

  loadQuestion();
});

setupPalette();
init();
