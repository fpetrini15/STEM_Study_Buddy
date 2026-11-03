#!/usr/bin/env node
/**
 * Regression tests for the browser quiz flow.
 * Run: node ci/test-quiz.js
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.tokens = new Set();
  }

  add(...tokens) {
    tokens.forEach((token) => this.tokens.add(token));
  }

  remove(...tokens) {
    tokens.forEach((token) => this.tokens.delete(token));
  }

  contains(token) {
    return this.tokens.has(token) || this.element.className.split(/\s+/).includes(token);
  }

  toggle(token, force) {
    if (force === undefined) {
      if (this.contains(token)) {
        this.remove(token);
        return false;
      }

      this.add(token);
      return true;
    }

    if (force) {
      this.add(token);
    } else {
      this.remove(token);
    }

    return force;
  }
}

function matchesSelector(element, selector) {
  const parts = String(selector).trim().split(/\s+/);
  if (parts.length === 1) {
    return matchesSimpleSelector(element, parts[0]);
  }

  const last = parts[parts.length - 1];
  if (!matchesSimpleSelector(element, last)) return false;

  let node = element.parentNode;
  const ancestors = parts.slice(0, -1).reverse();
  for (const part of ancestors) {
    while (node && !matchesSimpleSelector(node, part)) {
      node = node.parentNode;
    }
    if (!node) return false;
    node = node.parentNode;
  }
  return true;
}

function matchesSimpleSelector(element, selector) {
  if (!element || !selector.startsWith(".")) return false;
  const classes = selector.slice(1).split(".").filter(Boolean);
  return classes.every((name) => element.classList.contains(name));
}

class FakeElement {
  constructor(document, tagName = "div", id = "") {
    this.document = document;
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.className = "";
    this.classList = new FakeClassList(this);
    this.disabled = false;
    this.textContent = "";
    this.href = "";
    this.value = "";
    this._innerHTML = "";
  }

  set innerHTML(value) {
    this._innerHTML = value;
    if (value === "") {
      this.children.forEach((child) => {
        child.parentNode = null;
      });
      this.children = [];
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  get parentElement() {
    return this.parentNode || null;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (matchesSelector(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = (element) => {
      if (matchesSelector(element, selector)) found.push(element);
      element.children.forEach(visit);
    };
    this.children.forEach(visit);
    return found;
  }

  replaceChildren(...children) {
    this.children.forEach((child) => {
      child.parentNode = null;
    });
    this.children = [];
    children.forEach((child) => this.appendChild(child));
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }

    this.listeners[type].push(handler);
  }

  click() {
    if (this.disabled) {
      return;
    }

    (this.listeners.click || []).forEach((handler) => {
      handler({ preventDefault() {} });
    });
  }

  focus() {}

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
}

class FakeDocument {
  constructor(ids) {
    this.elements = new Map();
    this.allElements = [];
    this.body = this.createElement("body");

    ids.forEach((id) => {
      this.elements.set(id, this.createElement("div", id));
    });

    this.score = this.createElement("div");
    this.questionArea = this.createElement("div");
    this.instructionContainer = this.createElement("div");
    this.loaderEmoji = this.createElement("div");
    this.metaDescription = this.createElement("meta");
  }

  createElement(tagName, id = "") {
    const element = new FakeElement(this, tagName, id);
    this.allElements.push(element);
    return element;
  }

  getElementById(id) {
    const matches = this.allElements.filter((element) => element.id === id);
    if (matches.length > 0) {
      return matches[matches.length - 1];
    }
    return this.elements.get(id) || null;
  }

  querySelector(selector) {
    if (selector === ".score") return this.score;
    if (selector === ".question-area") return this.questionArea;
    if (selector === ".instruction-container") return this.instructionContainer;
    if (selector === ".science-emoji") return this.loaderEmoji;
    if (selector === 'meta[name="description"]') return this.metaDescription;
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    if (selector === ".mc-option") {
      return this.allElements.filter((element) => element.classList.contains("mc-option"));
    }

    return this.allElements.filter(
      (element) => element.parentNode && matchesSelector(element, selector),
    );
  }
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function loadQuizContext(options = {}) {
  const quizPath = path.join(__dirname, "..", "js", "quiz.js");
  const source = fs.readFileSync(quizPath, "utf8");
  const ids = [
    "quiz-content",
    "mode-screen",
    "mode-badge",
    "question-progress",
    "prompt",
    "prompt-container",
    "draggable",
    "interaction-area",
    "categories",
    "feedback",
    "score",
    "total",
    "progress-bar",
    "continue-btn",
    "check-worksheet-btn",
    "skip-btn",
    "final-screen",
    "final-heading",
    "final-tier",
    "final-score",
    "final-detail",
    "final-hint",
    "retry-btn",
    "back-to-quizzes-btn",
    "review-skipped-btn",
    "review-wrong-btn",
    "instruction-text",
    "loading-screen",
    "quiz-error",
    "quiz-error-message",
    "quiz-error-back",
    "tabTitle",
    "quizHeader",
    "favicon",
    "reference-panel",
    "reference-panel-title",
    "reference-toggle",
    "reference-panel-note",
    "reference-table-wrap",
  ];
  const document = new FakeDocument(ids);
  const storage = options.storage || {};
  const quizData = {
    title: "Continue Regression",
    questions: [
      {
        type: "multiple_choice",
        prompt: { text: "One?" },
        options: ["one"],
        answer: "one",
      },
      {
        type: "multiple_choice",
        prompt: { text: "Two?" },
        options: ["two"],
        answer: "two",
      },
      {
        type: "multiple_choice",
        prompt: { text: "Three?" },
        options: ["three"],
        answer: "three",
      },
    ],
  };
  const context = {
    console,
    document,
    URLSearchParams,
    Math: options.math || Math,
    window: {
      location: {
        search:
          options.search || "?quiz=biology/continue-regression&mode=practice",
      },
      matchMedia: () => ({ matches: false }),
    },
    CSS: { escape: (value) => String(value) },
    Nav: {
      updateQuizCrumb() {},
      recordRecentQuiz() {},
    },
    fetch: async () => ({
      ok: true,
      json: async () => options.quizData || quizData,
    }),
    setTimeout: (callback) => {
      callback();
      return 0;
    },
    clearTimeout() {},
    setStemText: (element, text) => {
      element.textContent = text;
    },
    IonQuiz: require("../js/ion-quiz.js"),
    localStorage: {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(storage, key)
          ? storage[key]
          : null;
      },
      setItem(key, value) {
        storage[key] = String(value);
      },
    },
  };

  vm.runInNewContext(source, context, { filename: quizPath });

  await flushAsyncWork();
  await flushAsyncWork();

  return { document, context };
}

function clickFirstAnswer(document) {
  const answerButton = document
    .querySelectorAll(".mc-option")
    .find((button) => button.parentNode === document.getElementById("categories"));

  assert(answerButton, "expected a rendered answer button");
  answerButton.click();
}

async function testContinueIsSingleUse() {
  const { document } = await loadQuizContext();
  const progress = document.getElementById("question-progress");
  const continueBtn = document.getElementById("continue-btn");

  assert.strictEqual(progress.textContent, "Question 1 of 3");

  clickFirstAnswer(document);
  assert.strictEqual(continueBtn.disabled, false);

  continueBtn.click();
  continueBtn.click();

  assert.strictEqual(
    progress.textContent,
    "Question 2 of 3",
    "a repeated Continue activation must not skip the next question",
  );
  assert.strictEqual(continueBtn.disabled, true);

  clickFirstAnswer(document);
  continueBtn.click();

  assert.strictEqual(progress.textContent, "Question 3 of 3");
}

async function testFillInScoringAndSkills() {
  const ionBank = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "data", "chemistry", "polyatomic_ions.json"),
      "utf8",
    ),
  );
  const { document } = await loadQuizContext({
    search: "?quiz=chemistry/polyatomic_ions&mode=practice&skills=name_to_charge",
    quizData: ionBank,
    math: { floor: Math.floor, random: () => 0 },
  });

  const progress = document.getElementById("question-progress");
  assert.strictEqual(progress.textContent, `Question 1 of ${ionBank.ions.length}`);

  const input = document.getElementById("fill-in-input");
  const checkBtn = document.getElementById("check-worksheet-btn");
  const continueBtn = document.getElementById("continue-btn");
  const score = document.getElementById("score");

  assert(input, "expected a fill-in input");
  assert.strictEqual(checkBtn.disabled, true);

  input.value = "not-a-charge";
  checkBtn.disabled = false;
  checkBtn.click();

  assert.equal(score.textContent, 0);
  assert.strictEqual(continueBtn.disabled, false);

  continueBtn.click();
  assert.strictEqual(progress.textContent, `Question 2 of ${ionBank.ions.length}`);

  const nextInput = document.getElementById("fill-in-input");
  nextInput.value = "-";
  checkBtn.disabled = false;
  checkBtn.click();

  assert.equal(score.textContent, 1);
  assert.equal(document.getElementById("total").textContent, 2);
}

async function testReferenceTableToggle() {
  const solubility = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "data", "chemistry", "solubility_rules.json"),
      "utf8",
    ),
  );
  const { document } = await loadQuizContext({
    search: "?quiz=chemistry/solubility_rules&mode=practice",
    quizData: solubility,
  });

  const panel = document.getElementById("reference-panel");
  const title = document.getElementById("reference-panel-title");
  const toggle = document.getElementById("reference-toggle");
  const wrap = document.getElementById("reference-table-wrap");

  assert.ok(!panel.classList.contains("hidden"), "table should be visible by default");
  assert.strictEqual(title.textContent, "Selected Solubility Information");
  assert.strictEqual(toggle.textContent, "Hide table");
  assert.ok(
    wrap.children.some((child) => child.className === "reference-table"),
    "expected a rendered reference table",
  );

  toggle.click();
  assert.strictEqual(toggle.textContent, "Show table");
  assert.ok(panel.classList.contains("reference-panel--collapsed"));
}

async function testTrueFalseStaysLeftToRight() {
  const trueFalseQuiz = {
    title: "True False Order",
    questions: [
      {
        type: "multiple_choice",
        prompt: { text: "Stored with false first." },
        options: ["False", "True"],
        answer: "True",
      },
    ],
  };
  const { document } = await loadQuizContext({
    search: "?quiz=biology/true-false-order&mode=practice",
    math: { floor: Math.floor, random: () => 0 },
    quizData: trueFalseQuiz,
  });

  const categories = document.getElementById("categories");
  const trueFalseButtons = document
    .querySelectorAll(".mc-option")
    .filter((button) => button.parentNode === categories);

  assert.ok(
    categories.classList.contains("categories--true-false"),
    "true/false choices should sit side by side",
  );
  assert.deepStrictEqual(
    trueFalseButtons.map((button) => button.textContent),
    ["True", "False"],
  );

  const { document: ordinaryDocument } = await loadQuizContext({
    search: "?quiz=biology/ordinary-order&mode=practice",
    math: { floor: Math.floor, random: () => 0 },
    quizData: {
      title: "Ordinary Order",
      questions: [
        {
          type: "multiple_choice",
          prompt: { text: "An ordinary choice." },
          options: ["A", "B"],
          answer: "A",
        },
      ],
    },
  });

  const ordinaryCategories = ordinaryDocument.getElementById("categories");
  const ordinaryButtons = ordinaryDocument
    .querySelectorAll(".mc-option")
    .filter((button) => button.parentNode === ordinaryCategories);

  assert.ok(!ordinaryCategories.classList.contains("categories--true-false"));
  assert.deepStrictEqual(
    ordinaryButtons.map((button) => button.textContent),
    ["B", "A"],
    "ordinary choices should still be shuffled",
  );
}

async function testDragTableUsesEveryChipOnce() {
  const { document } = await loadQuizContext({
    search: "?quiz=biology/drag-table&mode=practice",
    math: { floor: Math.floor, random: () => 0 },
    quizData: {
      title: "Drag Table",
      questions: [
        {
          type: "drag_table",
          prompt: { text: "Fill the table." },
          columns: ["Coelom", "Gut"],
          rows: [
            { label: "Flatworm", cells: ["Acoelomate", "Gastrovascular cavity"] },
            { label: "Earthworm", cells: ["Coelomate", "Mouth and an anus"] },
            { label: "Mollusc", cells: ["Coelomate", "Mouth and an anus"] },
          ],
          explanation: "Two groups share both a coelom and a complete gut.",
        },
      ],
    },
  });

  const blanks = document.querySelectorAll(".drag-table .sentence-blank");
  const chips = document.querySelectorAll(".sentence-chip");
  assert.strictEqual(blanks.length, 6);
  assert.strictEqual(chips.length, 6);

  const labels = chips.map((chip) => chip.textContent).sort();
  assert.deepStrictEqual(labels, [
    "Acoelomate",
    "Coelomate",
    "Coelomate",
    "Gastrovascular cavity",
    "Mouth and an anus",
    "Mouth and an anus",
  ]);

  const checkBtn = document.getElementById("check-worksheet-btn");
  assert.strictEqual(checkBtn.disabled, true);

  const expected = [
    "Acoelomate",
    "Gastrovascular cavity",
    "Coelomate",
    "Mouth and an anus",
    "Coelomate",
    "Mouth and an anus",
  ];
  expected.forEach((value, index) => {
    const chip = document
      .querySelectorAll(".sentence-bank .sentence-chip")
      .find((item) => item.textContent === value);
    assert.ok(chip, "missing chip " + value);
    chip.click();
    blanks[index].click();
  });

  assert.strictEqual(checkBtn.disabled, false);
  checkBtn.click();
  assert.equal(document.getElementById("score").textContent, 1);

  const headline = document.querySelector(".feedback-headline");
  assert.strictEqual(headline.textContent, "Correct!");
}

async function main() {
  await testContinueIsSingleUse();
  await testFillInScoringAndSkills();
  await testReferenceTableToggle();
  await testTrueFalseStaysLeftToRight();
  await testDragTableUsesEveryChipOnce();
  console.log("Quiz flow tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
