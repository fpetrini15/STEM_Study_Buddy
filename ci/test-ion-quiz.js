#!/usr/bin/env node
/**
 * Unit tests for polyatomic ion question generation and fill-in matching.
 * Run: node ci/test-ion-quiz.js
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const IonQuiz = require("../js/ion-quiz.js");

const ionBank = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "data", "chemistry", "polyatomic_ions.json"),
    "utf8",
  ),
);

function testSkillExamples() {
  ionBank.skills.forEach((skill) => {
    assert.ok(skill.examplePrompt, `${skill.id} needs examplePrompt`);
    assert.ok(skill.exampleAnswer, `${skill.id} needs exampleAnswer`);
    assert.match(
      skill.label,
      /^Given the /,
      `${skill.id} label should say what is given`,
    );
  });
}

function testHasIonBank() {
  assert.strictEqual(IonQuiz.hasIonBank(ionBank), true);
  assert.strictEqual(IonQuiz.hasIonBank({ questions: [] }), false);
  assert.strictEqual(IonQuiz.hasIonBank({ ions: [], skills: ionBank.skills }), false);
}

function testParseSkills() {
  const allIds = ionBank.skills.map((skill) => skill.id);

  assert.deepStrictEqual(IonQuiz.parseSkills(null, ionBank), allIds);
  assert.deepStrictEqual(
    IonQuiz.parseSkills("name_to_charge,formula_to_name", ionBank),
    ["name_to_charge", "formula_to_name"],
  );
  assert.deepStrictEqual(IonQuiz.parseSkills("not_a_skill", ionBank), allIds);
}

function testFillInNormalization() {
  assert.ok(IonQuiz.fillInAnswersMatch("so4", ["SO4", "SO₄"]));
  assert.ok(IonQuiz.fillInAnswersMatch("SO₄", ["SO4"]));
  assert.ok(IonQuiz.fillInAnswersMatch("2-", ["2-", "-2"]));
  assert.ok(IonQuiz.fillInAnswersMatch("-2", ["2-", "-2"]));
  assert.ok(IonQuiz.fillInAnswersMatch("²⁻", ["2-", "-2"]));
  assert.ok(IonQuiz.fillInAnswersMatch("2−", ["2-", "-2"]));
  assert.ok(IonQuiz.fillInAnswersMatch("+", ["+", "1+", "+1"]));
  assert.ok(IonQuiz.fillInAnswersMatch("+1", ["+", "1+", "+1"]));
  assert.ok(IonQuiz.fillInAnswersMatch("1+", ["+", "1+", "+1"]));
  assert.ok(!IonQuiz.fillInAnswersMatch("SO3", ["SO4", "SO₄"]));
  assert.ok(!IonQuiz.fillInAnswersMatch("2+", ["2-", "-2"]));
  assert.ok(!IonQuiz.fillInAnswersMatch("   ", ["SO4"]));
}

function testQuestionGeneration() {
  const chargeOnly = IonQuiz.generateQuestions(ionBank, ["name_to_charge"]);
  assert.strictEqual(chargeOnly.length, ionBank.ions.length);
  assert.ok(chargeOnly.every((question) => question.type === "fill_in"));
  assert.ok(chargeOnly.every((question) => question.match === "charge"));

  const nameOnly = IonQuiz.generateQuestions(ionBank, ["formula_to_name"]);
  assert.strictEqual(nameOnly.length, ionBank.ions.length);
  assert.ok(nameOnly.every((question) => question.type === "multiple_choice"));
  nameOnly.forEach((question) => {
    assert.strictEqual(question.options.length, 4);
    assert.ok(question.options.includes(question.answer));
  });

  const mixed = IonQuiz.generateQuestions(ionBank, [
    "name_to_formula",
    "formula_to_name",
    "name_to_charge",
    "formula_to_charge",
  ]);
  assert.strictEqual(mixed.length, ionBank.ions.length * 4);

  const sulfate = ionBank.ions.find((ion) => ion.name === "sulfate");
  const sulfateCharge = IonQuiz.makeQuestion(sulfate, "name_to_charge", [
    "sulfate",
    "sulfite",
    "nitrate",
    "phosphate",
  ]);
  assert.ok(IonQuiz.fillInAnswersMatch("2-", sulfateCharge.answers));
  assert.ok(IonQuiz.fillInAnswersMatch("-2", sulfateCharge.answers));

  const sulfateFormula = IonQuiz.makeQuestion(sulfate, "name_to_formula", [
    "sulfate",
  ]);
  assert.ok(IonQuiz.fillInAnswersMatch("SO4", sulfateFormula.answers));
  assert.ok(IonQuiz.fillInAnswersMatch("SO₄", sulfateFormula.answers));
}

function testNameDistractorsPreferFamily() {
  const allNames = ionBank.ions.map((ion) => ion.name);
  const options = IonQuiz.pickNameOptions("chlorate", allNames);
  assert.strictEqual(options.length, 4);
  assert.ok(options.includes("chlorate"));
  const familyHits = options.filter((name) =>
    ["hypochlorite", "chlorite", "perchlorate"].includes(name),
  );
  assert.ok(familyHits.length >= 3);
}

function main() {
  testSkillExamples();
  testHasIonBank();
  testParseSkills();
  testFillInNormalization();
  testQuestionGeneration();
  testNameDistractorsPreferFamily();
  console.log("Ion quiz tests passed.");
}

main();
