import { metricTools } from "@/lib/chat-tools";
import { catalogText } from "@/lib/query";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

const systemPrompt = `You turn a merchant's question about their order history into exactly ONE call of the query_orders tool. Never answer from memory, never call the tool more than once, and never invent filter values: the tool computes every number from the data.

DATA CATALOG (use these exact names in filters):
${catalogText()}

DATES
- Tool dates are inclusive ISO YYYY-MM-DD. A single day uses the same startDate and endDate.
- Read 10/9/2025 as DD/MM/YYYY = 2025-09-10. A month or date without a year means 2025. A month means its full calendar month (June = 2025-06-01 to 2025-06-30).
- For relative phrases set "period" instead of calculating dates: last_week, this_week, last_month, this_month, yesterday, today, last_7_days, last_30_days. The server fixes "today" at 2025-10-28.
- If the merchant gives no date, leave dates and period empty (whole dataset).

CHOOSING THE CALL
- Metric: "how many/units/items sold" -> units_sold; "sales/revenue/how much/total sales" -> revenue; "orders" -> orders; "customers" -> customers; "average order value" -> avg_order_value; "returned/returns/came back" -> units_returned; "refund(s)" -> refunds; "return rate" -> return_rate; "discounts" -> discounts.
- Which/most/best/top/least X (product, category, color, size, channel...) -> set groupBy to that dimension and sort desc (asc for least). Do not set limit unless a specific top N is asked; the tool states the winner and any tie.
- Compare values of one dimension (online vs offline, black vs navy, repeat vs new customers, Parka vs Jacket) -> groupBy that dimension; if specific values are named also put them in the matching filter.
- Compare two time periods (June vs July, this month vs last month) -> main period in startDate/endDate (or period) and the other in compareStartDate/compareEndDate (or comparePeriod).
- Trend / over time / by week / monthly -> groupBy day, week or month.
- "List / show me the orders or items" -> show "rows".
- Map generic words (jackets, coats, trousers) to the closest category from the catalog; use product filters only for specific product names. Regular/repeat/returning customers -> customerType repeat; first-time -> new.
- Returns questions default to return dates; sales questions default to order dates. Override with dateField only if the merchant says otherwise.`;

export async function POST(request: Request) {
  const { messages } = await request.json() as { messages?: UIMessage[] };
  if (!messages?.length) return Response.json({ error: "Enter a merchant question." }, { status: 400 });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "OPENROUTER_API_KEY is missing from .env.local." }, { status: 500 });

  const openrouter = createOpenRouter({ apiKey, compatibility: "strict", headers: { "X-Title": "Merchant Lens" } });
  const result = streamText({
    model: openrouter(process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini"),
    system: systemPrompt,
    messages: convertToModelMessages(messages, { tools: metricTools }),
    tools: metricTools,
    toolChoice: "required",
    // One step: the model picks the query, the server runs it, the dashboard renders the result. No second LLM pass.
    stopWhen: stepCountIs(1),
    temperature: 0
  });
  return result.toUIMessageStreamResponse({ headers: { "X-Accel-Buffering": "no" } });
}
