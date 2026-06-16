const PARAMS = new URLSearchParams(window.location.search);

const quizName = PARAMS.get("quiz");
const VALID_MODES = ["practice", "study", "exam"];

if (!quizName) {
  document.body.innerHTML = "<h1>No quiz specified</h1>";
  throw new Error("Missing quiz parameter");
}

const dataPath = "data/" + quizName + ".json";
let quizMode = PARAMS.get("mode");

/* STATE */

let quizData;
let questions = [];

let current = 0;
let correctCount = 0;
let answeredCount = 0;
let skippedCount = 0;
let skippedQuestions = [];
let wrongQuestions = [];

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

function isStudyMode() {
  return quizMode === "study";
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
      return q;
    }),
  );
}

function applyModeUI() {
  const labels = {
    practice: "Practice mode",
    study: "Study mode",
    exam: "Exam mode",
  };

  modeBadge.textContent = labels[quizMode] || "";
  modeBadge.classList.toggle("hidden", !quizMode);

  if (isStudyMode() || isExamMode()) {
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

function setFeedback(headline, question, tone, detail = null) {
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

  if (question.explanation) {
    const explanation = document.createElement("p");
    explanation.className = "feedback-explanation";
    setStemText(explanation, question.explanation);
    panel.appendChild(explanation);
  }

  feedback.appendChild(panel);
}

function lockQuestionInteraction(question) {
  draggable.setAttribute("draggable", "false");
  categoriesContainer.classList.add("locked");

  if (question.type === "multiple_choice") {
    document.querySelectorAll(".mc-option").forEach((btn) => {
      btn.disabled = true;
    });
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
  }
}

function showQuestionFeedback(headline, question, tone, detail = null) {
  skipBtn.disabled = true;
  lockQuestionInteraction(question);
  highlightCorrectAnswer(question);
  setFeedback(headline, question, tone, detail);
  feedback.classList.add("show");
  continueBtn.style.display = "inline-block";
  continueBtn.focus();
}

function showExamAdvance(question) {
  skipBtn.disabled = true;
  lockQuestionInteraction(question);
  continueBtn.style.display = "inline-block";
  continueBtn.focus();
}

function updateScoreDisplay() {
  if (!isStudyMode() && !isExamMode()) {
    scoreDisplay.textContent = correctCount;
    totalDisplay.textContent = answeredCount;
  }
}

function resetQuestionUI() {
  promptBox.innerHTML = "";
  promptContainer.style.display = "block";
  promptContainer.classList.remove("prompt-static");
  categoriesContainer.innerHTML = "";
  feedback.replaceChildren();
  feedback.classList.remove("show");

  continueBtn.style.display = "none";

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
};

const answerCheckers = {
  drag_and_drop: checkDragAnswer,
  multiple_choice: checkMultipleChoiceAnswer,
};

/* MODE SELECT */

function initModeSelection() {
  if (quizMode && VALID_MODES.includes(quizMode)) {
    modeScreen.classList.add("hidden");
    quizContent.classList.remove("hidden");
    applyModeUI();
    loadQuiz();
    return;
  }

  loadingScreen.classList.add("hidden");
  modeScreen.classList.remove("hidden");

  modeScreen.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      quizMode = btn.dataset.mode;
      modeScreen.classList.add("hidden");
      quizContent.classList.remove("hidden");
      applyModeUI();
      loadQuiz();
    });
  });
}

/* LOAD QUIZ */

async function loadQuiz() {
  loadingScreen.classList.remove("hidden");
  quizError.classList.add("hidden");
  quizContent.classList.remove("hidden");

  try {
    const res = await fetch(dataPath);
    if (!res.ok) {
      throw new Error("Quiz not found or unavailable.");
    }

    quizData = await res.json();

    if (!Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      throw new Error("This quiz has no questions yet.");
    }

    questions = prepareQuestions(quizData.questions);

    document.getElementById("tabTitle").textContent = quizData.title;
    document.getElementById("quizHeader").textContent = quizData.title;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.content = `Study with the ${quizData.title} on STEM Study Buddy. Practice, study, and exam modes with instant feedback.`;
    }

    document.body.dataset.subject = quizName.split("/")[0];
    if (typeof Nav !== "undefined") {
      Nav.updateQuizCrumb(quizData.title);
    }

    loadQuestion();

    setTimeout(() => {
      loadingScreen.classList.add("hidden");
    }, 150);
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

  if (isTouchDevice()) {
    instructionText.textContent = "Tap the matching category below.";
    draggable.setAttribute("draggable", "false");
  } else {
    instructionText.textContent =
      "Drag the prompt into the appropriate category.";
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

/* SKIP */

skipBtn.addEventListener("click", () => {
  const question = questions[current];

  skippedCount++;
  skippedQuestions.push(question);

  showQuestionFeedback(
    "Skipped.",
    question,
    "skipped",
    "Correct answer: " + question.answer,
  );
});

/* PROGRESS */

function updateProgress() {
  const percent = (current / questions.length) * 100;
  progressBar.style.width = percent + "%";
  questionProgress.textContent = `Question ${current + 1} of ${questions.length}`;
}

/* CONTINUE */

continueBtn.addEventListener("click", () => {
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
  skipBtn.style.display = "none";
}

function showActiveQuizUI() {
  questionArea.style.display = "";
  instructionContainer.style.display = "";
  interactionArea.style.display = "flex";
  categoriesContainer.style.display = "flex";
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
  } else if (isStudyMode()) {
    finalHeading.textContent = "Review Complete";
    finalTier.textContent = "📖 Session finished";
    finalScore.textContent = `${answeredCount} questions reviewed`;
    finalDetail.textContent =
      skippedCount > 0 ? `${skippedCount} skipped` : "Nice work studying.";
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
  questions = prepareQuestions(quizData.questions);

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

  const loaderEmoji = document.querySelector(".science-emoji");
  const emojis = { biology: "🧬", chemistry: "⚗️" };
  if (loaderEmoji) {
    loaderEmoji.textContent = emojis[subjectKey] || "🧪";
  }
}

function loadFavicon() {
  const subject = quizName.split("/")[0];
  const favicon = document.getElementById("favicon");

  if (subject === "biology") {
    favicon.href = "images/favicons/dna.svg";
  } else if (subject === "chemistry") {
    favicon.href = "images/favicons/chemistry.svg";
  } else {
    favicon.href = "";
  }
}

/* START */

loadFavicon();
applySubjectTheme();
initModeSelection();
