/**
 * Nongoeuskara v2 — D3-based interactive municipality map of Euskal Herria.
 *
 * Renders municipalities from a pre-built TopoJSON file using D3-geo for
 * projection and path generation. Supports zoom/pan via d3.zoom(), plus
 * the same prediction-driven zone highlighting as v1.
 */
import * as d3 from "d3";
import * as topojson from "topojson-client";
import { ZUERRERA_REGION } from "/src/towns.js";

const MODEL_LABELS = {
  "mendebal-sartaldea":   { name: "Mendebal-sartaldea",   color: "#8b5cf6" },
  "mendebal-sortaldea":   { name: "Mendebal-sortaldea",   color: "#7c3aed" },
  "erdialde-sartaldea":   { name: "Erdialde-sartaldea",   color: "#06b6d4" },
  "erdialde-sortaldea":   { name: "Erdialde-sortaldea",   color: "#0ea5e9" },
  "nafar-ipar-sartaldea": { name: "Nafar ipar-sartaldea", color: "#f59e0b" },
  "nafar-erdigunea":      { name: "Nafar erdigunea",      color: "#10b981" },
  "nafar-hego-sartaldea": { name: "Nafar hego-sartaldea", color: "#84cc16" },
  "nafar-sortaldea":      { name: "Nafar sortaldea",      color: "#f97316" },
  "naflap-sartaldea":     { name: "Naf-lapur sartaldea",  color: "#ec4899" },
  "naflap-sortaldea":     { name: "Naf-lapur sortaldea",  color: "#d946ef" },
  "zuberera":             { name: "Zuberera",             color: "#14b8a6" },
  "ekialde-nafarra":      { name: "Ekialdeko nafarra",    color: "#ef4444" },
};

const EUSKALKI_OF = {
  "mendebal-sartaldea":   "bizkaiera",
  "mendebal-sortaldea":   "bizkaiera",
  "erdialde-sartaldea":   "gipuzkera",
  "erdialde-sortaldea":   "gipuzkera",
  "nafar-ipar-sartaldea": "nafarrera",
  "nafar-erdigunea":      "nafarrera",
  "nafar-hego-sartaldea": "nafarrera",
  "nafar-sortaldea":      "nafarrera",
  "naflap-sartaldea":     "nafar-lapurtera",
  "naflap-sortaldea":     "nafar-lapurtera",
  "zuberera":             "zuberera",
  "ekialde-nafarra":      "ekialde-nafarra",
};

const EUSKALKI_NAMES = {
  "bizkaiera":       "Bizkaiera",
  "gipuzkera":       "Gipuzkera",
  "nafarrera":       "Nafarrera",
  "nafar-lapurtera": "Nafar-lapurtera",
  "zuberera":        "Zuberera",
  "ekialde-nafarra": "Ekialdeko nafarra",
};

let svg, g, projection, path, geoFeatures = [];
let currentActive = null, currentSecondary = null, currentEuskalki = null;
let zoomBehavior = null;

function getComputedFill(label) {
  return MODEL_LABELS[label]?.color || "var(--map-mun-fill)";
}

function getEuskalkiFill() {
  return "var(--map-euskalki-fill, #b9c3ce)";
}

// ── Tooltip ──
const tooltip = document.getElementById("tooltip");
const badge = document.getElementById("predictionBadge");
const badgeSwatch = document.getElementById("predictionSwatch");
const badgeName = document.getElementById("predictionName");
const badgeSecondary = document.getElementById("predictionSecondary");

function getZoneName(label, townName) {
  if (label === "zuberera" && townName && ZUERRERA_REGION[townName]) {
    return ZUERRERA_REGION[townName];
  }
  return MODEL_LABELS[label]?.name || null;
}

function moveTooltip(event) {
  const pad = 14;
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  const rect = tooltip.getBoundingClientRect();
  if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - pad;
  if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - pad;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function showTooltip(d, event) {
  const name = d?.properties?.name;
  if (!name || !tooltip) return;
  const zone = getZoneName(d.properties.label, name);
  tooltip.innerHTML = "";
  const strong = document.createElement("strong");
  strong.textContent = name;
  tooltip.appendChild(strong);
  if (zone) {
    const span = document.createElement("span");
    span.textContent = ` · ${zone}`;
    span.style.opacity = "0.65";
    tooltip.appendChild(span);
  }
  tooltip.classList.add("visible");
  moveTooltip(event);
}

// ── Highlighting ──
function applyStyles() {
  if (!g) return;
  g.selectAll(".mun")
    .attr("fill", d => {
      const label = d.properties.label;
      if (currentActive && label === currentActive) return getComputedFill(label);
      if (currentSecondary && label === currentSecondary) return getComputedFill(label);
      if (currentEuskalki && d.properties.euskalki === currentEuskalki) return getEuskalkiFill();
      return "var(--map-mun-fill)";
    })
    .attr("fill-opacity", d => {
      const label = d.properties.label;
      if (currentActive && label === currentActive) return "var(--map-active-opacity)";
      if (currentSecondary && label === currentSecondary) return "var(--map-secondary-opacity)";
      if (currentActive && !label) return 0.55;
      return 1;
    })
    .attr("stroke", d => {
      const label = d.properties.label;
      if (currentActive && label === currentActive) return getComputedFill(label);
      if (currentSecondary && label === currentSecondary) return getComputedFill(label);
      return "var(--map-mun-stroke)";
    })
    .attr("stroke-opacity", d => {
      if (currentSecondary && d.properties.label === currentSecondary) return "var(--map-secondary-stroke-opacity)";
      return 1;
    })
    .attr("stroke-width", d => {
      if (currentSecondary && d.properties.label === currentSecondary) return 0.8;
      return 0.4;
    })
    .attr("stroke-dasharray", d => {
      if (currentSecondary && d.properties.label === currentSecondary) return "2 1.5";
      return null;
    });
}

function highlightLabel(modelLabel, secondaryLabel) {
  currentActive = MODEL_LABELS[modelLabel] ? modelLabel : null;
  currentSecondary = MODEL_LABELS[secondaryLabel] && secondaryLabel !== modelLabel ? secondaryLabel : null;
  currentEuskalki = currentActive ? EUSKALKI_OF[currentActive] || null : null;
  applyStyles();
}

function clearHighlight() {
  currentActive = null;
  currentSecondary = null;
  currentEuskalki = null;
  applyStyles();
  if (badge) badge.classList.remove("visible", "has-details");
}

function pinLabel(modelLabel, secondaryLabel, confidence) {
  highlightLabel(modelLabel, secondaryLabel);
  const info = MODEL_LABELS[modelLabel];
  if (info && badge && badgeSwatch && badgeName) {
    badgeSwatch.style.backgroundColor = info.color;
    const pct = confidence != null ? `${(confidence * 100).toFixed(0)}%` : "";
    const euskalki = EUSKALKI_NAMES[EUSKALKI_OF[modelLabel]] || info.name;
    badgeName.textContent = euskalki;
    if (badgeSecondary) {
      badgeSecondary.textContent = pct ? `${info.name} · ${pct}` : info.name;
    }
    badge.classList.add("visible", "has-details");
  }
}

// ── Load and render ──
async function loadMap() {
  const container = document.getElementById("mapContainer");
  if (!container) { console.error("mapContainer not found"); return; }

  try {
    // CSS stylesheet for municipality base styles
    const style = document.createElement("style");
    style.textContent = `
      .mun {
        fill: var(--map-mun-fill, #dde2e7);
        stroke: var(--map-mun-stroke, #c2cad2);
        stroke-width: 0.6;
        stroke-linejoin: round;
        transition: fill 0.25s ease, fill-opacity 0.25s ease;
        cursor: default;
        vector-effect: non-scaling-stroke;
      }
      .mun:hover {
        stroke: var(--color-accent, #e85d75);
        stroke-width: 1;
      }
      .province {
        fill: none;
        stroke: var(--map-province-stroke, #8a949e);
        stroke-width: 1.1;
        stroke-linejoin: round;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);

    // Load TopoJSON
    const topoResp = await fetch(`${import.meta.env.BASE_URL}euskal-herria.json`);
    if (!topoResp.ok) throw new Error(`Fetch failed: ${topoResp.status}`);
    const topo = await topoResp.json();
    const objName = Object.keys(topo.objects)[0];
    geoFeatures = topojson.feature(topo, topo.objects[objName]).features;
    console.log("Loaded", geoFeatures.length, "municipalities");

    const geojson = { type: "FeatureCollection", features: geoFeatures };

    // Set up SVG
    const box = container.getBoundingClientRect();
    const width = box.width || 900;
    const height = box.height || 700;

    svg = d3.select("#mapContainer")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    // White/theme background behind the map
    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "var(--color-panel, #ffffff)");

    projection = d3.geoEquirectangular().fitSize([width, height], geojson);
    path = d3.geoPath(projection);

    // Zoom/pan group
    g = svg.append("g");

    // Province outlines
    const provinces = d3.groups(geoFeatures, d => d.properties.province);
    const provG = g.append("g").attr("class", "provinces");
    for (const [, feats] of provinces) {
      provG.append("path")
        .datum({
          type: "Feature",
          geometry: {
            type: "MultiPolygon",
            coordinates: feats.flatMap(f => {
              const g = f.geometry;
              if (g.type === "Polygon") return [g.coordinates];
              if (g.type === "MultiPolygon") return g.coordinates;
              return [];
            }),
          },
        })
        .attr("class", "province")
        .attr("d", path);
    }

    // Municipality paths
    const munG = g.append("g").attr("class", "municipalities");
    munG.selectAll("path")
      .data(geoFeatures)
      .join("path")
      .attr("class", "mun")
      .attr("d", path)
      .on("pointermove", function(event, d) {
        showTooltip(d, event);
        d3.select(this).attr("stroke", "var(--color-accent)").attr("stroke-width", 1);
      })
      .on("pointerleave", function() {
        if (tooltip) tooltip.classList.remove("visible");
        if (!currentActive) {
          d3.select(this).attr("stroke", "var(--map-mun-stroke)").attr("stroke-width", 0.4);
        }
      });

    // Zoom behavior
    zoomBehavior = d3.zoom()
      .scaleExtent([1, 5])
      .translateExtent([[0, 0], [width, height]])
      .on("zoom", event => { g.attr("transform", event.transform); });
    svg.call(zoomBehavior);

    // Zoom buttons
    document.getElementById("zoomIn")?.addEventListener("click", () => {
      svg.transition().duration(250).call(zoomBehavior.scaleBy, 1.3);
    });
    document.getElementById("zoomOut")?.addEventListener("click", () => {
      svg.transition().duration(250).call(zoomBehavior.scaleBy, 0.7);
    });
    document.getElementById("zoomReset")?.addEventListener("click", () => {
      svg.transition().duration(400).call(zoomBehavior.transform, d3.zoomIdentity);
    });

    // Hide map hint on first interaction
    const mapHint = document.getElementById("mapHint");
    if (mapHint) {
      svg.on("pointerover", () => { mapHint.style.display = "none"; }, { once: true });
    }

    // Theme change → reapply
    new MutationObserver(() => applyStyles())
      .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // Resize handling
    new ResizeObserver(() => {
      const b = container.getBoundingClientRect();
      const w = b.width || 900;
      const h = b.height || 700;
      svg.attr("width", w).attr("height", h).attr("viewBox", `0 0 ${w} ${h}`);
      projection = d3.geoEquirectangular().fitSize([w, h], geojson);
      path = d3.geoPath(projection);
      g.selectAll("path").attr("d", path);
      svg.call(zoomBehavior.transform, d3.zoomIdentity);
    }).observe(container);

    console.log("Map rendered successfully");
  } catch (err) {
    console.error("Map load failed:", err);
    const c = document.getElementById("mapContainer");
    if (c) c.textContent = "Mapa ezin da kargatu: " + err.message;
  }
}

// Start loading — don't wait for DOM (modules are deferred)
loadMap();

// ── Public API ──
window.euskalkid = { highlightLabel, clearHighlight, pinLabel, MODEL_LABELS, EUSKALKI_OF, EUSKALKI_NAMES };
