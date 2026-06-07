/**
 * Zeineuski WASM — Basque dialect identification in the browser.
 *
 * Hierarchical 2-step classifier using fasttext.wasm.js:
 *   1. Binary: batua vs dialectal
 *   2. Dialect: 5-class euskalkiak
 */

// Models hosted on Hugging Face Hub
const HF_BASE = "https://huggingface.co/itzune/zeineuski/resolve/main";
const MODEL_FILES = {
  binary: `${HF_BASE}/models/hier_binary_web.bin`,
  dialect: `${HF_BASE}/models/hier_dialect_web.bin`,
};

const DIALECT_NAMES = {
  batua: "Batua (Euskara Batua)",
  western: "Mendebaldekoa (Bizkaiera)",
  central: "Erdialdekoa (Gipuzkera)",
  "nav-lab": "Nafar-Lapurtera",
  uncertain: "Zalantzazkoa",
};

const BADGE_CLASS = {
  batua: "badge-batua",
  western: "badge-western",
  central: "badge-central",
  "nav-lab": "badge-nav-lab",
  uncertain: "badge-uncertain",
};

// ── State ──
let binaryModel = null;
let dialectModel = null;
let _loaded = false;

// ── Load WASM module and models ──
async function getFastText() {
  // fasttext.wasm.js provides ESM exports for browser via the package.json exports field
  const { getFastTextClass } = await import("fasttext.wasm.js");
  const FastTextClass = await getFastTextClass();
  return new FastTextClass();
}

export async function loadModels(onProgress) {
  if (_loaded) return { binaryModel, dialectModel };

  onProgress?.("Loading WASM module…");
  const ft = await getFastText();

  onProgress?.("Loading binary model (batua vs dialectal, 21MB)…");
  binaryModel = await ft.loadModel(MODEL_FILES.binary);

  onProgress?.("Loading dialect model (5-class, 13MB)…");
  dialectModel = await ft.loadModel(MODEL_FILES.dialect);

  _loaded = true;
  onProgress?.("✓ Ready");

  return { binaryModel, dialectModel };
}

// ── Prediction ──
export function predict(text, threshold = 0.7) {
  if (!_loaded) throw new Error("Models not loaded. Call loadModels() first.");

  text = text.replace(/\n/g, " ").trim();
  if (!text) {
    return {
      dialect: "uncertain",
      confidence: 0,
      dialectName: "No text",
      predictions: [],
    };
  }

  // Step 1: Binary
  const [binLabels, binProbs] = binaryModel.predict(text, 1);
  const binLabel = binLabels[0];
  const binConf = binProbs[0];

  if (binLabel === "__label__batua") {
    return {
      dialect: "batua",
      confidence: binConf,
      dialectName: DIALECT_NAMES.batua,
      predictions: [{ label: "batua", confidence: binConf }],
    };
  }

  // Step 2: Dialect
  const [labels, probs] = dialectModel.predict(text, 3);

  const topLabel = labels[0].replace("__label__", "");
  const topConf = probs[0];

  const predictions = [];
  for (let i = 0; i < labels.length; i++) {
    predictions.push({
      label: labels[i].replace("__label__", ""),
      confidence: probs[i],
    });
  }

  if (topConf < threshold) {
    return {
      dialect: "uncertain",
      confidence: topConf,
      dialectName: `Zalantzazkoa (${DIALECT_NAMES[topLabel] || topLabel}?)`,
      predictions,
    };
  }

  return {
    dialect: topLabel,
    confidence: topConf,
    dialectName: DIALECT_NAMES[topLabel] || topLabel,
    predictions,
  };
}

export { DIALECT_NAMES, BADGE_CLASS, _loaded as loaded };
