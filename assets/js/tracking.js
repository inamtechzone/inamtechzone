const UTM_SESSION_KEY = "itz_utm_session";
function captureUtmOnce_() {
  const existing = sessionStorage.getItem(UTM_SESSION_KEY);
  if (existing) return JSON.parse(existing);
  const url = new URL(window.location.href);
  const data = {
    utmSource: url.searchParams.get("utm_source") || "",
    utmMedium: url.searchParams.get("utm_medium") || "",
    utmCampaign: url.searchParams.get("utm_campaign") || "",
    utmContent: url.searchParams.get("utm_content") || "",
    referrer: document.referrer || "",
    landingPage: window.location.pathname,
  };
  sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(data));
  return data;
}
function getUtmSession() { return captureUtmOnce_(); }
function trackEvent(type, extra) {
  try {
    const session = getUtmSession();
    apiPost("leads.track", Object.assign({ type: type }, session, extra || {})).catch(() => {});
  } catch (e)
}
document.addEventListener("DOMContentLoaded", () => {
  captureUtmOnce_();
  // Generic pageview for pages that don't already call trackEvent("pageview", ...) themselves.
  if (!document.body.hasAttribute("data-skip-pageview")) {
    trackEvent("pageview", { landingPage: window.location.pathname });
  }
});
