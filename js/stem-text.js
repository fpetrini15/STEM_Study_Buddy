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

const STEM_PATTERN =
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

function needsStemFormatting(text) {
  return STEM_PATTERN.test(text);
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
  if (!needsStemFormatting(text)) {
    element.textContent = text;
    return;
  }

  element.classList.add("stem-text");
  element.innerHTML = formatStemHtml(text);
}
