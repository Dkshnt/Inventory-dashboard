import assert from "node:assert/strict";
import test from "node:test";
import { runMetricTool } from "./chat-tools";

test("metric tool execution uses the selected exact date range", () => {
  const result = runMetricTool("total_sales_for_black_items", { startDate: "2025-10-14", endDate: "2025-10-14" });
  assert.equal(result.answer, "Total sales for black items: $219.00.");
  assert.equal(result.range, "2025-10-14 to 2025-10-14");
});

test("metric tool execution rejects invalid dates", () => {
  assert.throws(() => runMetricTool("most_sold_product", { startDate: "October", endDate: "2025-10-31" }));
});
