const PARAMS = new URLSearchParams(window.location.search);

const quizName = PARAMS.get("quiz");
const VALID_MODES = ["practice", "exam"];

if (!quizName) {
  document.body.innerHTML = "<h1>No quiz specified</h1>";
  throw new Error("Missing quiz parameter");
}

const dataPath = "data/" + quizName + ".json";
let quizMode = PARAMS.get("mode");

/* STATE */

let quizData;
let questions = [];
let selectedSkills = [];

let current = 0;
let correctCount = 0;
let answeredCount = 0;
let skippedCount = 0;
let skippedQuestions = [];
let wrongQuestions = [];
let selectedSentenceChip = null;

/* ELEMENTS */

const quizContent = document.getElementById("quiz-content");
const modeScreen = document.getElementById("mode-screen");
const modeBadge = document.getElementById("mode-badge");
const questionProgress = document.getElementById("question-progress");
const promptBox = document.getElementById("prompt");
const promptContainer = document.getElementById("prompt-container");
const draggable = document.getElementById("draggable");
const interactionArea = document.getElementById("interaction-area");
const categoriesContainer = document.getElementById("categories");
const feedback = document.getElementById("feedback");
const scoreDisplay = document.getElementById("score");
const totalDisplay = document.getElementById("total");
const scoreContainer = document.querySelector(".score");
const progressBar = document.getElementById("progress-bar");
const continueBtn = document.getElementById("continue-btn");
const checkWorksheetBtn = document.getElementById("check-worksheet-btn");
const skipBtn = document.getElementById("skip-btn");
const finalScreen = document.getElementById("final-screen");
const finalHeading = document.getElementById("final-heading");
const finalTier = document.getElementById("final-tier");
const finalScore = document.getElementById("final-score");
const finalDetail = document.getElementById("final-detail");
const finalHint = document.getElementById("final-hint");
const retryBtn = document.getElementById("retry-btn");
const reviewSkippedBtn = document.getElementById("review-skipped-btn");
const reviewWrongBtn = document.getElementById("review-wrong-btn");
const backToQuizzesBtn = document.getElementById("back-to-quizzes-btn");
const instructionText = document.getElementById("instruction-text");
const questionArea = document.querySelector(".question-area");
const instructionContainer = document.querySelector(".instruction-container");
const loadingScreen = document.getElementById("loading-screen");
const quizError = document.getElementById("quiz-error");
const quizErrorMessage = document.getElementById("quiz-error-message");
const quizErrorBack = document.getElementById("quiz-error-back");

/* UTIL */

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
      message: "Good progress — focus on the questions you missed.",
    };
  }
  return {
    emoji: "💪",
    message: "Keep going — review wrong and skipped questions.",
  };
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function isTouchDevice() {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

function isExamMode() {
  return quizMode === "exam";
}

function prepareQuestions(sourceQuestions) {
  return shuffle(
    sourceQuestions.map((q) => {
      if (q.type === "multiple_choice") {
        return {
          ...q,
          options: shuffle([...q.options]),
        };
      }
      if (q.type === "drug_worksheet") {
        return {
          ...q,
          fields: q.fields.map((field) => ({
            ...field,
            options: shuffle([...field.options]),
          })),
        };
      }
      if (q.type === "drag_sentence" || q.type === "net_ionic") {
        return {
          ...q,
          bank: shuffle([...q.bank]),
        };
      }
      return q;
    }),
  );
}

function applyModeUI() {
  const labels = {
    practice: "Practice mode",
    exam: "Exam mode",
  };

  modeBadge.textContent = labels[quizMode] || "";
  modeBadge.classList.toggle("hidden", !quizMode);

  if (isExamMode()) {
    scoreContainer.style.display = "none";
  } else {
    scoreContainer.style.display = "";
  }

  skipBtn.style.display = isExamMode() ? "none" : "inline-block";
}

function resetRunState() {
  current = 0;
  correctCount = 0;
  answeredCount = 0;
  skippedCount = 0;
  skippedQuestions = [];
  wrongQuestions = [];
}

/* FEEDBACK */

function setFeedback(headline, question, tone, detail = null, messages = null) {
  feedback.replaceChildren();

  const panel = document.createElement("div");
  panel.className = "feedback-panel feedback-panel--" + tone;

  const main = document.createElement("p");
  main.className = "feedback-main";

  const headlineEl = document.createElement("span");
  headlineEl.className = "feedback-headline";
  setStemText(headlineEl, headline);
  main.appendChild(headlineEl);

  if (detail) {
    const detailEl = document.createElement("span");
    detailEl.className = "feedback-detail";
    setStemText(detailEl, detail);
    main.appendChild(detailEl);
  }

  panel.appendChild(main);

  const items = (messages || []).filter(Boolean);
  if (items.length > 0) {
    const list = document.createElement("ul");
    list.className = "quiz-feedback-list";
    items.forEach((message) => {
      const item = document.createElement("li");
      setStemText(item, message);
      list.appendChild(item);
    });
    panel.appendChild(list);
  }

  if (question.explanation) {
    const explanation = document.createElement("p");
    explanation.className = "feedback-explanation";
    setStemText(explanation, question.explanation);
    panel.appendChild(explanation);
  }

  feedback.appendChild(panel);
}

function formatWorksheetAnswerSummary(question) {
  return question.fields.map((field) => `${field.label}: ${field.answer}`);
}

function formatDragSentenceAnswerSummary(question) {
  return question.blanks.map((blank, index) => `Blank ${index + 1}: ${blank}`);
}

function lockQuestionInteraction(question) {
  draggable.setAttribute("draggable", "false");
  categoriesContainer.classList.add("locked");

  if (
    question.type === "multiple_choice" ||
    question.type === "drug_worksheet"
  ) {
    document.querySelectorAll(".mc-option").forEach((btn) => {
      btn.disabled = true;
    });
  }

  if (question.type === "fill_in") {
    const input = document.getElementById("fill-in-input");
    if (input) {
      input.disabled = true;
    }
  }

  if (question.type === "drag_sentence" || question.type === "net_ionic") {
    document.querySelectorAll(".sentence-chip").forEach((chip) => {
      chip.setAttribute("draggable", "false");
      chip.classList.remove("sentence-chip--selected");
    });
    document.querySelectorAll(".net-ionic-choice").forEach((btn) => {
      btn.disabled = true;
    });
    document
      .querySelectorAll(".net-ionic-add, .net-ionic-erase, .net-ionic-coeff")
      .forEach((btn) => {
        btn.disabled = true;
      });
    clearNetIonicErase();
  }

  if (
    question.type === "drug_worksheet" ||
    question.type === "drag_sentence" ||
    question.type === "fill_in" ||
    question.type === "net_ionic"
  ) {
    checkWorksheetBtn.disabled = true;
    checkWorksheetBtn.style.display = "none";
  }
}

function highlightCorrectAnswer(question) {
  if (question.type === "multiple_choice") {
    document.querySelectorAll(".mc-option").forEach((btn) => {
      if (btn.dataset.value === question.answer) {
        btn.classList.add("correct");
      }
    });
  } else if (question.type === "drag_and_drop") {
    const correctZone = document.querySelector(
      `[data-category="${CSS.escape(question.answer)}"]`,
    );
    if (correctZone) {
      correctZone.classList.add("correct");
    }
  } else if (question.type === "fill_in") {
    const input = document.getElementById("fill-in-input");
    if (input) {
      input.classList.add("correct");
    }
  }
  // drug_worksheet / drag_sentence: slot states are set during check/skip reveal
}

function showQuestionFeedback(
  headline,
  question,
  tone,
  detail = null,
  messages = null,
) {
  skipBtn.disabled = true;
  lockQuestionInteraction(question);
  highlightCorrectAnswer(question);
  setFeedback(headline, question, tone, detail, messages);
  feedback.classList.add("show");
  continueBtn.disabled = false;
  continueBtn.style.display = "inline-block";
  continueBtn.focus();
}

function showExamAdvance(question) {
  skipBtn.disabled = true;
  lockQuestionInteraction(question);
  continueBtn.disabled = false;
  continueBtn.style.display = "inline-block";
  continueBtn.focus();
}

function updateScoreDisplay() {
  if (!isExamMode()) {
    scoreDisplay.textContent = correctCount;
    totalDisplay.textContent = answeredCount;
  }
}

function resetQuestionUI() {
  promptBox.innerHTML = "";
  promptContainer.style.display = "block";
  promptContainer.classList.remove("prompt-static");
  categoriesContainer.innerHTML = "";
  categoriesContainer.classList.remove(
    "categories--worksheet",
    "categories--sentence",
    "categories--fill-in",
    "categories--net-ionic",
  );
  feedback.replaceChildren();
  feedback.classList.remove("show");
  selectedSentenceChip = null;

  continueBtn.style.display = "none";
  continueBtn.disabled = true;
  checkWorksheetBtn.style.display = "none";
  checkWorksheetBtn.disabled = true;
  checkWorksheetBtn.textContent = "Check answers";

  skipBtn.disabled = false;
  if (!isExamMode()) {
    skipBtn.style.display = "inline-block";
  }

  draggable.classList.add("hidden");
  draggable.innerHTML = "";
  draggable.setAttribute("draggable", "false");

  interactionArea.style.display = "flex";
  categoriesContainer.style.display = "flex";
  categoriesContainer.classList.remove("locked");
}

/* RENDER SYSTEM */

const questionRenderers = {
  drag_and_drop: renderDragQuestion,
  multiple_choice: renderMultipleChoiceQuestion,
  drug_worksheet: renderDrugWorksheetQuestion,
  drag_sentence: renderDragSentenceQuestion,
  fill_in: renderFillInQuestion,
  net_ionic: renderNetIonicQuestion,
};

const answerCheckers = {
  drag_and_drop: checkDragAnswer,
  multiple_choice: checkMultipleChoiceAnswer,
  drug_worksheet: checkDrugWorksheetAnswer,
  drag_sentence: checkDragSentenceAnswer,
  fill_in: checkFillInAnswer,
  net_ionic: checkNetIonicAnswer,
};

/* MODE SELECT */

function isIonBankQuiz(data) {
  return typeof IonQuiz !== "undefined" && IonQuiz.hasIonBank(data);
}

function applyQuizMeta() {
  document.getElementById("tabTitle").textContent = quizData.title;
  document.getElementById("quizHeader").textContent = quizData.title;

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.content = `Study with the ${quizData.title} on STEM Study Buddy. Practice and exam modes with instant feedback.`;
  }

  document.body.dataset.subject = quizName.split("/")[0];
  if (typeof Nav !== "undefined") {
    Nav.updateQuizCrumb(quizData.title);
  }

  applyQuizDisclaimer();
  setupReferenceTable();
}

function hasReferenceTable(data = quizData) {
  const table = data?.referenceTable;
  return (
    !!table &&
    Array.isArray(table.columns) &&
    table.columns.length > 0 &&
    Array.isArray(table.rows) &&
    table.rows.length > 0
  );
}

function referenceTableStorageKey() {
  return "stem-reference-table:" + quizName;
}

function isReferenceTableOpen() {
  try {
    return localStorage.getItem(referenceTableStorageKey()) !== "off";
  } catch {
    return true;
  }
}

function setReferenceTableOpen(open) {
  try {
    localStorage.setItem(referenceTableStorageKey(), open ? "on" : "off");
  } catch {
    // Storage may be unavailable.
  }
}

function applyReferenceTableVisibility() {
  const panel = document.getElementById("reference-panel");
  const toggle = document.getElementById("reference-toggle");
  if (!panel || !toggle) return;

  const open = isReferenceTableOpen();
  panel.classList.toggle("reference-panel--collapsed", !open);
  toggle.textContent = open ? "Hide table" : "Show table";
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function setupReferenceTable() {
  const panel = document.getElementById("reference-panel");
  const title = document.getElementById("reference-panel-title");
  const note = document.getElementById("reference-panel-note");
  const wrap = document.getElementById("reference-table-wrap");
  const toggle = document.getElementById("reference-toggle");
  if (!panel) return;

  if (!hasReferenceTable()) {
    panel.classList.add("hidden");
    return;
  }

  const tableData = quizData.referenceTable;
  if (title) {
    title.textContent = tableData.title || "Reference table";
  }

  if (note) {
    if (tableData.note) {
      setStemText(note, tableData.note);
      note.classList.remove("hidden");
    } else {
      note.textContent = "";
      note.classList.add("hidden");
    }
  }

  if (wrap) {
    wrap.replaceChildren();
    const table = document.createElement("table");
    table.className = "reference-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    tableData.columns.forEach((column) => {
      const th = document.createElement("th");
      setStemText(th, column);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    tableData.rows.forEach((row) => {
      const tr = document.createElement("tr");
      (row.cells || []).forEach((cell) => {
        const td = document.createElement("td");
        setStemText(td, cell);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  if (toggle && !toggle.dataset.bound) {
    toggle.dataset.bound = "true";
    toggle.addEventListener("click", () => {
      setReferenceTableOpen(!isReferenceTableOpen());
      applyReferenceTableVisibility();
    });
  }

  panel.classList.remove("hidden");
  applyReferenceTableVisibility();
}

function showReferencePanel() {
  const panel = document.getElementById("reference-panel");
  if (panel && hasReferenceTable()) {
    panel.classList.remove("hidden");
  }
}

function hideReferencePanel() {
  const panel = document.getElementById("reference-panel");
  if (panel) {
    panel.classList.add("hidden");
  }
}

function applyQuizDisclaimer() {
  const text = quizData?.disclaimer;
  if (typeof text !== "string" || text.trim().length === 0) return;
  if (typeof CatalogUtils === "undefined") return;
  if (document.querySelector(".quiz-disclaimer")) return;

  if (modeScreen) {
    modeScreen.appendChild(CatalogUtils.createDisclaimer(text));
  }

  const compact = CatalogUtils.createDisclaimer(text, { compact: true });
  const footer = quizContent?.querySelector("footer");
  if (footer) {
    footer.prepend(compact);
  } else {
    quizContent?.appendChild(compact);
  }
}

function getCheckedSkillIds() {
  return Array.from(
    document.querySelectorAll("#skill-options input[type='checkbox']:checked"),
  ).map((input) => input.value);
}

function updateSkillPickerError(show) {
  const error = document.getElementById("skill-picker-error");
  if (!error) return;
  error.classList.toggle("hidden", !show);
}

function syncSkillOptionState(label, input) {
  label.classList.toggle("skill-option--selected", input.checked);
}

function createSkillExampleChip(caption, value, kind) {
  const chip = document.createElement("span");
  chip.className = "skill-example-chip";

  const label = document.createElement("span");
  label.className = "skill-example-caption";
  label.textContent = caption;

  const text = document.createElement("span");
  text.className = `skill-example-${kind}`;
  setStemText(text, value);

  chip.appendChild(label);
  chip.appendChild(text);
  return chip;
}

function renderSkillPicker(data) {
  const picker = document.getElementById("skill-picker");
  const options = document.getElementById("skill-options");
  if (!picker || !options) return;

  const selected = new Set(selectedSkills);
  options.replaceChildren();

  data.skills.forEach((skill) => {
    const label = document.createElement("label");
    label.className = "skill-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = skill.id;
    input.checked = selected.has(skill.id);
    input.addEventListener("change", () => {
      selectedSkills = getCheckedSkillIds();
      syncSkillOptionState(label, input);
      updateSkillPickerError(false);
    });

    const copy = document.createElement("span");
    copy.className = "skill-option-copy";

    const title = document.createElement("strong");
    title.textContent = skill.label;
    copy.appendChild(title);

    if (skill.examplePrompt && skill.exampleAnswer) {
      const example = document.createElement("span");
      example.className = "skill-option-example";
      example.appendChild(
        createSkillExampleChip("Shown", skill.examplePrompt, "prompt"),
      );
      example.appendChild(
        createSkillExampleChip("Answer", skill.exampleAnswer, "answer"),
      );
      copy.appendChild(example);
    }

    label.appendChild(input);
    label.appendChild(copy);
    syncSkillOptionState(label, input);
    options.appendChild(label);
  });

  picker.classList.remove("hidden");
}

function sourceQuestions() {
  if (isIonBankQuiz(quizData)) {
    return IonQuiz.generateQuestions(quizData, selectedSkills);
  }

  return quizData.questions;
}

function beginQuiz() {
  const generated = sourceQuestions();
  if (!Array.isArray(generated) || generated.length === 0) {
    showQuizLoadError();
    return;
  }

  questions = prepareQuestions(generated);
  modeScreen.classList.add("hidden");
  quizContent.classList.remove("hidden");
  applyModeUI();
  loadQuestion();

  setTimeout(() => {
    loadingScreen.classList.add("hidden");
  }, 150);
}

function startFromModeCard(mode) {
  if (isIonBankQuiz(quizData)) {
    selectedSkills = getCheckedSkillIds();
    if (selectedSkills.length === 0) {
      updateSkillPickerError(true);
      return;
    }
  }

  quizMode = mode;
  beginQuiz();
}

function bindModeCards() {
  modeScreen.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      startFromModeCard(btn.dataset.mode);
    });
  });
}

async function initQuiz() {
  loadingScreen.classList.remove("hidden");
  quizError.classList.add("hidden");

  try {
    const res = await fetch(dataPath);
    if (!res.ok) {
      throw new Error("Quiz not found or unavailable.");
    }

    quizData = await res.json();
    applyQuizMeta();

    if (isIonBankQuiz(quizData)) {
      selectedSkills = IonQuiz.parseSkills(PARAMS.get("skills"), quizData);
    }

    const modeReady = quizMode && VALID_MODES.includes(quizMode);
    if (modeReady) {
      beginQuiz();
      return;
    }

    if (
      !isIonBankQuiz(quizData) &&
      (!Array.isArray(quizData.questions) || quizData.questions.length === 0)
    ) {
      throw new Error("This quiz has no questions yet.");
    }

    loadingScreen.classList.add("hidden");
    modeScreen.classList.remove("hidden");
    if (isIonBankQuiz(quizData)) {
      renderSkillPicker(quizData);
    }
    bindModeCards();
  } catch {
    showQuizLoadError();
  }
}

function showQuizLoadError() {
  loadingScreen.classList.add("hidden");
  modeScreen.classList.add("hidden");
  quizContent.classList.add("hidden");

  const subject = quizName.split("/")[0];
  quizErrorMessage.textContent =
    "We couldn't load this quiz. It may have been moved or is temporarily unavailable.";
  quizErrorBack.href = subject + ".html";
  quizError.classList.remove("hidden");
}

function trackQuizComplete(percent) {
  if (typeof gtag !== "function") return;

  gtag("event", "quiz_complete", {
    quiz_name: quizName,
    subject: quizName.split("/")[0],
    mode: quizMode || "practice",
    score_percent: percent,
    correct: correctCount,
    answered: answeredCount,
    skipped: skippedCount,
  });
}

/* LOAD QUESTION */

function loadQuestion() {
  if (current >= questions.length) {
    endQuiz();
    return;
  }

  resetQuestionUI();
  updateProgress();

  const question = questions[current];
  const renderer = questionRenderers[question.type];

  if (!renderer) {
    throw new Error("Unknown question type: " + question.type);
  }

  renderer(question);
}

/* DRAG QUESTION */

function renderDragQuestion(question) {
  createCategories(question);
  interactionArea.style.display = "flex";

  if (hasReferenceTable()) {
    instructionText.textContent = isTouchDevice()
      ? "Read the table, then tap Soluble or Insoluble."
      : "Read the table, then drag the compound into Soluble or Insoluble.";
  } else if (isTouchDevice()) {
    instructionText.textContent = "Tap the matching category below.";
  } else {
    instructionText.textContent =
      "Drag the prompt into the appropriate category.";
  }

  if (isTouchDevice()) {
    draggable.setAttribute("draggable", "false");
  } else {
    draggable.setAttribute("draggable", "true");
  }

  promptContainer.style.display = "none";
  promptContainer.classList.remove("prompt-static");

  if (question.prompt.text) {
    const text = document.createElement("div");
    text.className = "draggable-text";
    setStemText(text, question.prompt.text);
    draggable.appendChild(text);
  }

  if (question.prompt.image) {
    const img = document.createElement("img");
    img.src = question.prompt.image;
    img.className = "quiz-image";
    draggable.appendChild(img);
  }

  draggable.classList.remove("hidden");
  draggable.classList.add("visible");
}

/* MULTIPLE CHOICE */

function renderMultipleChoiceQuestion(question) {
  draggable.classList.add("hidden");
  promptContainer.style.display = "block";
  promptContainer.classList.add("prompt-static");
  interactionArea.style.display = "none";

  instructionText.textContent =
    "Select the correct answer from the options below.";

  if (question.prompt.text) {
    const text = document.createElement("div");
    setStemText(text, question.prompt.text);
    promptBox.appendChild(text);
  }

  if (question.prompt.image) {
    const img = document.createElement("img");
    img.src = question.prompt.image;
    img.className = "quiz-image";
    promptBox.appendChild(img);
  }

  question.options.forEach((option) => {
    const btn = document.createElement("button");
    btn.className = "mc-option";
    btn.dataset.value = option;
    setStemText(btn, option);

    btn.addEventListener("click", () => {
      handleAnswer(option);
    });

    categoriesContainer.appendChild(btn);
  });
}

/* FILL IN */

function getFillInValue() {
  const input = document.getElementById("fill-in-input");
  return input ? input.value : "";
}

function updateFillInCheckEnabled() {
  const question = questions[current];
  if (!question || question.type !== "fill_in") return;

  checkWorksheetBtn.disabled = getFillInValue().trim().length === 0;
}

function submitFillInAnswer() {
  if (categoriesContainer.classList.contains("locked")) return;
  if (getFillInValue().trim().length === 0) return;
  handleAnswer(getFillInValue());
}

function renderFillInQuestion(question) {
  draggable.classList.add("hidden");
  promptContainer.style.display = "block";
  promptContainer.classList.add("prompt-static");
  interactionArea.style.display = "none";
  categoriesContainer.classList.add("categories--fill-in");
  categoriesContainer.style.display = "block";

  instructionText.textContent =
    question.match === "charge"
      ? "Type the ionic charge (for example 2- or -2), then check your answer."
      : "Type the chemical formula (subscripts optional), then check your answer.";

  if (question.prompt.text) {
    const text = document.createElement("div");
    setStemText(text, question.prompt.text);
    promptBox.appendChild(text);
  }

  if (question.prompt.image) {
    const img = document.createElement("img");
    img.src = question.prompt.image;
    img.className = "quiz-image";
    promptBox.appendChild(img);
  }

  const form = document.createElement("form");
  form.className = "fill-in-form";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitFillInAnswer();
  });

  const input = document.createElement("input");
  input.type = "text";
  input.id = "fill-in-input";
  input.className = "fill-in-input";
  input.autocomplete = "off";
  input.autocapitalize = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Your answer");
  input.addEventListener("input", updateFillInCheckEnabled);

  form.appendChild(input);
  categoriesContainer.appendChild(form);

  checkWorksheetBtn.textContent = "Check answer";
  checkWorksheetBtn.style.display = "inline-block";
  checkWorksheetBtn.disabled = true;
  input.focus();
}

/* DRUG WORKSHEET */

function getWorksheetSelections() {
  const selections = {};
  document.querySelectorAll(".drug-worksheet-row").forEach((row) => {
    const selected = row.querySelector(".drug-worksheet-option.selected");
    if (selected) {
      selections[row.dataset.fieldId] = selected.dataset.value;
    }
  });
  return selections;
}

function updateWorksheetCheckEnabled() {
  const question = questions[current];
  if (!question || question.type !== "drug_worksheet") return;

  const selections = getWorksheetSelections();
  checkWorksheetBtn.disabled = !question.fields.every(
    (field) => selections[field.id],
  );
}

function setWorksheetFieldState(row, correct) {
  if (!row) return;
  row.classList.remove(
    "drug-worksheet-row--correct",
    "drug-worksheet-row--incorrect",
  );
  row.classList.add(
    correct ? "drug-worksheet-row--correct" : "drug-worksheet-row--incorrect",
  );
}

function clearWorksheetFieldStates() {
  document.querySelectorAll(".drug-worksheet-row").forEach((row) => {
    row.classList.remove(
      "drug-worksheet-row--correct",
      "drug-worksheet-row--incorrect",
    );
  });
}

function applyWorksheetResultStyles(question, selections) {
  clearWorksheetFieldStates();

  question.fields.forEach((field) => {
    const row = document.querySelector(
      `.drug-worksheet-row[data-field-id="${CSS.escape(field.id)}"]`,
    );
    if (!row) return;

    const chosen = selections[field.id];
    const isFieldCorrect = chosen === field.answer;
    setWorksheetFieldState(row, isFieldCorrect);

    row.querySelectorAll(".drug-worksheet-option").forEach((btn) => {
      btn.classList.remove("selected", "correct", "incorrect");

      if (btn.dataset.value === field.answer) {
        btn.classList.add("correct");
      } else if (btn.dataset.value === chosen) {
        btn.classList.add("incorrect");
      }
    });
  });
}

function revealWorksheetAnswers(question) {
  const selections = {};
  question.fields.forEach((field) => {
    selections[field.id] = field.answer;
  });
  applyWorksheetResultStyles(question, selections);
}

function renderDrugWorksheetQuestion(question) {
  draggable.classList.add("hidden");
  promptContainer.style.display = "block";
  promptContainer.classList.add("prompt-static");
  interactionArea.style.display = "none";
  categoriesContainer.classList.add("categories--worksheet");
  categoriesContainer.style.display = "block";

  instructionText.textContent = "Fill each field, then check your answers.";

  if (question.prompt.text) {
    const text = document.createElement("div");
    setStemText(text, question.prompt.text);
    promptBox.appendChild(text);
  }

  if (question.prompt.image) {
    const img = document.createElement("img");
    img.src = question.prompt.image;
    img.className = "quiz-image";
    promptBox.appendChild(img);
  }

  const form = document.createElement("div");
  form.className = "drug-worksheet";

  question.fields.forEach((field) => {
    const row = document.createElement("div");
    row.className = "drug-worksheet-row";
    row.dataset.fieldId = field.id;

    const label = document.createElement("div");
    label.className = "drug-worksheet-label";
    label.textContent = field.label;
    row.appendChild(label);

    const options = document.createElement("div");
    options.className = "drug-worksheet-options";

    field.options.forEach((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mc-option drug-worksheet-option";
      btn.dataset.value = option;
      setStemText(btn, option);

      btn.addEventListener("click", () => {
        if (categoriesContainer.classList.contains("locked")) return;
        options.querySelectorAll(".drug-worksheet-option").forEach((other) => {
          other.classList.remove("selected");
        });
        btn.classList.add("selected");
        updateWorksheetCheckEnabled();
      });

      options.appendChild(btn);
    });

    row.appendChild(options);
    form.appendChild(row);
  });

  categoriesContainer.appendChild(form);
  checkWorksheetBtn.style.display = "inline-block";
  checkWorksheetBtn.disabled = true;
}

/* DRAG SENTENCE */

function isSentenceArrow(part) {
  return (
    typeof part === "string" &&
    /^\s*(→|->|-->|⇒|⟶)\s*$/.test(part)
  );
}

function getDragSentenceSelections() {
  const selections = [];
  document.querySelectorAll(".sentence-blank").forEach((blank) => {
    const chip = blank.querySelector(".sentence-chip");
    selections.push(chip ? chip.dataset.value : null);
  });
  return selections;
}

function updateDragSentenceCheckEnabled() {
  const question = questions[current];
  if (!question) return;

  if (question.type === "net_ionic") {
    updateNetIonicCheckEnabled();
    return;
  }

  if (question.type !== "drag_sentence") return;

  const selections = getDragSentenceSelections();
  checkWorksheetBtn.disabled = !selections.every(Boolean);
}

function clearSentenceChipSelection() {
  if (selectedSentenceChip) {
    selectedSentenceChip.classList.remove("sentence-chip--selected");
  }
  selectedSentenceChip = null;
}

function returnChipToBank(chip, bank) {
  if (!chip || !bank) return;
  chip.classList.remove("sentence-chip--placed", "sentence-chip--selected");
  bank.appendChild(chip);
}

function placeChipInBlank(chip, blank, bank) {
  if (!chip || !blank || categoriesContainer.classList.contains("locked")) {
    return;
  }

  const existing = blank.querySelector(".sentence-chip");
  if (existing && existing !== chip) {
    returnChipToBank(existing, bank);
  }

  blank.appendChild(chip);
  chip.classList.add("sentence-chip--placed");
  chip.classList.remove("sentence-chip--selected");
  clearSentenceChipSelection();
  updateDragSentenceCheckEnabled();
}

function setSentenceBlankState(blank, correct) {
  if (!blank) return;
  blank.classList.remove(
    "sentence-blank--correct",
    "sentence-blank--incorrect",
  );
  blank.classList.add(
    correct ? "sentence-blank--correct" : "sentence-blank--incorrect",
  );
}

function clearSentenceBlankStates() {
  document.querySelectorAll(".sentence-blank").forEach((blank) => {
    blank.classList.remove(
      "sentence-blank--correct",
      "sentence-blank--incorrect",
    );
  });
}

function applyDragSentenceResultStyles(question, selections) {
  clearSentenceBlankStates();

  const blanks = document.querySelectorAll(".sentence-blank");
  question.blanks.forEach((answer, index) => {
    const blank = blanks[index];
    if (!blank) return;
    setSentenceBlankState(blank, selections[index] === answer);
  });
}

function revealDragSentenceAnswers(question) {
  const bank = document.querySelector(".sentence-bank");
  const blanks = document.querySelectorAll(".sentence-blank");
  const chipsByValue = new Map();

  document.querySelectorAll(".sentence-chip").forEach((chip) => {
    const value = chip.dataset.value;
    if (!chipsByValue.has(value)) {
      chipsByValue.set(value, []);
    }
    chipsByValue.get(value).push(chip);
  });

  question.blanks.forEach((answer, index) => {
    const blank = blanks[index];
    if (!blank) return;

    const existing = blank.querySelector(".sentence-chip");
    if (existing && existing.dataset.value === answer) {
      return;
    }

    if (existing && bank) {
      returnChipToBank(existing, bank);
    }

    const pool = chipsByValue.get(answer) || [];
    const chip =
      pool.find((item) => item.parentElement === bank) || pool[0] || null;
    if (chip) {
      placeChipInBlank(chip, blank, bank);
    }
  });

  applyDragSentenceResultStyles(question, question.blanks);
}

function createSentenceChip(word, bank) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "sentence-chip";
  chip.dataset.value = word;
  setStemText(chip, word);

  if (!isTouchDevice()) {
    chip.setAttribute("draggable", "true");

    chip.addEventListener("dragstart", (e) => {
      if (categoriesContainer.classList.contains("locked")) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData("text/plain", word);
      e.dataTransfer.effectAllowed = "move";
      chip.classList.add("sentence-chip--dragging");
      clearSentenceChipSelection();
    });

    chip.addEventListener("dragend", () => {
      chip.classList.remove("sentence-chip--dragging");
    });
  }

  chip.addEventListener("click", () => {
    if (categoriesContainer.classList.contains("locked")) return;

    if (chip.closest(".net-ionic-term") && isNetIonicEraseSelected()) {
      removeNetIonicTerm(chip.closest(".net-ionic-term"));
      return;
    }

    const parentBlank = chip.closest(".sentence-blank");
    if (parentBlank) {
      returnChipToBank(chip, bank);
      clearSentenceChipSelection();
      updateDragSentenceCheckEnabled();
      return;
    }

    if (selectedSentenceChip === chip) {
      clearSentenceChipSelection();
      return;
    }

    clearNetIonicErase();
    clearSentenceChipSelection();
    selectedSentenceChip = chip;
    chip.classList.add("sentence-chip--selected");
  });

  return chip;
}

function findChipForDrop(value, bank) {
  const dragging = document.querySelector(".sentence-chip--dragging");
  if (dragging && dragging.dataset.value === value) {
    return dragging;
  }

  const fromBank = Array.from(bank.querySelectorAll(".sentence-chip")).find(
    (item) => item.dataset.value === value,
  );
  if (fromBank) return fromBank;

  return Array.from(document.querySelectorAll(".sentence-chip")).find(
    (item) => item.dataset.value === value,
  );
}

function renderDragSentenceQuestion(question) {
  draggable.classList.add("hidden");
  promptContainer.style.display = "block";
  promptContainer.classList.add("prompt-static");
  interactionArea.style.display = "none";
  categoriesContainer.classList.add("categories--sentence");
  categoriesContainer.style.display = "block";
  selectedSentenceChip = null;

  instructionText.textContent = isTouchDevice()
    ? "Tap a word, then tap a blank. Tap a filled blank to clear it."
    : "Drag words into the blanks, then check your answers.";

  if (question.prompt.text) {
    const text = document.createElement("div");
    setStemText(text, question.prompt.text);
    promptBox.appendChild(text);
  }

  if (question.prompt.image) {
    const img = document.createElement("img");
    img.src = question.prompt.image;
    img.className = "quiz-image";
    promptBox.appendChild(img);
  }

  appendDragSentenceBuilder(question, categoriesContainer);

  checkWorksheetBtn.style.display = "inline-block";
  checkWorksheetBtn.disabled = true;
}

function appendDragSentenceBuilder(question, parent) {
  const wrapper = document.createElement("div");
  wrapper.className = "drag-sentence";

  const sentenceEl = document.createElement("div");
  sentenceEl.className = "drag-sentence-line";
  sentenceEl.setAttribute("role", "group");
  sentenceEl.setAttribute("aria-label", "Net ionic equation blanks");

  const bank = document.createElement("div");
  bank.className = "sentence-bank";
  bank.setAttribute("aria-label", "Ion bank");

  let blankIndex = 0;

  question.sentence.forEach((part) => {
    if (part === null) {
      const blank = document.createElement("span");
      blank.className = "sentence-blank";
      blank.dataset.blankIndex = String(blankIndex);
      blank.setAttribute("tabindex", "0");
      blank.setAttribute("role", "button");
      blank.setAttribute(
        "aria-label",
        `Blank ${blankIndex + 1}. Drop or tap a word here.`,
      );
      blankIndex += 1;

      blank.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!categoriesContainer.classList.contains("locked")) {
          blank.classList.add("sentence-blank--dragover");
        }
      });

      blank.addEventListener("dragleave", () => {
        blank.classList.remove("sentence-blank--dragover");
      });

      blank.addEventListener("drop", (e) => {
        e.preventDefault();
        blank.classList.remove("sentence-blank--dragover");
        if (categoriesContainer.classList.contains("locked")) return;

        const value = e.dataTransfer.getData("text/plain");
        const moving = findChipForDrop(value, bank);
        if (moving) {
          placeChipInBlank(moving, blank, bank);
        }
      });

      blank.addEventListener("click", () => {
        if (categoriesContainer.classList.contains("locked")) return;

        if (selectedSentenceChip) {
          placeChipInBlank(selectedSentenceChip, blank, bank);
          return;
        }

        const placed = blank.querySelector(".sentence-chip");
        if (placed) {
          returnChipToBank(placed, bank);
          updateDragSentenceCheckEnabled();
        }
      });

      sentenceEl.appendChild(blank);
    } else {
      const text = document.createElement("span");
      const isArrow = isSentenceArrow(part);
      text.className = isArrow
        ? "drag-sentence-arrow"
        : "drag-sentence-text";
      if (isArrow) {
        text.setAttribute("aria-hidden", "true");
        text.textContent = "→";
      } else {
        setStemText(text, part);
      }
      sentenceEl.appendChild(text);
    }
  });

  question.bank.forEach((word) => {
    bank.appendChild(createSentenceChip(word, bank));
  });

  wrapper.appendChild(sentenceEl);
  wrapper.appendChild(bank);
  parent.appendChild(wrapper);
}

/* NET IONIC */

const NET_IONIC_MAX_TERMS = 6;
const NET_IONIC_MAX_COEFF = 6;

function netIonicTerms(question, side) {
  return (question[side] || []).map((term) => ({
    species: term.species,
    coeff: term.coeff || 1,
  }));
}

function formatNetIonicSide(terms) {
  return terms
    .map((term, index) => {
      const coeff = term.coeff && term.coeff !== 1 ? String(term.coeff) : "";
      const piece = coeff + term.species;
      return index === 0 ? piece : " + " + piece;
    })
    .join("");
}

function formatNetIonicEquation(question) {
  if (!question.reaction) return "No reaction";
  return (
    formatNetIonicSide(netIonicTerms(question, "reactants")) +
    " → " +
    formatNetIonicSide(netIonicTerms(question, "products"))
  );
}

function getNetIonicReactionChoice() {
  const selected = document.querySelector(".net-ionic-choice.selected");
  if (!selected) return null;
  return selected.dataset.value === "reaction";
}

function getNetIonicBank() {
  return document.querySelector(".net-ionic-builder .sentence-bank");
}

function isNetIonicEraseSelected() {
  return Boolean(document.querySelector(".net-ionic-erase.selected"));
}

function clearNetIonicErase() {
  const erase = document.querySelector(".net-ionic-erase");
  const builder = document.querySelector(".net-ionic-builder");
  if (erase) {
    erase.classList.remove("selected");
  }
  if (builder) {
    builder.classList.remove("net-ionic-builder--erase");
  }
}

function toggleNetIonicErase() {
  const erase = document.querySelector(".net-ionic-erase");
  const builder = document.querySelector(".net-ionic-builder");
  if (!erase || !builder) return;

  const next = !erase.classList.contains("selected");
  erase.classList.toggle("selected", next);
  builder.classList.toggle("net-ionic-builder--erase", next);
  if (next) {
    clearSentenceChipSelection();
  }
}

function removeNetIonicTerm(term) {
  if (!term || categoriesContainer.classList.contains("locked")) return;

  const sideEl = term.closest(".net-ionic-side");
  const bank = getNetIonicBank();
  const chip = term.querySelector(".sentence-chip");
  if (chip && bank) {
    returnChipToBank(chip, bank);
  }
  term.remove();
  if (sideEl) {
    updateNetIonicJoiners(sideEl);
  }
  updateNetIonicCheckEnabled();
}

function readNetIonicSide(side) {
  return Array.from(
    document.querySelectorAll(
      `.net-ionic-side[data-side="${side}"] .net-ionic-term`,
    ),
  ).map((term) => {
    const chip = term.querySelector(".sentence-chip");
    return {
      species: chip ? chip.dataset.value : null,
      coeff: Number(term.dataset.coeff || 1),
    };
  });
}

function normalizeNetIonicTerms(terms) {
  return (terms || [])
    .filter((term) => term && term.species)
    .map((term) => ({
      species: term.species,
      coeff: term.coeff || 1,
    }))
    .sort((a, b) => {
      if (a.species === b.species) return a.coeff - b.coeff;
      return a.species.localeCompare(b.species);
    });
}

function netIonicSidesMatch(actual, expected) {
  const left = normalizeNetIonicTerms(actual);
  const right = normalizeNetIonicTerms(expected);
  if (left.length !== right.length) return false;
  return left.every(
    (term, index) =>
      term.species === right[index].species &&
      term.coeff === right[index].coeff,
  );
}

function updateNetIonicJoiners(sideEl) {
  const terms = sideEl.querySelectorAll(".net-ionic-term");
  terms.forEach((term, index) => {
    const joiner = term.querySelector(".net-ionic-plus");
    if (joiner) {
      joiner.classList.toggle("hidden", index === 0);
    }
  });
}

function setNetIonicCoeff(term, coeff) {
  term.dataset.coeff = String(coeff);
  const button = term.querySelector(".net-ionic-coeff");
  if (!button) return;
  button.textContent = coeff > 1 ? String(coeff) : "";
  button.classList.toggle("net-ionic-coeff--active", coeff > 1);
  button.setAttribute(
    "aria-label",
    coeff > 1 ? `Coefficient ${coeff}` : "Set coefficient",
  );
}

function cycleNetIonicCoeff(term) {
  if (categoriesContainer.classList.contains("locked")) return;
  if (isNetIonicEraseSelected()) {
    removeNetIonicTerm(term);
    return;
  }
  const currentCoeff = Number(term.dataset.coeff || 1);
  const next = currentCoeff >= NET_IONIC_MAX_COEFF ? 1 : currentCoeff + 1;
  setNetIonicCoeff(term, next);
}

function addNetIonicTerm(sideEl, bank, options = {}) {
  const terms = sideEl.querySelectorAll(".net-ionic-term");
  if (terms.length >= NET_IONIC_MAX_TERMS) return null;

  const term = document.createElement("div");
  term.className = "net-ionic-term";

  const plus = document.createElement("span");
  plus.className = "net-ionic-plus";
  plus.setAttribute("aria-hidden", "true");
  plus.textContent = "+";

  const coeffBtn = document.createElement("button");
  coeffBtn.type = "button";
  coeffBtn.className = "net-ionic-coeff";
  coeffBtn.title = "Tap to set a coefficient";
  coeffBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    cycleNetIonicCoeff(term);
  });

  const blank = document.createElement("span");
  blank.className = "sentence-blank net-ionic-slot";
  blank.setAttribute("tabindex", "0");
  blank.setAttribute("role", "button");
  blank.setAttribute("aria-label", "Drop or tap a species here.");

  blank.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!categoriesContainer.classList.contains("locked")) {
      blank.classList.add("sentence-blank--dragover");
    }
  });
  blank.addEventListener("dragleave", () => {
    blank.classList.remove("sentence-blank--dragover");
  });
  blank.addEventListener("drop", (event) => {
    event.preventDefault();
    blank.classList.remove("sentence-blank--dragover");
    if (categoriesContainer.classList.contains("locked")) return;
    clearNetIonicErase();
    const value = event.dataTransfer.getData("text/plain");
    const moving = findChipForDrop(value, bank);
    if (moving) {
      placeChipInBlank(moving, blank, bank);
    }
  });
  blank.addEventListener("click", () => {
    if (categoriesContainer.classList.contains("locked")) return;
    if (isNetIonicEraseSelected()) {
      removeNetIonicTerm(term);
      return;
    }
    if (selectedSentenceChip) {
      placeChipInBlank(selectedSentenceChip, blank, bank);
      return;
    }
    const placed = blank.querySelector(".sentence-chip");
    if (placed) {
      returnChipToBank(placed, bank);
      updateNetIonicCheckEnabled();
    }
  });

  term.appendChild(plus);
  term.appendChild(coeffBtn);
  term.appendChild(blank);

  sideEl.appendChild(term);
  setNetIonicCoeff(term, options.coeff || 1);
  updateNetIonicJoiners(sideEl);

  if (options.species) {
    const chip =
      findChipForDrop(options.species, bank) ||
      Array.from(document.querySelectorAll(".sentence-chip")).find(
        (item) => item.dataset.value === options.species,
      );
    if (chip) {
      placeChipInBlank(chip, blank, bank);
    }
  }

  updateNetIonicCheckEnabled();
  return term;
}

function clearNetIonicBuilder() {
  const bank = getNetIonicBank();
  document.querySelectorAll(".net-ionic-term").forEach((term) => {
    const chip = term.querySelector(".sentence-chip");
    if (chip && bank) {
      returnChipToBank(chip, bank);
    }
    term.remove();
  });
  document.querySelectorAll(".net-ionic-side").forEach(updateNetIonicJoiners);
  updateNetIonicCheckEnabled();
}

function updateNetIonicCheckEnabled() {
  const question = questions[current];
  if (!question || question.type !== "net_ionic") return;

  const choice = getNetIonicReactionChoice();
  if (choice === null) {
    checkWorksheetBtn.disabled = true;
    return;
  }

  if (choice === false) {
    checkWorksheetBtn.disabled = false;
    return;
  }

  const reactants = readNetIonicSide("reactants");
  const products = readNetIonicSide("products");
  const ready =
    reactants.length > 0 &&
    products.length > 0 &&
    reactants.every((term) => term.species) &&
    products.every((term) => term.species);

  checkWorksheetBtn.disabled = !ready;
}

function netIonicAnswerMatches(question, answer) {
  if (answer.reaction !== question.reaction) return false;
  if (!question.reaction) return true;
  return (
    netIonicSidesMatch(answer.reactants, netIonicTerms(question, "reactants")) &&
    netIonicSidesMatch(answer.products, netIonicTerms(question, "products"))
  );
}

function applyNetIonicTermStyles(question, answer) {
  ["reactants", "products"].forEach((side) => {
    const expected = normalizeNetIonicTerms(netIonicTerms(question, side));
    const used = new Set();
    document
      .querySelectorAll(`.net-ionic-side[data-side="${side}"] .net-ionic-term`)
      .forEach((term, index) => {
        const actual = readNetIonicSide(side)[index];
        const matchIndex = expected.findIndex((item, itemIndex) => {
          return (
            !used.has(itemIndex) &&
            actual &&
            item.species === actual.species &&
            item.coeff === actual.coeff
          );
        });
        const blank = term.querySelector(".sentence-blank");
        if (matchIndex !== -1) {
          used.add(matchIndex);
          setSentenceBlankState(blank, true);
        } else {
          setSentenceBlankState(blank, false);
        }
      });
  });
}

function revealNetIonicAnswers(question) {
  document.querySelectorAll(".net-ionic-choice").forEach((btn) => {
    const isCorrectChoice =
      btn.dataset.value === (question.reaction ? "reaction" : "none");
    btn.classList.toggle("selected", isCorrectChoice);
    btn.classList.toggle("correct", isCorrectChoice);
    btn.classList.remove("incorrect");
  });

  const builder = document.querySelector(".net-ionic-builder");
  if (builder) {
    builder.classList.toggle("hidden", !question.reaction);
  }

  if (!question.reaction) return;

  const bank = getNetIonicBank();
  clearNetIonicBuilder();

  ["reactants", "products"].forEach((side) => {
    const sideEl = document.querySelector(
      `.net-ionic-side[data-side="${side}"]`,
    );
    if (!sideEl || !bank) return;
    netIonicTerms(question, side).forEach((term) => {
      addNetIonicTerm(sideEl, bank, term);
    });
  });

  applyNetIonicTermStyles(question, {
    reactants: netIonicTerms(question, "reactants"),
    products: netIonicTerms(question, "products"),
  });
}

function createNetIonicSide(side) {
  const sideEl = document.createElement("div");
  sideEl.className = "net-ionic-side";
  sideEl.dataset.side = side;
  return sideEl;
}

function createNetIonicActionButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", () => {
    if (categoriesContainer.classList.contains("locked")) return;
    onClick();
  });
  return button;
}

function renderNetIonicQuestion(question) {
  draggable.classList.add("hidden");
  promptContainer.style.display = "block";
  promptContainer.classList.add("prompt-static");
  interactionArea.style.display = "none";
  categoriesContainer.classList.add(
    "categories--sentence",
    "categories--net-ionic",
  );
  categoriesContainer.style.display = "block";
  selectedSentenceChip = null;

  instructionText.textContent = isTouchDevice()
    ? "Choose Reaction or No reaction. Add a reactant or product, then tap chips into the blanks. Use Delete to remove a term. Tap the faint mark for a coefficient."
    : "Choose Reaction or No reaction. Click Add reactant or Add product, then drop chips into the blanks. Use Delete to remove a term.";

  if (question.prompt.text) {
    const text = document.createElement("div");
    setStemText(text, question.prompt.text);
    promptBox.appendChild(text);
  }

  const choiceRow = document.createElement("div");
  choiceRow.className = "net-ionic-choices";

  [
    { value: "reaction", label: "Reaction" },
    { value: "none", label: "No reaction" },
  ].forEach((choice) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "net-ionic-choice";
    btn.dataset.value = choice.value;
    btn.textContent = choice.label;
    btn.addEventListener("click", () => {
      if (categoriesContainer.classList.contains("locked")) return;
      choiceRow.querySelectorAll(".net-ionic-choice").forEach((other) => {
        other.classList.remove("selected");
      });
      btn.classList.add("selected");

      const builder = document.querySelector(".net-ionic-builder");
      if (choice.value === "none") {
        clearNetIonicBuilder();
        clearNetIonicErase();
        if (builder) builder.classList.add("hidden");
      } else if (builder) {
        builder.classList.remove("hidden");
      }
      updateNetIonicCheckEnabled();
    });
    choiceRow.appendChild(btn);
  });

  const builder = document.createElement("div");
  builder.className = "net-ionic-builder hidden";

  const bank = document.createElement("div");
  bank.className = "sentence-bank";
  bank.setAttribute("aria-label", "Ion bank");
  question.bank.forEach((word) => {
    bank.appendChild(createSentenceChip(word, bank));
  });

  const equation = document.createElement("div");
  equation.className = "net-ionic-equation";

  const reactantSide = createNetIonicSide("reactants");
  const productSide = createNetIonicSide("products");

  const arrow = document.createElement("span");
  arrow.className = "drag-sentence-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";

  equation.appendChild(reactantSide);
  equation.appendChild(arrow);
  equation.appendChild(productSide);

  const actions = document.createElement("div");
  actions.className = "net-ionic-actions";

  actions.appendChild(
    createNetIonicActionButton("Add reactant", "net-ionic-add", () => {
      addNetIonicTerm(reactantSide, bank);
    }),
  );
  actions.appendChild(
    createNetIonicActionButton("Add product", "net-ionic-add", () => {
      addNetIonicTerm(productSide, bank);
    }),
  );

  const erase = document.createElement("button");
  erase.type = "button";
  erase.className = "net-ionic-erase";
  erase.setAttribute("aria-label", "Delete a term");
  erase.innerHTML =
    '<span class="net-ionic-erase-glyph" aria-hidden="true">⌫</span><span>Delete</span>';
  erase.addEventListener("click", () => {
    if (categoriesContainer.classList.contains("locked")) return;
    toggleNetIonicErase();
  });
  actions.appendChild(erase);

  builder.appendChild(equation);
  builder.appendChild(bank);
  builder.appendChild(actions);

  categoriesContainer.appendChild(choiceRow);
  categoriesContainer.appendChild(builder);

  checkWorksheetBtn.style.display = "inline-block";
  checkWorksheetBtn.disabled = true;
}

function checkNetIonicAnswer(answer, question) {
  const isCorrect = netIonicAnswerMatches(question, answer);
  const misses = [];

  if (answer.reaction !== question.reaction) {
    misses.push(
      question.reaction ? "A reaction does occur." : "No reaction occurs.",
    );
  } else if (question.reaction && !isCorrect) {
    misses.push("Net ionic: " + formatNetIonicEquation(question));
  }

  if (!isExamMode()) {
    document.querySelectorAll(".net-ionic-choice").forEach((btn) => {
      const choseReaction = btn.dataset.value === "reaction";
      btn.classList.remove("correct", "incorrect");
      if (choseReaction === question.reaction) {
        btn.classList.add("correct");
      } else if (btn.classList.contains("selected")) {
        btn.classList.add("incorrect");
      }
    });

    const builder = document.querySelector(".net-ionic-builder");
    if (builder) {
      builder.classList.toggle("hidden", !question.reaction);
    }

    if (question.reaction) {
      if (isCorrect) {
        applyNetIonicTermStyles(question, answer);
      } else {
        revealNetIonicAnswers(question);
      }
    }
  }

  answeredCount++;

  if (isCorrect) {
    correctCount++;
  } else {
    wrongQuestions.push(question);
  }

  checkWorksheetBtn.style.display = "none";
  checkWorksheetBtn.disabled = true;

  if (isExamMode()) {
    showExamAdvance(question);
    updateScoreDisplay();
    return;
  }

  if (isCorrect) {
    showQuestionFeedback("Correct!", question, "correct");
  } else {
    showQuestionFeedback("Wrong!", question, "incorrect", null, misses);
  }

  updateScoreDisplay();
}

/* CATEGORIES */

function createCategories(question) {
  const cats = question.categories || quizData.categories;

  cats.forEach((cat) => {
    const zone = document.createElement("div");
    zone.className = "dropzone";
    zone.textContent = cat;
    zone.dataset.category = cat;

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("dragover");
    });

    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      handleAnswer(cat);
    });

    zone.addEventListener("click", () => {
      if (
        isTouchDevice() &&
        question.type === "drag_and_drop" &&
        !categoriesContainer.classList.contains("locked")
      ) {
        handleAnswer(cat);
      }
    });

    categoriesContainer.appendChild(zone);
  });
}

/* ANSWER HANDLER */

function handleAnswer(userAnswer) {
  skipBtn.disabled = true;

  const question = questions[current];
  const checker = answerCheckers[question.type];

  if (!checker) {
    throw new Error("No checker for type: " + question.type);
  }

  checker(userAnswer, question);
}

/* DRAG CHECK */

function checkDragAnswer(category, question) {
  const correct = question.answer;
  const isCorrect = category === correct;

  answeredCount++;

  document.querySelectorAll(".dropzone").forEach((zone) => {
    zone.classList.remove("correct", "incorrect");
  });

  if (isCorrect) {
    correctCount++;
  } else {
    wrongQuestions.push(question);
    if (!isExamMode()) {
      const chosenZone = document.querySelector(
        `[data-category="${CSS.escape(category)}"]`,
      );
      if (chosenZone) {
        chosenZone.classList.add("incorrect");
      }
    }
  }

  if (isExamMode()) {
    showExamAdvance(question);
    updateScoreDisplay();
    return;
  }

  if (isCorrect) {
    showQuestionFeedback("Correct!", question, "correct");
  } else {
    showQuestionFeedback("Wrong!", question, "incorrect", "Correct answer: " + correct);
  }

  updateScoreDisplay();
}

/* MC CHECK */

function checkMultipleChoiceAnswer(option, question) {
  const correct = question.answer;
  const isCorrect = option === correct;

  answeredCount++;

  if (isCorrect) {
    correctCount++;
  } else {
    wrongQuestions.push(question);
    if (!isExamMode()) {
      document.querySelectorAll(".mc-option").forEach((btn) => {
        if (btn.dataset.value === option) {
          btn.classList.add("incorrect");
        }
      });
    }
  }

  if (isExamMode()) {
    showExamAdvance(question);
    updateScoreDisplay();
    return;
  }

  if (isCorrect) {
    showQuestionFeedback("Correct!", question, "correct");
  } else {
    showQuestionFeedback("Wrong!", question, "incorrect", "Correct answer: " + correct);
  }

  updateScoreDisplay();
}

/* FILL IN CHECK */

function checkFillInAnswer(userAnswer, question) {
  const isCorrect = IonQuiz.fillInAnswersMatch(userAnswer, question.answers);

  answeredCount++;

  const input = document.getElementById("fill-in-input");
  if (isCorrect) {
    correctCount++;
  } else {
    wrongQuestions.push(question);
    if (!isExamMode() && input) {
      input.classList.add("incorrect");
    }
  }

  checkWorksheetBtn.style.display = "none";
  checkWorksheetBtn.disabled = true;

  if (isExamMode()) {
    showExamAdvance(question);
    updateScoreDisplay();
    return;
  }

  if (isCorrect) {
    showQuestionFeedback("Correct!", question, "correct");
  } else {
    showQuestionFeedback(
      "Wrong!",
      question,
      "incorrect",
      "Correct answer: " + question.answer,
    );
  }

  updateScoreDisplay();
}

/* DRUG WORKSHEET CHECK */

function checkDrugWorksheetAnswer(selections, question) {
  const misses = [];
  let allCorrect = true;

  question.fields.forEach((field) => {
    const chosen = selections[field.id];
    if (chosen !== field.answer) {
      allCorrect = false;
      misses.push(`${field.label}: ${field.answer}`);
    }
  });

  if (!isExamMode()) {
    applyWorksheetResultStyles(question, selections);
  }

  answeredCount++;

  if (allCorrect) {
    correctCount++;
  } else {
    wrongQuestions.push(question);
  }

  checkWorksheetBtn.style.display = "none";
  checkWorksheetBtn.disabled = true;

  if (isExamMode()) {
    showExamAdvance(question);
    updateScoreDisplay();
    return;
  }

  if (allCorrect) {
    showQuestionFeedback("Correct!", question, "correct");
  } else {
    showQuestionFeedback("Wrong!", question, "incorrect", null, misses);
  }

  updateScoreDisplay();
}

/* DRAG SENTENCE CHECK */

function checkDragSentenceAnswer(selections, question) {
  const misses = [];
  let allCorrect = true;

  question.blanks.forEach((answer, index) => {
    if (selections[index] !== answer) {
      allCorrect = false;
      misses.push(`Blank ${index + 1}: ${answer}`);
    }
  });

  if (!isExamMode()) {
    applyDragSentenceResultStyles(question, selections);
  }

  answeredCount++;

  if (allCorrect) {
    correctCount++;
  } else {
    wrongQuestions.push(question);
  }

  checkWorksheetBtn.style.display = "none";
  checkWorksheetBtn.disabled = true;

  if (isExamMode()) {
    showExamAdvance(question);
    updateScoreDisplay();
    return;
  }

  if (allCorrect) {
    showQuestionFeedback("Correct!", question, "correct");
  } else {
    showQuestionFeedback("Wrong!", question, "incorrect", null, misses);
  }

  updateScoreDisplay();
}

/* SKIP */

skipBtn.addEventListener("click", () => {
  const question = questions[current];

  skippedCount++;
  skippedQuestions.push(question);

  if (question.type === "drug_worksheet") {
    revealWorksheetAnswers(question);
    showQuestionFeedback(
      "Skipped.",
      question,
      "skipped",
      null,
      formatWorksheetAnswerSummary(question),
    );
    return;
  }

  if (question.type === "drag_sentence") {
    revealDragSentenceAnswers(question);
    showQuestionFeedback(
      "Skipped.",
      question,
      "skipped",
      null,
      formatDragSentenceAnswerSummary(question),
    );
    return;
  }

  if (question.type === "net_ionic") {
    revealNetIonicAnswers(question);
    showQuestionFeedback(
      "Skipped.",
      question,
      "skipped",
      "Correct answer: " + formatNetIonicEquation(question),
    );
    return;
  }

  showQuestionFeedback(
    "Skipped.",
    question,
    "skipped",
    "Correct answer: " + question.answer,
  );
});

checkWorksheetBtn.addEventListener("click", () => {
  if (checkWorksheetBtn.disabled) return;

  const question = questions[current];
  if (question.type === "fill_in") {
    submitFillInAnswer();
    return;
  }

  if (question.type === "drag_sentence") {
    handleAnswer(getDragSentenceSelections());
    return;
  }

  if (question.type === "net_ionic") {
    handleAnswer({
      reaction: getNetIonicReactionChoice(),
      reactants: readNetIonicSide("reactants"),
      products: readNetIonicSide("products"),
    });
    return;
  }

  handleAnswer(getWorksheetSelections());
});

/* PROGRESS */

function updateProgress() {
  const percent = (current / questions.length) * 100;
  progressBar.style.width = percent + "%";
  questionProgress.textContent = `Question ${current + 1} of ${questions.length}`;
}

/* CONTINUE */

continueBtn.addEventListener("click", () => {
  if (continueBtn.disabled) {
    return;
  }

  continueBtn.disabled = true;
  continueBtn.style.display = "none";
  current++;
  loadQuestion();
});

function hideActiveQuizUI() {
  questionArea.style.display = "none";
  instructionContainer.style.display = "none";
  interactionArea.style.display = "none";
  categoriesContainer.style.display = "none";
  feedback.replaceChildren();
  feedback.classList.remove("show");
  continueBtn.style.display = "none";
  checkWorksheetBtn.style.display = "none";
  skipBtn.style.display = "none";
  hideReferencePanel();
}

function showActiveQuizUI() {
  questionArea.style.display = "";
  instructionContainer.style.display = "";
  interactionArea.style.display = "flex";
  categoriesContainer.style.display = "flex";
  showReferencePanel();
}

/* END QUIZ */

function endQuiz() {
  hideActiveQuizUI();

  finalScreen.style.display = "block";

  const percent =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const tier = getScoreTier(percent);

  if (isExamMode()) {
    finalHeading.textContent = "Exam Complete";
    scoreContainer.style.display = "";
    finalTier.textContent = `${tier.emoji} ${tier.message}`;
    finalScore.textContent = `${percent}%`;
    finalDetail.textContent = `${correctCount} of ${answeredCount} correct`;
  } else {
    finalHeading.textContent = "Quiz Complete!";
    finalTier.textContent = `${tier.emoji} ${tier.message}`;
    finalScore.textContent = `${percent}%`;
    finalDetail.textContent = `${correctCount} of ${answeredCount} correct${skippedCount > 0 ? ` · ${skippedCount} skipped` : ""}`;
  }

  if (wrongQuestions.length > 0) {
    finalHint.textContent =
      "Start with Review Wrong to revisit the questions you missed.";
    finalHint.classList.remove("hidden");
  } else if (skippedQuestions.length > 0) {
    finalHint.textContent =
      "You skipped some questions — Review Skipped to see the answers.";
    finalHint.classList.remove("hidden");
  } else {
    finalHint.classList.add("hidden");
  }

  reviewWrongBtn.style.display =
    wrongQuestions.length > 0 ? "inline-block" : "none";
  reviewWrongBtn.textContent = `Review Wrong (${wrongQuestions.length})`;

  reviewSkippedBtn.style.display =
    skippedQuestions.length > 0 ? "inline-block" : "none";
  reviewSkippedBtn.textContent = `Review Skipped (${skippedQuestions.length})`;

  progressBar.style.width = "100%";
  questionProgress.textContent = `Question ${questions.length} of ${questions.length}`;

  if (typeof Nav !== "undefined") {
    Nav.recordRecentQuiz(quizName, quizData.title);
  }

  trackQuizComplete(percent);
  finalHeading.focus();
}

function startReviewRound(reviewQuestions) {
  questions = prepareQuestions(reviewQuestions);
  current = 0;
  correctCount = 0;
  answeredCount = 0;
  skippedCount = 0;
  skippedQuestions = [];
  wrongQuestions = [];

  finalScreen.style.display = "none";
  reviewSkippedBtn.style.display = "none";
  reviewWrongBtn.style.display = "none";
  finalHint.classList.add("hidden");

  showActiveQuizUI();
  applyModeUI();
  scoreDisplay.textContent = "0";
  totalDisplay.textContent = "0";

  loadQuestion();
}

/* RETRY */

retryBtn.addEventListener("click", () => {
  resetRunState();
  questions = prepareQuestions(sourceQuestions());

  finalScreen.style.display = "none";
  reviewSkippedBtn.style.display = "none";
  reviewWrongBtn.style.display = "none";
  finalHint.classList.add("hidden");

  showActiveQuizUI();
  applyModeUI();
  scoreDisplay.textContent = "0";
  totalDisplay.textContent = "0";

  loadQuestion();
});

reviewSkippedBtn.addEventListener("click", () => {
  const toReview = [...skippedQuestions];
  skippedQuestions = [];
  startReviewRound(toReview);
});

reviewWrongBtn.addEventListener("click", () => {
  const toReview = [...wrongQuestions];
  wrongQuestions = [];
  startReviewRound(toReview);
});

/* MISC */

function applySubjectTheme() {
  const subjectKey = quizName.split("/")[0];
  document.body.classList.add("subject-" + subjectKey);

  if (backToQuizzesBtn && subjectKey) {
    backToQuizzesBtn.href = subjectKey + ".html";
  }

  const loaderEmoji = document.querySelector(".science-emoji");
  const emojis = {
    biology: "🧬",
    chemistry: "⚗️",
    emt: "🚑",
    pharmacology: "💊",
  };
  if (loaderEmoji) {
    loaderEmoji.textContent = emojis[subjectKey] || "🧪";
  }

  if (
    typeof CatalogUtils !== "undefined" &&
    CatalogUtils.isMedicalSubject(subjectKey) &&
    !document.querySelector(".medical-disclaimer")
  ) {
    const footer = quizContent?.querySelector("footer");
    const disclaimer = CatalogUtils.createMedicalDisclaimer({ compact: true });
    if (footer) {
      footer.prepend(disclaimer);
    } else {
      quizContent?.appendChild(disclaimer);
    }
  }
}

function loadFavicon() {
  const subject = quizName.split("/")[0];
  const favicon = document.getElementById("favicon");

  const icons = {
    biology: "images/favicons/dna.svg",
    chemistry: "images/favicons/chemistry.svg",
    emt: "images/favicons/emt.svg",
    pharmacology: "images/favicons/pharmacology.svg",
  };

  favicon.href = icons[subject] || "";
}

/* START */

loadFavicon();
applySubjectTheme();
initQuiz();
