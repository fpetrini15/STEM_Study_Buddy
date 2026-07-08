#!/usr/bin/env node
/**
 * Lint shared quiz data for repository-local asset references.
 * Run: node ci/test-quiz-data.js
 */

const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");

function walkJsonFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkJsonFiles(fullPath));
      return;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  });

  return files;
}

function getQuestionCollections(data) {
  if (Array.isArray(data.questions)) {
    return [{ label: "questions", questions: data.questions }];
  }

  return [];
}

function main() {
  const failures = [];

  walkJsonFiles(dataDir).forEach((filePath) => {
    const relativePath = path.relative(rootDir, filePath);
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    getQuestionCollections(data).forEach(({ label, questions }) => {
      questions.forEach((question, index) => {
        const image = question?.prompt?.image;

        if (typeof image !== "string" || image.trim() === "") {
          return;
        }

        const imagePath = path.join(rootDir, image);
        if (!fs.existsSync(imagePath)) {
          failures.push(
            `${relativePath} ${label}[${index}]: missing prompt.image asset ${image}`,
          );
        }
      });
    });
  });

  if (failures.length > 0) {
    console.error("Quiz data asset validation failed:");
    failures.forEach((failure) => console.error(`  - ${failure}`));
    process.exit(1);
  }

  console.log("All quiz prompt image assets exist.");
}

main();
