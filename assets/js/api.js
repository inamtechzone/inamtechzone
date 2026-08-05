/**
 * api.js
 * Thin wrapper around fetch() for talking to the Apps Script Web App.
 *
 * IMPORTANT: POST bodies are sent with Content-Type: text/plain. This is
 * intentional — it's the standard trick for calling Apps Script Web Apps from
 * a different origin (e.g. Vercel) without triggering a CORS preflight
 * (OPTIONS) request, which Apps Script Web Apps don't handle. The server
 * (Code.gs) still parses the body as JSON regardless of the declared type.
 */
const ITZ = window.ITZ_CONFIG;

function itzToken() {
  return localStorage.getItem("itz_admin_token") || "";
}

async function apiGet(action, params) {
  const query = new URLSearchParams(Object.assign({ action: action }, params || {}));
  const token = itzToken();
  if (token) query.set("token", token);
  const res = await fetch(ITZ.API_URL + "?" + query.toString(), { method: "GET" });
  const json = await res.json();
  if (!json.success) throw new ApiError(json.message, json.code);
  return json.data;
}

// For actions that return raw text (CSV/XML) instead of the {success, data}
// JSON envelope — e.g. products.exportShopifyCsv, feeds.*.
async function apiGetRaw(action, params) {
  const query = new URLSearchParams(Object.assign({ action: action }, params || {}));
  const token = itzToken();
  if (token) query.set("token", token);
  const res = await fetch(ITZ.API_URL + "?" + query.toString(), { method: "GET" });
  if (!res.ok) throw new ApiError(`Request failed (HTTP ${res.status})`, res.status);
  return res.text();
}

async function apiPost(action, payload) {
  const res = await fetch(ITZ.API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: action, token: itzToken(), payload: payload || {} }),
  });
  const json = await res.json();
  if (!json.success) throw new ApiError(json.message, json.code);
  return json.data;
}

const ADMIN_GET_ACTIONS = ["orders.list", "orders.get", "customers.list", "coupons.list",
  "activitylog.list", "reports.summary", "backup.export"];

class ApiError extends Error {
  constructor(message, code) {
    super(message || "Something went wrong");
    this.code = code || 400;
  }
}

// Reads a <input type="file"> FileList into base64 payloads ready for upload.image.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // "data:image/png;base64,AAAA..."
      const base64 = result.split(",")[1];
      resolve({ fileName: file.name, mimeType: file.type, base64: base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImageFile(file) {
  const payload = await fileToBase64(file);
  const data = await apiPost("upload.image", payload);
  return data.url;
}
