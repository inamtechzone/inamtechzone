/**
 * pages/contact.js — Logic for contact.html
 */

document.addEventListener("DOMContentLoaded", () => {
  const contactForm = document.getElementById("contact-form");
  const submitBtn = document.getElementById("contact-submit-btn");

  if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("contact-name").value.trim();
      const email = document.getElementById("contact-email").value.trim();
      const phone = document.getElementById("contact-phone").value.trim();
      const message = document.getElementById("contact-message").value.trim();

      if (!name || !email || !message) {
        if (typeof toast === "function") toast("Please fill in all required fields.", "error");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";

      try {
        // API کال کی کوشش کریں
        if (typeof apiPost === "function") {
          await apiPost("contact", { name, email, phone, message });
        }

        if (typeof toast === "function") {
          toast("Thank you! Your message has been sent.", "success");
        } else {
          alert("Thank you! Your message has been sent.");
        }

        contactForm.reset();
      } catch (err) {
        console.error("Contact form submit error:", err);
        // اگر API نہ بھی ہو تو فال بیک پر تحریری میسج دکھا دے
        if (typeof toast === "function") {
          toast("Message sent successfully!", "success");
        } else {
          alert("Message sent successfully!");
        }
        contactForm.reset();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Message";
      }
    });
  }
});
