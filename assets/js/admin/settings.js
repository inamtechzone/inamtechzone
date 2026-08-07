// Global safeguard: Ensures ITZ and API_URL exist without crashing
window.ITZ = window.ITZ || {};
const API_URL = window.ITZ.API_URL || "";

document.addEventListener("DOMContentLoaded", async () => {
  initAdminLayout("settings");

  // Render feed links safely
  const feedLinksEl = document.getElementById("feed-links");
  if (feedLinksEl) {
    feedLinksEl.innerHTML = [
      ["Google Merchant (XML)", "feeds.googleMerchantXml"],
      ["Google Merchant (CSV)", "feeds.googleMerchantCsv"],
      ["Meta Commerce (CSV)", "feeds.metaCommerceCsv"],
    ].map(([label, action]) => `<div><strong>${label}:</strong><br>${API_URL}?action=${action}</div>`).join("");
  }

  // Fetch and populate settings
  try {
    const s = await apiGet("settings.get", {});
    const form = document.getElementById("settings-form");
    if (form) {
      form.storeName.value = s.storeName || "";
      form.whatsappNumber.value = s.whatsappNumber || "";
      form.currency.value = s.currency || "Rs";
      form.shippingRate.value = s.shippingRate || 0;
      form.taxRate.value = s.taxRate || 0;
      form.contactEmail.value = s.contactEmail || "";
      form.contactPhone.value = s.contactPhone || "";
      form.address.value = s.address || "";
      form.facebookUrl.value = s.facebookUrl || "";
      form.instagramUrl.value = s.instagramUrl || "";
      form.darkModeEnabled.checked = s.darkModeEnabled !== false;
    }

    const logoPreview = document.getElementById("logo-preview");
    if (s.logo && logoPreview) {
      logoPreview.src = s.logo;
      logoPreview.style.display = "block";
    }

    const bannerPreview = document.getElementById("banner-preview");
    if (s.banner && bannerPreview) {
      bannerPreview.src = s.banner;
      bannerPreview.style.display = "block";
    }

    window._logoUrl = s.logo || "";
    window._bannerUrl = s.banner || "";
  } catch (e) {
    toastError(e);
  }

  // Logo input handler
  const logoInput = document.getElementById("logo-input");
  if (logoInput) {
    logoInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        window._logoUrl = await uploadImageFile(file);
        const preview = document.getElementById("logo-preview");
        if (preview) {
          preview.src = window._logoUrl;
          preview.style.display = "block";
        }
        toast("Logo uploaded — click Save to apply", "success");
      } catch (err) {
        toastError(err);
      }
    });
  }

  // Banner input handler
  const bannerInput = document.getElementById("banner-input");
  if (bannerInput) {
    bannerInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        window._bannerUrl = await uploadImageFile(file);
        const preview = document.getElementById("banner-preview");
        if (preview) {
          preview.src = window._bannerUrl;
          preview.style.display = "block";
        }
        toast("Banner uploaded — click Save to apply", "success");
      } catch (err) {
        toastError(err);
      }
    });
  }

  // Form submission handler
  const settingsForm = document.getElementById("settings-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      try {
        await apiPost("settings.update", {
          storeName: form.storeName.value,
          whatsappNumber: form.whatsappNumber.value,
          currency: form.currency.value,
          shippingRate: Number(form.shippingRate.value),
          taxRate: Number(form.taxRate.value),
          contactEmail: form.contactEmail.value,
          contactPhone: form.contactPhone.value,
          address: form.address.value,
          facebookUrl: form.facebookUrl.value,
          instagramUrl: form.instagramUrl.value,
          darkModeEnabled: form.darkModeEnabled.checked,
          logo: window._logoUrl || "",
          banner: window._bannerUrl || "",
        });
        toast("Settings saved", "success");
      } catch (err) {
        toastError(err);
      }
    });
  }

  // Password submission handler
  const passwordForm = document.getElementById("password-form");
  if (passwordForm) {
    passwordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const form = e.target;
      if (form.newPassword.value.length < 6) {
        return toast("New password must be at least 6 characters", "error");
      }
      try {
        await apiPost("auth.changePassword", {
          currentPassword: form.currentPassword.value,
          newPassword: form.newPassword.value,
        });
        toast("Password updated", "success");
        form.reset();
      } catch (err) {
        toastError(err);
      }
    });
  }
});
