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

  querySelectorAll() {
    return [];
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
    return this.elements.get(id);
  }

  querySelector(selector) {
    if (selector === ".score") return this.score;
    if (selector === ".question-area") return this.questionArea;
    if (selector === ".instruction-container") return this.instructionContainer;
    if (selector === ".science-emoji") return this.loaderEmoji;
    if (selector === 'meta[name="description"]') return this.metaDescription;
    return null;
  }

  querySelectorAll(selector) {
    if (selector === ".mc-option") {
      return this.allElements.filter((element) => element.classList.contains("mc-option"));
    }

    return [];
  }
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function loadQuizContext() {
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
  ];
  const document = new FakeDocument(ids);
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
    window: {
      location: { search: "?quiz=biology/continue-regression&mode=practice" },
      matchMedia: () => ({ matches: false }),
    },
    CSS: { escape: (value) => String(value) },
    Nav: {
      updateQuizCrumb() {},
      recordRecentQuiz() {},
    },
    fetch: async () => ({
      ok: true,
      json: async () => quizData,
    }),
    setTimeout: (callback) => {
      callback();
      return 0;
    },
    clearTimeout() {},
    setStemText: (element, text) => {
      element.textContent = text;
    },
  };

  vm.runInNewContext(source, context, { filename: quizPath });

  await flushAsyncWork();
  await flushAsyncWork();

  return { document };
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

async function main() {
  await testContinueIsSingleUse();
  console.log("Quiz flow tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
