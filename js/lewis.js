const loadingScreen = document.getElementById("loading-screen");
const errorEl = document.getElementById("lewis-error");
const errorMessageEl = document.getElementById("lewis-error-message");
const contentEl = document.getElementById("lewis-content");
const formulaEl = document.getElementById("lewis-formula");
const boardEl = document.getElementById("lewis-board");
const ionDisplayEl = document.getElementById("lewis-ion-display");
const ionChargeEl = document.getElementById("lewis-ion-charge");
const feedbackEl = document.getElementById("lewis-feedback");
const checkBtn = document.getElementById("lewis-check-btn");
const diagramSkipBtn = document.getElementById("lewis-diagram-skip-btn");
const resetBtn = document.getElementById("lewis-reset-btn");
const continueBtn = document.getElementById("continue-btn");
const skipBtn = document.getElementById("skip-btn");
const progressBar = document.getElementById("progress-bar");
const questionProgress = document.getElementById("question-progress");
const scoreDisplay = document.getElementById("score");
const totalDisplay = document.getElementById("total");
const questionArea = document.getElementById("lewis-question-area");
const workspaceEl = document.querySelector(".lewis-workspace");
const boardWrapEl = document.querySelector(".lewis-board-wrap");
const instructionContainer = document.querySelector(".instruction-container");
const finalScreen = document.getElementById("final-screen");
const finalHeading = document.getElementById("final-heading");
const finalTier = document.getElementById("final-tier");
const finalScore = document.getElementById("final-score");
const finalDetail = document.getElementById("final-detail");
const retryBtn = document.getElementById("retry-btn");
const modeScreen = document.getElementById("lewis-mode-screen");
const browseScreen = document.getElementById("lewis-browse-screen");
const browseBackBtn = document.getElementById("lewis-browse-back-btn");
const browseRecentSection = document.getElementById("lewis-browse-recent");
const browseRecentList = document.getElementById("lewis-browse-recent-list");
const browseAllList = document.getElementById("lewis-browse-all-list");
const browseSearchInput = document.getElementById("lewis-browse-search");
const browseCountEl = document.getElementById("lewis-browse-count");
const browseEmptyEl = document.getElementById("lewis-browse-empty");
const browseDifficultyFiltersEl = document.getElementById(
  "lewis-browse-difficulty-filters",
);
const browseStructuresBtn = document.getElementById("lewis-browse-structures-btn");
const browseStyleInputs = document.querySelectorAll('input[name="browse-style"]');
const modeBadge = document.getElementById("mode-badge");
const stageStepper = document.getElementById("lewis-stage-stepper");
const electronsStage = document.getElementById("lewis-electrons-stage");
const analysisStage = document.getElementById("lewis-analysis-stage");
const valenceQuestion = document.getElementById("lewis-valence-question");
const valenceInput = document.getElementById("lewis-valence-input");
const valenceCheckBtn = document.getElementById("lewis-valence-check-btn");
const analysisCheckBtn = document.getElementById("lewis-analysis-check-btn");
const analysisReferenceWrap = document.getElementById("lewis-analysis-reference-board-wrap");
const electronDomainsInput = document.getElementById("lewis-electron-domains");
const instructionText = document.getElementById("instruction-text");
const taskHeader = document.getElementById("lewis-task-header");
const electronCounter = document.getElementById("lewis-electron-counter");

let toolData = null;
let allMolecules = [];
let browseMolecules = [];
let sessionMolecules = [];
let practiceMode = "structure";
let browsePracticeStyle = "structure";
let browseDifficultyFilter = "all";
let currentStage = "diagram";
let current = 0;
let correctCount = 0;
let answeredCount = 0;
let skippedCount = 0;
let currentMolecule = null;
let bondState = {};
let loneState = {};
let selectedTool = null;
let questionLocked = false;
let skippedCurrent = false;
let sessionValenceCount = null;
let valenceStepCorrect = null;

const MAX_BONDS = 3;
const MAX_DOTS = 8;
const MAX_CIRCLE_DOTS = 2;
const LONE_PAIR_DOTS = 2;

const SLOT_DIRECTION_LABELS = {
  north: "above",
  south: "below",
  west: "left of",
  east: "right of",
  northwest: "upper-left of",
  northeast: "upper-right of",
  southwest: "lower-left of",
  southeast: "lower-right of",
};

const DIAGONAL_DIRECTIONS = new Set([
  "northwest",
  "northeast",
  "southwest",
  "southeast",
]);

const LEWIS_ATOM_SLOT_RATIO = 44 / 48;
const LEWIS_CIRCLE_SLOT_SCALE = 0.85;

const DIAGONAL_CONNECTOR_CORNERS = {
  northwest: { ax: -1, ay: -1, sx: 1, sy: 1 },
  northeast: { ax: 1, ay: -1, sx: -1, sy: 1 },
  southwest: { ax: -1, ay: 1, sx: 1, sy: -1 },
  southeast: { ax: 1, ay: 1, sx: -1, sy: -1 },
};

function circleRadiusGrid() {
  return LEWIS_CIRCLE_SLOT_SCALE / 2;
}

const OCTAHEDRAL_HUB_DIAGONAL_ANGLE_DEG = 30;
const OCTAHEDRAL_HUB_DIAGONAL_REACH = 2;

function computePolarDiagonalLayout(layout, molecule = null) {
  const slotAngles = molecule ? getHubDiagonalSlotAngles(molecule) : null;
  const angleDeg =
    slotAngles?.northeast != null
      ? 90 - slotAngles.northeast
      : layout.diagonalAngle ?? OCTAHEDRAL_HUB_DIAGONAL_ANGLE_DEG;
  const diagonalRotation = molecule ? getHubDiagonalRotation(molecule) : 0;

  if (layout.diagonalReach != null) {
    return {
      ...layout,
      diagonalAngle: angleDeg,
      diagonalRotation,
      diagonalReach: layout.diagonalReach,
      slotAngles,
    };
  }

  const r = (layout.circleScale ?? LEWIS_CIRCLE_SLOT_SCALE) / 2;
  const halfSpan = layout.columns / 2;
  const maxReach = halfSpan - r;
  const hintRad = (angleDeg * Math.PI) / 180;
  const reach = Math.min(r / Math.cos(hintRad), maxReach);
  const fittedAngleDeg = (Math.acos(Math.min(1, r / reach)) * 180) / Math.PI;

  return {
    ...layout,
    diagonalAngle: fittedAngleDeg,
    diagonalRotation,
    diagonalReach: reach,
    slotAngles,
  };
}

function normalizeHubAngle(deg) {
  let angle = deg % 360;
  if (angle > 180) angle -= 360;
  if (angle <= -180) angle += 360;
  return angle;
}

function spokeBisector(leftDeg, rightDeg) {
  let left = leftDeg;
  let right = rightDeg;
  if (right < left) right += 360;
  return normalizeHubAngle((left + right) / 2);
}

function getSpokeAngles(molecule) {
  const ligandCount = molecule.atoms.length - 1;
  const spokeStep = 360 / ligandCount;
  const { angleOffset } = getRadialRingAngleOptions(molecule);

  return Array.from({ length: ligandCount }, (_, i) =>
    normalizeHubAngle(i * spokeStep - 90 + angleOffset),
  );
}

function symmetricHubSlotAngles(alpha) {
  const upper = 90 - alpha;
  const lower = 180 - upper;

  return {
    northeast: upper,
    northwest: -upper,
    southeast: lower,
    southwest: -lower,
  };
}

function getHubDiagonalSlotAngles(molecule) {
  if (molecule.hubDiagonalSlotAngles) {
    return { ...molecule.hubDiagonalSlotAngles };
  }

  const ligandCount = molecule.atoms.length - 1;
  if (!isRadialLayout(molecule) || ligandCount <= 0) {
    return symmetricHubSlotAngles(OCTAHEDRAL_HUB_DIAGONAL_ANGLE_DEG);
  }

  if (
    Number.isInteger(molecule.northLigandIndex) ||
    isTrigonalBipyramidalLayout(molecule)
  ) {
    const spokes = getSpokeAngles(molecule);
    const bisectors = spokes.map((angle, i) =>
      spokeBisector(angle, spokes[(i + 1) % ligandCount]),
    );

    const northeast = bisectors.find((angle) => angle > 0 && angle < 90);
    const northwest = bisectors.find((angle) => angle < 0 && angle > -90);
    const southeast = bisectors.find((angle) => angle >= 90 && angle < 180);
    const southwest = bisectors.find((angle) => angle <= -90);

    return { northeast, northwest, southeast, southwest };
  }

  const alpha = Number.isFinite(molecule.hubDiagonalAngle)
    ? molecule.hubDiagonalAngle
    : OCTAHEDRAL_HUB_DIAGONAL_ANGLE_DEG;

  return symmetricHubSlotAngles(alpha);
}

function unitRayFromNorthAngle(angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;

  return {
    ux: Math.sin(rad),
    uy: -Math.cos(rad),
  };
}

function hubDiagonalRay(direction, layout) {
  const slotAngle = layout.slotAngles?.[direction];
  if (slotAngle != null) {
    return unitRayFromNorthAngle(slotAngle);
  }

  return diagonalUnitRay(
    direction,
    layout.diagonalAngle,
    layout.diagonalRotation ?? 0,
  );
}

function rotateUnitRay(ux, uy, rotationDeg) {
  if (!rotationDeg) {
    return { ux, uy };
  }

  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return {
    ux: ux * cos - uy * sin,
    uy: ux * sin + uy * cos,
  };
}

function diagonalUnitRay(direction, angleDeg, rotationDeg = 0) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rays = {
    northeast: { ux: cos, uy: -sin },
    northwest: { ux: -cos, uy: -sin },
    southeast: { ux: cos, uy: sin },
    southwest: { ux: -cos, uy: sin },
  };

  return rotateUnitRay(rays[direction].ux, rays[direction].uy, rotationDeg);
}

const SLOT_LAYOUTS = {
  compact: {
    columns: 3,
    rows: 3,
    atom: { col: 1, row: 1 },
    slots: [
      { direction: "north", col: 1, row: 0, shape: "square" },
      { direction: "south", col: 1, row: 2, shape: "square" },
      { direction: "west", col: 0, row: 1, shape: "square", terminal: "first" },
      { direction: "east", col: 2, row: 1, shape: "square", terminal: "last" },
    ],
  },
  compactLinearFirst: {
    columns: 2,
    rows: 3,
    atom: { col: 1, row: 1 },
    slots: [
      { direction: "north", col: 1, row: 0, shape: "square" },
      { direction: "south", col: 1, row: 2, shape: "square" },
      { direction: "west", col: 0, row: 1, shape: "square" },
    ],
  },
  compactLinearLast: {
    columns: 2,
    rows: 3,
    atom: { col: 0, row: 1 },
    slots: [
      { direction: "north", col: 0, row: 0, shape: "square" },
      { direction: "south", col: 0, row: 2, shape: "square" },
      { direction: "east", col: 1, row: 1, shape: "square" },
    ],
  },
  expanded: {
    columns: 3,
    rows: 3,
    atom: { col: 1, row: 1 },
    slots: [
      { direction: "northwest", col: 0, row: 0, shape: "circle" },
      { direction: "north", col: 1, row: 0, shape: "square" },
      { direction: "northeast", col: 2, row: 0, shape: "circle" },
      { direction: "southwest", col: 0, row: 2, shape: "circle" },
      { direction: "south", col: 1, row: 2, shape: "square" },
      { direction: "southeast", col: 2, row: 2, shape: "circle" },
    ],
  },
  octahedralCentral: {
    columns: 3,
    rows: 3,
    atom: { col: 1, row: 1 },
    circleScale: 0.72,
    diagonalAngle: OCTAHEDRAL_HUB_DIAGONAL_ANGLE_DEG,
    diagonalReach: OCTAHEDRAL_HUB_DIAGONAL_REACH,
    slots: [
      { direction: "northwest", shape: "circle", polar: true },
      { direction: "northeast", shape: "circle", polar: true },
      { direction: "southwest", shape: "circle", polar: true },
      { direction: "southeast", shape: "circle", polar: true },
    ],
  },
  octahedralLigand: {
    columns: 3,
    rows: 3,
    atom: { col: 1, row: 1 },
    slots: [
      { direction: "north", col: 1, row: 0, shape: "square" },
      { direction: "west", col: 0, row: 1, shape: "square" },
      { direction: "east", col: 2, row: 1, shape: "square" },
    ],
  },
  trigonalCentral: {
    columns: 3,
    rows: 3,
    atom: { col: 1, row: 1 },
    bondSlots: [
      { col: 0, row: 1, peripheralIndex: 1, direction: "west" },
      { col: 2, row: 1, peripheralIndex: 2, direction: "east" },
      { col: 1, row: 2, peripheralIndex: 3, direction: "south" },
    ],
    slots: [{ direction: "north", col: 1, row: 0, shape: "square" }],
  },
  trigonalCentralExpanded: {
    columns: 3,
    rows: 3,
    atom: { col: 1, row: 1 },
    bondSlots: [
      { col: 0, row: 1, peripheralIndex: 1, direction: "west" },
      { col: 2, row: 1, peripheralIndex: 2, direction: "east" },
      { col: 1, row: 2, peripheralIndex: 3, direction: "south" },
    ],
    slots: [
      { direction: "northwest", col: 0, row: 0, shape: "circle" },
      { direction: "north", col: 1, row: 0, shape: "square" },
      { direction: "northeast", col: 2, row: 0, shape: "circle" },
      { direction: "southwest", col: 0, row: 2, shape: "circle" },
      { direction: "southeast", col: 2, row: 2, shape: "circle" },
    ],
  },
  trigonalLigandWest: {
    columns: 2,
    rows: 3,
    atom: { col: 1, row: 1 },
    slots: [
      { direction: "north", col: 1, row: 0, shape: "square" },
      { direction: "west", col: 0, row: 1, shape: "square" },
      { direction: "south", col: 1, row: 2, shape: "square" },
    ],
  },
  trigonalLigandEast: {
    columns: 2,
    rows: 3,
    atom: { col: 0, row: 1 },
    slots: [
      { direction: "north", col: 0, row: 0, shape: "square" },
      { direction: "east", col: 1, row: 1, shape: "square" },
      { direction: "south", col: 0, row: 2, shape: "square" },
    ],
  },
  trigonalLigandSouth: {
    columns: 3,
    rows: 2,
    atom: { col: 1, row: 0 },
    slots: [
      { direction: "west", col: 0, row: 0, shape: "square" },
      { direction: "east", col: 2, row: 0, shape: "square" },
      { direction: "south", col: 1, row: 1, shape: "square" },
    ],
  },
};

function getOctahedralLigandAngle(ligandIndex, ligandCount, options = {}) {
  const topLigandIndex = options.topLigandIndex ?? 0;
  const angleOffset = options.angleOffset ?? 0;
  const normalizedTop =
    ((topLigandIndex % ligandCount) + ligandCount) % ligandCount;
  const adjustedIndex =
    (ligandIndex - normalizedTop + ligandCount) % ligandCount;

  return (adjustedIndex * 360) / ligandCount - 90 + angleOffset;
}

function getRadialRingAngleOptions(molecule) {
  const ligandCount = molecule.atoms.length - 1;
  const options = {
    topLigandIndex: molecule.topSpokeLigand ?? 0,
    angleOffset: molecule.ringAngleOffset ?? 0,
  };

  if (Number.isInteger(molecule.northLigandIndex)) {
    const northIndex =
      ((molecule.northLigandIndex % ligandCount) + ligandCount) % ligandCount;

    // Spoke angles use rotate(angle) then translateY(-radius); 0° is north.
    options.topLigandIndex = 0;
    options.angleOffset = 90 - (northIndex * 360) / ligandCount;
  } else if (isTrigonalBipyramidalLayout(molecule)) {
    // Default: first peripheral atom is the north axial ligand.
    options.topLigandIndex = 0;
    options.angleOffset = 90;
  }

  return options;
}

function getHubDiagonalRotation(molecule) {
  if (Number.isFinite(molecule.hubDiagonalRotation)) {
    return molecule.hubDiagonalRotation;
  }

  return 0;
}

function isRadialLayout(molecule) {
  const layout = molecule?.layout;
  return (
    layout === "octahedral" ||
    layout === "tetrahedral" ||
    layout === "trigonal_bipyramidal"
  );
}

function isTrigonalBipyramidalLayout(molecule) {
  return molecule?.layout === "trigonal_bipyramidal";
}

function isTrigonalPlanarLayout(molecule) {
  return molecule?.layout === "trigonal_planar";
}

function usesWideDiagramLayout(molecule) {
  return isRadialLayout(molecule) || isTrigonalPlanarLayout(molecule);
}

function getTrigonalLigandLayoutKey(atomIndex) {
  const layouts = {
    1: "trigonalLigandWest",
    2: "trigonalLigandEast",
    3: "trigonalLigandSouth",
  };

  return layouts[atomIndex] || "trigonalLigandWest";
}

const PRACTICE_MODES = {
  structure: "structure",
  full: "full",
  browse: "browse",
};

const BROWSE_PRACTICE_STYLES = {
  structure: "structure",
  full: "full",
};

/*
 * Browse difficulty tiers — subjective, holistic load for drawing + analysis.
 * Each molecule sets "difficulty" in lewis_structures.json. We avoid feature
 * tags (resonance, ion, octahedral, etc.) in the UI because they hint at answers.
 *
 * Easy:   Small/simple structures; one clear Lewis form; familiar shapes
 *         (linear, trig planar, tetrahedral) without expanded central hubs.
 * Medium: Resonance or multiple valid Lewis forms, ion charge accounting, or
 *         bent/pyramidal shapes from central lone pairs.
 * Hard:   Expanded central lone slots, hypervalent centers (5–6 domains),
 *         unusual layouts (octahedral / trigonal bipyramidal hub, T-shaped geometry), or dense analysis.
 *
 * Keep JSON assignments in sync when adding molecules:
 *   easy:   co2, bcl3, cbr4, cnbr, nf3, nh4_plus, bf4_minus
 *   medium: so2, no2_minus, no3_minus, so3, so4_minus, nocl, si2, clf2_plus, socl2, pobr3, so2f2
 *   hard:   xecl2, clf2_minus, asf6_minus, brf3, xef4, scl4, sbcl4_minus, pcl5
 */
const BROWSE_DIFFICULTIES = [
  { value: "easy", label: "Easy", chipClass: "easy" },
  { value: "medium", label: "Medium", chipClass: "medium" },
  { value: "hard", label: "Hard", chipClass: "hard" },
];

const RECENT_LEWIS_KEY = "stemStudyBuddy.lewisRecentStructures";
const BROWSE_STYLE_KEY = "stemStudyBuddy.lewisBrowseStyle";
const MAX_RECENT_LEWIS = 8;

const STAGES = {
  electrons: "electrons",
  diagram: "diagram",
  analysis: "analysis",
};

const ELECTRON_GEOMETRY_OPTIONS = [
  { value: "linear", label: "Linear" },
  { value: "trigonal_planar", label: "Trigonal planar" },
  { value: "tetrahedral", label: "Tetrahedral" },
  { value: "trigonal_bipyramidal", label: "Trigonal bipyramidal" },
  { value: "octahedral", label: "Octahedral" },
];

const MOLECULAR_GEOMETRY_OPTIONS = [
  { value: "linear", label: "Linear" },
  { value: "trigonal_planar", label: "Trigonal planar" },
  { value: "tetrahedral", label: "Tetrahedral" },
  { value: "trigonal_pyramidal", label: "Trigonal pyramidal" },
  { value: "bent", label: "Bent" },
  { value: "t_shaped", label: "T-shaped" },
  { value: "seesaw", label: "Seesaw" },
  { value: "square_planar", label: "Square planar" },
  { value: "trigonal_bipyramidal", label: "Trigonal bipyramidal" },
  { value: "square_pyramidal", label: "Square pyramidal" },
  { value: "octahedral", label: "Octahedral" },
];

const POLARITY_OPTIONS = [
  { value: "polar", label: "Polar" },
  { value: "nonpolar", label: "Nonpolar" },
];

const HYBRIDIZATION_OPTIONS = [
  { value: "sp", label: "sp" },
  { value: "sp2", label: "sp²" },
  { value: "sp3", label: "sp³" },
  { value: "sp3d", label: "sp³d" },
  { value: "sp3d2", label: "sp³d²" },
];

const ANALYSIS_OPTION_MAP = {
  electronGeometry: ELECTRON_GEOMETRY_OPTIONS,
  molecularGeometry: MOLECULAR_GEOMETRY_OPTIONS,
  polarity: POLARITY_OPTIONS,
  hybridization: HYBRIDIZATION_OPTIONS,
};

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getScoreTier(percent) {
  if (percent >= 90) {
    return { emoji: "🌟", message: "Excellent work!" };
  }
  if (percent >= 70) {
    return {
      emoji: "👍",
      message: "Solid effort — review any misses to lock it in.",
    };
  }
  if (percent >= 50) {
    return {
      emoji: "📚",
      message: "Good progress — focus on the structures you missed.",
    };
  }
  return {
    emoji: "💪",
    message: "Keep going — practice builds fluency with Lewis diagrams.",
  };
}

function showError(message) {
  loadingScreen.classList.add("hidden");
  modeScreen.classList.add("hidden");
  contentEl.classList.add("hidden");
  errorEl.classList.remove("hidden");
  errorMessageEl.textContent = message;
}

function isBrowseMode() {
  return practiceMode === PRACTICE_MODES.browse;
}

function getBrowseStyleFromStorage() {
  const stored = localStorage.getItem(BROWSE_STYLE_KEY);
  if (stored === BROWSE_PRACTICE_STYLES.full) {
    return BROWSE_PRACTICE_STYLES.full;
  }

  return BROWSE_PRACTICE_STYLES.structure;
}

function saveBrowseStyle() {
  localStorage.setItem(BROWSE_STYLE_KEY, browsePracticeStyle);
}

function syncBrowseStyleInputs() {
  browseStyleInputs.forEach((input) => {
    input.checked = input.value === browsePracticeStyle;
  });
}

function readRecentLewisStructures() {
  try {
    const raw = localStorage.getItem(RECENT_LEWIS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry) => entry && typeof entry.id === "string");
  } catch {
    return [];
  }
}

function recordRecentLewisStructure(molecule) {
  if (!molecule?.id) return;

  const recent = readRecentLewisStructures().filter((entry) => entry.id !== molecule.id);
  recent.unshift({
    id: molecule.id,
    formula: molecule.formula,
    name: molecule.name || molecule.formula,
    visitedAt: Date.now(),
  });

  localStorage.setItem(
    RECENT_LEWIS_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT_LEWIS)),
  );
}

function findMoleculeById(moleculeId) {
  if (!moleculeId) return null;

  return allMolecules.find((molecule) => molecule.id === moleculeId) || null;
}

function getBrowsePracticeLabel() {
  return isFullAnalysisMode() ? "Full analysis" : "Structure only";
}

function updateBrowseURL(moleculeId) {
  const params = new URLSearchParams();
  params.set("molecule", moleculeId);
  params.set("practice", browsePracticeStyle);
  history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
}

function clearBrowseURL() {
  history.replaceState(null, "", window.location.pathname);
}

function parseDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const practice = params.get("practice")?.toLowerCase();

  return {
    moleculeId: params.get("molecule")?.toLowerCase() || "",
    practice:
      practice === BROWSE_PRACTICE_STYLES.full
        ? BROWSE_PRACTICE_STYLES.full
        : BROWSE_PRACTICE_STYLES.structure,
  };
}

function compareBrowseMolecules(a, b) {
  const nameA = (a.name || a.formula).toLowerCase();
  const nameB = (b.name || b.formula).toLowerCase();
  return nameA.localeCompare(nameB);
}

function createBrowseItemButton(molecule) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lewis-browse-item";
  button.dataset.moleculeId = molecule.id;

  const formula = document.createElement("span");
  formula.className = "lewis-browse-item-formula";
  formula.textContent = molecule.formula;

  const name = document.createElement("span");
  name.className = "lewis-browse-item-name";
  name.textContent = molecule.name || molecule.formula;

  button.append(formula, name);
  button.addEventListener("click", () => startBrowseMolecule(molecule));
  return button;
}

function getBrowseEligibleMolecules() {
  if (browsePracticeStyle === BROWSE_PRACTICE_STYLES.full) {
    return browseMolecules.filter(
      (molecule) => molecule.valenceElectrons && molecule.analysis,
    );
  }

  return browseMolecules;
}

function matchesBrowseSearch(molecule, query) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const haystack = [
    molecule.id,
    molecule.name,
    molecule.formula,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(trimmed);
}

function getBrowseDisplayMolecules(eligible, query) {
  const searchFiltered = eligible.filter((molecule) =>
    matchesBrowseSearch(molecule, query),
  );

  if (browseDifficultyFilter === "all") {
    return searchFiltered;
  }

  return searchFiltered.filter(
    (molecule) => molecule.difficulty === browseDifficultyFilter,
  );
}

function syncBrowseDifficultyChips() {
  if (!browseDifficultyFiltersEl) return;

  browseDifficultyFiltersEl.querySelectorAll(".quiz-filter-chip").forEach((chip) => {
    const isActive = chip.dataset.difficulty === browseDifficultyFilter;
    chip.classList.toggle("quiz-filter-chip--active", isActive);
    chip.setAttribute("aria-pressed", String(isActive));
  });
}

function setupBrowseDifficultyFilters() {
  if (!browseDifficultyFiltersEl || browseDifficultyFiltersEl.dataset.ready === "true") {
    return;
  }

  browseDifficultyFiltersEl.dataset.ready = "true";

  const chips = [
    { value: "all", label: "All", chipClass: "all" },
    ...BROWSE_DIFFICULTIES,
  ];

  chips.forEach(({ value, label, chipClass }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `quiz-filter-chip quiz-filter-chip--browse-${chipClass}`;
    button.dataset.difficulty = value;
    button.textContent = label;
    button.setAttribute("aria-pressed", value === browseDifficultyFilter ? "true" : "false");

    if (value === browseDifficultyFilter) {
      button.classList.add("quiz-filter-chip--active");
    }

    button.addEventListener("click", () => {
      browseDifficultyFilter = value;
      syncBrowseDifficultyChips();
      renderBrowsePicker();
    });

    browseDifficultyFiltersEl.append(button);
  });
}

function createBrowseDifficultyChip(label, chipClass) {
  const chip = document.createElement("span");
  chip.className = `lewis-browse-difficulty-chip lewis-browse-difficulty-chip--${chipClass}`;
  chip.textContent = label;
  return chip;
}

function renderBrowsePicker() {
  setupBrowseDifficultyFilters();
  syncBrowseStyleInputs();

  const eligible = getBrowseEligibleMolecules();
  const query = browseSearchInput?.value || "";
  const displayMolecules = getBrowseDisplayMolecules(eligible, query);
  const searchFiltered = eligible.filter((molecule) =>
    matchesBrowseSearch(molecule, query),
  );

  if (browseCountEl) {
    const totalShown = displayMolecules.length;
    const searchTotal = searchFiltered.length;

    browseCountEl.textContent =
      totalShown === searchTotal && searchTotal === eligible.length
        ? `(${eligible.length})`
        : `(${totalShown} of ${eligible.length})`;
  }

  browseAllList.replaceChildren();
  browseEmptyEl?.classList.toggle("hidden", displayMolecules.length > 0);

  const tiersToShow =
    browseDifficultyFilter === "all"
      ? BROWSE_DIFFICULTIES
      : BROWSE_DIFFICULTIES.filter(
          (tier) => tier.value === browseDifficultyFilter,
        );

  tiersToShow.forEach(({ value, label, chipClass }) => {
    const groupMolecules = displayMolecules
      .filter((molecule) => molecule.difficulty === value)
      .sort(compareBrowseMolecules);

    if (groupMolecules.length === 0) {
      return;
    }

    const group = document.createElement("div");
    group.className = "lewis-browse-group";

    const title = document.createElement("h4");
    title.className = "lewis-browse-group-title";
    title.append(createBrowseDifficultyChip(label, chipClass));

    const list = document.createElement("div");
    list.className = "lewis-browse-list";

    groupMolecules.forEach((molecule) => {
      list.append(createBrowseItemButton(molecule));
    });

    group.append(title, list);
    browseAllList.append(group);
  });

  const recentEntries = readRecentLewisStructures();
  browseRecentList.replaceChildren();

  const recentMolecules = recentEntries
    .map((entry) => findMoleculeById(entry.id))
    .filter((molecule) => molecule && eligible.some((item) => item.id === molecule.id));

  if (recentMolecules.length === 0) {
    browseRecentSection.classList.add("hidden");
  } else {
    browseRecentSection.classList.remove("hidden");
    recentMolecules.forEach((molecule) => {
      browseRecentList.append(createBrowseItemButton(molecule));
    });
  }
}

function showBrowsePicker() {
  practiceMode = PRACTICE_MODES.browse;
  modeScreen.classList.add("hidden");
  browseScreen.classList.remove("hidden");
  contentEl.classList.add("hidden");
  finalScreen.style.display = "none";
  clearBrowseURL();
  browseDifficultyFilter = "all";
  if (browseSearchInput) {
    browseSearchInput.value = "";
  }
  syncBrowseDifficultyChips();
  renderBrowsePicker();
}

function hideBrowsePicker() {
  browseScreen.classList.add("hidden");
}

function applyBrowseSessionUI() {
  const scoreEl = scoreDisplay.closest(".score");

  if (isBrowseMode()) {
    scoreEl?.classList.add("hidden");
    browseStructuresBtn.classList.remove("hidden");
    skipBtn.classList.add("hidden");
    modeBadge.textContent = `Browse · ${getBrowsePracticeLabel()}`;
    modeBadge.classList.remove("hidden");
    return;
  }

  scoreEl?.classList.remove("hidden");
  browseStructuresBtn.classList.add("hidden");
  skipBtn.classList.remove("hidden");
}

function startBrowseMolecule(molecule) {
  if (!molecule) return;

  const checkedStyle = document.querySelector('input[name="browse-style"]:checked');
  if (checkedStyle) {
    browsePracticeStyle = checkedStyle.value;
    saveBrowseStyle();
  }

  if (isFullAnalysisMode() && (!molecule.valenceElectrons || !molecule.analysis)) {
    return;
  }

  practiceMode = PRACTICE_MODES.browse;
  recordRecentLewisStructure(molecule);
  updateBrowseURL(molecule.id);

  hideBrowsePicker();
  modeScreen.classList.add("hidden");
  contentEl.classList.remove("hidden");
  finalScreen.style.display = "none";

  resetRunState();
  sessionMolecules = [molecule];
  current = 0;
  currentStage = isFullAnalysisMode() ? STAGES.electrons : STAGES.diagram;

  showActiveUI();
  applyBrowseSessionUI();
  loadQuestion();
}

function returnToBrowsePicker() {
  hideActiveUI();
  contentEl.classList.add("hidden");
  browseStructuresBtn.classList.add("hidden");
  showBrowsePicker();
}

function exitBrowseToModes() {
  hideBrowsePicker();
  modeScreen.classList.remove("hidden");
  practiceMode = PRACTICE_MODES.structure;
  clearBrowseURL();
}

function tryApplyDeepLink() {
  const { moleculeId, practice } = parseDeepLink();
  if (!moleculeId) return false;

  const molecule = findMoleculeById(moleculeId);
  if (!molecule) return false;

  browsePracticeStyle = practice;
  saveBrowseStyle();
  startBrowseMolecule(molecule);
  return true;
}

function isFullAnalysisMode() {
  if (isBrowseMode()) {
    return browsePracticeStyle === BROWSE_PRACTICE_STYLES.full;
  }

  return practiceMode === PRACTICE_MODES.full;
}

function fillAnalysisSelect(selectEl, options) {
  selectEl.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select…";
  selectEl.appendChild(placeholder);

  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    selectEl.appendChild(item);
  });
}

function populateAnalysisSelects() {
  fillAnalysisSelect(
    document.getElementById("lewis-electron-geometry"),
    ELECTRON_GEOMETRY_OPTIONS
  );
  fillAnalysisSelect(
    document.getElementById("lewis-molecular-geometry"),
    MOLECULAR_GEOMETRY_OPTIONS
  );
  fillAnalysisSelect(
    document.getElementById("lewis-polarity"),
    POLARITY_OPTIONS
  );
  fillAnalysisSelect(
    document.getElementById("lewis-hybridization"),
    HYBRIDIZATION_OPTIONS
  );
}

function normalizeBondAngles(value) {
  const angles = Array.isArray(value) ? value : [value];
  return angles.map((angle) => String(angle)).sort((a, b) => Number(a) - Number(b));
}

function getSelectedBondAngles() {
  return [
    ...document.querySelectorAll('input[name="bondAngle"]:checked'),
  ].map((input) => input.value);
}

function bondAnglesMatch(selected, expected) {
  const normalizedSelected = [...selected].sort((a, b) => Number(a) - Number(b));
  const normalizedExpected = normalizeBondAngles(expected);

  if (normalizedSelected.length !== normalizedExpected.length) {
    return false;
  }

  return normalizedSelected.every(
    (angle, index) => angle === normalizedExpected[index]
  );
}

function formatBondAngles(value) {
  const angles = normalizeBondAngles(value);

  if (angles.length === 0) {
    return "";
  }

  if (angles.length === 1) {
    return `${angles[0]}°`;
  }

  return angles.map((angle) => `${angle}°`).join(", ");
}

function formatDistortion(value) {
  return value ? "yes" : "no";
}

function formatAnalysisAnswer(field, value) {
  const options = ANALYSIS_OPTION_MAP[field] || [];
  const match = options.find((option) => option.value === value);
  return match ? match.label : value;
}

function getCentralAtom(molecule) {
  const atomId = molecule.analysis?.centralAtom;
  if (!atomId) return null;
  return molecule.atoms.find((atom) => atom.id === atomId) || null;
}

function setupValenceStage() {
  const prompt = `How many valence electrons does ${currentMolecule.formula} have?`;
  valenceQuestion.textContent = prompt;
  if (typeof setStemText === "function") {
    setStemText(valenceQuestion, prompt);
  }
  valenceInput.value = "";
  valenceInput.disabled = false;
  valenceCheckBtn.disabled = false;
  instructionText.textContent =
    "Add valence electrons from each atom, then adjust for any ion charge.";
  valenceInput.focus();
}

function resetAnalysisForm() {
  document.getElementById("lewis-analysis-form").reset();
  clearAnalysisFieldStates();
  document
    .querySelectorAll("#lewis-analysis-form select")
    .forEach((select) => {
      select.disabled = false;
    });
  document
    .querySelectorAll(
      '#lewis-analysis-form input[type="radio"], #lewis-analysis-form input[type="checkbox"]'
    )
    .forEach((input) => {
      input.disabled = false;
    });
  if (electronDomainsInput) {
    electronDomainsInput.disabled = false;
  }
  analysisCheckBtn.disabled = false;

  instructionText.textContent =
    "Count bonding and lone-pair domains on the central atom, then determine geometry, polarity, whether lone pairs distort the angle, hybridization, and ideal bond angle.";
  renderAnalysisReferenceDiagram();
}

function renderAnalysisReferenceDiagram() {
  if (!analysisReferenceWrap || !currentMolecule) return;

  analysisReferenceWrap.replaceChildren();
  analysisReferenceWrap.classList.toggle(
    "lewis-board-wrap--octahedral",
    usesWideDiagramLayout(currentMolecule)
  );

  const { frame, body } = createDiagramFrame(currentMolecule);
  if (usesWideDiagramLayout(currentMolecule)) {
    frame.classList.add("lewis-ion-display--octahedral");
  }

  const referenceBoard = document.createElement("div");
  referenceBoard.setAttribute("aria-label", "Reference Lewis diagram");
  populateBoard(
    referenceBoard,
    currentMolecule,
    buildExampleState(currentMolecule),
    { readonly: true }
  );
  body.appendChild(referenceBoard);
  analysisReferenceWrap.appendChild(frame);
}

function clearAnalysisFieldStates() {
  document.querySelectorAll(".lewis-analysis-field").forEach((field) => {
    field.classList.remove(
      "lewis-analysis-field--correct",
      "lewis-analysis-field--incorrect"
    );
  });
}

function setAnalysisFieldState(field, correct) {
  if (!field) return;
  field.classList.remove(
    "lewis-analysis-field--correct",
    "lewis-analysis-field--incorrect"
  );
  field.classList.add(
    correct ? "lewis-analysis-field--correct" : "lewis-analysis-field--incorrect"
  );
}

function applyAnalysisFieldHighlights() {
  const analysis = currentMolecule.analysis;

  const domainsField = document.querySelector(
    '[data-analysis-field="electronDomains"]'
  );
  const userDomains = Number.parseInt(electronDomainsInput?.value, 10);
  setAnalysisFieldState(
    domainsField,
    Number.isFinite(userDomains) && userDomains === analysis.electronDomains
  );

  const resonanceField = document.querySelector(
    '[data-analysis-field="resonance"]'
  );
  const resonanceValue = document.querySelector(
    'input[name="resonance"]:checked'
  )?.value;
  const expectedResonance = formatExpectedResonance(currentMolecule);
  setAnalysisFieldState(
    resonanceField,
    resonanceValue === expectedResonance
  );

  const fields = [
    { field: "electronGeometry", id: "lewis-electron-geometry" },
    { field: "molecularGeometry", id: "lewis-molecular-geometry" },
    { field: "polarity", id: "lewis-polarity" },
  ];

  fields.forEach(({ field, id }) => {
    const select = document.getElementById(id);
    const fieldEl = document.querySelector(`[data-analysis-field="${field}"]`);
    const correct = Boolean(select.value) && select.value === analysis[field];
    setAnalysisFieldState(fieldEl, correct);
  });

  const distortionField = document.querySelector(
    '[data-analysis-field="distortion"]'
  );
  const distortionValue = document.querySelector(
    'input[name="distortion"]:checked'
  )?.value;
  const expectedDistortion = analysis.distortion ? "yes" : "no";
  setAnalysisFieldState(
    distortionField,
    distortionValue === expectedDistortion
  );

  const hybridizationSelect = document.getElementById("lewis-hybridization");
  const hybridizationField = document.querySelector(
    '[data-analysis-field="hybridization"]'
  );
  setAnalysisFieldState(
    hybridizationField,
    Boolean(hybridizationSelect.value) &&
      hybridizationSelect.value === analysis.hybridization
  );

  const bondAngleField = document.querySelector(
    '[data-analysis-field="bondAngle"]'
  );
  setAnalysisFieldState(
    bondAngleField,
    bondAnglesMatch(getSelectedBondAngles(), analysis.bondAngle)
  );
}

function buildAnalysisAnswerMessages() {
  const analysis = currentMolecule.analysis;

  return [
    `Electron domains: ${analysis.electronDomains}`,
    `Resonance: ${formatExpectedResonance(currentMolecule)}`,
    `Electron geometry: ${formatAnalysisAnswer("electronGeometry", analysis.electronGeometry)}`,
    `Molecular geometry: ${formatAnalysisAnswer("molecularGeometry", analysis.molecularGeometry)}`,
    `Polarity: ${formatAnalysisAnswer("polarity", analysis.polarity)}`,
    `Bond angle distorted: ${formatDistortion(analysis.distortion)}`,
    `Hybridization: ${formatAnalysisAnswer("hybridization", analysis.hybridization)}`,
    `Ideal bond angle(s): ${formatBondAngles(analysis.bondAngle)}`,
  ];
}

function countPlacedElectrons() {
  const bondElectrons = Object.values(bondState).reduce(
    (sum, count) => sum + (count || 0) * 2,
    0
  );
  const loneElectrons = Object.values(loneState).reduce(
    (sum, count) => sum + (count || 0),
    0
  );

  return bondElectrons + loneElectrons;
}

function getDiagramElectronBudget() {
  if (Number.isFinite(sessionValenceCount) && sessionValenceCount > 0) {
    return sessionValenceCount;
  }
  return currentMolecule?.valenceElectrons ?? null;
}

function isDiagramCheckReady() {
  const budget = getDiagramElectronBudget();
  if (!Number.isFinite(budget)) {
    return true;
  }

  return countPlacedElectrons() === budget;
}

function updateDiagramActions() {
  const onDiagram = currentStage === STAGES.diagram;
  const showDiagramSkip = onDiagram && !isBrowseMode();

  diagramSkipBtn?.classList.toggle("hidden", !showDiagramSkip);

  if (!isBrowseMode()) {
    skipBtn.classList.toggle("hidden", showDiagramSkip);
    skipBtn.style.display = showDiagramSkip ? "none" : "inline-block";
  }

  updateSkipButtonLabels();

  if (!onDiagram) {
    return;
  }

  if (questionLocked) {
    checkBtn.disabled = true;
    diagramSkipBtn.disabled = true;
    return;
  }

  diagramSkipBtn.disabled = false;
  checkBtn.disabled = !isDiagramCheckReady();
}

function updateSkipButtonLabels() {
  if (isFullAnalysisMode()) {
    if (currentStage === STAGES.electrons) {
      skipBtn.textContent = "Skip to diagram";
    } else if (currentStage === STAGES.analysis) {
      skipBtn.textContent = "Next structure";
    } else {
      skipBtn.textContent = "Skip";
    }

    if (diagramSkipBtn) {
      diagramSkipBtn.textContent =
        currentStage === STAGES.diagram ? "Skip to analysis" : "Skip";
    }

    return;
  }

  skipBtn.textContent = "Skip";
  if (diagramSkipBtn) {
    diagramSkipBtn.textContent = "Skip";
  }
}

function scrollPageToTop() {
  window.scrollTo(0, 0);
}

function advanceToNextStage() {
  if (!isFullAnalysisMode()) {
    return false;
  }

  if (currentStage === STAGES.electrons) {
    if (sessionValenceCount == null) {
      captureSessionValenceCount();
    }

    currentStage = STAGES.diagram;
    resetQuestionUI();
    updateProgress();
    updateStageUI();
    scrollPageToTop();
    return true;
  }

  if (currentStage === STAGES.diagram) {
    currentStage = STAGES.analysis;
    resetQuestionUI();
    resetAnalysisForm();
    updateProgress();
    updateStageUI();
    scrollPageToTop();
    return true;
  }

  return false;
}

function updateElectronCounter() {
  const budget = getDiagramElectronBudget();
  const showCounter =
    currentStage === STAGES.diagram && Number.isFinite(budget);

  electronCounter.classList.toggle("hidden", !showCounter);
  if (!showCounter) {
    updateDiagramActions();
    return;
  }

  const used = countPlacedElectrons();
  const remaining = budget - used;

  electronCounter.textContent = `${used} of ${budget} valence electrons placed · ${remaining} remaining`;
  electronCounter.classList.toggle("lewis-electron-counter--over", used > budget);
  electronCounter.classList.toggle(
    "lewis-electron-counter--complete",
    used === budget
  );
  updateDiagramActions();
}

function captureSessionValenceCount() {
  if (valenceStepCorrect === false) {
    sessionValenceCount = currentMolecule.valenceElectrons;
    return;
  }

  const userValue = Number.parseInt(valenceInput.value, 10);
  sessionValenceCount =
    Number.isFinite(userValue) && userValue > 0
      ? userValue
      : currentMolecule.valenceElectrons;
}

function lockAnalysisForm() {
  document
    .querySelectorAll("#lewis-analysis-form select, #lewis-analysis-form input")
    .forEach((input) => {
      input.disabled = true;
    });
  analysisCheckBtn.disabled = true;
}

function updateStageUI() {
  const fullMode = isFullAnalysisMode();

  stageStepper.classList.toggle("hidden", !fullMode);
  electronsStage.classList.toggle(
    "hidden",
    !fullMode || currentStage !== STAGES.electrons
  );
  questionArea.style.display =
    fullMode && currentStage !== STAGES.diagram ? "none" : "";
  analysisStage.classList.toggle(
    "hidden",
    !fullMode || currentStage !== STAGES.analysis
  );

  document.querySelectorAll(".lewis-stage-step").forEach((step) => {
    const stage = step.dataset.stage;
    const stageOrder = [STAGES.electrons, STAGES.diagram, STAGES.analysis];
    const currentIndex = stageOrder.indexOf(currentStage);
    const stepIndex = stageOrder.indexOf(stage);

    step.classList.toggle("lewis-stage-step--active", stage === currentStage);
    step.classList.toggle("lewis-stage-step--done", stepIndex < currentIndex);
  });

  if (currentStage === STAGES.diagram) {
    instructionText.textContent = isFullAnalysisMode()
      ? "Place bonds and lone pairs using all valence electrons from step 1. Each bond line counts as 2 electrons; each lone pair counts as 2."
      : "Select Bond or Lone pair, then click slots to place. Use Erase to remove one bond line or one lone pair at a time.";
    updateElectronCounter();
  } else {
    electronCounter.classList.add("hidden");
    updateDiagramActions();
  }

  taskHeader.classList.toggle("lewis-task-header--full", fullMode);
  updateSkipButtonLabels();
}

function initModeSelection() {
  browsePracticeStyle = getBrowseStyleFromStorage();
  syncBrowseStyleInputs();

  if (tryApplyDeepLink()) {
    return;
  }

  modeScreen.classList.remove("hidden");

  modeScreen.querySelectorAll(".mode-card").forEach((button) => {
    button.addEventListener("click", () => {
      practiceMode = button.dataset.mode;

      if (practiceMode === PRACTICE_MODES.browse) {
        showBrowsePicker();
        return;
      }

      modeScreen.classList.add("hidden");
      contentEl.classList.remove("hidden");
      modeBadge.classList.remove("hidden");
      modeBadge.textContent =
        practiceMode === PRACTICE_MODES.full
          ? "Full analysis mode"
          : "Structure practice mode";
      applyBrowseSessionUI();
      startSession();
    });
  });
}

function startSession() {
  resetRunState();
  sessionMolecules = shuffle(
    isFullAnalysisMode()
      ? allMolecules.filter((molecule) => molecule.valenceElectrons && molecule.analysis)
      : [...allMolecules]
  );

  if (sessionMolecules.length === 0) {
    showError("No structures are available for this mode yet.");
    return;
  }

  finalScreen.style.display = "none";
  showActiveUI();
  applyBrowseSessionUI();
  scoreDisplay.textContent = "0";
  totalDisplay.textContent = "0";
  skipBtn.style.display = "inline-block";
  loadQuestion();
}

function atomHasLoneSlots(atom, index, molecule) {
  if (atom.symbol === "H") return false;
  return true;
}

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";

function toSubscriptNumber(value) {
  return String(value)
    .split("")
    .map((digit) => SUBSCRIPT_DIGITS[Number(digit)])
    .join("");
}

function getDuplicateAtomIndex(atom, molecule) {
  const symbolTotals = {};
  molecule.atoms.forEach((entry) => {
    symbolTotals[entry.symbol] = (symbolTotals[entry.symbol] || 0) + 1;
  });

  if (symbolTotals[atom.symbol] <= 1) {
    return null;
  }

  let index = 0;
  for (const entry of molecule.atoms) {
    if (entry.symbol !== atom.symbol) continue;
    index += 1;
    if (entry.id === atom.id) {
      return index;
    }
  }

  return null;
}

function buildAtomLabelMap(molecule) {
  const labels = {};

  molecule.atoms.forEach((atom) => {
    const index = getDuplicateAtomIndex(atom, molecule);
    labels[atom.id] =
      index === null
        ? atom.symbol
        : `${atom.symbol}(${toSubscriptNumber(index)})`;
  });

  return labels;
}

function getAtomLabel(atomId, molecule, atomLabels) {
  return atomLabels?.[atomId] ?? molecule.atoms.find((a) => a.id === atomId)?.symbol;
}

function getAtomLabelByIndex(index, molecule, atomLabels) {
  return atomLabels[molecule.atoms[index].id];
}

function renderAtomElement(atomEl, atom, molecule) {
  const duplicateIndex = getDuplicateAtomIndex(atom, molecule);

  atomEl.replaceChildren();

  const labelWrap = document.createElement("span");
  labelWrap.className = "lewis-atom-label";

  const symbolSpan = document.createElement("span");
  symbolSpan.className = "lewis-atom-symbol";
  symbolSpan.textContent = atom.symbol;
  labelWrap.appendChild(symbolSpan);

  if (duplicateIndex !== null) {
    const indexSpan = document.createElement("span");
    indexSpan.className = "lewis-atom-index";
    indexSpan.setAttribute("aria-hidden", "true");

    const sub = document.createElement("sub");
    sub.textContent = `(${duplicateIndex})`;
    indexSpan.appendChild(sub);
    labelWrap.appendChild(indexSpan);
  }

  atomEl.appendChild(labelWrap);
}

function loneDirectionLabel(direction) {
  return SLOT_DIRECTION_LABELS[direction] || direction;
}

function filterTerminalSlots(layout, index, atomCount) {
  const slots = layout.slots.filter((slot) => {
    if (slot.terminal === "first") return index === 0;
    if (slot.terminal === "last") return index === atomCount - 1;
    return true;
  });

  return { ...layout, slots };
}

function resolveAtomLayout(atom, index, molecule) {
  const atomLayoutKey =
    atom.slotLayout || (atom.diagonalLoneSlots ? "expanded" : "compact");
  const atomCount = molecule.atoms.length;
  const isLinear = molecule.layout === "linear";

  if (isTrigonalPlanarLayout(molecule)) {
    if (index === 0) {
      if (usesExpandedSlotLayout(atom, index, molecule)) {
        return SLOT_LAYOUTS.trigonalCentralExpanded;
      }

      return SLOT_LAYOUTS.trigonalCentral;
    }

    return SLOT_LAYOUTS[getTrigonalLigandLayoutKey(index)];
  }

  if (isRadialLayout(molecule)) {
    if (index === 0) {
      return computePolarDiagonalLayout(SLOT_LAYOUTS.octahedralCentral, molecule);
    }

    return SLOT_LAYOUTS.octahedralLigand;
  }

  if (atomLayoutKey === "expanded") {
    return filterTerminalSlots(SLOT_LAYOUTS.expanded, index, atomCount);
  }

  if (isLinear && atomCount > 1) {
    if (index === 0) {
      return SLOT_LAYOUTS.compactLinearFirst;
    }
    if (index === atomCount - 1) {
      return SLOT_LAYOUTS.compactLinearLast;
    }
  }

  return filterTerminalSlots(SLOT_LAYOUTS.compact, index, atomCount);
}

function placeOnGrid(element, col, row) {
  element.style.gridColumn = String(col + 1);
  element.style.gridRow = String(row + 1);
}

function placePolarDiagonalSlot(element, direction, layout) {
  const ray = hubDiagonalRay(direction, layout);
  const R = layout.diagonalReach;
  const percentFromCenter = (R / layout.columns) * 100;

  element.classList.add("lewis-slot--polar");
  element.style.setProperty("--lewis-polar-x", `${ray.ux * percentFromCenter}%`);
  element.style.setProperty("--lewis-polar-y", `${ray.uy * percentFromCenter}%`);
}

function applySlotGrid(element, layout) {
  element.classList.add("lewis-slot-grid");
  element.style.setProperty("--lewis-grid-cols", layout.columns);
  element.style.setProperty("--lewis-grid-rows", layout.rows);
  element.style.gridTemplateColumns = `repeat(${layout.columns}, var(--lewis-slot-size))`;
  element.style.gridTemplateRows = `repeat(${layout.rows}, var(--lewis-slot-size))`;
}

function usesExpandedSlotLayout(atom, index, molecule) {
  if (isRadialLayout(molecule) && index === 0) {
    return true;
  }

  return atom.slotLayout === "expanded" || Boolean(atom.diagonalLoneSlots);
}

function createDiagonalConnectorsSvg(layout) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "lewis-diagonal-connectors");
  svg.setAttribute("aria-hidden", "true");

  svg.setAttribute("viewBox", `0 0 ${layout.columns} ${layout.rows}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.overflow = "visible";

  const atomCx = layout.atom.col + 0.5;
  const atomCy = layout.atom.row + 0.5;
  const atomRadius = LEWIS_ATOM_SLOT_RATIO / 2;
  const circleRadius = (layout.circleScale ?? LEWIS_CIRCLE_SLOT_SCALE) / 2;
  const atomCorner = atomRadius / Math.SQRT2;
  const circleCorner = circleRadius / Math.SQRT2;
  const reach = layout.diagonalReach;

  layout.slots.forEach((slot) => {
    if (!DIAGONAL_DIRECTIONS.has(slot.direction)) return;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    let x1;
    let y1;
    let x2;
    let y2;

    if (reach != null) {
      const ray = hubDiagonalRay(slot.direction, layout);
      x1 = atomCx + ray.ux * atomRadius;
      y1 = atomCy + ray.uy * atomRadius;
      x2 = atomCx + ray.ux * (reach - circleRadius);
      y2 = atomCy + ray.uy * (reach - circleRadius);
    } else {
      const corners = DIAGONAL_CONNECTOR_CORNERS[slot.direction];
      if (!corners) return;

      x1 = atomCx + corners.ax * atomCorner;
      y1 = atomCy + corners.ay * atomCorner;
      x2 = slot.col + 0.5 + corners.sx * circleCorner;
      y2 = slot.row + 0.5 + corners.sy * circleCorner;
    }

    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    svg.appendChild(line);
  });

  return svg;
}

function slotDirectionsForAtom(atom, index, molecule) {
  if (!atomHasLoneSlots(atom, index, molecule)) return [];

  return resolveAtomLayout(atom, index, molecule).slots.map((slot) => slot.direction);
}

function loneDirectionsForAtom(atom, index, molecule) {
  return slotDirectionsForAtom(atom, index, molecule);
}

function appendLinearBondSlots(
  column,
  atom,
  index,
  molecule,
  layout,
  labels,
  atomLabel,
  readonly
) {
  if (molecule.layout !== "linear") return;

  const lastIndex = molecule.atoms.length - 1;
  const bondRow = layout.atom.row;

  if (index > 0 && index < lastIndex) {
    const leftAtom = molecule.atoms[index - 1];
    column.appendChild(
      createSlot({
        kind: "bond",
        label: `Bond between ${labels[leftAtom.id]} and ${atomLabel}`,
        dataset: { bond: bondKey(index - 1) },
        gridCol: 0,
        gridRow: bondRow,
        readonly,
      })
    );
  }

  if (index === lastIndex - 1) {
    const rightAtom = molecule.atoms[index + 1];
    column.appendChild(
      createSlot({
        kind: "bond",
        label: `Bond between ${atomLabel} and ${labels[rightAtom.id]}`,
        dataset: { bond: bondKey(index) },
        gridCol: layout.columns - 1,
        gridRow: bondRow,
        readonly,
      })
    );
  }
}

function appendTrigonalBondSlots(
  column,
  atom,
  index,
  molecule,
  layout,
  labels,
  atomLabel,
  readonly
) {
  if (!isTrigonalPlanarLayout(molecule) || index !== 0 || !layout.bondSlots) {
    return;
  }

  layout.bondSlots.forEach(({ col, row, peripheralIndex, direction }) => {
    const ligand = molecule.atoms[peripheralIndex];
    if (!ligand) return;

    column.appendChild(
      createSlot({
        kind: "bond",
        label: `Bond between ${atomLabel} and ${labels[ligand.id]}`,
        dataset: { bond: centralBondKey(peripheralIndex) },
        direction,
        gridCol: col,
        gridRow: row,
        readonly,
      })
    );
  });
}

function buildAtomColumn(atom, index, molecule, readonly = false, atomLabels) {
  const column = document.createElement("div");
  column.className = "lewis-atom-column";

  const labels = atomLabels || buildAtomLabelMap(molecule);
  const atomLabel = labels[atom.id];
  const layout = resolveAtomLayout(atom, index, molecule);
  const slotOptions = { readonly };

  applySlotGrid(column, layout);

  if (layout.circleScale != null) {
    column.style.setProperty(
      "--lewis-circle-slot-scale",
      String(layout.circleScale)
    );
  }

  if (usesExpandedSlotLayout(atom, index, molecule)) {
    column.classList.add("lewis-atom-column--expanded");
    if (layout.diagonalAngle != null) {
      column.classList.add("lewis-atom-column--polar-diagonals");
      column.style.setProperty(
        "--lewis-diagonal-angle",
        `${layout.diagonalAngle}deg`
      );
    }
    column.appendChild(createDiagonalConnectorsSvg(layout));
  }

  if (atomHasLoneSlots(atom, index, molecule)) {
    layout.slots.forEach((slotDef) => {
      const slot = createSlot({
        kind: "lone",
        direction: slotDef.direction,
        label: `Lone electrons ${loneDirectionLabel(slotDef.direction)} ${atomLabel}`,
        dataset: { lone: loneKey(atom.id, slotDef.direction) },
        shape: slotDef.shape,
        gridCol: slotDef.polar ? null : slotDef.col,
        gridRow: slotDef.polar ? null : slotDef.row,
        ...slotOptions,
      });

      if (slotDef.polar) {
        placePolarDiagonalSlot(slot, slotDef.direction, layout);
      }

      column.appendChild(slot);
    });
  }

  appendLinearBondSlots(
    column,
    atom,
    index,
    molecule,
    layout,
    labels,
    atomLabel,
    readonly
  );

  appendTrigonalBondSlots(
    column,
    atom,
    index,
    molecule,
    layout,
    labels,
    atomLabel,
    readonly
  );

  const atomEl = document.createElement("div");
  atomEl.className = "lewis-atom lewis-grid-atom";
  renderAtomElement(atomEl, atom, molecule);
  placeOnGrid(atomEl, layout.atom.col, layout.atom.row);
  column.appendChild(atomEl);

  return column;
}

function buildOctahedralLigandColumn(atom, atomIndex, molecule, readonly = false) {
  const layout = SLOT_LAYOUTS.octahedralLigand;
  const column = document.createElement("div");
  column.className = "lewis-atom-column lewis-octahedral-ligand-column";

  const labels = buildAtomLabelMap(molecule);
  const atomLabel = labels[atom.id];
  const slotOptions = { readonly };

  applySlotGrid(column, layout);

  layout.slots.forEach((slotDef) => {
    column.appendChild(
      createSlot({
        kind: "lone",
        direction: slotDef.direction,
        label: `Lone electrons ${loneDirectionLabel(slotDef.direction)} ${atomLabel}`,
        dataset: { lone: loneKey(atom.id, slotDef.direction) },
        shape: slotDef.shape,
        gridCol: slotDef.col,
        gridRow: slotDef.row,
        ...slotOptions,
      })
    );
  });

  const atomEl = document.createElement("div");
  atomEl.className = "lewis-atom lewis-grid-atom";
  renderAtomElement(atomEl, atom, molecule);
  placeOnGrid(atomEl, layout.atom.col, layout.atom.row);
  column.appendChild(atomEl);

  return column;
}

function buildOctahedralBondSlot(atomIndex, molecule, readonly = false) {
  const labels = buildAtomLabelMap(molecule);
  const atom = molecule.atoms[atomIndex];
  const atomLabel = labels[atom.id];
  const centralLabel = labels[molecule.atoms[0].id];

  return createSlot({
    kind: "bond",
    label: `Bond between ${centralLabel} and ${atomLabel}`,
    dataset: { bond: centralBondKey(atomIndex) },
    readonly,
  });
}

function buildOctahedralBoard(molecule, readonly = false) {
  const board = document.createElement("div");
  board.className = "lewis-octahedral-board lewis-octahedral-ring";

  const hub = document.createElement("div");
  hub.className = "lewis-octahedral-ring__hub";
  hub.appendChild(buildAtomColumn(molecule.atoms[0], 0, molecule, readonly));
  board.appendChild(hub);

  const ligandCount = molecule.atoms.length - 1;
  const ringAngleOptions = getRadialRingAngleOptions(molecule);
  for (let i = 0; i < ligandCount; i++) {
    const atomIndex = i + 1;
    const atom = molecule.atoms[atomIndex];
    if (!atom) continue;

    const ligandAngle = getOctahedralLigandAngle(
      i,
      ligandCount,
      ringAngleOptions
    );

    const wrapper = document.createElement("div");
    wrapper.className = "lewis-octahedral-ring__ligand";
    wrapper.style.setProperty("--ligand-angle", `${ligandAngle}deg`);
    wrapper.appendChild(
      buildOctahedralLigandColumn(atom, atomIndex, molecule, readonly)
    );
    board.appendChild(wrapper);

    const bondWrapper = document.createElement("div");
    bondWrapper.className = "lewis-octahedral-ring__bond";
    bondWrapper.style.setProperty("--ligand-angle", `${ligandAngle}deg`);
    bondWrapper.appendChild(
      buildOctahedralBondSlot(atomIndex, molecule, readonly)
    );
    board.appendChild(bondWrapper);
  }

  return board;
}

function addTrigonalPlanarCell(grid, gridCol, gridRow, content, extraClass = "") {
  const cell = document.createElement("div");
  cell.className = `lewis-trigonal-planar-grid__cell${extraClass ? ` ${extraClass}` : ""}`;
  cell.style.gridColumn = String(gridCol);
  cell.style.gridRow = String(gridRow);
  cell.appendChild(content);
  grid.appendChild(cell);
}

function buildTrigonalPlanarBoard(molecule, readonly = false) {
  const board = document.createElement("div");
  board.className = "lewis-trigonal-planar-board";

  const grid = document.createElement("div");
  grid.className = "lewis-trigonal-planar-grid";

  addTrigonalPlanarCell(
    grid,
    1,
    1,
    buildAtomColumn(molecule.atoms[1], 1, molecule, readonly),
    "lewis-trigonal-planar-grid__cell--west"
  );
  addTrigonalPlanarCell(
    grid,
    2,
    1,
    buildAtomColumn(molecule.atoms[0], 0, molecule, readonly),
    "lewis-trigonal-planar-grid__cell--hub"
  );
  addTrigonalPlanarCell(
    grid,
    3,
    1,
    buildAtomColumn(molecule.atoms[2], 2, molecule, readonly),
    "lewis-trigonal-planar-grid__cell--east"
  );
  addTrigonalPlanarCell(
    grid,
    2,
    2,
    buildAtomColumn(molecule.atoms[3], 3, molecule, readonly),
    "lewis-trigonal-planar-grid__cell--south"
  );

  board.appendChild(grid);
  return board;
}

function buildBoardRow(molecule, readonly = false) {
  const row = document.createElement("div");
  row.className = "lewis-linear-row";
  const atomLabels = buildAtomLabelMap(molecule);

  molecule.atoms.forEach((atom, index) => {
    row.appendChild(buildAtomColumn(atom, index, molecule, readonly, atomLabels));
  });

  return row;
}

function getIonChargeSuperscript(charge) {
  if (charge === undefined || charge === null || charge === 0) {
    return null;
  }

  const sign = charge > 0 ? "+" : "−";
  const magnitude = Math.abs(charge);
  return magnitude === 1 ? sign : `${magnitude}${sign}`;
}

function applyIonDisplay(molecule, frameEl = ionDisplayEl, chargeEl = ionChargeEl) {
  if (!frameEl || !chargeEl) return;

  const label = getIonChargeSuperscript(molecule.charge);

  if (label) {
    frameEl.classList.add("lewis-ion-display--charged");
    chargeEl.textContent = label;
  } else {
    frameEl.classList.remove("lewis-ion-display--charged");
    chargeEl.textContent = "";
  }
}

function createDiagramFrame(molecule) {
  const frame = document.createElement("div");
  frame.className = "lewis-ion-display";

  const openBracket = document.createElement("span");
  openBracket.className = "lewis-ion-bracket";
  openBracket.setAttribute("aria-hidden", "true");
  openBracket.textContent = "[";

  const body = document.createElement("div");
  body.className = "lewis-ion-body";

  const closeBracket = document.createElement("span");
  closeBracket.className = "lewis-ion-bracket";
  closeBracket.setAttribute("aria-hidden", "true");
  closeBracket.textContent = "]";

  const charge = document.createElement("sup");
  charge.className = "lewis-ion-charge";

  frame.appendChild(openBracket);
  frame.appendChild(body);
  frame.appendChild(closeBracket);
  frame.appendChild(charge);

  applyIonDisplay(molecule, frame, charge);

  return { frame, body };
}

function populateBoard(targetEl, molecule, state, { readonly = false } = {}) {
  targetEl.replaceChildren();
  targetEl.className = `lewis-board lewis-board--${molecule.layout || "linear"}`;

  if (readonly) {
    targetEl.classList.add("lewis-board--example");
  }

  if (isTrigonalPlanarLayout(molecule)) {
    targetEl.appendChild(buildTrigonalPlanarBoard(molecule, readonly));
  } else if (isRadialLayout(molecule)) {
    targetEl.appendChild(buildOctahedralBoard(molecule, readonly));
  } else if (molecule.layout === "linear") {
    targetEl.appendChild(buildBoardRow(molecule, readonly));
  } else {
    targetEl.textContent = "Unsupported layout.";
    return;
  }

  refreshBoard(targetEl, state);
}

function renderBoard(molecule) {
  if (
    !isRadialLayout(molecule) &&
    !isTrigonalPlanarLayout(molecule) &&
    molecule.layout !== "linear"
  ) {
    boardEl.textContent = "Unsupported layout.";
    return;
  }

  populateBoard(boardEl, molecule, { bonds: bondState, lones: loneState });
}

function getAnswerVariants(molecule) {
  return LewisAnswers.getAnswerVariants(molecule);
}

function buildExampleState(molecule) {
  if (molecule.example) {
    const bonds = { ...(molecule.example.bonds || {}) };
    const lones = {};

    Object.entries(molecule.example.loneDots || {}).forEach(([atomId, entry]) => {
      if (typeof entry === "number") {
        distributeExampleLoneDots(atomId, entry, molecule, lones);
        return;
      }
      Object.entries(entry).forEach(([dir, count]) => {
        if (count > 0) {
          lones[loneKey(atomId, dir)] = count;
        }
      });
    });
    return { bonds, lones };
  }

  return buildStateFromVariant(getAnswerVariants(molecule)[0], molecule);
}

function buildStateFromVariant(variant, molecule) {
  const bonds = { ...variant.bonds };
  const lones = {};

  molecule.atoms.forEach((atom, index) => {
    const entry = variant.loneDots[atom.id];
    if (entry === undefined) return;

    if (typeof entry === "object" && typeof entry.total !== "number") {
      Object.entries(entry).forEach(([dir, count]) => {
        if (count > 0) {
          lones[loneKey(atom.id, dir)] = count;
        }
      });
      return;
    }

    distributeExampleLoneDots(
      atom.id,
      getExpectedLoneDots(atom.id, variant.loneDots),
      molecule,
      lones
    );
  });

  return { bonds, lones };
}

function distributeExampleLoneDots(atomId, total, molecule, lones) {
  if (total <= 0) return;

  const atomIndex = molecule.atoms.findIndex((a) => a.id === atomId);
  const atom = molecule.atoms[atomIndex];
  const layout = resolveAtomLayout(atom, atomIndex, molecule);
  let remaining = total;

  for (const slot of layout.slots) {
    if (remaining <= 0) break;
    const count = Math.min(remaining, 2);
    lones[loneKey(atomId, slot.direction)] = count;
    remaining -= count;
  }
}

function getBondKeys(molecule) {
  if (isRadialLayout(molecule) || isTrigonalPlanarLayout(molecule)) {
    return molecule.atoms.slice(1).map((_, index) => centralBondKey(index + 1));
  }

  const keys = [];
  for (let i = 0; i < molecule.atoms.length - 1; i++) {
    keys.push(bondKey(i));
  }
  return keys;
}

function bondKey(leftIndex) {
  return `${leftIndex}-${leftIndex + 1}`;
}

function centralBondKey(peripheralIndex) {
  return `0-${peripheralIndex}`;
}

function loneKey(atomId, direction) {
  return `${atomId}:${direction}`;
}

function parseLoneKey(key) {
  const [atomId, direction] = key.split(":");
  return { atomId, direction };
}

function getExpectedLoneDots(atomId, loneDotsAnswer) {
  const entry = loneDotsAnswer[atomId];
  if (typeof entry === "number") return entry;
  if (entry && typeof entry.total === "number") return entry.total;
  if (entry && typeof entry === "object") {
    return Object.values(entry).reduce((sum, value) => sum + value, 0);
  }
  return 0;
}

function getActualLoneDots(atomId, molecule) {
  const atomIndex = molecule.atoms.findIndex((a) => a.id === atomId);
  if (atomIndex < 0) return 0;

  return slotDirectionsForAtom(
    molecule.atoms[atomIndex],
    atomIndex,
    molecule
  ).reduce(
    (sum, dir) => sum + (loneState[loneKey(atomId, dir)] || 0),
    0
  );
}

function getFilledLoneSlotCounts(atomId, molecule) {
  const atomIndex = molecule.atoms.findIndex((a) => a.id === atomId);
  if (atomIndex < 0) return [];

  return slotDirectionsForAtom(
    molecule.atoms[atomIndex],
    atomIndex,
    molecule
  )
    .map((dir) => loneState[loneKey(atomId, dir)] || 0)
    .filter((count) => count > 0);
}

function clearFeedback() {
  feedbackEl.replaceChildren();
  feedbackEl.classList.remove("show");
}

function resetState() {
  bondState = {};
  loneState = {};
  clearSelectedTool();

  if (!currentMolecule) return;

  getBondKeys(currentMolecule).forEach((key) => {
    bondState[key] = 0;
  });

  currentMolecule.atoms.forEach((atom, index) => {
    loneDirectionsForAtom(atom, index, currentMolecule).forEach((dir) => {
      loneState[loneKey(atom.id, dir)] = 0;
    });
  });
}

function renderBondSlotContent(count) {
  const wrap = document.createElement("span");
  wrap.className = "lewis-slot-bonds";

  if (count === 1) wrap.classList.add("lewis-slot-bonds--single");
  else if (count === 2) wrap.classList.add("lewis-slot-bonds--double");
  else if (count >= 3) wrap.classList.add("lewis-slot-bonds--triple");

  for (let i = 0; i < count; i++) {
    const line = document.createElement("span");
    line.className = "lewis-bond-line";
    wrap.appendChild(line);
  }

  return wrap;
}

function renderLoneSlotContent(count, direction) {
  const wrap = document.createElement("span");
  wrap.className = "lewis-slot-dots";

  if (direction === "west" || direction === "east") {
    wrap.classList.add("lewis-slot-dots--vertical");
  } else if (direction === "north" || direction === "south") {
    wrap.classList.add("lewis-slot-dots--horizontal");
  } else if (DIAGONAL_DIRECTIONS.has(direction)) {
    wrap.classList.add("lewis-slot-dots--diagonal-inline");
  }

  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    dot.className = "lewis-dot";
    dot.textContent = "·";
    wrap.appendChild(dot);
  }

  return wrap;
}

function refreshSlotElement(slotEl, state = null) {
  const bonds = state?.bonds ?? bondState;
  const lones = state?.lones ?? loneState;
  const kind = slotEl.dataset.kind;
  slotEl.replaceChildren();

  if (kind === "bond") {
    const count = bonds[slotEl.dataset.bond] || 0;
    if (count > 0) {
      slotEl.appendChild(renderBondSlotContent(count));
    }
    slotEl.classList.toggle("lewis-slot--filled", count > 0);
    return;
  }

  const count = lones[slotEl.dataset.lone] || 0;
  if (count > 0) {
    const { direction } = parseLoneKey(slotEl.dataset.lone);
    slotEl.appendChild(renderLoneSlotContent(count, direction));
  }
  slotEl.classList.toggle("lewis-slot--filled", count > 0);
}

function refreshBoard(container = boardEl, state = null) {
  container.querySelectorAll(".lewis-slot").forEach((slotEl) => {
    refreshSlotElement(slotEl, state);
  });
  updateElectronCounter();
}

function createSlot({
  kind,
  label,
  dataset,
  direction = null,
  shape = "square",
  gridCol = null,
  gridRow = null,
  readonly = false,
}) {
  const slot = document.createElement(readonly ? "div" : "button");
  if (!readonly) {
    slot.type = "button";
  }
  slot.className = `lewis-slot lewis-slot--${kind}`;
  if (readonly) {
    slot.classList.add("lewis-slot--readonly");
  }
  slot.dataset.kind = kind;
  slot.setAttribute("aria-label", label);

  if (shape === "circle" || (direction && DIAGONAL_DIRECTIONS.has(direction))) {
    slot.classList.add("lewis-slot--circle");
  }

  if (direction) {
    slot.classList.add(`lewis-slot--${direction}`);
  }

  if (Number.isInteger(gridCol) && Number.isInteger(gridRow)) {
    placeOnGrid(slot, gridCol, gridRow);
  } else if (direction) {
    slot.classList.add(`lewis-grid-${direction}`);
  }

  if (kind === "bond" && !Number.isInteger(gridRow)) {
    slot.classList.add("lewis-grid-bond");
  }

  Object.entries(dataset).forEach(([key, value]) => {
    slot.dataset[key] = value;
  });

  if (readonly) {
    return slot;
  }

  slot.addEventListener("click", () => handleSlotClick(slot));
  slot.addEventListener("dragover", (event) => {
    event.preventDefault();
    slot.classList.add("lewis-slot--dragover");
  });
  slot.addEventListener("dragleave", () => {
    slot.classList.remove("lewis-slot--dragover");
  });
  slot.addEventListener("drop", (event) => {
    event.preventDefault();
    slot.classList.remove("lewis-slot--dragover");
    const token = event.dataTransfer.getData("text/plain");
    if (token) addTokenToSlot(slot, token);
  });

  return slot;
}

function lockQuestion() {
  questionLocked = true;
  clearSelectedTool();
  boardEl.classList.add("lewis-board--locked");
  checkBtn.disabled = true;
  diagramSkipBtn.disabled = true;
  skipBtn.disabled = true;
  resetBtn.disabled = true;

  document.querySelectorAll(".lewis-token").forEach((token) => {
    token.setAttribute("draggable", "false");
    token.classList.add("lewis-token--disabled");
  });
}

function unlockQuestion() {
  questionLocked = false;
  boardEl.classList.remove("lewis-board--locked");
  resetBtn.disabled = false;
  skipBtn.disabled = false;
  updateDiagramActions();

  document.querySelectorAll(".lewis-token").forEach((token) => {
    token.setAttribute("draggable", "true");
    token.classList.remove("lewis-token--disabled");
  });
}

function getMaxLoneDotsForSlot(slot) {
  if (slot.dataset.kind !== "lone") return MAX_DOTS;
  if (slot.classList.contains("lewis-slot--circle")) return MAX_CIRCLE_DOTS;
  return MAX_DOTS;
}

function addTokenToSlot(slot, token) {
  if (questionLocked) return;

  if (slot.dataset.kind === "bond" && token === "bond") {
    const key = slot.dataset.bond;
    bondState[key] = Math.min(MAX_BONDS, (bondState[key] || 0) + 1);
  } else if (slot.dataset.kind === "lone" && token === "lonePair") {
    const key = slot.dataset.lone;
    const maxDots = getMaxLoneDotsForSlot(slot);
    loneState[key] = Math.min(
      maxDots,
      (loneState[key] || 0) + LONE_PAIR_DOTS
    );
  } else {
    return;
  }

  refreshSlotElement(slot);
  updateElectronCounter();
}

function removeFromSlot(slot) {
  if (questionLocked) return;

  if (slot.dataset.kind === "bond") {
    const key = slot.dataset.bond;
    bondState[key] = Math.max(0, (bondState[key] || 0) - 1);
  } else {
    const key = slot.dataset.lone;
    const current = loneState[key] || 0;
    const removeCount =
      current % LONE_PAIR_DOTS === 0 ? LONE_PAIR_DOTS : current;
    loneState[key] = Math.max(0, current - removeCount);
  }

  refreshSlotElement(slot);
  updateElectronCounter();
}

function clearSelectedTool() {
  selectedTool = null;
  document.querySelectorAll(".lewis-token").forEach((token) => {
    token.classList.remove("lewis-token--selected");
  });
  boardEl.classList.remove("lewis-board--erase");
}

function setSelectedTool(tool) {
  selectedTool = selectedTool === tool ? null : tool;
  document.querySelectorAll(".lewis-token").forEach((el) => {
    el.classList.toggle("lewis-token--selected", el.dataset.token === selectedTool);
  });
  boardEl.classList.toggle("lewis-board--erase", selectedTool === "erase");
}

function handleSlotClick(slot) {
  if (questionLocked) return;

  if (selectedTool === "erase") {
    removeFromSlot(slot);
    return;
  }

  if (selectedTool === "bond" || selectedTool === "lonePair") {
    addTokenToSlot(slot, selectedTool);
  }
}

function setupPalette() {
  document.querySelectorAll(".lewis-token").forEach((tokenEl) => {
    const token = tokenEl.dataset.token;

    tokenEl.addEventListener("dragstart", (event) => {
      if (questionLocked || token === "erase") {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData("text/plain", token);
      event.dataTransfer.effectAllowed = "copy";
    });

    tokenEl.addEventListener("click", () => {
      if (questionLocked) return;
      setSelectedTool(token);
    });

    tokenEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        tokenEl.click();
      }
    });
  });
}

function validateVariant(variant, molecule) {
  const atomLabels = buildAtomLabelMap(molecule);

  return LewisValidation.validateVariant(
    variant,
    molecule,
    bondState,
    loneState,
    {
      getActualLoneDots: (atomId) => getActualLoneDots(atomId, molecule),
      getFilledLoneSlotCounts: (atomId) =>
        getFilledLoneSlotCounts(atomId, molecule),
      getAtomLabel: (atomId) => getAtomLabel(atomId, molecule, atomLabels),
    },
  );
}

function getMatchingAnswerVariant(molecule) {
  for (const variant of getAnswerVariants(molecule)) {
    if (validateVariant(variant, molecule).length === 0) {
      return variant;
    }
  }

  return null;
}

function getExpectedResonance(molecule, matchedVariant = null) {
  const variant = matchedVariant ?? getMatchingAnswerVariant(molecule);
  const analysis = molecule?.analysis ?? {};

  if (variant?.resonance !== undefined) {
    return variant.resonance;
  }

  if (analysis.resonanceFromDiagram) {
    const orders = variant?.bonds
      ? Object.values(variant.bonds)
      : LewisAnswers.getExpectedBondKeys(molecule)
          .map((key) => bondState[key] || 0)
          .filter((order) => order > 0);

    if (orders.length > 0) {
      const hasSingle = orders.some((order) => order === 1);
      const hasMultiple = orders.some((order) => order >= 2);
      return hasSingle && hasMultiple;
    }
  }

  return Boolean(analysis.resonance);
}

function formatExpectedResonance(molecule, matchedVariant = null) {
  return getExpectedResonance(molecule, matchedVariant) ? "yes" : "no";
}

function compareAnswer() {
  return getMatchingAnswerVariant(currentMolecule)
    ? []
    : validateVariant(getAnswerVariants(currentMolecule)[0], currentMolecule);
}

function showFeedback(headline, tone, messages = [], showExample = false) {
  feedbackEl.replaceChildren();

  const panel = document.createElement("div");
  panel.className = `feedback-panel feedback-panel--${tone}`;

  const main = document.createElement("p");
  main.className = "feedback-main";

  const headlineEl = document.createElement("span");
  headlineEl.className = "feedback-headline";
  headlineEl.textContent = headline;
  main.appendChild(headlineEl);

  panel.appendChild(main);

  const items = messages.filter(Boolean);

  if (items.length > 0) {
    const list = document.createElement("ul");
    list.className = "lewis-feedback-list";
    items.forEach((message) => {
      const item = document.createElement("li");
      if (typeof setStemText === "function") {
        setStemText(item, message);
      } else {
        item.textContent = message;
      }
      list.appendChild(item);
    });
    panel.appendChild(list);
  }

  if (
    currentMolecule?.explanation &&
    currentStage !== STAGES.electrons
  ) {
    const explanation = document.createElement("p");
    explanation.className = "feedback-explanation stem-text";
    setStemText(explanation, currentMolecule.explanation);
    panel.appendChild(explanation);
  }

  if (showExample && currentMolecule) {
    if (isFullAnalysisMode() && currentStage !== STAGES.diagram) {
      showExample = false;
    }
  }

  if (showExample && currentMolecule) {
    const exampleSection = document.createElement("div");
    exampleSection.className = "lewis-example";

    const label = document.createElement("p");
    label.className = "lewis-example-label";
    label.textContent = "Example correct diagram";
    exampleSection.appendChild(label);

    const boardWrap = document.createElement("div");
    boardWrap.className = "lewis-board-wrap lewis-board-wrap--example";
    if (usesWideDiagramLayout(currentMolecule)) {
      boardWrap.classList.add("lewis-board-wrap--octahedral");
    }

    const { frame, body } = createDiagramFrame(currentMolecule);
    if (usesWideDiagramLayout(currentMolecule)) {
      frame.classList.add("lewis-ion-display--octahedral");
    }
    const exampleBoard = document.createElement("div");
    exampleBoard.setAttribute(
      "aria-label",
      "Example correct Lewis diagram"
    );
    populateBoard(exampleBoard, currentMolecule, buildExampleState(currentMolecule), {
      readonly: true,
    });
    body.appendChild(exampleBoard);
    boardWrap.appendChild(frame);
    exampleSection.appendChild(boardWrap);
    panel.appendChild(exampleSection);
  }

  feedbackEl.appendChild(panel);
  feedbackEl.classList.add("show");
}

function applyDiagramLayoutClasses(molecule) {
  const isWide = usesWideDiagramLayout(molecule);

  contentEl?.classList.toggle("lewis-content--octahedral", isWide);
  workspaceEl?.classList.toggle("lewis-workspace--octahedral", isWide);
  boardWrapEl?.classList.toggle("lewis-board-wrap--octahedral", isWide);
  ionDisplayEl?.classList.toggle("lewis-ion-display--octahedral", isWide);
}

function loadMolecule(molecule) {
  currentMolecule = molecule;
  resetState();
  formulaEl.textContent = molecule.formula;
  if (typeof setStemText === "function") {
    setStemText(formulaEl, molecule.formula);
  }
  applyDiagramLayoutClasses(molecule);
  renderBoard(molecule);
  applyIonDisplay(molecule);
}

function resetQuestionUI() {
  clearFeedback();
  clearAnalysisFieldStates();
  clearSelectedTool();
  unlockQuestion();
  skippedCurrent = false;
  continueBtn.style.display = "none";

  if (isBrowseMode()) {
    skipBtn.style.display = "none";
  } else {
    skipBtn.disabled = false;
  }

  valenceInput.disabled = false;
  valenceCheckBtn.disabled = false;
  analysisCheckBtn.disabled = false;
  document
    .querySelectorAll("#lewis-analysis-form select, #lewis-analysis-form input")
    .forEach((input) => {
      input.disabled = false;
    });

  updateDiagramActions();
}

function getStructureProgressLabel(molecule) {
  if (!molecule) return "";
  if (molecule.name && molecule.formula) {
    return `${molecule.name} (${molecule.formula})`;
  }
  return molecule.name || molecule.formula;
}

function updateProgress() {
  const molecule = sessionMolecules[current];
  const structureLabel = getStructureProgressLabel(molecule);

  if (isBrowseMode()) {
    progressBar.style.width = "100%";

    if (isFullAnalysisMode()) {
      const stageLabels = {
        [STAGES.electrons]: "Valence electrons",
        [STAGES.diagram]: "Lewis diagram",
        [STAGES.analysis]: "Molecular analysis",
      };
      const stepNumbers = {
        [STAGES.electrons]: 1,
        [STAGES.diagram]: 2,
        [STAGES.analysis]: 3,
      };
      questionProgress.textContent = `${structureLabel}\nStep ${stepNumbers[currentStage]}: ${stageLabels[currentStage]}`;
      return;
    }

    questionProgress.textContent = structureLabel;
    return;
  }

  const total = sessionMolecules.length;
  const percent = total ? (current / total) * 100 : 0;
  progressBar.style.width = `${percent}%`;

  const structureLine = `Structure ${current + 1} of ${total}: ${structureLabel}`;

  if (isFullAnalysisMode()) {
    const stageLabels = {
      [STAGES.electrons]: "Valence electrons",
      [STAGES.diagram]: "Lewis diagram",
      [STAGES.analysis]: "Molecular analysis",
    };
    const stepNumbers = {
      [STAGES.electrons]: 1,
      [STAGES.diagram]: 2,
      [STAGES.analysis]: 3,
    };
    questionProgress.textContent = `${structureLine}\nStep ${stepNumbers[currentStage]}: ${stageLabels[currentStage]}`;
    return;
  }

  questionProgress.textContent = structureLine;
}

function updateScoreDisplay() {
  if (isBrowseMode()) return;

  scoreDisplay.textContent = correctCount;
  totalDisplay.textContent = answeredCount;
}

function loadQuestion() {
  if (current >= sessionMolecules.length) {
    if (isBrowseMode()) return;

    endSession();
    return;
  }

  resetQuestionUI();
  sessionValenceCount = null;
  valenceStepCorrect = null;
  currentStage = isFullAnalysisMode() ? STAGES.electrons : STAGES.diagram;
  updateProgress();
  loadMolecule(sessionMolecules[current]);
  updateStageUI();
  scrollPageToTop();

  if (currentStage === STAGES.electrons) {
    setupValenceStage();
  } else if (currentStage === STAGES.analysis) {
    resetAnalysisForm();
  }
}

function revealAnswer() {
  lockQuestion();

  if (isBrowseMode()) {
    if (isFullAnalysisMode() && currentStage !== STAGES.analysis) {
      continueBtn.style.display = "inline-block";
      continueBtn.focus();
    }
    return;
  }

  continueBtn.style.display = "inline-block";
  continueBtn.focus();
}

function handleValenceCheck() {
  const expected = currentMolecule.valenceElectrons;
  const userValue = Number.parseInt(valenceInput.value, 10);
  const correct = userValue === expected;
  valenceStepCorrect = correct;

  if (!isBrowseMode()) {
    answeredCount++;

    if (correct) {
      correctCount++;
    }
  }

  if (correct) {
    showFeedback("Correct!", "correct");
  } else {
    showFeedback("Not quite.", "incorrect", [
      `Expected ${expected} valence electrons.`,
    ]);
  }

  valenceInput.disabled = true;
  valenceCheckBtn.disabled = true;
  updateScoreDisplay();
  revealAnswer();
}

function handleAnalysisCheck() {
  const analysis = currentMolecule.analysis;
  const issues = [];

  const userDomains = Number.parseInt(electronDomainsInput?.value, 10);
  if (!Number.isFinite(userDomains)) {
    issues.push("Number of electron domains is required.");
  } else if (userDomains !== analysis.electronDomains) {
    issues.push(
      `Electron domains: expected ${analysis.electronDomains}.`
    );
  }

  const resonanceValue = document.querySelector(
    'input[name="resonance"]:checked'
  )?.value;
  const expectedResonance = formatExpectedResonance(currentMolecule);

  if (!resonanceValue) {
    issues.push("Select whether the species has resonance.");
  } else if (resonanceValue !== expectedResonance) {
    issues.push(`Resonance: expected ${expectedResonance}.`);
  }

  const fields = [
    {
      id: "lewis-electron-geometry",
      key: "electronGeometry",
      label: "Electron geometry",
    },
    {
      id: "lewis-molecular-geometry",
      key: "molecularGeometry",
      label: "Molecular geometry",
    },
    { id: "lewis-polarity", key: "polarity", label: "Polarity" },
  ];

  fields.forEach(({ id, key, label }) => {
    const select = document.getElementById(id);
    if (!select.value) {
      issues.push(`${label} is required.`);
      return;
    }
    if (select.value !== analysis[key]) {
      issues.push(
        `${label}: expected ${formatAnalysisAnswer(key, analysis[key])}.`
      );
    }
  });

  const distortionValue = document.querySelector(
    'input[name="distortion"]:checked'
  )?.value;
  const expectedDistortion = analysis.distortion ? "yes" : "no";

  if (!distortionValue) {
    issues.push("Select whether the bond angle is distorted from ideal.");
  } else if (distortionValue !== expectedDistortion) {
    issues.push(
      `Bond angle distorted: expected ${expectedDistortion}.`
    );
  }

  const hybridizationSelect = document.getElementById("lewis-hybridization");
  if (!hybridizationSelect.value) {
    issues.push("Hybridization is required.");
  } else if (hybridizationSelect.value !== analysis.hybridization) {
    issues.push(
      `Hybridization: expected ${formatAnalysisAnswer("hybridization", analysis.hybridization)}.`
    );
  }

  const selectedBondAngles = getSelectedBondAngles();

  if (selectedBondAngles.length === 0) {
    issues.push("Select all ideal bond angles that apply.");
  } else if (!bondAnglesMatch(selectedBondAngles, analysis.bondAngle)) {
    issues.push(
      `Ideal bond angle(s): expected ${formatBondAngles(analysis.bondAngle)}.`
    );
  }

  const correct = issues.length === 0;

  if (!isBrowseMode()) {
    answeredCount++;

    if (correct) {
      correctCount++;
    }
  }

  if (correct) {
    showFeedback("Correct!", "correct");
  } else {
    showFeedback("Not quite.", "incorrect", issues);
  }

  lockAnalysisForm();
  applyAnalysisFieldHighlights();
  updateScoreDisplay();
  revealAnswer();
}

function handleCheck() {
  const issues = compareAnswer();
  const correct = issues.length === 0;

  if (!isBrowseMode()) {
    answeredCount++;

    if (correct) {
      correctCount++;
    }
  }

  if (correct) {
    showFeedback("Correct!", "correct");
  } else {
    showFeedback("Not quite.", "incorrect", issues, true);
  }

  updateScoreDisplay();
  revealAnswer();
}

function handleSkip() {
  skippedCount++;
  skippedCurrent = true;

  let messages = [`Correct structure: ${currentMolecule.formula}`];
  let showExample = true;

  if (isFullAnalysisMode()) {
    if (currentStage === STAGES.electrons) {
      messages = [`Expected ${currentMolecule.valenceElectrons} valence electrons.`];
      showExample = false;
    } else if (currentStage === STAGES.analysis) {
      showExample = false;
      messages = buildAnalysisAnswerMessages();
    }
  }

  if (currentStage === STAGES.electrons) {
    valenceInput.disabled = true;
    valenceCheckBtn.disabled = true;
    sessionValenceCount = currentMolecule.valenceElectrons;
  } else if (currentStage === STAGES.analysis) {
    lockAnalysisForm();
    applyAnalysisFieldHighlights();
  }

  showFeedback("Skipped.", "skipped", messages, showExample);
  revealAnswer();
}

function hideActiveUI() {
  questionArea.style.display = "none";
  electronsStage.classList.add("hidden");
  analysisStage.classList.add("hidden");
  stageStepper.classList.add("hidden");
  taskHeader.classList.add("hidden");
  clearFeedback();
  continueBtn.style.display = "none";
  skipBtn.style.display = "none";
  browseStructuresBtn.classList.add("hidden");
}

function showActiveUI() {
  taskHeader.classList.remove("hidden");
  questionArea.style.display = "";
  instructionContainer.style.display = "";
  applyBrowseSessionUI();
  updateStageUI();
}

function endSession() {
  hideActiveUI();

  finalScreen.style.display = "block";

  const percent =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const tier = getScoreTier(percent);

  finalTier.textContent = `${tier.emoji} ${tier.message}`;
  finalScore.textContent = `${percent}%`;
  finalDetail.textContent = `${correctCount} of ${answeredCount} correct${skippedCount > 0 ? ` · ${skippedCount} skipped` : ""}`;

  progressBar.style.width = "100%";
  questionProgress.textContent = `Structure ${sessionMolecules.length} of ${sessionMolecules.length}`;

  finalHeading.focus();
}

function resetRunState() {
  current = 0;
  correctCount = 0;
  answeredCount = 0;
  skippedCount = 0;
}

async function init() {
  try {
    const res = await fetch("data/chemistry/lewis_structures.json");
    if (!res.ok) throw new Error("Could not load Lewis structure data.");

    toolData = await res.json();

    if (!Array.isArray(toolData.molecules) || toolData.molecules.length === 0) {
      throw new Error("No Lewis structures are available yet.");
    }

    allMolecules = [...toolData.molecules];
    browseMolecules = [...toolData.molecules];
    browsePracticeStyle = getBrowseStyleFromStorage();
    populateAnalysisSelects();

    const titleEl = document.getElementById("lewis-title");
    if (titleEl) {
      titleEl.textContent = toolData.title;
    }

    setTimeout(() => {
      loadingScreen.classList.add("hidden");
      initModeSelection();
    }, 150);
  } catch (error) {
    showError(error.message || "Something went wrong.");
  }
}

checkBtn.addEventListener("click", handleCheck);

diagramSkipBtn?.addEventListener("click", handleSkip);

valenceCheckBtn.addEventListener("click", handleValenceCheck);

analysisCheckBtn.addEventListener("click", handleAnalysisCheck);

valenceInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !valenceCheckBtn.disabled) {
    event.preventDefault();
    handleValenceCheck();
  }
});

resetBtn.addEventListener("click", () => {
  if (questionLocked) return;
  resetState();
  refreshBoard();
  clearFeedback();
  updateElectronCounter();
});

continueBtn.addEventListener("click", () => {
  if (skippedCurrent) {
    skippedCurrent = false;

    if (advanceToNextStage()) {
      return;
    }

    if (!isBrowseMode()) {
      current++;
      loadQuestion();
    }

    return;
  }

  if (advanceToNextStage()) {
    return;
  }

  if (isBrowseMode()) {
    return;
  }

  current++;
  loadQuestion();
});

skipBtn.addEventListener("click", handleSkip);

browseBackBtn.addEventListener("click", exitBrowseToModes);

browseStructuresBtn.addEventListener("click", returnToBrowsePicker);

browseStyleInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked) return;

    browsePracticeStyle = input.value;
    saveBrowseStyle();
    renderBrowsePicker();
  });
});

browseSearchInput?.addEventListener("input", renderBrowsePicker);

retryBtn.addEventListener("click", () => {
  finalScreen.style.display = "none";
  showActiveUI();
  startSession();
});

setupPalette();
init();
