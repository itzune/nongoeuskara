/**
 * Nongoeuskara — Monochrome map with model-label-based zone highlighting.
 *
 * Loads the remapped SVG where each <g> and <path> has a `data-model-label`
 * attribute matching one of the 12 tier-3 azpieuskalki model output classes.
 *
 * Default: all paths in muted grey.
 * On hover/click: highlight all SVG elements with a matching data-model-label.
 * Programmatic API: window.euskalkid.highlightLabel("mendebal-sartaldea")
 */

const MODEL_LABELS = {
  "mendebal-sartaldea":   { name: "Mendebal-sartaldea",    color: "#8b5cf6" },
  "mendebal-sortaldea":   { name: "Mendebal-sortaldea",    color: "#7c3aed" },
  "erdialde-sartaldea":   { name: "Erdialde-sartaldea",    color: "#06b6d4" },
  "erdialde-sortaldea":   { name: "Erdialde-sortaldea",    color: "#0ea5e9" },
  "nafar-ipar-sartaldea": { name: "Nafar ipar-sartaldea",  color: "#f59e0b" },
  "nafar-erdigunea":      { name: "Nafar erdigunea",        color: "#10b981" },
  "nafar-hego-sartaldea": { name: "Nafar hego-sartaldea",  color: "#84cc16" },
  "nafar-sortaldea":      { name: "Nafar sortaldea",        color: "#f97316" },
  "naflap-sartaldea":     { name: "Naf-lapur sartaldea",    color: "#ec4899" },
  "naflap-sortaldea":     { name: "Naf-lapur sortaldea",    color: "#d946ef" },
  "zuberera":             { name: "Zuberera",               color: "#14b8a6" },
  "ekialde-nafarra":      { name: "Ekialdeko nafarra",      color: "#ef4444" },
};

const DISABLED_FILL = "#d0d5da";
const DISABLED_STROKE = "#bcc4cc";

const container = document.getElementById("mapContainer");
const legend = document.getElementById("legend");
const tooltip = document.getElementById("tooltip");

let svgRoot = null;
let highlightedLabel = null;

const NS_INKSCAPE = "http://www.inkscape.org/namespaces/inkscape";

function buildLegend() {
  for (const [label, info] of Object.entries(MODEL_LABELS)) {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.dataset.modelLabel = label;

    const swatch = document.createElement("div");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = info.color;

    const name = document.createElement("span");
    name.textContent = info.name;

    item.append(swatch, name);

    item.addEventListener("click", () => {
      if (highlightedLabel === label) {
        clearHighlight();
      } else {
        highlightLabel(label);
      }
    });

    legend.appendChild(item);
  }
}

/**
 * Find the model label for a given SVG element.
 * Checks the element itself and its ancestor groups.
 */
function getModelLabel(el) {
  // Check the element
  if (el.dataset?.modelLabel) return el.dataset.modelLabel;

  // Walk up ancestor tree
  let current = el;
  while (current && current !== svgRoot) {
    if (current.dataset?.modelLabel) return current.dataset.modelLabel;
    current = current.parentElement;
  }
  return null;
}

/**
 * Find a human-readable name for the hovered element.
 */
function getElementName(el) {
  // Try path id
  if (el.id && !el.id.startsWith("path")) return el.id;

  // Try parent <g> id
  const parent = el.closest("g[id]");
  if (parent && parent.id) {
    // Skip if it's an Inkscape-layer <g>
    if (parent.hasAttributeNS?.(NS_INKSCAPE, "label")) return null;
    if (!parent.id.startsWith("g") && !parent.id.startsWith("layer")) {
      return parent.id;
    }
  }
  return null;
}

/**
 * Turn all paths into uniform muted grey.
 */
function greyOutAll() {
  if (!svgRoot) return;
  const paths = svgRoot.querySelectorAll("path");
  paths.forEach((p) => {
    p.style.fill = DISABLED_FILL;
    p.style.fillOpacity = "1";
    p.style.stroke = DISABLED_STROKE;
    p.style.strokeOpacity = "1";
    p.style.filter = "";
  });
}

async function loadMap() {
  const resp = await fetch("./map.svg");
  const text = await resp.text();

  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(text, "image/svg+xml");
  const importedSvg = svgDoc.documentElement;

  container.innerHTML = "";
  container.appendChild(document.importNode(importedSvg, true));
  svgRoot = container.querySelector("svg");
  if (!svgRoot) return;

  svgRoot.setAttribute("width", "100%");
  svgRoot.setAttribute("height", "100%");

  // Turn all paths grey
  greyOutAll();

  // Attach hover listeners to all paths
  const allPaths = svgRoot.querySelectorAll("path");
  allPaths.forEach((path) => {
    path.addEventListener("mouseenter", (e) => {
      const label = getModelLabel(path);
      if (label) {
        highlightLabel(label);
        // Show tooltip with town name + zone
        const townName = getElementName(path);
        const zoneName = MODEL_LABELS[label]?.name || label;
        tooltip.textContent = townName ? `${townName} — ${zoneName}` : zoneName;
        tooltip.classList.add("visible");
        moveTooltip(e);
      }
    });

    path.addEventListener("mouseleave", () => {
      if (highlightedLabel !== getModelLabel(path)) {
        resetHighlight();
      }
      tooltip.classList.remove("visible");
    });

    path.addEventListener("mousemove", (e) => {
      moveTooltip(e);
    });
  });
}

/**
 * Highlight all paths with the given model label.
 */
function highlightLabel(modelLabel) {
  if (highlightedLabel === modelLabel) return;
  resetHighlight();

  if (!svgRoot) return;

  const info = MODEL_LABELS[modelLabel];
  const color = info?.color || "#ff0000";

  // Find all paths that match this model label (on path or ancestor <g>)
  const allPaths = svgRoot.querySelectorAll("path");
  allPaths.forEach((p) => {
    const pathLabel = getModelLabel(p);
    if (pathLabel === modelLabel) {
      p.style.fill = color;
      p.style.fillOpacity = "0.85";
      p.style.stroke = "#333";
      p.style.strokeOpacity = "0.6";
      p.style.filter = "drop-shadow(0 0 2px rgba(0,0,0,0.25))";
    }
  });

  highlightedLabel = modelLabel;

  // Update legend
  legend.querySelectorAll(".legend-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.modelLabel === modelLabel);
  });
}

function clearHighlight() {
  resetHighlight();
  highlightedLabel = null;
  legend.querySelectorAll(".legend-item").forEach((item) => {
    item.classList.remove("active");
  });
}

function resetHighlight() {
  if (!svgRoot) return;
  const paths = svgRoot.querySelectorAll("path");
  paths.forEach((p) => {
    p.style.fill = DISABLED_FILL;
    p.style.fillOpacity = "1";
    p.style.stroke = DISABLED_STROKE;
    p.style.strokeOpacity = "1";
    p.style.filter = "";
  });
}

function moveTooltip(event) {
  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
}

// Init
buildLegend();
loadMap();

// Public API for model integration
window.euskalkid = {
  highlightLabel,
  clearHighlight,
  MODEL_LABELS,
};
