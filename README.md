# Merchant Lens

A Next.js dashboard for answering focused questions from merchant order history. Its development database is the supplied `data/store-order-history.csv`, parsed by `lib/merchant-data.ts` at runtime.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Metrics

Every metric is a plain TypeScript function that accepts exact `startDate` and `endDate` strings (`YYYY-MM-DD`) and returns its result:

- `mostSoldProduct(startDate, endDate)` — product with the most sold units. **Why:** identifies the product creating the greatest unit demand, helping with replenishment and promotion decisions.
- `returnsOnlineVsOffline(startDate, endDate)` — returned units by channel. **Why:** exposes channel-specific post-purchase friction, so operations can investigate the source of returns.
- `repeatVsNewCustomerSales(startDate, endDate)` — sales totals split by customer history. **Why:** distinguishes retention-driven revenue from acquisition-driven revenue.
- `totalSalesForBlackItems(startDate, endDate)` — revenue from black products. **Why:** answers a color-specific merchandising or campaign question without mixing in other variants.
- `topProductCategory(startDate, endDate)` — category with the most sold units. **Why:** shows which merchandise family is driving demand and deserves space or inventory attention.

The implementation lives in `lib/metrics.ts`, with a test suite in `lib/metrics.test.ts`.

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
