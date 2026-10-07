(function (root, factory) {
  const rules = factory();
  if (typeof window !== "undefined") root.AdminMarketRules = rules;
  else if (typeof module === "object" && module.exports) module.exports = rules;
  else root.AdminMarketRules = rules;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function () {
  function normalizeMarket(value, fallback) {
    const market = String(value || "").trim().toUpperCase();
    if (market === "MY" || market === "SG") return market;
    return String(fallback || "SG").toUpperCase() === "MY" ? "MY" : "SG";
  }

  function orderMarket(order) {
    return normalizeMarket(order && (order.market_code || order.country_code || order.market), "SG");
  }

  function isOrderInMarket(order, market) {
    return orderMarket(order) === normalizeMarket(market, "SG");
  }

  function ordersForMarket(orders, market) {
    return (orders || []).filter(function (order) { return isOrderInMarket(order, market); });
  }

  function recipesForProductMarket(recipes, productId, market) {
    const targetMarket = normalizeMarket(market, "SG");
    return (recipes || []).filter(function (row) {
      return String(row.product_id) === String(productId)
        && normalizeMarket(row.market_code, "SG") === targetMarket;
    });
  }

  function findInventoryItemForMarket(inventory, id, market) {
    const targetMarket = normalizeMarket(market, "SG");
    return (inventory || []).find(function (item) {
      return String(item.id) === String(id)
        && normalizeMarket(item.market_code, "SG") === targetMarket;
    });
  }

  function savedProductFoodCost(options) {
    const input = options || {};
    const unitCost = typeof input.unitCost === "function" ? input.unitCost : function () { return 0; };
    const visit = function (productId, ancestors) {
      const key = String(productId);
      if (ancestors.has(key)) return 0;
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(key);
      return recipesForProductMarket(input.recipes, productId, input.market).reduce(function (sum, row) {
        const quantity = Number(row.quantity_used || 0);
        if (row.component_product_id) return sum + quantity * visit(row.component_product_id, nextAncestors);
        const ingredient = findInventoryItemForMarket(input.inventory, row.inventory_item_id, input.market);
        return ingredient ? sum + quantity * Number(unitCost(ingredient) || 0) : sum;
      }, 0);
    };
    return visit(input.productId, new Set());
  }

  function productsForCostingMarket(menu, market) {
    const targetMarket = normalizeMarket(market, "SG");
    return (menu || []).filter(function (product) {
      return targetMarket === "SG" || product.malaysia_available === true;
    });
  }

  return {
    normalizeMarket,
    orderMarket,
    isOrderInMarket,
    ordersForMarket,
    recipesForProductMarket,
    findInventoryItemForMarket,
    savedProductFoodCost,
    productsForCostingMarket,
  };
});
