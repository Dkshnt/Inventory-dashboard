# Merchant Lens

A Next.js dashboard for answering focused questions from merchant order history. It includes a sample database in `lib/merchant-data.ts`; replace those arrays with your database queries when connecting production data.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Metrics

Every metric is a plain TypeScript function that accepts exact `startDate` and `endDate` strings (`YYYY-MM-DD`) and returns its result:

- `mostSoldProduct(startDate, endDate)` — product with the most sold units.
- `returnsOnlineVsOffline(startDate, endDate)` — returned units by channel.
- `repeatVsNewCustomerSales(startDate, endDate)` — sales totals split by customer history.
- `totalSalesForBlackItems(startDate, endDate)` — revenue from black products.
- `topProductCategory(startDate, endDate)` — category with the most sold units.

The implementation lives in `lib/metrics.ts`, with a test suite in `lib/metrics.test.ts`.

## Date rules

- **Last week** is the full Monday–Sunday calendar week before a supplied fixed date.
- **This month** is the month containing the latest order entry.
- **Sales** metrics filter by `orderDate`.
- **Returns** metrics filter by `returnDate`.
- `10/9/2025` in this dashboard means **10 September 2025** (DD/MM/YYYY).

## Validate

```bash
npm run lint
npm test
npm run build
```
