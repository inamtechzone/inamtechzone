document.addEventListener("DOMContentLoaded", () => {
  if (isAdminLoggedIn()) { window.location.href = "/admin/index.html"; return; }

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById("login-btn");
    btn.disabled = true; btn.textContent = "Signing in…";
    try {
      await adminLogin(form.email.value, form.password.value);
      window.location.href = "/admin/index.html";
    } catch (err) {
      toastError(err);
      btn.disabled = false; btn.textContent = "Sign in";
    }
  });
});
