const ITZ = window.ITZ_CONFIG;

function itzToken() {
  return localStorage.getItem("itz_admin_token") || "";
}

async function apiGet(action, params) {
  // _t: Date.now() شامل کرنے سے براؤزر پرانا کیشے ریڈ نہیں کرے گا
  const queryParams = Object.assign({ action: action, _t: Date.now() }, params || {});
  const query = new URLSearchParams(queryParams);
  const token = itzToken();
  if (token) query.set("token", token);

  const res = await fetch(ITZ.API_URL + "?" + query.toString(), { 
    method: "GET",
    cache: "no-store" // کیشے بائی پاس کرنے کے لیے
  });
  const json = await res.json();
  if (!json.success) throw new ApiError(json.message, json.code);
  return json.data;
}

async function apiGetRaw(action, params) {
  const queryParams = Object.assign({ action: action, _t: Date.now() }, params || {});
  const query = new URLSearchParams(queryParams);
  const token = itzToken();
  if (token) query.set("token", token);

  const res = await fetch(ITZ.API_URL + "?" + query.toString(), { 
    method: "GET",
    cache: "no-store"
  });
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

const ADMIN_GET_ACTIONS = [
  "orders.list", "orders.get", "customers.list", "coupons.list",
  "activitylog.list", "reports.summary", "backup.export"
];

class ApiError extends Error {
  constructor(message, code) {
    super(message || "Something went wrong");
    this.code = code || 400;
  }
}

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
