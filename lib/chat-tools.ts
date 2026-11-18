import { mostSoldProduct, repeatVsNewCustomerSales, returnsOnlineVsOffline, topProductCategory, totalSalesForBlackItems } from "./metrics";
import { tool } from "ai";
import { z } from "zod";

export type MetricToolName = "most_sold_product" | "returns_online_vs_offline" | "repeat_vs_new_customer_sales" | "total_sales_for_black_items" | "top_product_category";
export type MetricToolArgs = { startDate: string; endDate: string };

const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
}).refine(({ startDate, endDate }) => startDate <= endDate, { message: "startDate must not be after endDate." });
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

/** Executes one tool selected by the model. Dates are validated before touching merchant data. */
export function runMetricTool(name: MetricToolName, args: MetricToolArgs) {
  if (!date(args.startDate) || !date(args.endDate) || args.startDate > args.endDate) throw new Error("The model returned an invalid date range.");
  const range = `${args.startDate} to ${args.endDate}`;
  switch (name) {
    case "most_sold_product": { const result = mostSoldProduct(args.startDate, args.endDate); return result ? { answer: `${result.product} was the most sold product, with ${result.units} units.`, range, data: result } : { answer: "No orders were found.", range, data: null }; }
    case "returns_online_vs_offline": { const result = returnsOnlineVsOffline(args.startDate, args.endDate); return { answer: `Returns: ${result.online} online unit${result.online === 1 ? "" : "s"} and ${result.offline} offline unit${result.offline === 1 ? "" : "s"}.`, range, data: result }; }
    case "repeat_vs_new_customer_sales": { const result = repeatVsNewCustomerSales(args.startDate, args.endDate); return { answer: `Sales: ${money(result.repeatSales)} from repeat customers and ${money(result.newSales)} from new customers.`, range, data: result }; }
    case "total_sales_for_black_items": { const result = totalSalesForBlackItems(args.startDate, args.endDate); return { answer: `Total sales for black items: ${money(result)}.`, range, data: result }; }
    case "top_product_category": { const result = topProductCategory(args.startDate, args.endDate); return result ? { answer: `${result.category} was the top product category, with ${result.units} units sold.`, range, data: result } : { answer: "No orders were found.", range, data: null }; }
  }
}

/** AI SDK tools: one is selected by OpenRouter, then executed locally against the CSV. */
export const metricTools = {
  most_sold_product: tool({
    description: "Find the product with the most units sold. Filter sales by order date.", inputSchema: dateRangeSchema,
    execute: async (args) => runMetricTool("most_sold_product", args)
  }),
  returns_online_vs_offline: tool({
    description: "Compare returned units sold online versus offline. Filter returns by return date.", inputSchema: dateRangeSchema,
    execute: async (args) => runMetricTool("returns_online_vs_offline", args)
  }),
  repeat_vs_new_customer_sales: tool({
    description: "Compare revenue from repeat and new customers. Filter sales by order date.", inputSchema: dateRangeSchema,
    execute: async (args) => runMetricTool("repeat_vs_new_customer_sales", args)
  }),
  total_sales_for_black_items: tool({
    description: "Calculate revenue from black variants. Filter sales by order date.", inputSchema: dateRangeSchema,
    execute: async (args) => runMetricTool("total_sales_for_black_items", args)
  }),
  top_product_category: tool({
    description: "Find the category with the most units sold. Filter sales by order date.", inputSchema: dateRangeSchema,
    execute: async (args) => runMetricTool("top_product_category", args)
  })
};
