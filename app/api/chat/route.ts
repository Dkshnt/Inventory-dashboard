import { metricTools, runMetricTool, type MetricToolArgs, type MetricToolName } from "@/lib/chat-tools";

const systemPrompt = `You route merchant analytics questions to exactly ONE metric tool. Never answer from memory and never call more than one tool.
The CSV database covers May–October 2025. Tool dates are inclusive ISO YYYY-MM-DD dates.
Interpret DD/MM/YYYY: 10/9/2025 is 2025-09-10. A month without a year refers to 2025. Use its full calendar month.
Fixed today is 2025-10-28. "last week" is the preceding complete Monday–Sunday week: 2025-10-20 through 2025-10-26. "last month" is the preceding full calendar month: 2025-09-01 through 2025-09-30. "this month" follows the latest dataset entry: 2025-10-01 through 2025-10-27.
If no date is stated, use the complete available reporting period: 2025-05-01 through 2025-10-31.
Use returns_online_vs_offline only for return questions (it filters return_date). Use the other tools for sales questions (they filter order_date). Choose the tool that matches the requested metric.`;

type OpenRouterToolCall = { function?: { name?: string; arguments?: string } };

export async function POST(request: Request) {
  const { question } = await request.json() as { question?: string };
  if (!question?.trim()) return Response.json({ error: "Enter a merchant question." }, { status: 400 });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "OPENROUTER_API_KEY is missing from .env.local." }, { status: 500 });

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "http://localhost:3000", "X-Title": "Merchant Lens" },
    body: JSON.stringify({ model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: question }], tools: metricTools, tool_choice: "required", temperature: 0 })
  });
  if (!response.ok) return Response.json({ error: "OpenRouter could not select a metric. Check the API key, model access, and account balance." }, { status: 502 });
  const payload = await response.json() as { choices?: Array<{ message?: { tool_calls?: OpenRouterToolCall[] } }> };
  const calls = payload.choices?.[0]?.message?.tool_calls ?? [];
  if (calls.length !== 1) return Response.json({ error: "The model did not select exactly one metric tool. Please rephrase the question." }, { status: 422 });
  try {
    const name = calls[0].function?.name as MetricToolName;
    if (!metricTools.some((tool) => tool.function.name === name)) throw new Error("Unknown tool.");
    const args = JSON.parse(calls[0].function?.arguments ?? "{}") as MetricToolArgs;
    return Response.json({ ...runMetricTool(name, args), tool: name, arguments: args });
  } catch {
    return Response.json({ error: "The model selected invalid metric details. Please rephrase the question." }, { status: 422 });
  }
}
