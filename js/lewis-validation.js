/**
 * Lewis structure data linting and answer-state validation.
 * Used by lewis.js (browser) and scripts/test-lewis.js (Node).
 */
const LewisValidation = (function () {
  const LewisAnswers =
    typeof module !== "undefined" && module.exports
      ? require("./lewis-answers.js")
      : globalThis.LewisAnswers;

  function getExpectedLoneDots(atomId, loneDotsAnswer) {
    const entry = loneDotsAnswer[atomId];
    if (typeof entry === "number") return entry;
    if (entry && typeof entry.total === "number") return entry.total;
    if (entry && typeof entry === "object") {
      return Object.values(entry).reduce((sum, value) => sum + value, 0);
    }
    return 0;
  }

  function countElectronsInVariant(variant) {
    const bondElectrons = Object.values(variant.bonds || {}).reduce(
      (sum, order) => sum + order * 2,
      0,
    );
    const loneElectrons = Object.keys(variant.loneDots || {}).reduce(
      (sum, atomId) => sum + getExpectedLoneDots(atomId, variant.loneDots),
      0,
    );

    return bondElectrons + loneElectrons;
  }

  function getActualLoneDotsFromState(atomId, loneState) {
    return Object.entries(loneState || {})
      .filter(([key]) => key.startsWith(`${atomId}:`))
      .reduce((sum, [, count]) => sum + (count || 0), 0);
  }

  function validateVariant(variant, molecule, bondState, loneState, helpers = {}) {
    const issues = [];
    const { bonds, loneDots } = variant;
    const getActualLoneDots =
      helpers.getActualLoneDots ||
      ((atomId) => getActualLoneDotsFromState(atomId, loneState));
    const getFilledLoneSlotCounts =
      helpers.getFilledLoneSlotCounts || (() => []);
    const getAtomLabel = helpers.getAtomLabel || ((atomId) => atomId);

    Object.entries(bonds || {}).forEach(([key, expected]) => {
      const actual = bondState[key] || 0;
      if (actual !== expected) {
        issues.push(
          `Bond ${key}: expected order ${expected}, got ${actual}.`,
        );
      }
    });

    Object.keys(bondState || {}).forEach((key) => {
      if (!(key in bonds) && bondState[key] > 0) {
        issues.push(`Unexpected bond ${key}.`);
      }
    });

    Object.keys(loneDots || {}).forEach((atomId) => {
      const expected = getExpectedLoneDots(atomId, loneDots);
      const actual = getActualLoneDots(atomId);
      const pairCount = expected / 2;

      if (actual !== expected) {
        issues.push(
          `${getAtomLabel(atomId)}: expected ${pairCount} lone pair${
            pairCount === 1 ? "" : "s"
          } (${expected} electrons), got ${actual}.`,
        );
        return;
      }

      const slotCounts = getFilledLoneSlotCounts(atomId);
      if (slotCounts.some((count) => count % 2 !== 0)) {
        issues.push(
          `${getAtomLabel(atomId)}: lone electrons must be placed in pairs.`,
        );
      }
    });

    Object.entries(loneState || {}).forEach(([key, count]) => {
      if (count === 0) return;
      const atomId = key.split(":")[0];
      if (!(atomId in loneDots)) {
        issues.push(`Unexpected lone electrons on ${getAtomLabel(atomId)}.`);
      }
    });

    return issues;
  }

  function lintVariant(variant, molecule) {
    const errors = [];
    const expectedBondKeys = LewisAnswers.getExpectedBondKeys(molecule);
    const variantBondKeys = Object.keys(variant.bonds || {});

    expectedBondKeys.forEach((key) => {
      if (!(key in variant.bonds)) {
        errors.push(`Missing bond key ${key}.`);
      }
    });

    variantBondKeys.forEach((key) => {
      if (!expectedBondKeys.includes(key)) {
        errors.push(`Unexpected bond key ${key} for layout ${molecule.layout}.`);
      }

      const order = variant.bonds[key];
      if (!Number.isInteger(order) || order < 1 || order > 3) {
        errors.push(`Bond ${key} has invalid order ${order}.`);
      }
    });

    if (Number.isFinite(molecule.valenceElectrons)) {
      const electronCount = countElectronsInVariant(variant);
      if (electronCount !== molecule.valenceElectrons) {
        errors.push(
          `Electron count ${electronCount} does not match valenceElectrons ${molecule.valenceElectrons}.`,
        );
      }
    }

    Object.entries(variant.loneDots || {}).forEach(([atomId, entry]) => {
      const count = getExpectedLoneDots(atomId, { [atomId]: entry });
      if (count % 2 !== 0) {
        errors.push(`${atomId}: lone electron count ${count} is not even.`);
      }
    });

    const atomIds = new Set(molecule.atoms.map((atom) => atom.id));
    Object.keys(variant.loneDots || {}).forEach((atomId) => {
      if (!atomIds.has(atomId)) {
        errors.push(`Unknown atom id "${atomId}" in loneDots.`);
      }
    });

    return errors;
  }

  function lintPattern(pattern, molecule) {
    const errors = [];
    const peripheralCount = LewisAnswers.getPeripheralIndices(molecule).length;

    if (!Array.isArray(pattern.peripheralOrders)) {
      errors.push("Pattern missing peripheralOrders array.");
      return errors;
    }

    if (pattern.peripheralOrders.length !== peripheralCount) {
      errors.push(
        `Pattern peripheralOrders length ${pattern.peripheralOrders.length} does not match ${peripheralCount} peripheral atoms.`,
      );
    }

    pattern.peripheralOrders.forEach((order, index) => {
      if (!Number.isInteger(order) || order < 1 || order > 3) {
        errors.push(`peripheralOrders[${index}] has invalid order ${order}.`);
      }

      if (
        pattern.peripheralLoneByOrder &&
        pattern.peripheralLoneByOrder[String(order)] === undefined
      ) {
        errors.push(
          `peripheralLoneByOrder missing entry for bond order ${order}.`,
        );
      }
    });

    if (
      pattern.centralLone !== undefined &&
      (typeof pattern.centralLone !== "number" || pattern.centralLone < 0)
    ) {
      errors.push("centralLone must be a non-negative number.");
    }

    try {
      LewisAnswers.expandPattern(molecule, pattern);
    } catch (error) {
      errors.push(`Pattern expansion failed: ${error.message}`);
    }

    return errors;
  }

  function lintMolecule(molecule) {
    const errors = [];
    const { answer } = molecule;

    if (!answer) {
      errors.push("Missing answer.");
      return errors;
    }

    if (Array.isArray(answer.patterns)) {
      answer.patterns.forEach((pattern, index) => {
        lintPattern(pattern, molecule).forEach((message) => {
          errors.push(`patterns[${index}]: ${message}`);
        });
      });
    }

    const variants = LewisAnswers.getAnswerVariants(molecule);
    if (variants.length === 0) {
      errors.push("No answer variants after expansion.");
    }

    const signatures = new Set();
    variants.forEach((variant, index) => {
      lintVariant(variant, molecule).forEach((message) => {
        errors.push(`variant[${index}]: ${message}`);
      });

      const signature = LewisAnswers.variantSignature(variant);
      if (signatures.has(signature)) {
        errors.push(`Duplicate variant at index ${index}.`);
      }
      signatures.add(signature);
    });

    return errors;
  }

  function lintDataset(toolData) {
    const report = { ok: true, molecules: [] };

    if (!toolData || !Array.isArray(toolData.molecules)) {
      return { ok: false, error: "Invalid dataset: molecules array required." };
    }

    toolData.molecules.forEach((molecule) => {
      const errors = lintMolecule(molecule);
      const variants = LewisAnswers.getAnswerVariants(molecule);
      const entry = {
        id: molecule.id,
        variantCount: variants.length,
        errors,
      };

      if (errors.length > 0) {
        report.ok = false;
      }

      report.molecules.push(entry);
    });

    return report;
  }

  function buildStateFromVariant(variant) {
    const bondState = { ...variant.bonds };
    const loneState = {};

    Object.entries(variant.loneDots || {}).forEach(([atomId, entry]) => {
      if (typeof entry === "number") {
        loneState[`${atomId}:slot0`] = entry;
        return;
      }

      if (entry && typeof entry === "object" && typeof entry.total !== "number") {
        Object.entries(entry).forEach(([direction, count]) => {
          if (count > 0) {
            loneState[`${atomId}:${direction}`] = count;
          }
        });
      }
    });

    return { bondState, loneState };
  }

  function testAllVariants(toolData) {
    const failures = [];

    toolData.molecules.forEach((molecule) => {
      LewisAnswers.getAnswerVariants(molecule).forEach((variant, index) => {
        const { bondState, loneState } = buildStateFromVariant(variant);
        const issues = validateVariant(variant, molecule, bondState, loneState);
        if (issues.length > 0) {
          failures.push({
            id: molecule.id,
            variantIndex: index,
            issues,
          });
        }
      });
    });

    return failures;
  }

  return {
    getExpectedLoneDots,
    countElectronsInVariant,
    validateVariant,
    lintVariant,
    lintPattern,
    lintMolecule,
    lintDataset,
    buildStateFromVariant,
    testAllVariants,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = LewisValidation;
}

if (typeof window !== "undefined") {
  window.LewisValidation = LewisValidation;
}
