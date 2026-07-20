/**
 * Lewis structure answer expansion — patterns, variants, and bond/lone helpers.
 * Used by lewis.js (browser) and ci/test-lewis.js (Node).
 *
 * Grading accepts any entry returned by getAnswerVariants(): patterns (expanded),
 * explicit variants, and/or a top-level bonds+loneDots object can all be combined.
 * Add every distinct valid Lewis structure so students are not marked wrong for
 * an acceptable alternative (e.g. octet-compliant vs expanded-octet forms).
 */
const LewisAnswers = (function () {
  function getCentralIndex(molecule) {
    const centralId = molecule.analysis?.centralAtom;
    if (centralId) {
      const index = molecule.atoms.findIndex((atom) => atom.id === centralId);
      if (index >= 0) return index;
    }

    if (molecule.layout === "linear" && molecule.atoms.length === 3) {
      return 1;
    }

    return 0;
  }

  function getPeripheralIndices(molecule) {
    const central = getCentralIndex(molecule);
    return molecule.atoms.map((_, index) => index).filter((index) => index !== central);
  }

  function bondKeyForPair(leftIndex, rightIndex) {
    const left = Math.min(leftIndex, rightIndex);
    const right = Math.max(leftIndex, rightIndex);
    return `${left}-${right}`;
  }

  function getExpectedBondKeys(molecule) {
    const layout = molecule.layout || "linear";
    const central = getCentralIndex(molecule);

    if (
      layout === "octahedral" ||
      layout === "tetrahedral" ||
      layout === "trigonal_planar" ||
      layout === "trigonal_bipyramidal"
    ) {
      return getPeripheralIndices(molecule).map(
        (peripheralIndex) => `${central}-${peripheralIndex}`,
      );
    }

    const keys = [];
    for (let i = 0; i < molecule.atoms.length - 1; i++) {
      keys.push(`${i}-${i + 1}`);
    }
    return keys;
  }

  function buildBondsFromOrders(molecule, peripheralOrders) {
    const central = getCentralIndex(molecule);
    const peripherals = getPeripheralIndices(molecule);
    const bonds = {};

    if (peripherals.length !== peripheralOrders.length) {
      throw new Error(
        `Expected ${peripherals.length} peripheral bond orders, got ${peripheralOrders.length}.`,
      );
    }

    peripherals.forEach((peripheralIndex, i) => {
      bonds[bondKeyForPair(central, peripheralIndex)] = peripheralOrders[i];
    });

    return bonds;
  }

  function buildLoneDotsFromPattern(molecule, pattern, peripheralOrders) {
    const central = getCentralIndex(molecule);
    const centralAtom = molecule.atoms[central];
    const peripherals = getPeripheralIndices(molecule);
    const loneDots = {};
    const peripheralLoneByOrder = pattern.peripheralLoneByOrder || {};
    const centralLone = pattern.centralLone ?? 0;

    if (centralLone > 0 && centralAtom) {
      loneDots[centralAtom.id] = centralLone;
    }

    peripherals.forEach((peripheralIndex, i) => {
      const order = peripheralOrders[i];
      const atom = molecule.atoms[peripheralIndex];
      const loneCount = peripheralLoneByOrder[String(order)];

      if (loneCount === undefined) {
        throw new Error(
          `Missing peripheralLoneByOrder entry for bond order ${order}.`,
        );
      }

      if (loneCount > 0) {
        loneDots[atom.id] = loneCount;
      }
    });

    return loneDots;
  }

  function permuteOrders(orders) {
    const results = [];

    function permute(start) {
      if (start === orders.length) {
        results.push([...orders]);
        return;
      }

      const seen = new Set();
      for (let i = start; i < orders.length; i++) {
        const key = orders[i];
        if (seen.has(key)) continue;
        seen.add(key);

        [orders[start], orders[i]] = [orders[i], orders[start]];
        permute(start + 1);
        [orders[start], orders[i]] = [orders[i], orders[start]];
      }
    }

    permute(0);
    return results;
  }

  function variantSignature(variant) {
    const bonds = Object.entries(variant.bonds || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join("|");
    const lones = Object.entries(variant.loneDots || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
      .join("|");

    return `${bonds}::${lones}`;
  }

  function dedupeVariants(variants) {
    const seen = new Set();
    const unique = [];

    variants.forEach((variant) => {
      const signature = variantSignature(variant);
      if (seen.has(signature)) return;
      seen.add(signature);
      unique.push(variant);
    });

    return unique;
  }

  function expandPattern(molecule, pattern) {
    const ordersList = pattern.permute
      ? permuteOrders([...pattern.peripheralOrders])
      : [pattern.peripheralOrders];

    return ordersList.map((peripheralOrders) => {
      const variant = {
        bonds: buildBondsFromOrders(molecule, peripheralOrders),
        loneDots: buildLoneDotsFromPattern(molecule, pattern, peripheralOrders),
      };

      if (pattern.resonance !== undefined) {
        variant.resonance = pattern.resonance;
      }

      return variant;
    });
  }

  function expandPatterns(molecule, patterns) {
    return dedupeVariants(
      patterns.flatMap((pattern) => expandPattern(molecule, pattern)),
    );
  }

  function getAnswerVariants(molecule) {
    const { answer } = molecule;
    if (!answer) return [];

    const variants = [];

    if (Array.isArray(answer.patterns) && answer.patterns.length > 0) {
      variants.push(...expandPatterns(molecule, answer.patterns));
    }

    if (Array.isArray(answer.variants) && answer.variants.length > 0) {
      variants.push(...answer.variants);
    }

    if (answer.bonds && answer.loneDots) {
      const variant = { bonds: answer.bonds, loneDots: answer.loneDots };

      if (answer.resonance !== undefined) {
        variant.resonance = answer.resonance;
      }

      variants.push(variant);
    }

    return dedupeVariants(variants);
  }

  const ELECTRON_DEFICIENT_CENTRAL_ATOMS = new Set(["B", "Be"]);

  function getLoneDotTotal(atomId, loneDotsAnswer) {
    const entry = loneDotsAnswer?.[atomId];
    if (typeof entry === "number") return entry;
    if (entry && typeof entry.total === "number") return entry.total;
    if (entry && typeof entry === "object") {
      return Object.values(entry).reduce((sum, value) => sum + value, 0);
    }
    return 0;
  }

  function countCentralElectrons(variant, molecule) {
    const centralIndex = getCentralIndex(molecule);
    const centralAtom = molecule.atoms[centralIndex];
    if (!centralAtom) return null;

    const bondElectrons = Object.entries(variant.bonds || {}).reduce(
      (sum, [key, order]) => {
        const parts = key.split("-").map((part) => Number.parseInt(part, 10));
        if (
          parts.length !== 2 ||
          parts.some((part) => !Number.isInteger(part)) ||
          !parts.includes(centralIndex)
        ) {
          return sum;
        }
        return sum + order * 2;
      },
      0,
    );

    return bondElectrons + getLoneDotTotal(centralAtom.id, variant.loneDots || {});
  }

  function isOctetCompliantCentral(variant, molecule) {
    const electrons = countCentralElectrons(variant, molecule);
    return electrons === 8;
  }

  function isElectronDeficientCentral(variant, molecule) {
    const centralIndex = getCentralIndex(molecule);
    const centralAtom = molecule.atoms[centralIndex];
    if (!centralAtom || !ELECTRON_DEFICIENT_CENTRAL_ATOMS.has(centralAtom.symbol)) {
      return false;
    }

    const electrons = countCentralElectrons(variant, molecule);
    return electrons != null && electrons < 8;
  }

  /**
   * Prefer an octet-compliant form for Reveal / example diagrams so beginners
   * see the clearest teaching structure. Fall back to intentional B/Be
   * electron-deficient forms, then the first listed variant (expanded-only).
   * Expanded-octet alternatives remain accepted for grading when listed.
   */
  function getPreferredExampleVariant(molecule) {
    const variants = getAnswerVariants(molecule);
    if (variants.length === 0) return null;

    const octet = variants.find((variant) =>
      isOctetCompliantCentral(variant, molecule),
    );
    if (octet) return octet;

    const deficient = variants.find((variant) =>
      isElectronDeficientCentral(variant, molecule),
    );
    if (deficient) return deficient;

    return variants[0];
  }

  return {
    getCentralIndex,
    getPeripheralIndices,
    getExpectedBondKeys,
    bondKeyForPair,
    buildBondsFromOrders,
    buildLoneDotsFromPattern,
    permuteOrders,
    variantSignature,
    dedupeVariants,
    expandPattern,
    expandPatterns,
    getAnswerVariants,
    getLoneDotTotal,
    countCentralElectrons,
    isOctetCompliantCentral,
    isElectronDeficientCentral,
    getPreferredExampleVariant,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = LewisAnswers;
}

if (typeof window !== "undefined") {
  window.LewisAnswers = LewisAnswers;
}
