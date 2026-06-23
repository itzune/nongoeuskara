/**
 * Nongoeuskara v2 — Entry point.
 *
 * Sets up theme, UI glue (textarea, dice, length warning), then initializes
 * the D3 map and prediction pipeline.
 */
import { applyTheme, listenForSystemChanges, toggleTheme } from "/src/theme.js";
import "./map.js"; // D3 map (auto-loads, exposes window.euskalkid)
// predict.js and details.js are loaded via script tags in the HTML

// ── Theme ──
applyTheme();
listenForSystemChanges();

const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  const iconDark = themeToggle.querySelector(".theme-icon-dark");
  const iconLight = themeToggle.querySelector(".theme-icon-light");

  function updateToggleIcon() {
    const isDark = document.documentElement.classList.contains("dark");
    if (iconDark) iconDark.style.display = isDark ? "none" : "inline";
    if (iconLight) iconLight.style.display = isDark ? "inline" : "none";
  }
  updateToggleIcon();

  themeToggle.addEventListener("click", () => {
    toggleTheme();
    updateToggleIcon();
  });
}

// ── Textarea auto-resize + length warning ──
const textarea = document.getElementById("textInput");
const diceBtn = document.getElementById("diceBtn");
const lengthWarning = document.getElementById("lengthWarning");
const MIN_WORDS = 8;
const LENGTH_HINT = "Esaldi laburregia: idatzi esaldi oso bat (gutxienez 8 hitz) emaitza fidagarriagoa lortzeko.";
const mapTooltip = document.getElementById("tooltip");

function updateLengthWarning() {
  if (!textarea || !lengthWarning) return;
  const words = textarea.value.trim().split(/\s+/).filter(Boolean).length;
  lengthWarning.classList.toggle("visible", words > 0 && words < MIN_WORDS);
}

function positionTooltip(event) {
  if (!mapTooltip) return;
  const gap = 14;
  const rect = mapTooltip.getBoundingClientRect();
  const h = rect.height || 60;
  let top = event.clientY - h - gap;
  if (top < 8) top = event.clientY + gap;
  mapTooltip.style.left = `${event.clientX + gap}px`;
  mapTooltip.style.top = `${top}px`;
}

if (lengthWarning) {
  lengthWarning.addEventListener("mouseenter", (e) => {
    if (!mapTooltip || !lengthWarning.classList.contains("visible")) return;
    mapTooltip.textContent = LENGTH_HINT;
    mapTooltip.classList.add("visible", "multiline");
    positionTooltip(e);
  });
  lengthWarning.addEventListener("mousemove", (e) => {
    if (!mapTooltip?.classList.contains("visible")) return;
    positionTooltip(e);
  });
  lengthWarning.addEventListener("mouseleave", () => {
    mapTooltip?.classList.remove("visible", "multiline");
  });
}

if (textarea) {
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 180) + "px";
    updateLengthWarning();
  });
  updateLengthWarning();
}

// ── Example sentences ──
const EXAMPLES = [
  "Bakizu, refugiaduek ta honek zerak, eurek hartun ezan dauie alaba batelez.",
  "Bai. Inguru hartatiken jende asko jun zan? Eztakit nik zenbat jende jungo zan.",
  "Zea erdiyan, zea, zolua du gotti tximiniya atea 'ta handikan bota geo zea, brasa.",
  "Jendea garbitzen zen uda partean hagitz ongi, zertaz han garbitu labaderoan arropa eta garbia gelditzen zen!",
  "Ta, ya, bee herrira hots ein zuten 'a ver' balen bazegon neskaan bat nehi zubena fatie, beraakin ezkontzia.",
  "Eta goraintziak bialdu etxera! Eta, eta ni aspaldin ez girela, e, ikusi ez dugu elkar.",
  "Amak ez zien mintzatzen kaskoina, bana aitatxik ba.",
  "Eta gero aitu gintuen Hitler zela, Hendaiat etorria Francorekin elkarrizketa eiteat.",
  "Eta gero etxera xoan eta zer egitan zen, e, aigaritako? Pues… aigaltako? Aigal ona egitan zen, e? Ona, 'y tan' ona!",
  "Bai, eztakit zer adina zan, bainan nik uste det hamabi tiru eman zizkiotela behintzat, bai.",
  "oono beste etxe batetaa ba. Bai? Bai. Eta hona noiz etorri zinen? En cinquante-et-un jinak gintian Domintxineat.",
  "Eskualduna zen buxer hura, eta erran zion: Ez nauzu hartuko, Agustin, zerori, xahal hori, guk etxian badugu hori.",
];

if (diceBtn && textarea) {
  diceBtn.addEventListener("click", () => {
    const ex = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
    textarea.value = ex;
    textarea.dispatchEvent(new Event("input"));
  });
}
