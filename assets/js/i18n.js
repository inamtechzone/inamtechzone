const I18N_LANG_KEY = "itz_lang";
const SUPPORTED_LANGS = ["en", "ur", "ar"];
const RTL_LANGS = ["ur", "ar"];
let i18nDict = {};
async function loadLanguage(lang) {
  if (SUPPORTED_LANGS.indexOf(lang) === -1) lang = "en";
  try {
    const res = await fetch(`/assets/i18n/${lang}.json`);
    i18nDict = await res.json();
  } catch (e) {
    i18nDict = {};
  }
  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("dir", RTL_LANGS.indexOf(lang) !== -1 ? "rtl" : "ltr");
  localStorage.setItem(I18N_LANG_KEY, lang);
  applyTranslations();
}
function t(key) { return i18nDict[key] || key; }
function applyTranslations() {
  qsa("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
}
function currentLanguage() { return localStorage.getItem(I18N_LANG_KEY) || "en"; }
function setLanguage(lang) { loadLanguage(lang); }
document.addEventListener("DOMContentLoaded", () => { loadLanguage(currentLanguage()); });
