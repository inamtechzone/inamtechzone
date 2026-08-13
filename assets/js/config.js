// Configuration Settings
window.ITZ_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbxuKOpTYh5BtpO20atki3kQGsg84uB7R-IfcNICwiVeOPFg5_FUzVdbStkWyJbQ8wh8Hw/exec",
  STORE_NAME: "INAM TECH ZONE",
  WHATSAPP_NUMBER: "923341215808", // Updated WhatsApp Number
  CURRENCY: "Rs.",
  DELIVERY_CHARGES: 350,          // Manual Delivery / Hub Fee
  FREE_DELIVERY_ABOVE: 0,      // Free delivery threshold
};

// Aliases (Attaching directly to window prevents 'already declared' SyntaxErrors)
window.ITZ = window.ITZ_CONFIG;
window.CONFIG = window.ITZ_CONFIG;
window.API_URL = window.ITZ_CONFIG.API_URL;
window.DELIVERY_CHARGES = window.ITZ_CONFIG.DELIVERY_CHARGES;
