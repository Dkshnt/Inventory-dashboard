import { mostSoldProduct, repeatVsNewCustomerSales, returnsOnlineVsOffline, topProductCategory, totalSalesForBlackItems } from "./metrics";

export type MetricToolName = "most_sold_product" | "returns_online_vs_offline" | "repeat_vs_new_customer_sales" | "total_sales_for_black_items" | "top_product_category";
export type MetricToolArgs = { startDate: string; endDate: string };

const dateParameters = {
  type: "object",
  properties: {
    startDate: { type: "string", description: "Exact inclusive ISO date in YYYY-MM-DD." },
    endDate: { type: "string", description: "Exact inclusive ISO date in YYYY-MM-DD." }
  },
  required: ["startDate", "endDate"],
  additionalProperties: false
};

export const metricTools = [
  { type: "function", function: { name: "most_sold_product", description: "Find the product with the most units sold. Sales are filtered by order date.", parameters: dateParameters } },
  { type: "function", function: { name: "returns_online_vs_offline", description: "Compare returned units sold online versus offline. Returns are filtered by return date.", parameters: dateParameters } },
  { type: "function", function: { name: "repeat_vs_new_customer_sales", description: "Compare revenue from repeat and new customers. Sales are filtered by order date.", parameters: dateParameters } },
  { type: "function", function: { name: "total_sales_for_black_items", description: "Calculate revenue from black variants. Sales are filtered by order date.", parameters: dateParameters } },
  { type: "function", function: { name: "top_product_category", description: "Find the category with the most units sold. Sales are filtered by order date.", parameters: dateParameters } }
] as const;

const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
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
