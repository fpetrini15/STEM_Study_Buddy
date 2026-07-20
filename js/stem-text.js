const SUBSCRIPT_MAP = {
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
};

const SUPERSCRIPT_MAP = {
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
};

// Sub/superscripts and digit stoichiometry get markup; the STEM serif face is
// applied only on dedicated formula elements (see setStemText).
const STEM_MARKUP_PATTERN =
  /[₀-₉⁰-⁹⁺⁻₊₋]|[A-Za-z\)]\d|\d(?=[A-Za-z])/;

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mapScriptRun(run, map) {
  return [...run]
    .map((char) => map[char] ?? char)
    .join("");
}

function needsStemMarkup(text) {
  return STEM_MARKUP_PATTERN.test(text);
}

function isDedicatedFormulaElement(element) {
  return (
    element.classList.contains("lewis-formula") ||
    element.classList.contains("lewis-browse-item-formula")
  );
}

function formatStemHtml(text) {
  let html = escapeHtml(text);

  html = html.replace(/[₀-₉₊₋]+/g, (run) => {
    return `<sub>${mapScriptRun(run, SUBSCRIPT_MAP)}</sub>`;
  });

  html = html.replace(/[⁰-⁹⁺⁻]+/g, (run) => {
    return `<sup>${mapScriptRun(run, SUPERSCRIPT_MAP)}</sup>`;
  });

  html = html.replace(/([A-Za-z\)])(\d+)/g, "$1<sub>$2</sub>");

  return html;
}

function setStemText(element, text) {
  const value = String(text ?? "");
  const dedicated = isDedicatedFormulaElement(element);
  const markup = needsStemMarkup(value);
  // STEM serif is reserved for dedicated formula chips (e.g. Lewis). Quiz prompts,
  // options, and feedback stay on the UI face so mixed prose doesn't flicker fonts.
  const useStemFont = dedicated;

  if (useStemFont) {
    element.classList.add("stem-text");
  } else {
    element.classList.remove("stem-text");
  }

  if (markup) {
    element.innerHTML = formatStemHtml(value);
    return;
  }

  element.textContent = value;
}
