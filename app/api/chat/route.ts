import { metricTools } from "@/lib/chat-tools";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { stepCountIs, streamText } from "ai";

const systemPrompt = `You route merchant analytics questions to exactly ONE metric tool. Never answer from memory and never call more than one tool.
The CSV database covers May–October 2025. Tool dates are inclusive ISO YYYY-MM-DD dates.
Interpret DD/MM/YYYY: 10/9/2025 is 2025-09-10. A month without a year refers to 2025. Use its full calendar month.
Fixed today is 2025-10-28. "last week" is the preceding complete Monday–Sunday week: 2025-10-20 through 2025-10-26. "last month" is the preceding full calendar month: 2025-09-01 through 2025-09-30. "this month" follows the latest dataset entry: 2025-10-01 through 2025-10-27.
If no date is stated, use the complete available reporting period: 2025-05-01 through 2025-10-31.
Use returns_online_vs_offline only for return questions (it filters return_date). Use the other tools for sales questions (they filter order_date). Choose the tool that matches the requested metric.`;

export async function POST(request: Request) {
  const { question } = await request.json() as { question?: string };
  if (!question?.trim()) return Response.json({ error: "Enter a merchant question." }, { status: 400 });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "OPENROUTER_API_KEY is missing from .env.local." }, { status: 500 });

  const openrouter = createOpenRouter({ apiKey, compatibility: "strict", headers: { "X-Title": "Merchant Lens" } });
  const result = streamText({
    model: openrouter(process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini"),
    system: systemPrompt,
    prompt: question,
    tools: metricTools,
    toolChoice: "required",
    stopWhen: stepCountIs(2),
    prepareStep: ({ stepNumber }) => stepNumber === 0 ? { toolChoice: "required" } : { toolChoice: "none" },
    temperature: 0
  });
  return result.toTextStreamResponse({ headers: { "X-Accel-Buffering": "no" } });
}
