const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("./admin-order-rules.js");

test("cancelled pending-confirmation orders produce zero payment-review alerts", () => {
  const orders = [{ id: "cancelled-audit-order", payment_status: "pending_confirmation", order_status: "cancelled" }];
  assert.equal(orders.filter(rules.isPaymentReviewOrder).length, 0);
  assert.equal(orders.filter((order) => rules.orderMatchesFilter(order, "payment")).length, 0);
  assert.equal(orders.filter((order) => rules.orderMatchesFilter(order, "cancelled")).length, 1);
  assert.equal(orders.filter((order) => rules.orderMatchesFilter(order, "all")).length, 1);
});

test("production submitted alias follows the same cancelled-order rule", () => {
  assert.equal(rules.isPaymentReviewOrder({ payment_status: "submitted", order_status: "cancelled" }), false);
  assert.equal(rules.isPaymentReviewOrder({ payment_status: "submitted", order_status: "awaiting_confirmation" }), true);
});

test("normalises Singapore WhatsApp phone numbers", () => {
  assert.equal(rules.normalizeSingaporeWhatsAppNumber("86864403"), "6586864403");
  assert.equal(rules.normalizeSingaporeWhatsAppNumber("+65 8686 4403"), "6586864403");
  assert.equal(rules.normalizeSingaporeWhatsAppNumber("(+65)-8686-4403"), "6586864403");
  assert.equal(rules.normalizeSingaporeWhatsAppNumber("6586864403"), "6586864403");
  assert.equal(rules.normalizeSingaporeWhatsAppNumber("123"), "");
  assert.equal(
    rules.buildWhatsAppUrl("86864403", "Hi Tingya, see you at 11:30 AM!"),
    "https://wa.me/6586864403?text=Hi%20Tingya%2C%20see%20you%20at%2011%3A30%20AM!"
  );
});
