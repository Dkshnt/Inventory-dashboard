# Merchant Lens

A Next.js dashboard for answering focused questions from merchant order history. Its development database is the supplied `data/store-order-history.csv`, parsed by `lib/merchant-data.ts` at runtime.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## AI merchant chat

The chat endpoint (`POST /api/chat`) uses Vercel AI SDK's `streamText` with the OpenRouter provider. It streams the final answer to the dashboard as it arrives. OpenRouter selects **one** approved metric tool and exact dates; the selected plain-code tool then queries the local CSV. OpenRouter never receives the order-history rows.

Add your OpenRouter key to `.env.local`:

```bash
OPENROUTER_API_KEY=your_key_here
# Optional: choose any tool-capable model available to your account.
OPENROUTER_MODEL=openai/gpt-4o-mini
```

`.env.local` is Git-ignored. Do not put the key in `.env.example` or commit it.

### Tool calls and date interpretation

Every chat request must produce exactly one tool call with inclusive `startDate` and `endDate` values. The server rejects zero or multiple calls.

| Merchant wording | Tool | Exact date range |
| --- | --- | --- |
| “Which products were returned more — online or offline?” | `returns_online_vs_offline` | `2025-05-01` to `2025-10-31` (complete reporting period when omitted) |
| “Are regular customers purchasing more than new customers?” | `repeat_vs_new_customer_sales` | `2025-05-01` to `2025-10-31` |
| “How many black items did we sell on 10th Sep?” | `total_sales_for_black_items` | `2025-09-10` to `2025-09-10` |
| “In July, which was our most sold item?” | `top_product_category` | `2025-07-01` to `2025-07-31` |
| “Which product did we sell most in June?” | `most_sold_product` | `2025-06-01` to `2025-06-30` |

The router treats `10/9/2025` as DD/MM/YYYY, `last week` as `2025-10-20` through `2025-10-26`, and `last month` as `2025-09-01` through `2025-09-30`. These ranges are calculated from the fixed sample reference date `2025-10-28`. `this month` is the month containing the latest CSV entry (`2025-10-01` through `2025-10-27`).

## Metrics

Every metric is a plain TypeScript function that accepts exact `startDate` and `endDate` strings (`YYYY-MM-DD`) and returns its result:

- `mostSoldProduct(startDate, endDate)` — product with the most sold units. **Why:** identifies the product creating the greatest unit demand, helping with replenishment and promotion decisions.
- `returnsOnlineVsOffline(startDate, endDate)` — returned units by channel. **Why:** exposes channel-specific post-purchase friction, so operations can investigate the source of returns.
- `repeatVsNewCustomerSales(startDate, endDate)` — sales totals split by customer history. **Why:** distinguishes retention-driven revenue from acquisition-driven revenue.
- `totalSalesForBlackItems(startDate, endDate)` — revenue from black products. **Why:** answers a color-specific merchandising or campaign question without mixing in other variants.
- `topProductCategory(startDate, endDate)` — category with the most sold units. **Why:** shows which merchandise family is driving demand and deserves space or inventory attention.

The implementation lives in `lib/metrics.ts`, with a test suite in `lib/metrics.test.ts`.

## Visualization rules

- **Line chart:** use for trends, where a metric is compared across time periods.
- **Bar chart:** use for comparisons; the dashboard applies it to online versus offline returns and repeat versus new-customer sales.
- **Single metric card:** use for totals and ranked numbers; the dashboard applies it to the June top product, 10 September black-item sales, and July top category.
- **Table:** use when the merchant asks for detailed rows or columns rather than one aggregate or comparison.

All dashboard visualizations are generated only from `data/store-order-history.csv`. After a question is submitted, the answer section shows a black-and-white throbbing histogram while the metric tool runs, then fades into the appropriate chart.

## Date rules

- **Last week** is the full Monday–Sunday calendar week before a supplied fixed date. The reproducible default is `FIXED_TODAY = "2025-10-28"`; callers can still pass another exact date as the second argument.
- **This month** is the month containing the latest order entry.
- **Sales** metrics filter by `orderDate`.
- **Returns** metrics filter by `returnDate`.
- `10/9/2025` in this dashboard means **10 September 2025** (DD/MM/YYYY).

### `last week` terminal output

With the fixed reference date above:

```text
> tsx -e "import { resolveDateRule } from './lib/metrics'; console.log(resolveDateRule('last week'))"
{ startDate: '2025-10-20', endDate: '2025-10-26' }
```

## Validate

```bash
npm run lint
npm test
npm run build
```


SS - <img width="653" height="492" alt="image" src="https://github.com/user-attachments/assets/edcd69a1-a514-41d7-8975-530efa8f030c" />

