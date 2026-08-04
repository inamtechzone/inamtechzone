/**
 * i18n.js
 * ARCHITECTURE-LEVEL READINESS SCAFFOLD, not a full translation of every
 * page. This wires up: a language switcher, per-language JSON dictionaries,
 * RTL layout switching for Arabic/Urdu, and a `data-i18n="key"` attribute
 * convention that translates any element it's added to. Today it's applied
 * to the shared nav/footer as a working example — extending coverage to the
 * rest of the storefront means adding `data-i18n` attributes to the
 * remaining static text and translation keys to the three JSON files; the
 * mechanism underneath already fully supports it.
 */

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
