const fs = require("fs");
const path = require("path");

const VALID_TYPES = new Set([
  "drag_and_drop",
  "multiple_choice",
  "drug_worksheet",
  "drag_sentence",
  "fill_in",
  "net_ionic",
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

  if (question.type === "fill_in") {
    if (!Array.isArray(question.answers) || question.answers.length === 0) {
      errors.push(`${label}: fill_in answers are required.`);
    } else {
      question.answers.forEach((answer, answerIndex) => {
        if (typeof answer !== "string" || answer.length === 0) {
          errors.push(
            `${label}: answers[${answerIndex}] must be a non-empty string.`,
          );
        }
      });
    }

    if (typeof question.answer !== "string" || question.answer.length === 0) {
      errors.push(`${label}: answer must be a non-empty display string.`);
    }

    return errors;
  }

  if (question.type === "net_ionic") {
    if (typeof question.reaction !== "boolean") {
      errors.push(`${label}: net_ionic reaction must be true or false.`);
    }

    if (question.reaction) {
      if (!Array.isArray(question.bank) || question.bank.length === 0) {
        errors.push(`${label}: net_ionic bank is required.`);
      }

      ["reactants", "products"].forEach((side) => {
        if (!Array.isArray(question[side]) || question[side].length === 0) {
          errors.push(`${label}: net_ionic ${side} are required.`);
          return;
        }

        question[side].forEach((term, termIndex) => {
          const termLabel = `${label} ${side}[${termIndex}]`;
          if (!term || typeof term.species !== "string" || term.species.length === 0) {
            errors.push(`${termLabel}: species must be a non-empty string.`);
          } else if (
            Array.isArray(question.bank) &&
            !question.bank.includes(term.species)
          ) {
            errors.push(
              `${termLabel}: species "${term.species}" is not in bank.`,
            );
          }

          if (
            term.coeff !== undefined &&
            (!Number.isInteger(term.coeff) || term.coeff < 1)
          ) {
            errors.push(`${termLabel}: coeff must be a positive integer.`);
          }
        });
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

function validateIonBank(filePath, quiz) {
  const errors = [];
  const label = path.relative(process.cwd(), filePath);

  if (!Array.isArray(quiz.skills) || quiz.skills.length === 0) {
    errors.push(`${label}: skills must be a non-empty array.`);
  } else {
    const skillIds = new Set();
    quiz.skills.forEach((skill, index) => {
      const skillLabel = `${label} skill ${index + 1}`;
      if (!skill || typeof skill !== "object") {
        errors.push(`${skillLabel}: must be an object.`);
        return;
      }
      if (typeof skill.id !== "string" || skill.id.length === 0) {
        errors.push(`${skillLabel}: id must be a non-empty string.`);
      } else if (skillIds.has(skill.id)) {
        errors.push(`${skillLabel}: duplicate skill id "${skill.id}".`);
      } else {
        skillIds.add(skill.id);
      }
      if (typeof skill.label !== "string" || skill.label.length === 0) {
        errors.push(`${skillLabel}: label must be a non-empty string.`);
      }
      const hasPrompt = typeof skill.examplePrompt === "string" && skill.examplePrompt.length > 0;
      const hasAnswer = typeof skill.exampleAnswer === "string" && skill.exampleAnswer.length > 0;
      if (hasPrompt !== hasAnswer) {
        errors.push(
          `${skillLabel}: examplePrompt and exampleAnswer must be provided together.`,
        );
      }
    });
  }

  if (!Array.isArray(quiz.ions) || quiz.ions.length === 0) {
    errors.push(`${label}: ions must be a non-empty array.`);
    return errors;
  }

  const names = new Set();
  const formulas = new Set();

  quiz.ions.forEach((ion, index) => {
    const ionLabel = `${label} ion ${index + 1}`;
    if (!ion || typeof ion !== "object") {
      errors.push(`${ionLabel}: must be an object.`);
      return;
    }

    if (typeof ion.name !== "string" || ion.name.length === 0) {
      errors.push(`${ionLabel}: name must be a non-empty string.`);
    } else if (names.has(ion.name)) {
      errors.push(`${ionLabel}: duplicate name "${ion.name}".`);
    } else {
      names.add(ion.name);
    }

    if (typeof ion.formula !== "string" || ion.formula.length === 0) {
      errors.push(`${ionLabel}: formula must be a non-empty string.`);
    } else if (formulas.has(ion.formula)) {
      errors.push(`${ionLabel}: duplicate formula "${ion.formula}".`);
    } else {
      formulas.add(ion.formula);
    }

    if (typeof ion.formulaDisplay !== "string" || ion.formulaDisplay.length === 0) {
      errors.push(`${ionLabel}: formulaDisplay must be a non-empty string.`);
    }

    if (!Array.isArray(ion.charges) || ion.charges.length === 0) {
      errors.push(`${ionLabel}: charges must be a non-empty array.`);
    } else {
      ion.charges.forEach((charge, chargeIndex) => {
        if (typeof charge !== "string" || charge.length === 0) {
          errors.push(
            `${ionLabel}: charges[${chargeIndex}] must be a non-empty string.`,
          );
        }
      });
    }
  });

  return errors;
}

function validateQuiz(filePath) {
  const quiz = readJson(filePath);
  const errors = [];
  const label = path.relative(process.cwd(), filePath);

  if (quiz.disclaimer !== undefined) {
    if (typeof quiz.disclaimer !== "string" || quiz.disclaimer.trim().length === 0) {
      errors.push(`${label}: disclaimer must be a non-empty string when present.`);
    }
  }

  if (quiz.referenceTable !== undefined) {
    const table = quiz.referenceTable;
    if (!table || typeof table !== "object") {
      errors.push(`${label}: referenceTable must be an object when present.`);
    } else {
      if (!Array.isArray(table.columns) || table.columns.length === 0) {
        errors.push(`${label}: referenceTable.columns must be a non-empty array.`);
      }
      if (!Array.isArray(table.rows) || table.rows.length === 0) {
        errors.push(`${label}: referenceTable.rows must be a non-empty array.`);
      } else {
        table.rows.forEach((row, index) => {
          if (!Array.isArray(row?.cells) || row.cells.length === 0) {
            errors.push(
              `${label}: referenceTable.rows[${index}].cells must be a non-empty array.`,
            );
          } else if (
            Array.isArray(table.columns) &&
            row.cells.length !== table.columns.length
          ) {
            errors.push(
              `${label}: referenceTable.rows[${index}] has ${row.cells.length} cell(s) but columns has ${table.columns.length}.`,
            );
          }
        });
      }
    }
  }

  const hasIonBank = Array.isArray(quiz.ions) && quiz.ions.length > 0;

  if (hasIonBank) {
    errors.push(...validateIonBank(filePath, quiz));
  }

  if (Array.isArray(quiz.questions) && quiz.questions.length > 0) {
    quiz.questions.forEach((question, index) => {
      errors.push(...validateQuestion(filePath, quiz, question, index));
    });
    return errors;
  }

  if (!hasIonBank) {
    return [
      `${path.relative(process.cwd(), filePath)}: questions must be a non-empty array.`,
    ];
  }

  return errors;
}

const errors = getQuizFiles().flatMap(validateQuiz);

if (errors.length > 0) {
  console.error("Quiz data validation failed:\n");
  errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}

console.log("Quiz data validation passed.");
