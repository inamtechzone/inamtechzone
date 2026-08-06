document.addEventListener("DOMContentLoaded", function() {
    // 1. Header کو لوڈ کرنا
    const headerContainer = document.getElementById("header-placeholder");
    if (headerContainer) {
        fetch("/components/header.html")
            .then(response => response.text())
            .then(data => {
                headerContainer.innerHTML = data;
            })
            .catch(error => console.error("Error loading header:", error));
    }

    // 2. Footer کو لوڈ کرنا
    const footerContainer = document.getElementById("footer-placeholder");
    if (footerContainer) {
        fetch("/components/footer.html")
            .then(response => response.text())
            .then(data => {
                footerContainer.innerHTML = data;
            })
            .catch(error => console.error("Error loading footer:", error));
    }
});
