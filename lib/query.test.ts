import assert from "node:assert/strict";
import test from "node:test";
import { catalogText, runQuery, type QueryInput } from "./query";

const q = (input: Partial<QueryInput>) => runQuery(input as QueryInput);
const groups = (out: ReturnType<typeof q>) => { assert.equal(out.data.kind, "groups"); return out.data.kind === "groups" ? out.data.rows.map((r) => [r.labels.join(" · "), r.value]) : []; };

test("identification: which jackets (Outerwear) came back the most", () => {
  const out = q({ metric: "units_returned", categories: ["Outerwear"], groupBy: ["product"] });
  assert.deepEqual(groups(out), [["Alpine Down Parka", 3], ["Northridge Insulated Jacket", 2], ["Harbor Rain Shell", 1]]);
  assert.match(out.answer, /Alpine Down Parka \(3\)/);
});

test("comparison between values: returns online vs offline", () => {
  assert.deepEqual(groups(q({ metric: "units_returned", groupBy: ["channel"] })), [["Online", 7], ["Offline", 1]]);
});

test("any channel: Instagram orders as rows, and by raw sales channel", () => {
  const rows = q({ show: "rows", channels: ["instagram"] });
  assert.equal(rows.data.kind === "rows" && rows.data.total, 2);
  assert.deepEqual(groups(q({ metric: "orders", groupBy: ["sales_channel"] })).map((r) => r[0]).sort(), ["Instagram", "Online Store", "Point of Sale", "Shop app"]);
});

test("any product, color, size and date: black items on one day, units and revenue", () => {
  const value = (input: Partial<QueryInput>) => (q(input).data as { value: number }).value;
  assert.equal(value({ metric: "units_sold", colors: ["black"], startDate: "2025-10-14", endDate: "2025-10-14" }), 1);
  assert.equal(value({ metric: "revenue", colors: ["black"], startDate: "2025-10-14", endDate: "2025-10-14" }), 219);
  assert.match(q({ metric: "units_sold", colors: ["black"], startDate: "2025-09-10", endDate: "2025-09-10" }).answer, /No matching order lines/);
  assert.equal(value({ metric: "revenue", products: ["parka"], sizes: ["medium"] }), 416.1);
});

test("ties are reported, not hidden (June top product)", () => {
  const out = q({ metric: "units_sold", groupBy: ["product"], startDate: "2025-06-01", endDate: "2025-06-30" });
  assert.match(out.answer, /Linen Button Shirt, Selvedge Slim Jeans tied at 1/);
});

test("repeat vs new customers", () => {
  assert.deepEqual(groups(q({ metric: "revenue", groupBy: ["customer_type"], startDate: "2025-06-01", endDate: "2025-06-30" })), [["Repeat", 162]]);
  const all = groups(q({ metric: "revenue", groupBy: ["customer_type"] }));
  assert.equal(all.length, 2);
});

test("trend: months are chronological; days are zero-filled", () => {
  const months = groups(q({ metric: "revenue", groupBy: ["month"] }));
  assert.deepEqual(months.map((r) => r[0]), ["2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10"]);
  assert.deepEqual(months.slice(0, 5).map((r) => r[1]), [224, 162, 118, 102, 231.1]);
  assert.deepEqual(groups(q({ metric: "units_sold", groupBy: ["day"], startDate: "2025-10-01", endDate: "2025-10-03" })), [["2025-10-01", 0], ["2025-10-02", 2], ["2025-10-03", 0]]);
});

test("period comparison: October vs September revenue, and relative periods", () => {
  const out = q({ metric: "revenue", startDate: "2025-10-01", endDate: "2025-10-31", compareStartDate: "2025-09-01", compareEndDate: "2025-09-30" });
  assert.equal(out.data.kind, "comparison");
  const row = out.data.kind === "comparison" ? out.data.rows[0] : null;
  assert.equal(row?.current, 2261.25);
  assert.equal(row?.previous, 231.1);
  assert.equal(row?.change, 2030.15);
  const lastWeek = q({ metric: "revenue", period: "last_week" });
  assert.equal(lastWeek.range, "2025-10-20 to 2025-10-26");
  assert.equal((lastWeek.data as { value: number }).value, 543.5);
  const rel = q({ metric: "revenue", period: "this_month", comparePeriod: "last_month" });
  assert.equal(rel.data.kind, "comparison");
});

test("grouped comparison across periods", () => {
  const out = q({ metric: "units_sold", groupBy: ["category"], startDate: "2025-10-01", endDate: "2025-10-31", compareStartDate: "2025-09-01", compareEndDate: "2025-09-30" });
  assert.equal(out.data.kind, "comparison");
  assert.match(out.answer, /Biggest change: Outerwear/);
});

test("derived metrics: return rate, average order value, customers, refunds", () => {
  assert.equal((q({ metric: "return_rate", categories: ["Outerwear"] }).data as { value: number }).value, 0.6);
  assert.equal((q({ metric: "refunds", returnReasons: ["too small"] }).data as { value: number }).value, 219 + 135.15);
  assert.equal((q({ metric: "customers", startDate: "2025-10-01", endDate: "2025-10-03" }).data as { value: number }).value, 1);
  assert.ok((q({ metric: "avg_order_value" }).data as { value: number }).value > 0);
});

test("two-dimension breakdowns render as tables", () => {
  const out = q({ metric: "units_sold", groupBy: ["category", "channel"] });
  assert.equal(out.data.kind === "groups" && out.data.chart, "table");
});

test("unknown products, bad dates and impossible combinations return guidance instead of zeros or crashes", () => {
  assert.match(q({ metric: "revenue", products: ["sneakers"] }).answer, /couldn't find product “sneakers”.*Alpine Down Parka/);
  assert.match(q({ metric: "revenue", startDate: "2025-02-30", endDate: "2025-03-01" }).answer, /not a real calendar date/);
  assert.match(q({ metric: "revenue", startDate: "2025-10-31", endDate: "2025-10-01" }).answer, /after the end date/);
  assert.match(q({ metric: "revenue", groupBy: ["month"], comparePeriod: "last_month" }).answer, /can't also be split/);
});

test("the catalog given to the model comes from the data", () => {
  const text = catalogText();
  for (const expected of ["Outerwear: Alpine Down Parka", "Instagram (online)", "Point of Sale (offline)", "Too small", "Black"]) assert.ok(text.includes(expected), expected);
});

test("out of scope: fields the dataset does not record", () => {
  const out = q({ outOfScope: "profit margin" });
  assert.equal(out.data.kind, "out_of_scope");
  assert.match(out.answer, /^This metric is out of scope\. “profit margin” isn't recorded/);
  // the flag wins even if the model also filled other fields
  assert.equal(q({ outOfScope: "stock level", metric: "units_sold" }).data.kind, "out_of_scope");
  assert.equal(q({ outOfScope: "   ", metric: "units_sold" }).data.kind, "value");
});

test("out of scope: products, colors or channels that are not in the data", () => {
  for (const input of [{ products: ["sneakers"] }, { colors: ["purple"] }, { channels: ["TikTok Shop"] }, { categories: ["Footwear"] }]) {
    const out = q({ metric: "revenue", ...input });
    assert.equal(out.data.kind, "out_of_scope", JSON.stringify(input));
    assert.match(out.answer, /^This metric is out of scope\./);
  }
});

test("out of scope: dates entirely outside the dataset; partial overlap still answers", () => {
  assert.equal(q({ metric: "revenue", startDate: "2024-01-01", endDate: "2024-12-31" }).data.kind, "out_of_scope");
  assert.match(q({ metric: "revenue", period: "last_year" }).answer, /dataset covers 2025-05-06 to 2025-10-27/);
  assert.equal(q({ metric: "revenue", startDate: "2025-11-15" }).data.kind, "out_of_scope");
  assert.equal(q({ metric: "revenue", startDate: "2025-10-20", endDate: "2025-12-31" }).data.kind, "value");
  assert.equal(q({ metric: "revenue", startDate: "2025-10-01", endDate: "2025-10-31", compareStartDate: "2024-10-01", compareEndDate: "2024-10-31" }).data.kind, "out_of_scope");
});

test("date rules follow the calendar from the current date (2025-10-28, a Tuesday)", () => {
  const range = (period: QueryInput["period"]) => q({ metric: "revenue", period }).range;
  assert.equal(range("last_week"), "2025-10-20 to 2025-10-26");   // previous Monday-Sunday
  assert.equal(range("this_week"), "2025-10-27 to 2025-10-28");   // Monday to today
  assert.equal(range("this_month"), "2025-10-01 to 2025-10-28");  // 1st of month to today
  assert.equal(range("last_month"), "2025-09-01 to 2025-09-30");  // previous full month
  assert.equal(range("this_quarter"), "2025-10-01 to 2025-10-28");
  assert.equal(range("last_quarter"), "2025-07-01 to 2025-09-30");
  assert.equal(range("this_year"), "2025-01-01 to 2025-10-28");
  assert.equal(range("last_7_days"), "2025-10-22 to 2025-10-28");
  assert.equal(range("yesterday"), "2025-10-27 to 2025-10-27");
});

test("no dates at all means the earliest to the latest date in the dataset, for sales and returns alike", () => {
  assert.equal(q({ metric: "revenue" }).range, "2025-05-06 to 2025-10-27");
  assert.equal(q({ metric: "units_returned" }).range, "2025-05-06 to 2025-10-27");
  assert.equal(q({ metric: "revenue", startDate: "2025-09-01" }).range, "2025-09-01 to 2025-10-27");
  assert.equal(q({ metric: "revenue", endDate: "2025-06-30" }).range, "2025-05-06 to 2025-06-30");
});
