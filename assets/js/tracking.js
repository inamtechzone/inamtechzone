const UTM_SESSION_KEY = "itz_utm_session";

function captureUtmOnce_() {
  try {
    const existing = sessionStorage.getItem(UTM_SESSION_KEY);
    if (existing) {
      return JSON.parse(existing);
    }
  } catch (e) {
    // SessionStorage inaccessible ya JSON corrupt hone par safely catch karein
  }

  const url = new URL(window.location.href);
  const data = {
    utmSource: url.searchParams.get("utm_source") || "",
    utmMedium: url.searchParams.get("utm_medium") || "",
    utmCampaign: url.searchParams.get("utm_campaign") || "",
    utmContent: url.searchParams.get("utm_content") || "",
    referrer: document.referrer || "",
    landingPage: window.location.pathname,
  };

  try {
    sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(data));
  } catch (e) {
    // Storage disabled hone par fallback
  }

  return data;
}

function getUtmSession() {
  return captureUtmOnce_();
}

function trackEvent(type, extra) {
  try {
    const session = getUtmSession();
    const payload = Object.assign({ type: type }, session, extra || {});

    // Safe Check: Check karein ke apiPost load ho chuka hai
    if (typeof apiPost === "function") {
      apiPost("leads.track", payload).catch(() => {});
    }
  } catch (e) {
    console.error("Tracking event error:", e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  captureUtmOnce_();
  
  if (!document.body.hasAttribute("data-skip-pageview")) {
    trackEvent("pageview", { landingPage: window.location.pathname });
  }
});
