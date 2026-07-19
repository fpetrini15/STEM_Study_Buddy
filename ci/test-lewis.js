#!/usr/bin/env node
/**
 * Lint and test Lewis structure answer data.
 * Run: node ci/test-lewis.js
 */

const fs = require("fs");
const path = require("path");

const dataPath = path.join(
  __dirname,
  "..",
  "data",
  "chemistry",
  "lewis_structures.json",
);

const LewisAnswers = require("../js/lewis-answers.js");
const LewisValidation = require("../js/lewis-validation.js");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function testDiagramDerivedResonance(toolData) {
  const molecule = toolData.molecules.find((entry) => entry.id === "no3_minus");
  assert(molecule, "Expected no3_minus fixture to exist.");

  const variants = LewisAnswers.getAnswerVariants(molecule);
  const uniformVariant = variants.find(
    (variant) =>
      Object.values(variant.bonds).length > 0 &&
      Object.values(variant.bonds).every((order) => order >= 2),
  );
  const mixedVariant = variants.find((variant) =>
    LewisAnswers.hasMixedSingleAndMultipleBonds(variant.bonds),
  );

  assert(uniformVariant, "Expected nitrate to include a uniform-bond variant.");
  assert(mixedVariant, "Expected nitrate to include a mixed-bond variant.");
  assert(
    !LewisAnswers.hasMixedSingleAndMultipleBonds(uniformVariant.bonds),
    "Uniform-bond nitrate should not be treated as diagram-derived resonance.",
  );
  assert(
    LewisAnswers.hasMixedSingleAndMultipleBonds(mixedVariant.bonds),
    "Mixed-bond nitrate should be treated as diagram-derived resonance.",
  );
}

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

  testDiagramDerivedResonance(toolData);

  const totalVariants = lintReport.molecules.reduce(
    (sum, entry) => sum + entry.variantCount,
    0,
  );

  console.log(
    `\nAll ${lintReport.molecules.length} molecules passed (${totalVariants} variants).`,
  );
}

main();
