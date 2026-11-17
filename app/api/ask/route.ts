import { mostSoldProduct, repeatVsNewCustomerSales, returnsOnlineVsOffline, topProductCategory, totalSalesForBlackItems } from "@/lib/metrics";

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export async function POST(request: Request) {
  const { question } = await request.json() as { question?: string };
  const normalized = (question ?? "").toLowerCase().replaceAll("/", "-");
  let answer = "I can answer the five supported merchant metrics. Try one of the example questions.";
  if (normalized.includes("most sold") && normalized.includes("june")) {
    const result = mostSoldProduct("2025-06-01", "2025-06-30");
    answer = result ? `${result.product} was the most sold product in June, with ${result.units} units.` : "No June orders found.";
  } else if (normalized.includes("return") && (normalized.includes("online") || normalized.includes("offline"))) {
    const result = returnsOnlineVsOffline("2025-06-01", "2025-06-30");
    answer = `June returns: ${result.online} online unit${result.online === 1 ? "" : "s"} and ${result.offline} offline unit${result.offline === 1 ? "" : "s"}.`;
  } else if (normalized.includes("repeat") && normalized.includes("new")) {
    const result = repeatVsNewCustomerSales("2025-06-01", "2025-06-30");
    answer = `June sales: ${money(result.repeatSales)} from repeat customers and ${money(result.newSales)} from new customers.`;
  } else if (normalized.includes("black") && (normalized.includes("10-9-2025") || normalized.includes("september 10"))) {
    answer = `Total sales for black items on 10 September 2025: ${money(totalSalesForBlackItems("2025-09-10", "2025-09-10"))}.`;
  } else if (normalized.includes("top") && normalized.includes("category") && normalized.includes("july")) {
    const result = topProductCategory("2025-07-01", "2025-07-31");
    answer = result ? `${result.category} was July's top product category, with ${result.units} units sold.` : "No July orders found.";
  }
  return Response.json({ answer });
}
