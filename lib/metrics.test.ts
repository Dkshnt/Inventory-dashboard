import assert from "node:assert/strict";
import test from "node:test";
import { mostSoldProduct, repeatVsNewCustomerSales, returnsOnlineVsOffline, topProductCategory, totalSalesForBlackItems } from "./metrics";

test("merchant metrics use the intended dates and fields", () => {
  assert.deepEqual(mostSoldProduct("2025-06-01", "2025-06-30"), { product: "Classic Tee", units: 5 });
  assert.deepEqual(returnsOnlineVsOffline("2025-06-01", "2025-06-30"), { online: 1, offline: 1 });
  assert.deepEqual(repeatVsNewCustomerSales("2025-06-01", "2025-06-30"), { repeatSales: 90, newSales: 124 });
  assert.equal(totalSalesForBlackItems("2025-09-10", "2025-09-10"), 112);
  assert.deepEqual(topProductCategory("2025-07-01", "2025-07-31"), { category: "Apparel", units: 6 });
});
