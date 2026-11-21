"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart } from "ai";
import { FormEvent, useMemo, useState } from "react";
import type { QueryOutput } from "@/lib/query";

const prompts = [
  "What was the most sold product in June?",
  "Which jackets came back the most?",
  "Which products were returned more — online or offline?",
  "Is sales from repeat customers more than new customers?",
  "How many black items did we sell on 10/9/2025?",
  "Which product category was sold most in July?",
  "Show monthly revenue",
  "Compare October and September revenue by category",
  "List Instagram orders"
];
type Metric = { label: string; value: string; sub: string };
type Format = "number" | "currency" | "percent";
type Result = { output: QueryOutput; error?: undefined } | { error: string; output?: undefined } | null;

function fmt(value: number, format: Format) {
  if (format === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function Bars({ values, format }: { values: Array<{ label: string; value: number }>; format: Format }) {
  const max = Math.max(...values.map((item) => item.value), 1);
  return <div className="bar-chart">{values.map((item) => <div className="bar-row" key={item.label}><div className="bar-meta"><span>{item.label}</span><b>{fmt(item.value, format)}</b></div><div className="bar-track"><div className="bar-fill" style={{ width: `${item.value / max * 100}%` }} /></div></div>)}</div>;
}

function PairedBars({ values, format, currentLabel, previousLabel }: { values: Array<{ label: string; current: number; previous: number }>; format: Format; currentLabel: string; previousLabel: string }) {
  const max = Math.max(...values.flatMap((item) => [item.current, item.previous]), 1);
  return <div className="bar-chart">
    <div className="legend"><span><i className="swatch now" />{currentLabel}</span><span><i className="swatch before" />{previousLabel}</span></div>
    {values.map((item) => <div className="bar-row" key={item.label}>
      <div className="bar-meta"><span>{item.label}</span><b>{fmt(item.current, format)} <em>vs {fmt(item.previous, format)}</em></b></div>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${item.current / max * 100}%` }} /></div>
      <div className="bar-track thin"><div className="bar-fill prev" style={{ width: `${item.previous / max * 100}%` }} /></div>
    </div>)}
  </div>;
}

function LineChart({ points, format }: { points: Array<{ label: string; value: number }>; format: Format }) {
  const W = 560, H = 200, P = 28;
  const max = Math.max(...points.map((point) => point.value), 1);
  const step = points.length > 1 ? (W - 2 * P) / (points.length - 1) : 0;
  const xy = points.map((point, index) => [P + index * step, H - P - (point.value / max) * (H - 2 * P)] as const);
  return <div className="line-chart">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trend chart">
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#26324b" />
      <polyline points={xy.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#7c9cff" strokeWidth="2.5" strokeLinejoin="round" />
      {xy.map(([x, y], index) => <circle key={points[index].label} cx={x} cy={y} r="4" fill="#5ce0bb"><title>{`${points[index].label}: ${fmt(points[index].value, format)}`}</title></circle>)}
    </svg>
    <div className="line-axis"><span>{points[0].label}</span><span>peak {fmt(max, format)}</span><span>{points[points.length - 1].label}</span></div>
  </div>;
}

function Table({ columns, rows }: { columns: string[]; rows: Array<Array<string | number>> }) {
  return <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className={typeof cell === "number" ? "num" : undefined}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function Chart({ output }: { output: QueryOutput }) {
  const { data } = output;
  switch (data.kind) {
    case "message": return <p className="chart-note">{output.answer}</p>;
    case "value": return <><div className="result-kicker">Single metric</div><h3>{data.label}</h3><div className="single-metric"><div>{fmt(data.value, data.format)}</div><span>{data.scope || "All matching orders"}{data.matched ? ` · ${data.matched} order line${data.matched === 1 ? "" : "s"}` : ""}</span></div></>;
    case "groups": {
      const points = data.rows.map((row) => ({ label: row.labels.join(" · "), value: row.value }));
      return <><div className="result-kicker">{data.chart === "line" ? "Trend" : data.chart === "bar" ? "Comparison" : "Breakdown"}</div><h3>{data.label} by {data.dims.join(" and ").toLowerCase()}</h3>
        {data.chart === "line" ? <LineChart points={points} format={data.format} /> : data.chart === "bar" ? <Bars values={points} format={data.format} /> : <Table columns={[...data.dims, data.label]} rows={data.rows.map((row) => [...row.labels, fmt(row.value, data.format)])} />}</>;
    }
    case "comparison": {
      const title = data.dims.length ? `${data.label} by ${data.dims.join(" and ").toLowerCase()}` : data.label;
      return <><div className="result-kicker">Period comparison</div><h3>{title}</h3>
        {data.dims.length > 1
          ? <Table columns={[...data.dims, "Current", "Previous", "Change"]} rows={data.rows.map((row) => [...row.labels, fmt(row.current, data.format), fmt(row.previous, data.format), `${row.change < 0 ? "-" : "+"}${fmt(Math.abs(row.change), data.format)}`])} />
          : <PairedBars format={data.format} currentLabel={data.currentRange} previousLabel={data.previousRange} values={data.rows.map((row) => ({ label: row.labels.join(" · "), current: row.current, previous: row.previous }))} />}</>;
    }
    case "rows": return <><div className="result-kicker">Detail rows</div><h3>Order lines ({data.total})</h3><Table columns={data.columns} rows={data.rows} /></>;
  }
}

function HistogramLoader() { return <div className="loading-viz" aria-label="Loading chart"><div className="histogram"><i /><i /><i /><i /><i /><i /><i /></div><p>Turning your question into a query…</p></div>; }

export default function Dashboard({ metrics, latestOrder }: { metrics: Metric[]; latestOrder: string }) {
  const [question, setQuestion] = useState(prompts[0]);
  const { messages, sendMessage, status, error } = useChat({ transport: new DefaultChatTransport({ api: "/api/chat" }) });
  const result = useMemo<Result>(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return null;
    for (const part of [...last.parts].reverse()) {
      if (!isToolUIPart(part)) continue;
      if (part.state === "output-available") return { output: part.output as QueryOutput };
      if (part.state === "output-error") return { error: part.errorText };
    }
    return null;
  }, [messages]);
  const loading = status === "submitted" || status === "streaming";
  async function ask(event?: FormEvent) { event?.preventDefault(); if (question.trim()) await sendMessage({ text: question }); }
  return <main className="shell">
    <div className="eyebrow">Merchant Lens · Order intelligence</div><h1>Ask the history.<br />Find the signal.</h1>
    <p className="lede">Ask in plain language about any product, date, channel or customer group. The assistant turns your question into an exact, CSV-backed query and picks the right visualization.</p>
    <section className="grid metrics">{metrics.map((metric) => <article className="card" key={metric.label}><div className="label">{metric.label}</div><div className="value">{metric.value}</div><div className="sub">{metric.sub}</div></article>)}</section>
    <section className="grid workspace"><div className="ask"><h2>Ask order history</h2><div className="suggestions">{prompts.map((prompt) => <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>{prompt}</button>)}</div><form className="prompt" onSubmit={ask}><input aria-label="Analytics question" value={question} onChange={(event) => setQuestion(event.target.value)} /><button disabled={loading}>{loading ? "Thinking…" : "Ask"}</button></form>
      <div className="chart-stage">{loading ? <HistogramLoader /> : result?.output ? <div className="result-visual"><Chart output={result.output} />{result.output.data.kind !== "message" && <p className="answer">{result.output.answer}</p>}{result.output.range && <p className="range">Exact range: {result.output.range}</p>}</div> : result?.error ? <p className="chart-error">{result.error}</p> : <div className="chart-empty">Your chart will appear here.</div>}{error && <p className="chart-error">{error.message}</p>}</div></div>
    <aside className="rules"><h2>Display rules</h2><div className="rule"><b>Trend</b><br />Line chart for values changing over days, weeks or months.</div><div className="rule"><b>Comparison</b><br />Bar chart for rankings and for comparing products, channels, colors or customer types; paired bars for one period versus another.</div><div className="rule"><b>Single number</b><br />Metric card for totals.</div><div className="rule"><b>Detailed rows</b><br />Table for order lists and two-way breakdowns.</div></aside></section>
    <p className="foot">CSV merchant database · Latest order: {latestOrder} · Currency shown in USD</p>
  </main>;
}
