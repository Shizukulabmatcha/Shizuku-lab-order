/**
 * Shizuku Lab order email notifications
 *
 * Deploy this file as a Google Apps Script web app. The matching Supabase
 * trigger sends a completed payment-submission payload here; GmailApp then
 * emails the shop owner. Keep SHARED_SECRET identical to the value used in
 * supabase-email-notifications.sql.
 */
const RECIPIENT_EMAIL = "tinghuioh29@gmail.com";
const SHARED_SECRET = "REPLACE_WITH_THE_SAME_LONG_RANDOM_SECRET";

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!payload.secret || payload.secret !== SHARED_SECRET) {
      return jsonResponse({ ok: false, error: "Unauthorized" });
    }

    const order = payload.order || {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    const orderNumber = text(order.order_number || order.id || "Unknown order");
    const itemLines = items.length
      ? items.map(function (item) {
          const options = Array.isArray(item.options) && item.options.length
            ? " (" + item.options.map(function (option) { return text(option.option_name); }).join(", ") + ")"
            : "";
          return "• " + Number(item.quantity || 1) + " × " + text(item.product_name || "Item") + options;
        }).join("\n")
      : "• Order items are available in the admin dashboard.";

    const subject = "New paid order " + orderNumber + " · $" + Number(order.total || 0).toFixed(2);
    const body = [
      "A customer has uploaded payment proof.",
      "",
      "Order: " + orderNumber,
      "Customer: " + text(order.customer_name),
      "Phone: " + text(order.customer_phone),
      "Instagram: " + (order.instagram ? "@" + text(order.instagram) : "—"),
      "Pickup: " + text(order.collection_date) + " · " + text(order.collection_time),
      "Total: $" + Number(order.total || 0).toFixed(2),
      "PayNow transaction reference: " + text(order.transaction_reference || "Not provided"),
      "",
      "Items",
      itemLines,
      "",
      "Customer notes: " + text(order.notes || "—"),
      "",
      "Payment screenshot has been uploaded. Open the Shizuku Lab admin dashboard to review and confirm it."
    ].join("\n");

    GmailApp.sendEmail(RECIPIENT_EMAIL, subject, body, {
      name: "Shizuku Lab Orders"
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function text(value) {
  return String(value == null || value === "" ? "—" : value).replace(/[\r\n]+/g, " ").trim();
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
