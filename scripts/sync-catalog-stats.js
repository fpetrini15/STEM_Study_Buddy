#!/usr/bin/env node
/**
 * Sync questionCount / types (and Lewis itemCount) into data/catalog.json
 * so subject pages do not need to fetch every quiz JSON on load.
 *
 * Usage:
 *   node scripts/sync-catalog-stats.js
 *   node scripts/sync-catalog-stats.js --check   # exit 1 if catalog is stale
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CATALOG_PATH = path.join(ROOT, "data", "catalog.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function quizStatsFromFile(subjectKey, quizId) {
  const filePath = path.join(ROOT, "data", subjectKey, `${quizId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const data = readJson(filePath);

  if (Array.isArray(data.ions) && data.ions.length > 0) {
    return {
      questionCount: data.ions.length,
      types: {
        fill_in: data.ions.length,
        multiple_choice: data.ions.length,
      },
      title: data.title,
    };
  }

  if (!Array.isArray(data.questions)) {
    return null;
  }

  const types = {};
  data.questions.forEach((question) => {
    types[question.type] = (types[question.type] || 0) + 1;
  });

  return {
    questionCount: data.questions.length,
    types,
    title: data.title,
  };
}

function practiceStatsFromFile(subjectKey, dataFile) {
  const filePath = path.join(ROOT, "data", subjectKey, `${dataFile}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const data = readJson(filePath);
  return {
    itemCount: data.molecules?.length ?? 0,
    title: data.title,
  };
}

function typesEqual(a = {}, b = {}) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] || 0) !== (b[key] || 0)) return false;
  }
  return true;
}

function collectQuizEntries(catalog) {
  const entries = [];

  Object.entries(catalog).forEach(([key, subject]) => {
    if (key === "sections" || !subject || typeof subject !== "object") return;

    (subject.quizzes || []).forEach((quiz, index) => {
      entries.push({ subjectKey: key, quiz, path: `quizzes[${index}]` });
    });

    (subject.units || []).forEach((unit, unitIndex) => {
      (unit.quizzes || []).forEach((quiz, quizIndex) => {
        entries.push({
          subjectKey: key,
          quiz,
          path: `units[${unitIndex}].quizzes[${quizIndex}]`,
        });
      });
    });
  });

  return entries;
}

function syncCatalog(catalog, { checkOnly = false } = {}) {
  const errors = [];
  let changed = false;

  collectQuizEntries(catalog).forEach(
    ({ subjectKey, quiz, path: entryPath }) => {
      if (!quiz || typeof quiz !== "object" || !quiz.id) return;

      if (quiz.href) {
        const dataFile = quiz.dataFile || quiz.id;
        const stats = practiceStatsFromFile(subjectKey, dataFile);
        if (!stats) {
          errors.push(
            `${subjectKey}/${entryPath} (${quiz.id}): missing data file data/${subjectKey}/${dataFile}.json`,
          );
          return;
        }

        if (quiz.itemCount !== stats.itemCount) {
          if (checkOnly) {
            errors.push(
              `${subjectKey}/${quiz.id}: itemCount is ${quiz.itemCount ?? "missing"}, expected ${stats.itemCount}`,
            );
          } else {
            quiz.itemCount = stats.itemCount;
            changed = true;
          }
        }
        return;
      }

      const stats = quizStatsFromFile(subjectKey, quiz.id);
      if (!stats) {
        errors.push(
          `${subjectKey}/${entryPath} (${quiz.id}): missing quiz file data/${subjectKey}/${quiz.id}.json`,
        );
        return;
      }

      if (quiz.questionCount !== stats.questionCount) {
        if (checkOnly) {
          errors.push(
            `${subjectKey}/${quiz.id}: questionCount is ${quiz.questionCount ?? "missing"}, expected ${stats.questionCount}`,
          );
        } else {
          quiz.questionCount = stats.questionCount;
          changed = true;
        }
      }

      if (!typesEqual(quiz.types, stats.types)) {
        if (checkOnly) {
          errors.push(
            `${subjectKey}/${quiz.id}: types out of date (expected ${JSON.stringify(stats.types)})`,
          );
        } else {
          quiz.types = stats.types;
          changed = true;
        }
      }
    },
  );

  return { errors, changed };
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const catalog = readJson(CATALOG_PATH);
  const { errors, changed } = syncCatalog(catalog, { checkOnly });

  if (errors.length > 0) {
    console.error("Catalog stats check failed:\n");
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  if (checkOnly) {
    console.log("Catalog stats are up to date.");
    return;
  }

  if (changed) {
    writeJson(CATALOG_PATH, catalog);
    console.log("Updated data/catalog.json with quiz stats.");
  } else {
    console.log("data/catalog.json already has up-to-date quiz stats.");
  }
}

main();
