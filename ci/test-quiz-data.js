const fs = require("fs");
const path = require("path");

const VALID_TYPES = new Set(["drag_and_drop", "multiple_choice"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getQuizFiles() {
  const dataRoot = path.join(__dirname, "..", "data");
  const subjects = fs
    .readdirSync(dataRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  return subjects.flatMap((subject) => {
    const subjectDir = path.join(dataRoot, subject);
    return fs
      .readdirSync(subjectDir)
      .filter((fileName) => fileName.endsWith(".json"))
      .filter((fileName) => fileName !== "lewis_structures.json")
      .map((fileName) => path.join(subjectDir, fileName));
  });
}

function validateQuestion(filePath, quiz, question, index) {
  const errors = [];
  const label = `${path.relative(process.cwd(), filePath)} question ${index + 1}`;

  if (!VALID_TYPES.has(question.type)) {
    errors.push(`${label}: unknown type "${question.type}".`);
  }

  if (!question.prompt || (!question.prompt.text && !question.prompt.image)) {
    errors.push(`${label}: prompt.text or prompt.image is required.`);
  }

  if (typeof question.answer !== "string" || question.answer.length === 0) {
    errors.push(`${label}: answer must be a non-empty string.`);
  }

  if (question.type === "multiple_choice") {
    if (!Array.isArray(question.options) || question.options.length === 0) {
      errors.push(`${label}: multiple-choice options are required.`);
    } else if (!question.options.includes(question.answer)) {
      errors.push(`${label}: answer "${question.answer}" is not in options.`);
    }
  }

  if (question.type === "drag_and_drop") {
    const categories = question.categories || quiz.categories;
    if (!Array.isArray(categories) || categories.length === 0) {
      errors.push(`${label}: drag-and-drop categories are required.`);
    } else if (!categories.includes(question.answer)) {
      errors.push(`${label}: answer "${question.answer}" is not in categories.`);
    }
  }

  return errors;
}

function validateQuiz(filePath) {
  const quiz = readJson(filePath);
  const errors = [];

  if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return [`${path.relative(process.cwd(), filePath)}: questions must be a non-empty array.`];
  }

  quiz.questions.forEach((question, index) => {
    errors.push(...validateQuestion(filePath, quiz, question, index));
  });

  return errors;
}

const errors = getQuizFiles().flatMap(validateQuiz);

if (errors.length > 0) {
  console.error("Quiz data validation failed:\n");
  errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}

console.log("Quiz data validation passed.");
