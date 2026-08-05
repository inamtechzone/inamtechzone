/**
 * js/api.js — Central API Client for Google Apps Script Backend
 */

// Configuration: Replace with your deployed Web App URL if dynamic binding isn't used
const API_CONFIG = {
  baseUrl: window.ITZ_API_URL || "https://script.google.com/macros/s/YOUR_EXEC_ID/exec",
  timeout: 15000, // 15 seconds timeout
};

/**
 * Builds standard request URL with parameters
 */
function buildApiUrl(action, params = {}) {
  const url = new URL(API_CONFIG.baseUrl);
  url.searchParams.append("action", action);

  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });

  return url.toString();
}

/**
 * Global API GET Request Wrapper
 */
async function apiGet(action, params = {}) {
  const requestUrl = buildApiUrl(action, params);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    const response = await fetch(requestUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const json = await response.json();

    if (json.success === false) {
      throw new Error(json.message || "API request failed");
    }

    return json;
  } catch (error) {
    console.error(`[API Error] GET ${action}:`, error);
    if (typeof toastError === "function") {
      toastError(error.message || "Network request failed.");
    }
    throw error;
  }
}

/**
 * Global API POST Request Wrapper
 */
async function apiPost(action, payload = {}) {
  const requestUrl = buildApiUrl(action);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    // Google Apps Script requires text/plain to prevent CORS preflight blocking
    const response = await fetch(requestUrl, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const json = await response.json();

    if (json.success === false) {
      throw new Error(json.message || "Operation failed");
    }

    return json;
  } catch (error) {
    console.error(`[API Error] POST ${action}:`, error);
    if (typeof toastError === "function") {
      toastError(error.message || "Failed to submit data.");
    }
    throw error;
  }
}

/**
 * Convenience Methods for Common Store Operations
 */
const StoreAPI = {
  // Fetch products list with filters
  getProducts: (params = {}) => apiGet("products.list", params),

  // Fetch single product by ID or Slug
  getProduct: (idOrSlug) => apiGet("products.get", { id: idOrSlug }),

  // Submit Order / Checkout Payload
  createOrder: (orderData) => apiPost("orders.create", orderData),

  // Fetch Store Categories
  getCategories: () => apiGet("categories.list"),
};

// Export globally for legacy browser compatibility
window.apiGet = apiGet;
window.apiPost = apiPost;
window.StoreAPI = StoreAPI;
