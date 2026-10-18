const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "admin.js"), "utf8");
const promoBlock = source.slice(source.indexOf("function offlinePromoPhone("), source.indexOf("async function saveOfflineOrder()"));

function contextFor(promo, count = 0, market = "SG") {
  const context = {
    ADMIN_WORKSPACE_MARKET: market,
    money: (value) => `$${Number(value).toFixed(2)}`,
    db: {
      from: (table) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({ limit: async () => ({ data: [promo], error: null }) }),
              limit: async () => ({ data: [promo], error: null }),
              eq: async () => ({ count, error: null }),
            }),
          }),
        }),
      }),
    },
  };
  vm.createContext(context);
  vm.runInContext(promoBlock, context);
  return context;
}

test("offline promo discounts only eligible items and clamps at their price", () => {
  const context = contextFor();
  const draft = { counts_as_sale: true, items: [{ product_id: 1, quantity: 2, unit_price: 6 }, { product_id: 2, quantity: 1, unit_price: 9 }] };
  assert.equal(context.offlineOrderSubtotal(draft), 21);
  assert.equal(context.offlinePromoDiscount({ discount_type: "percent", discount_value: 25, applicable_product_ids: [1] }, draft), 3);
  assert.equal(context.offlinePromoDiscount({ discount_type: "fixed", discount_value: 20, applicable_product_ids: [1] }, draft), 12);
  assert.equal(context.offlinePromoDiscount({ discount_type: "fixed", discount_value: 20 }, { ...draft, counts_as_sale: false }), 0);
});

test("offline promo normalises Singapore phone for one-use checks", () => {
  const context = contextFor();
  assert.equal(context.offlinePromoPhone("+65 9123 4567"), "91234567");
  assert.equal(context.offlinePromoPhone("9123 4567"), "91234567");
});

test("offline promo normalises Malaysia phone like the customer store", () => {
  const context = contextFor(null, 0, "MY");
  assert.equal(context.offlinePromoPhone("012-123 4567"), "60121234567");
  assert.equal(context.offlinePromoPhone("+60 12-123 4567"), "60121234567");
});
