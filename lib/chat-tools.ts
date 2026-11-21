import { tool } from "ai";
import { querySchema, runQuery } from "./query";

export { runQuery };

/**
 * One general tool instead of a fixed menu of metrics. The model translates the merchant's question into a
 * structured query (metric, grouping, filters, dates, optional comparison period); plain code validates it
 * and computes the answer from the CSV. The model never sees the order rows.
 */
export const metricTools = {
  query_orders: tool({
    description: "Answer any question about the merchant's order history: totals, rankings (most/least), comparisons between products, categories, colors, sizes, channels or customer types, comparisons between two time periods, trends over days/weeks/months, return and refund analysis, or a list of matching order lines. Filter by any product, category, color, size, channel, customer type, fulfillment status or return reason, and by any date range.",
    inputSchema: querySchema,
    execute: async (args) => runQuery(args)
  })
};
