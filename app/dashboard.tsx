"use client";

import { FormEvent, useState } from "react";

const prompts = [
  "What was the most sold product in June?",
  "Compare returns online vs offline.",
  "Repeat vs new customer sales",
  "Total sales for black items on 10/9/2025",
  "What was the top product category in July?"
];

type Metric = { label: string; value: string; sub: string };

export default function Dashboard({ metrics, latestOrder }: { metrics: Metric[]; latestOrder: string }) {
  const [question, setQuestion] = useState(prompts[0]);
  const [answer, setAnswer] = useState("Ask an analytics question to see the answer and its date logic.");
  const [loading, setLoading] = useState(false);
  async function ask(event?: FormEvent) {
    event?.preventDefault(); setLoading(true);
    const response = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
    const data = await response.json(); setAnswer(data.answer); setLoading(false);
  }
  return <main className="shell">
    <div className="eyebrow">Merchant Lens · Order intelligence</div>
    <h1>Ask the history.<br />Find the signal.</h1>
    <p className="lede">A lightweight merchant analytics dashboard. Each metric is calculated from exact dates, ready to replace with your connected order database.</p>
    <section className="grid metrics">{metrics.map((metric) => <article className="card" key={metric.label}><div className="label">{metric.label}</div><div className="value">{metric.value}</div><div className="sub">{metric.sub}</div></article>)}</section>
    <section className="grid workspace"><div className="ask"><h2>Ask order history</h2><div className="suggestions">{prompts.map((prompt) => <button key={prompt} onClick={() => setQuestion(prompt)}>{prompt}</button>)}</div><form className="prompt" onSubmit={ask}><input aria-label="Analytics question" value={question} onChange={(event) => setQuestion(event.target.value)} /><button disabled={loading}>{loading ? "Reading…" : "Ask"}</button></form><div className="answer"><strong>Answer</strong>{answer}</div></div>
    <aside className="rules"><h2>Date rules</h2><div className="rule"><b>Last week</b><br />The complete Monday–Sunday calendar week immediately before a fixed date.</div><div className="rule"><b>This month</b><br />The month containing the latest available order entry.</div><div className="rule"><b>Sales questions</b><br />Always filter by <code>orderDate</code>.</div><div className="rule"><b>Return questions</b><br />Always filter by <code>returnDate</code>.</div></aside></section>
    <p className="foot">CSV merchant database · Latest order: {latestOrder} · Currency shown in USD</p>
  </main>;
}
