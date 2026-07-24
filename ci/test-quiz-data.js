const fs = require("fs");
const path = require("path");

const VALID_TYPES = new Set([
  "drag_and_drop",
  "multiple_choice",
  "drug_worksheet",
  "drag_sentence",
]);

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

  if (question.type === "drug_worksheet") {
    if (!Array.isArray(question.fields) || question.fields.length === 0) {
      errors.push(`${label}: drug_worksheet fields are required.`);
    } else {
      question.fields.forEach((field, fieldIndex) => {
        const fieldLabel = `${label} field ${fieldIndex + 1}`;
        if (!field || typeof field !== "object") {
          errors.push(`${fieldLabel}: must be an object.`);
          return;
        }
        if (typeof field.id !== "string" || field.id.length === 0) {
          errors.push(`${fieldLabel}: id must be a non-empty string.`);
        }
        if (typeof field.label !== "string" || field.label.length === 0) {
          errors.push(`${fieldLabel}: label must be a non-empty string.`);
        }
        if (!Array.isArray(field.options) || field.options.length === 0) {
          errors.push(`${fieldLabel}: options are required.`);
        } else if (
          typeof field.answer !== "string" ||
          !field.options.includes(field.answer)
        ) {
          errors.push(
            `${fieldLabel}: answer must be a non-empty string present in options.`,
          );
        }
      });
    }
    return errors;
  }

  if (question.type === "drag_sentence") {
    if (!Array.isArray(question.sentence) || question.sentence.length === 0) {
      errors.push(`${label}: drag_sentence sentence is required.`);
    }
    if (!Array.isArray(question.blanks) || question.blanks.length === 0) {
      errors.push(`${label}: drag_sentence blanks are required.`);
    }
    if (!Array.isArray(question.bank) || question.bank.length === 0) {
      errors.push(`${label}: drag_sentence bank is required.`);
    }

    if (
      Array.isArray(question.sentence) &&
      Array.isArray(question.blanks)
    ) {
      const blankSlots = question.sentence.filter((part) => part === null).length;
      if (blankSlots !== question.blanks.length) {
        errors.push(
          `${label}: sentence has ${blankSlots} blank(s) but blanks has ${question.blanks.length} answer(s).`,
        );
      }

      question.sentence.forEach((part, partIndex) => {
        if (part !== null && typeof part !== "string") {
          errors.push(
            `${label}: sentence[${partIndex}] must be a string or null.`,
          );
        }
      });
    }

    if (Array.isArray(question.bank) && Array.isArray(question.blanks)) {
      question.blanks.forEach((blank, blankIndex) => {
        if (typeof blank !== "string" || blank.length === 0) {
          errors.push(
            `${label}: blanks[${blankIndex}] must be a non-empty string.`,
          );
        } else if (!question.bank.includes(blank)) {
          errors.push(
            `${label}: blanks[${blankIndex}] "${blank}" is not in bank.`,
          );
        }
      });

      question.bank.forEach((word, wordIndex) => {
        if (typeof word !== "string" || word.length === 0) {
          errors.push(
            `${label}: bank[${wordIndex}] must be a non-empty string.`,
          );
        }
      });
    }

    return errors;
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
