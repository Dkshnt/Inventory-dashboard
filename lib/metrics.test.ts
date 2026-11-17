import assert from "node:assert/strict";
import test from "node:test";
import { mostSoldProduct, repeatVsNewCustomerSales, resolveDateRule, returnsOnlineVsOffline, topProductCategory, totalSalesForBlackItems } from "./metrics";

test("merchant metrics use the intended dates and fields", () => {
  assert.deepEqual(mostSoldProduct("2025-06-01", "2025-06-30"), { product: "Linen Button Shirt", units: 1 });
  assert.deepEqual(returnsOnlineVsOffline("2025-06-01", "2025-06-30"), { online: 0, offline: 0 });
  assert.deepEqual(repeatVsNewCustomerSales("2025-06-01", "2025-06-30"), { repeatSales: 162, newSales: 0 });
  assert.equal(totalSalesForBlackItems("2025-09-10", "2025-09-10"), 0);
  assert.deepEqual(topProductCategory("2025-07-01", "2025-07-31"), { category: "Bottoms", units: 1 });
});

test("last week resolves from the documented fixed today date", () => {
  assert.deepEqual(resolveDateRule("last week"), { startDate: "2025-10-20", endDate: "2025-10-26" });
});
