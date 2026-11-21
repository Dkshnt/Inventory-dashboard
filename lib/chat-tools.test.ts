import assert from "node:assert/strict";
import test from "node:test";
import { asSchema } from "ai";
import { metricTools } from "./chat-tools";
import { querySchema } from "./query";

test("the model gets one general query tool", () => {
  assert.deepEqual(Object.keys(metricTools), ["query_orders"]);
});

test("the tool schema converts to JSON schema and accepts null/omitted optional fields", async () => {
  const json = await asSchema(querySchema).jsonSchema as { properties: Record<string, unknown> };
  for (const key of ["metric", "groupBy", "products", "categories", "colors", "channels", "startDate", "endDate", "period", "compareStartDate", "show"]) assert.ok(key in json.properties, key);
  assert.ok(querySchema.safeParse({ metric: "revenue", groupBy: ["month"], startDate: null, products: null }).success);
  assert.ok(querySchema.safeParse({}).success);
  assert.ok(!querySchema.safeParse({ metric: "profit" }).success);
  assert.ok(!querySchema.safeParse({ startDate: "June" }).success);
});
