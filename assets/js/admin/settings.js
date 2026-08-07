document.addEventListener("DOMContentLoaded", async () => {
  initAdminLayout("settings");

  document.getElementById("feed-links").innerHTML = [
    ["Google Merchant (XML)", "feeds.googleMerchantXml"],
    ["Google Merchant (CSV)", "feeds.googleMerchantCsv"],
    ["Meta Commerce (CSV)", "feeds.metaCommerceCsv"],
  ].map(([label, action]) => `<div><strong>${label}:</strong><br>${ITZ.API_URL}?action=${action}</div>`).join("");

  try {
    const s = await apiGet("settings.get", {});
    const form = document.getElementById("settings-form");
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
    if (s.logo) { document.getElementById("logo-preview").src = s.logo; document.getElementById("logo-preview").style.display = "block"; }
    if (s.banner) { document.getElementById("banner-preview").src = s.banner; document.getElementById("banner-preview").style.display = "block"; }
    window._logoUrl = s.logo || "";
    window._bannerUrl = s.banner || "";
  } catch (e) { toastError(e); }

  document.getElementById("logo-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      window._logoUrl = await uploadImageFile(file);
      document.getElementById("logo-preview").src = window._logoUrl;
      document.getElementById("logo-preview").style.display = "block";
      toast("Logo uploaded — click Save to apply", "success");
    } catch (err) { toastError(err); }
  });

  document.getElementById("banner-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      window._bannerUrl = await uploadImageFile(file);
      document.getElementById("banner-preview").src = window._bannerUrl;
      document.getElementById("banner-preview").style.display = "block";
      toast("Banner uploaded — click Save to apply", "success");
    } catch (err) { toastError(err); }
  });

  document.getElementById("settings-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      await apiPost("settings.update", {
        storeName: form.storeName.value, whatsappNumber: form.whatsappNumber.value,
        currency: form.currency.value, shippingRate: Number(form.shippingRate.value),
        taxRate: Number(form.taxRate.value), contactEmail: form.contactEmail.value,
        contactPhone: form.contactPhone.value, address: form.address.value,
        facebookUrl: form.facebookUrl.value, instagramUrl: form.instagramUrl.value,
        darkModeEnabled: form.darkModeEnabled.checked,
        logo: window._logoUrl || "", banner: window._bannerUrl || "",
      });
      toast("Settings saved", "success");
    } catch (err) { toastError(err); }
  });

  document.getElementById("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.newPassword.value.length < 6) return toast("New password must be at least 6 characters", "error");
    try {
      await apiPost("auth.changePassword", { currentPassword: form.currentPassword.value, newPassword: form.newPassword.value });
      toast("Password updated", "success");
      form.reset();
    } catch (err) { toastError(err); }
  });
});
