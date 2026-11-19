"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { FormEvent, useMemo, useState } from "react";

const prompts = ["What was the most sold product in June?", "Which products were returned more — online or offline?", "Is sales from repeat customers more than new customers?", "Tell me total sales for black items for 10/9/2025", "Which product category was sold most in July?"];
type Metric = { label: string; value: string; sub: string };
type ToolOutput = { answer: string; range: string; data: Record<string, unknown> | number | null };

function value(value: unknown, currency = false) {
  if (typeof value !== "number") return String(value ?? "—");
  return currency ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value) : String(value);
}

function Bars({ values, currency = false }: { values: Array<{ label: string; value: number }>; currency?: boolean }) {
  const max = Math.max(...values.map((item) => item.value), 1);
  return <div className="bar-chart">{values.map((item) => <div className="bar-row" key={item.label}><div className="bar-meta"><span>{item.label}</span></div><div className="bar-hit" tabIndex={0} aria-label={`${item.label}: ${value(item.value, currency)}`}><div className="bar-track"><div className="bar-fill" style={{ width: `${item.value / max * 100}%` }} /></div><span className="chart-tooltip"><b>{item.label}</b><span>{value(item.value, currency)}</span></span></div></div>)}</div>;
}

function Chart({ tool, output }: { tool: string; output: ToolOutput }) {
  const data = output.data;
  if (tool === "returns_online_vs_offline" && data && typeof data === "object") return <><div className="result-kicker">Comparison · return date</div><h3>Returns by channel</h3><Bars values={[{ label: "Online", value: Number(data.online) }, { label: "Offline", value: Number(data.offline) }]} /></>;
  if (tool === "repeat_vs_new_customer_sales" && data && typeof data === "object") return <><div className="result-kicker">Comparison · order date</div><h3>Customer sales mix</h3><Bars currency values={[{ label: "Repeat customers", value: Number(data.repeatSales) }, { label: "New customers", value: Number(data.newSales) }]} /></>;
  const headline = tool === "total_sales_for_black_items" ? value(data, true) : data && typeof data === "object" ? String(data.product ?? data.category ?? "No result") : "No result";
  const sub = data && typeof data === "object" && "units" in data ? `${data.units} units sold` : "Total sales";
  return <><div className="result-kicker">Single metric · order date</div><h3>{tool.replaceAll("_", " ")}</h3><div className="single-metric"><div>{headline}</div><span>{sub}</span></div></>;
}

function HistogramLoader() { return <div className="loading-viz" aria-label="Loading chart"><div className="histogram"><i /><i /><i /><i /><i /><i /><i /></div><p>Turning your question into a metric…</p></div>; }

export default function Dashboard({ metrics, latestOrder }: { metrics: Metric[]; latestOrder: string }) {
  const [question, setQuestion] = useState(prompts[0]);
  const { messages, sendMessage, status, error } = useChat({ transport: new DefaultChatTransport({ api: "/api/chat" }) });
  const result = useMemo(() => {
    for (const message of [...messages].reverse()) for (const part of [...message.parts].reverse()) {
      if (isToolUIPart(part) && part.state === "output-available") return { tool: part.type.slice(5), output: part.output as ToolOutput };
    }
    return null;
  }, [messages]);
  const loading = status === "submitted" || status === "streaming";
  async function ask(event?: FormEvent) { event?.preventDefault(); if (question.trim()) await sendMessage({ text: question }); }
  return <main className="shell">
    <div className="eyebrow">Merchant Lens · Order intelligence</div><h1>Ask the history.<br />Find the signal.</h1>
    <p className="lede">Ask in plain language. The assistant selects one exact, CSV-backed metric and presents the right visualization.</p>
    <section className="grid metrics">{metrics.map((metric) => <article className="card" key={metric.label}><div className="label">{metric.label}</div><div className="value">{metric.value}</div><div className="sub">{metric.sub}</div></article>)}</section>
    <section className="grid workspace"><div className="ask"><h2>Ask order history</h2><div className="suggestions">{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>{prompt}</button>)}</div><form className="prompt" onSubmit={ask}><input aria-label="Analytics question" value={question} onChange={(event) => setQuestion(event.target.value)} /><button disabled={loading}>{loading ? "Thinking…" : "Ask"}</button></form><div className="chart-stage">{loading ? <HistogramLoader /> : result ? <div className="result-visual"><Chart tool={result.tool} output={result.output} /><p className="range">Exact range: {result.output.range}</p></div> : <div className="chart-empty">Your chart will appear here.</div>}{error && <p className="chart-error">{error.message}</p>}</div></div>
    <aside className="rules"><h2>Display rules</h2><div className="rule"><b>Trend</b><br />Line chart for values changing over time.</div><div className="rule"><b>Comparison</b><br />Bar chart for online vs offline or repeat vs new.</div><div className="rule"><b>Single number</b><br />Metric card for totals and ranked results.</div><div className="rule"><b>Detailed rows</b><br />Table for row-by-row or column-by-column questions.</div></aside></section>
    <p className="foot">CSV merchant database · Latest order: {latestOrder} · Currency shown in USD</p>
  </main>;
}
