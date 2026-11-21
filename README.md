# Merchant Lens

A Next.js dashboard for answering questions from merchant order history. Its development database is the supplied `data/store-order-history.csv`, parsed by `lib/merchant-data.ts` at runtime. Merchants ask in plain language; the app turns the question into an exact query, computes the answer from the CSV and shows the right visualization.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## AI merchant chat

The chat endpoint (`POST /api/chat`) uses Vercel AI SDK's `streamText` with the OpenRouter provider. The model gets **one general tool, `query_orders`**, and turns any merchant question into a structured query. Plain code in `lib/query.ts` validates that query and computes the answer from the local CSV, so OpenRouter never receives the order-history rows. The run is a single step: the model chooses the query, the server executes it, the dashboard renders the result.

Add your OpenRouter key to `.env.local`:

```bash
OPENROUTER_API_KEY=your_key_here
# Optional: choose any tool-capable model available to your account.
OPENROUTER_MODEL=openai/gpt-4o-mini
```

`.env.local` is Git-ignored. Do not put the key in `.env.example` or commit it.

### What a query can express

| Field | Meaning |
| --- | --- |
| `metric` | `units_sold`, `revenue`, `discounts`, `orders`, `customers`, `avg_order_value`, `units_returned`, `refunds`, `return_rate` |
| `groupBy` (up to 2) | `product`, `category`, `color`, `size`, `channel` (online/offline), `sales_channel` (Online Store, Shop app, Instagram, Point of Sale), `customer_type`, `customer`, `fulfillment_status`, `return_reason`, `day`, `week`, `month` |
| filters | `products`, `categories`, `colors`, `sizes`, `channels`, `customerType`, `customerIds`, `fulfillmentStatuses`, `returnReasons`, `returnedOnly` |
| dates | `startDate`/`endDate` (any inclusive range), or `period` (see [Date rules](#date-rules)), and `dateField` (`order_date` or `return_date`) |
| comparison | `compareStartDate`/`compareEndDate` or `comparePeriod` for period-versus-period |
| output | `show: "rows"` lists matching order lines; `sort`; `limit` |
| `outOfScope` | Set when the question cannot be answered from this dataset (see [Out-of-scope questions](#out-of-scope-questions)) |

The system prompt includes a catalog generated from the CSV (categories and their products, colors, sizes, channels, return reasons, the fields the data records, date coverage), so the model uses real values. Ties are reported rather than hidden.

### Example questions

| Merchant wording | Query |
| --- | --- |
| “Which jackets came back the most?” | `units_returned`, `categories: [Outerwear]`, `groupBy: [product]` |
| “Returned more online or offline?” | `units_returned`, `groupBy: [channel]` |
| “How many black items did we sell on 10th Sep?” | `units_sold`, `colors: [black]`, `2025-09-10` to `2025-09-10` |
| “Which product sold most in June?” | `units_sold`, `groupBy: [product]`, June |
| “Monthly revenue” | `revenue`, `groupBy: [month]` |
| “Compare October and September revenue by category” | `revenue`, `groupBy: [category]`, Oct with `compare*` = Sep |
| “List Instagram orders” | `show: rows`, `channels: [Instagram]` |
| “What was our profit margin last month?” | `outOfScope: "profit margin"` → out-of-scope message |

## Out-of-scope questions

When a question asks for something the dataset does not contain, the dashboard shows a clear **“This metric is out of scope”** message with a short reason, instead of guessing a nearby metric or showing a misleading zero. A question is out of scope when it asks for:

- **A field the data does not record**, such as profit or margin, cost, stock or inventory, traffic or conversion, ratings, customer age, gender or location, shipping time or ad spend. The data records only the columns in the CSV (order, customer, product, variant, quantity, price, discount, total, sales channel, fulfillment status, return date, return reason, refund).
- **A forecast or prediction**, or a topic unrelated to the store.
- **A value that is not in the data**, such as a product, category, color, size, sales channel or return reason that never appears in the CSV (for example “sneakers” or “TikTok Shop”). The message lists the values that do exist.
- **Dates entirely outside the dataset**, such as 2024 or a future month. The message states the range the data covers. A range that only partly overlaps the data is answered with the part that exists.

How it works: the model sets `outOfScope` for unsupported fields and topics; the server checks filter values and date coverage itself, so a made-up product or an out-of-range year is caught even if the model does not flag it. The result is rendered as an amber “This metric is out of scope” card.

Questions that are in scope but match no rows (for example black items on a day with no sales) are not out of scope: they show a zero or a short “no matching order lines” note.

## Date rules

Merchants rarely give exact dates, so relative phrases are resolved by the server from the **calendar**, not by the model. The “current date” is `FIXED_TODAY` in `lib/metrics.ts`, set to `2025-10-28` (a Tuesday) so the sample dataset stays reproducible. For a live store, change it to today's date.

| Merchant says | Rule | Range with current date `2025-10-28` |
| --- | --- | --- |
| `last week` | The previous full calendar week, Monday to Sunday | `2025-10-20` to `2025-10-26` |
| `this week` | Monday of the current week through the current date | `2025-10-27` to `2025-10-28` |
| `this month` | The 1st of the current month through the current date | `2025-10-01` to `2025-10-28` |
| `last month` | The previous full calendar month | `2025-09-01` to `2025-09-30` |
| `this quarter` | The 1st of the current calendar quarter through the current date | `2025-10-01` to `2025-10-28` |
| `last quarter` | The previous full calendar quarter | `2025-07-01` to `2025-09-30` |
| `this year` | 1 January of the current year through the current date | `2025-01-01` to `2025-10-28` |
| `last year` | The previous full calendar year | `2024-01-01` to `2024-12-31` (no data → out of scope) |
| `yesterday` / `today` | The day before / the current date | `2025-10-27` / `2025-10-28` |
| `last 7 days` / `last 30 days` | The 7 / 30 days ending on the current date | `2025-10-22` to `2025-10-28` / `2025-09-29` to `2025-10-28` |
| A month name, e.g. `June` | The full calendar month; the year defaults to 2025 | `2025-06-01` to `2025-06-30` |
| `10/9/2025` | Read as DD/MM/YYYY | `2025-09-10` |
| **No date given at all** | **The earliest to the latest date in the dataset** (across order dates and return dates) | `2025-05-06` to `2025-10-27` |

Other rules:

- Only a start date (“since 1 September”) runs to the latest date in the dataset; only an end date (“until 30 June”) starts at the earliest date.
- Date ranges are inclusive and use `YYYY-MM-DD`. A single day has the same start and end.
- Sales metrics (units sold, revenue, orders, ...) filter by **order date**. `units_returned` and `refunds` filter by **return date**. `return_rate` is the share of units sold in the period that were later returned. The merchant can override the basis with `dateField`.
- The exact range used is always shown under the result (“Exact range: ...”).

`last week` as terminal output:

```text
> tsx -e "import { resolveDateRule } from './lib/metrics'; console.log(resolveDateRule('last week'))"
{ startDate: '2025-10-20', endDate: '2025-10-26' }
```

## Metrics

All metrics are computed in `lib/query.ts` from exact dates. Revenue is `line_total` (after discounts, before refunds). `orders` and `customers` count distinct ids. `lib/metrics.ts` still holds the five original functions that feed the summary cards at the top of the page, and the date helper `resolveDateRule`.

## Visualization rules

- **Line chart:** trends over `day`, `week` or `month` (empty buckets are zero-filled).
- **Bar chart:** rankings and comparisons between products, categories, colors, sizes, channels or customer types.
- **Paired bars:** one period versus another.
- **Single metric card:** one total.
- **Table:** order-line lists and two-way breakdowns.
- **Out-of-scope card:** “This metric is out of scope” with the reason, for anything the dataset cannot answer.

All dashboard visualizations are generated only from `data/store-order-history.csv`. After a question is submitted, the answer section shows a black-and-white throbbing histogram while the query runs, then fades into the appropriate result.

## Validate

```bash
npm run lint
npm test
npm run build
```
