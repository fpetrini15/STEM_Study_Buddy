const IonQuiz = {
  SKILL_IDS: [
    "name_to_formula",
    "formula_to_name",
    "name_to_charge",
    "formula_to_charge",
  ],

  NAME_FAMILIES: [
    ["nitrite", "nitrate"],
    ["sulfite", "sulfate"],
    ["hypochlorite", "chlorite", "chlorate", "perchlorate"],
    ["chromate", "dichromate"],
  ],

  SUBSCRIPT_MAP: {
    "₀": "0",
    "₁": "1",
    "₂": "2",
    "₃": "3",
    "₄": "4",
    "₅": "5",
    "₆": "6",
    "₇": "7",
    "₈": "8",
    "₉": "9",
    "₊": "+",
    "₋": "-",
  },

  SUPERSCRIPT_MAP: {
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
    "⁺": "+",
    "⁻": "-",
  },

  hasIonBank(data) {
    return (
      Array.isArray(data?.ions) &&
      data.ions.length > 0 &&
      Array.isArray(data?.skills) &&
      data.skills.length > 0
    );
  },

  skillIds(data) {
    return (data?.skills || [])
      .map((skill) => skill?.id)
      .filter((id) => typeof id === "string" && id.length > 0);
  },

  parseSkills(param, data) {
    const valid = new Set(this.skillIds(data));
    if (!param || typeof param !== "string") {
      return this.skillIds(data);
    }

    const parsed = param
      .split(",")
      .map((part) => part.trim())
      .filter((id) => valid.has(id));

    return parsed.length > 0 ? parsed : this.skillIds(data);
  },

  shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  },

  uniqueStrings(values) {
    const seen = new Set();
    const result = [];
    values.forEach((value) => {
      if (typeof value !== "string" || value.length === 0) return;
      if (seen.has(value)) return;
      seen.add(value);
      result.push(value);
    });
    return result;
  },

  normalizeFillInAnswer(text) {
    return String(text ?? "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[−–—]/g, "-")
      .replace(/[₀-₉₊₋]/g, (char) => this.SUBSCRIPT_MAP[char] ?? char)
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g, (char) => this.SUPERSCRIPT_MAP[char] ?? char);
  },

  fillInAnswersMatch(userAnswer, answers) {
    const normalized = this.normalizeFillInAnswer(userAnswer).toLowerCase();
    if (!normalized) return false;

    return (answers || []).some((answer) => {
      return this.normalizeFillInAnswer(answer).toLowerCase() === normalized;
    });
  },

  displayCharge(charges) {
    const normalized = (charges || []).map((charge) =>
      this.normalizeFillInAnswer(charge),
    );

    if (normalized.some((charge) => charge === "+" || charge === "1+" || charge === "+1")) {
      return "⁺";
    }
    if (normalized.some((charge) => charge === "3-" || charge === "-3")) {
      return "³⁻";
    }
    if (normalized.some((charge) => charge === "2-" || charge === "-2")) {
      return "²⁻";
    }
    return "⁻";
  },

  pickNameOptions(correctName, allNames) {
    const names = allNames.filter((name) => typeof name === "string" && name.length > 0);
    const options = new Set([correctName]);
    const family =
      this.NAME_FAMILIES.find((group) => group.includes(correctName)) || [];

    this.shuffle(family.filter((name) => name !== correctName)).forEach((name) => {
      if (options.size < 4 && names.includes(name)) {
        options.add(name);
      }
    });

    this.shuffle(names.filter((name) => !options.has(name))).forEach((name) => {
      if (options.size < 4) {
        options.add(name);
      }
    });

    return this.shuffle([...options]);
  },

  makeQuestion(ion, skillId, allNames) {
    const formula = ion.formulaDisplay || ion.formula;
    const chargeAnswer = this.displayCharge(ion.charges);
    const formulaAnswers = this.uniqueStrings([ion.formula, ion.formulaDisplay]);
    const chargeAnswers = this.uniqueStrings([
      ...(ion.charges || []),
      chargeAnswer,
    ]);

    if (skillId === "name_to_formula") {
      return {
        type: "fill_in",
        skill: skillId,
        match: "formula",
        prompt: { text: `What is the formula for ${ion.name}?` },
        answers: formulaAnswers,
        answer: formula,
        explanation: ion.explanation,
      };
    }

    if (skillId === "formula_to_name") {
      return {
        type: "multiple_choice",
        skill: skillId,
        prompt: { text: `What is the name of ${formula}?` },
        options: this.pickNameOptions(ion.name, allNames),
        answer: ion.name,
        explanation: ion.explanation,
      };
    }

    if (skillId === "name_to_charge") {
      return {
        type: "fill_in",
        skill: skillId,
        match: "charge",
        prompt: { text: `What is the charge of ${ion.name}?` },
        answers: chargeAnswers,
        answer: chargeAnswer,
        explanation: ion.explanation,
      };
    }

    return {
      type: "fill_in",
      skill: skillId,
      match: "charge",
      prompt: { text: `What is the charge of ${formula}?` },
      answers: chargeAnswers,
      answer: chargeAnswer,
      explanation: ion.explanation,
    };
  },

  generateQuestions(data, skillIds) {
    if (!this.hasIonBank(data)) return [];

    const allowed = new Set(this.skillIds(data));
    const selected = (skillIds || []).filter((id) => allowed.has(id));
    const allNames = data.ions.map((ion) => ion.name);
    const questions = [];

    selected.forEach((skillId) => {
      data.ions.forEach((ion) => {
        questions.push(this.makeQuestion(ion, skillId, allNames));
      });
    });

    return questions;
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = IonQuiz;
}
