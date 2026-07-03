#!/usr/bin/env node
/**
 * Lint and test Lewis structure answer data.
 * Run: node ci/test-lewis.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dataPath = path.join(
  __dirname,
  "..",
  "data",
  "chemistry",
  "lewis_structures.json",
);

const LewisAnswers = require("../js/lewis-answers.js");
const LewisValidation = require("../js/lewis-validation.js");

function main() {
  const raw = fs.readFileSync(dataPath, "utf8");
  const toolData = JSON.parse(raw);

  console.log("Lewis structures — lint & validation\n");

  const lintReport = LewisValidation.lintDataset(toolData);
  let errorCount = 0;

  lintReport.molecules.forEach((entry) => {
    const status = entry.errors.length === 0 ? "ok" : "FAIL";
    console.log(`  [${status}] ${entry.id} (${entry.variantCount} variant(s))`);
    entry.errors.forEach((message) => {
      errorCount++;
      console.log(`         ${message}`);
    });
  });

  if (!lintReport.ok) {
    console.error(`\nLint failed with ${errorCount} error(s).`);
    process.exit(1);
  }

  const validationFailures = LewisValidation.testAllVariants(toolData);
  if (validationFailures.length > 0) {
    console.error("\nValidation failures:");
    validationFailures.forEach((failure) => {
      console.error(`  ${failure.id} variant[${failure.variantIndex}]:`);
      failure.issues.forEach((issue) => console.error(`    - ${issue}`));
    });
    process.exit(1);
  }

  testContinueButtonConsumesQueuedClicks();

  const totalVariants = lintReport.molecules.reduce(
    (sum, entry) => sum + entry.variantCount,
    0,
  );

  console.log(
    `\nAll ${lintReport.molecules.length} molecules passed (${totalVariants} variants).`,
  );
}

function testContinueButtonConsumesQueuedClicks() {
  const lewisPath = path.join(__dirname, "..", "js", "lewis.js");
  const rawSource = fs.readFileSync(lewisPath, "utf8");
  const source = rawSource.replace(/\nsetupPalette\(\);\ninit\(\);\s*$/, "\n");
  const listeners = {};
  const elements = new Map();

  function createClassList() {
    const classes = new Set();
    return {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, force) => {
        const shouldAdd = force === undefined ? !classes.has(name) : Boolean(force);
        if (shouldAdd) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
        return shouldAdd;
      },
      contains: (name) => classes.has(name),
    };
  }

  function createElement(id = "") {
    const element = {
      id,
      style: {},
      dataset: {},
      children: [],
      className: "",
      textContent: "",
      value: "",
      checked: false,
      disabled: false,
      classList: createClassList(),
      addEventListener(type, handler) {
        listeners[id] ||= {};
        listeners[id][type] ||= [];
        listeners[id][type].push(handler);
      },
      append(...children) {
        element.children.push(...children);
      },
      appendChild(child) {
        element.children.push(child);
        return child;
      },
      replaceChildren(...children) {
        element.children = [...children];
      },
      querySelector() {
        return createElement();
      },
      querySelectorAll() {
        return [];
      },
      setAttribute(name, value) {
        element[name] = value;
      },
      focus() {},
      closest() {
        return createElement();
      },
    };

    return element;
  }

  function getElement(id) {
    if (!elements.has(id)) {
      elements.set(id, createElement(id));
    }
    return elements.get(id);
  }

  const browseStyleInputs = [
    Object.assign(createElement("browse-style-structure"), {
      value: "structure",
      checked: true,
    }),
    Object.assign(createElement("browse-style-full"), { value: "full" }),
  ];

  const stageSteps = ["electrons", "diagram", "analysis"].map((stage) =>
    Object.assign(createElement(`stage-${stage}`), { dataset: { stage } }),
  );

  const documentStub = {
    getElementById: getElement,
    createElement: () => createElement(),
    querySelector(selector) {
      return getElement(selector);
    },
    querySelectorAll(selector) {
      if (selector === 'input[name="browse-style"]') return browseStyleInputs;
      if (selector === ".lewis-stage-step") return stageSteps;
      return [];
    },
  };

  const context = {
    document: documentStub,
    window: { scrollTo() {}, location: { pathname: "/lewis.html", search: "" } },
    history: { replaceState() {} },
    localStorage: { getItem: () => null, setItem() {} },
    console,
    URLSearchParams,
    setTimeout() {},
    __listeners: listeners,
  };

  const regression = `
practiceMode = PRACTICE_MODES.full;
currentStage = STAGES.electrons;
current = 0;
sessionMolecules = [
  { id: "water", name: "Water", formula: "H2O", valenceElectrons: 8 },
  { id: "ammonia", name: "Ammonia", formula: "NH3", valenceElectrons: 8 },
];
currentMolecule = sessionMolecules[0];
valenceInput.value = "8";
continueBtn.disabled = false;
continueBtn.style.display = "inline-block";

const continueClicks = __listeners["continue-btn"].click;
if (!continueClicks || continueClicks.length !== 1) {
  throw new Error("Continue click handler was not registered.");
}

continueClicks[0]();
continueClicks[0]();

if (currentStage !== STAGES.diagram) {
  throw new Error("Continue should advance only one full-analysis stage.");
}
if (current !== 0) {
  throw new Error("Continue should not skip to the next molecule.");
}
if (!continueBtn.disabled || continueBtn.style.display !== "none") {
  throw new Error("Continue should be disabled and hidden after it is consumed.");
}
`;

  vm.runInNewContext(`${source}\n${regression}`, context, {
    filename: "lewis-continue-regression.js",
  });
}

main();
