/**
 * Zeineuski WASM demo — UI logic.
 */
import { loadModels, predict, DIALECT_NAMES, BADGE_CLASS } from "./zeineuski.js";

// ── DOM elements ──
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const sizeHint = document.getElementById("sizeHint");
const variantSize = document.getElementById("variantSize");
const input = document.getElementById("input");
const btnPredict = document.getElementById("btnPredict");
const btnClear = document.getElementById("btnClear");
const result = document.getElementById("result");
const dialectBadge = document.getElementById("dialectBadge");
const confidence = document.getElementById("confidence");
const confidenceFill = document.getElementById("confidenceFill");
const predictionsList = document.getElementById("predictionsList");
const exampleChips = document.getElementById("exampleChips");

// ── Examples ──
const EXAMPLES = [
  {
    label: "batua",
    text: "Gaur goizean, Aitor Esteban EAJko diputatua elkarrizketatuko du ETB1eko albistegian.",
  },
  {
    label: "western",
    text: "Baleike espediente judizialak itzuli biher izetie inglesa ez dan hizkuntza batien irakurtzen daben bezeroentzat.",
  },
  {
    label: "central",
    text: "Gu inguru hontan bizi gea.",
  },
  {
    label: "nav-lab",
    text: "Bena atzuek eskarmentu haundioa zan berko lukete.",
  },
  {
    label: "western",
    text: "Askatasun zibilen historixa tamalgarri horretaz gain.",
  },
  {
    label: "central",
    text: "Ezarpen-proiektu baten fase hori osatzeko, gitxi gorabehera 17 hillabete bihar'txu SCRk.",
  },
  {
    label: "nav-lab",
    text: "Ene exenpluik maiteena igela ta uliaina da.",
  },
  {
    label: "batua",
    text: "Euskal Herriko Unibertsitateak ikastaro berria antolatu du datorren ikasturterako.",
  },
];

// ── Set up examples ──
EXAMPLES.forEach((ex) => {
  const chip = document.createElement("div");
  chip.className = "example-chip";
  chip.innerHTML = `<span class="chip-label">${ex.label}</span>${ex.text.slice(0, 80)}…`;
  chip.addEventListener("click", () => {
    input.value = ex.text;
    doPredict();
  });
  exampleChips.appendChild(chip);
});

// ── Buttons ──
btnPredict.addEventListener("click", doPredict);
btnClear.addEventListener("click", () => {
  input.value = "";
  result.classList.remove("visible");
});

// Enter key to predict
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    doPredict();
  }
});

// ── Predict ──
function doPredict() {
  const text = input.value.trim();
  if (!text) return;

  try {
    const res = predict(text, 0.7);

    const badgeClass = BADGE_CLASS[res.dialect] || "badge-uncertain";
    dialectBadge.innerHTML = `<span class="dialect-badge ${badgeClass}">${res.dialectName}</span>`;

    const confPct = (res.confidence * 100).toFixed(1);
    confidence.textContent = `${confPct}%`;
    confidenceFill.style.width = `${res.confidence * 100}%`;

    predictionsList.innerHTML = "";
    if (res.predictions.length === 0 && res.dialect === "batua") {
      predictionsList.innerHTML =
        '<li><span class="pred-label">batua</span><span class="pred-conf">—</span></li>';
    } else {
      res.predictions.forEach((p) => {
        const li = document.createElement("li");
        const name = DIALECT_NAMES[p.label] || p.label;
        li.innerHTML = `<span class="pred-label">${name}</span><span class="pred-conf">${(p.confidence * 100).toFixed(1)}%</span>`;
        predictionsList.appendChild(li);
      });
    }

    result.classList.add("visible");
  } catch (err) {
    console.error("Prediction error:", err);
    statusText.textContent = "Error during prediction: " + err.message;
  }
}

// ── Initialize ──
async function init() {
  try {
    await loadModels((msg) => {
      statusText.textContent = msg;
      if (msg === "✓ Ready") {
        statusDot.className = "status-dot ready";
        btnPredict.disabled = false;
        sizeHint.style.display = "block";
        variantSize.textContent = "34";
      }
    });
  } catch (err) {
    console.error("Failed to load models:", err);
    statusDot.className = "status-dot error";
    statusText.textContent =
      "Error loading models. Check console for details.";
  }
}

init();
