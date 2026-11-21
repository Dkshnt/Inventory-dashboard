import { z } from "zod";
import { dataColumns, lineItems } from "./merchant-data";
import { FIXED_TODAY, resolveDateRule } from "./metrics";
import type { LineItem } from "./types";

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

export const METRICS = ["units_sold", "revenue", "discounts", "orders", "customers", "avg_order_value", "units_returned", "refunds", "return_rate"] as const;
export const GROUPS = ["product", "category", "color", "size", "channel", "sales_channel", "customer_type", "customer", "fulfillment_status", "return_reason", "day", "week", "month"] as const;
export const PERIODS = ["today", "yesterday", "this_week", "last_week", "last_7_days", "this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year", "last_30_days", "all_time"] as const;

export type Metric = (typeof METRICS)[number];
export type Group = (typeof GROUPS)[number];
export type Period = (typeof PERIODS)[number];
type DateField = "order_date" | "return_date";
type DateRange = { startDate: string; endDate: string };
type Format = "number" | "currency" | "percent";

const METRIC_META: Record<Metric, { label: string; format: Format; additive: boolean }> = {
  units_sold: { label: "Units sold", format: "number", additive: true },
  revenue: { label: "Revenue", format: "currency", additive: true },
  discounts: { label: "Discounts given", format: "currency", additive: true },
  orders: { label: "Orders", format: "number", additive: false },
  customers: { label: "Customers", format: "number", additive: false },
  avg_order_value: { label: "Average order value", format: "currency", additive: false },
  units_returned: { label: "Units returned", format: "number", additive: true },
  refunds: { label: "Refunds", format: "currency", additive: true },
  return_rate: { label: "Return rate", format: "percent", additive: false }
};

const GROUP_LABEL: Record<Group, string> = {
  product: "Product", category: "Category", color: "Color", size: "Size", channel: "Channel", sales_channel: "Sales channel",
  customer_type: "Customer type", customer: "Customer", fulfillment_status: "Fulfillment status", return_reason: "Return reason",
  day: "Day", week: "Week", month: "Month"
};
const TIME_GROUPS: Group[] = ["day", "week", "month"];
const isTime = (group: Group) => TIME_GROUPS.includes(group);

/* ------------------------------------------------------------------ */
/* Tool input schema (what the LLM fills in)                           */
/* ------------------------------------------------------------------ */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const terms = z.array(z.string().min(1)).max(10);

export const querySchema = z.object({
  outOfScope: z.string().nullish().describe("Set ONLY when the question asks for something this dataset cannot answer: a field it does not record (profit, margin, cost, stock/inventory, traffic, conversion, ratings, customer age/gender/location, shipping time, ad spend), a forecast or prediction, a product/value that is not in the catalog, or a topic unrelated to this store. Give a short phrase naming what was asked, e.g. \"profit margin\". Never substitute a nearby metric. Leave every other field empty."),
  show: z.enum(["summary", "rows"]).nullish().describe("summary (default): one number, a ranking, a trend or a comparison. rows: list the matching order lines when the merchant asks to list/show/see the orders or items themselves."),
  metric: z.enum(METRICS).nullish().describe("What to measure. units_sold = items sold / how many. revenue = sales / money. orders = distinct orders. customers = distinct customers. avg_order_value. units_returned = items returned. refunds = money refunded. return_rate = returned units / units sold. discounts = money discounted."),
  groupBy: z.array(z.enum(GROUPS)).max(2).nullish().describe("Break the metric down by one or two dimensions. Use it for rankings (most/best/top/which product), comparisons between values (online vs offline, black vs navy, repeat vs new) and trends (day/week/month). Omit for a single total."),
  products: terms.nullish().describe("Product names or parts of names, e.g. ['parka']."),
  categories: terms.nullish().describe("Product categories from the catalog. Map generic words (jackets, coats, tops, trousers) to the closest category."),
  colors: terms.nullish().describe("Colors from the catalog, e.g. ['black']."),
  sizes: terms.nullish().describe("Sizes from the catalog, e.g. ['M']. small/medium/large map to S/M/L."),
  channels: terms.nullish().describe("online, offline (in-store / point of sale) or an exact sales channel such as Instagram, Shop app, Online Store, Point of Sale."),
  customerType: z.enum(["new", "repeat"]).nullish().describe("Restrict to new or repeat (regular/returning) customers."),
  customerIds: terms.nullish().describe("Specific customer ids such as C-10233."),
  fulfillmentStatuses: terms.nullish().describe("fulfilled, partially_fulfilled or unfulfilled."),
  returnReasons: terms.nullish().describe("Return reasons from the catalog, e.g. ['too small']."),
  returnedOnly: z.boolean().nullish().describe("true to include only items that were returned."),
  startDate: isoDate.nullish().describe("Inclusive start, YYYY-MM-DD. Use for named dates, months, quarters and ranges."),
  endDate: isoDate.nullish().describe("Inclusive end, YYYY-MM-DD. Same as startDate for a single day."),
  period: z.enum(PERIODS).nullish().describe("Calendar period resolved by the server. Prefer it for 'last week', 'this week', 'last month', 'this month', 'last/this quarter', 'last/this year', 'yesterday' etc. Ignored when startDate/endDate are given. Omit when the merchant gives no date at all (the server then uses the earliest to the latest date in the dataset)."),
  dateField: z.enum(["order_date", "return_date"]).nullish().describe("Which date the range applies to. Defaults: units_returned and refunds use return_date, everything else uses order_date."),
  compareStartDate: isoDate.nullish().describe("Start of a second period to compare against (e.g. 'June vs July')."),
  compareEndDate: isoDate.nullish().describe("End of the second period."),
  comparePeriod: z.enum(PERIODS).nullish().describe("Relative second period, e.g. last_month when the main period is this_month."),
  sort: z.enum(["desc", "asc"]).nullish().describe("desc (default) = highest/newest first. asc for lowest/least/oldest."),
  limit: z.number().int().min(1).max(100).nullish().describe("Max groups or rows to return. Omit unless the merchant asks for a specific top N.")
});
export type QueryInput = z.infer<typeof querySchema>;

/* ------------------------------------------------------------------ */
/* Output shapes (what the dashboard renders)                          */
/* ------------------------------------------------------------------ */

export type GroupRow = { labels: string[]; value: number };
export type QueryData =
  | { kind: "message" }
  | { kind: "out_of_scope"; reason: string }
  | { kind: "value"; label: string; format: Format; value: number; matched: number; scope: string }
  | { kind: "groups"; label: string; format: Format; dims: string[]; chart: "line" | "bar" | "table"; rows: GroupRow[]; total: number }
  | { kind: "comparison"; label: string; format: Format; currentRange: string; previousRange: string; dims: string[]; rows: Array<{ labels: string[]; current: number; previous: number; change: number; changePct: number | null }> }
  | { kind: "rows"; columns: string[]; rows: Array<Array<string | number>>; total: number };
export type QueryOutput = { answer: string; range: string; data: QueryData };

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => { const date = toDate(iso); date.setUTCDate(date.getUTCDate() + days); return toIso(date); };
const isRealDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(toDate(iso).getTime()) && toIso(toDate(iso)) === iso;
const mondayOf = (iso: string) => addDays(iso, -((toDate(iso).getUTCDay() || 7) - 1));
const nextMonth = (month: string) => { const [year, m] = month.split("-").map(Number); return m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`; };

function bounds(field: DateField): DateRange {
  const dates = lineItems.map((item) => field === "order_date" ? item.orderDate : item.returnDate).filter(Boolean).sort();
  return { startDate: dates[0] ?? FIXED_TODAY, endDate: dates.at(-1) ?? FIXED_TODAY };
}

/** Earliest and latest date anywhere in the dataset (order dates and return dates). */
function datasetBounds(): DateRange {
  const a = bounds("order_date");
  const b = bounds("return_date");
  return { startDate: a.startDate < b.startDate ? a.startDate : b.startDate, endDate: a.endDate > b.endDate ? a.endDate : b.endDate };
}
const quarterStart = (iso: string) => `${iso.slice(0, 4)}-${String(Math.floor((Number(iso.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;

function periodRange(period: Period): DateRange {
  switch (period) {
    case "today": return { startDate: FIXED_TODAY, endDate: FIXED_TODAY };
    case "yesterday": { const day = addDays(FIXED_TODAY, -1); return { startDate: day, endDate: day }; }
    case "this_week": return { startDate: mondayOf(FIXED_TODAY), endDate: FIXED_TODAY };
    case "last_week": return resolveDateRule("last week");
    case "last_7_days": return { startDate: addDays(FIXED_TODAY, -6), endDate: FIXED_TODAY };
    case "this_month": return resolveDateRule("this month");
    case "last_month": { const endDate = addDays(`${FIXED_TODAY.slice(0, 7)}-01`, -1); return { startDate: `${endDate.slice(0, 7)}-01`, endDate }; }
    case "last_30_days": return { startDate: addDays(FIXED_TODAY, -29), endDate: FIXED_TODAY };
    case "this_quarter": return { startDate: quarterStart(FIXED_TODAY), endDate: FIXED_TODAY };
    case "last_quarter": { const endDate = addDays(quarterStart(FIXED_TODAY), -1); return { startDate: quarterStart(endDate), endDate }; }
    case "this_year": return { startDate: `${FIXED_TODAY.slice(0, 4)}-01-01`, endDate: FIXED_TODAY };
    case "last_year": { const year = Number(FIXED_TODAY.slice(0, 4)) - 1; return { startDate: `${year}-01-01`, endDate: `${year}-12-31` }; }
    case "all_time": return datasetBounds();
  }
}

type RangeInput = { startDate?: string | null; endDate?: string | null; period?: Period | null };
/** Returns a range, or a human-readable error string. */
function resolveRange({ startDate, endDate, period }: RangeInput): DateRange | string {
  if (startDate || endDate) {
    const edge = datasetBounds();
    const range = { startDate: startDate ?? (endDate && endDate < edge.startDate ? endDate : edge.startDate), endDate: endDate ?? (startDate && startDate > edge.endDate ? startDate : edge.endDate) };
    if (!isRealDate(range.startDate) || !isRealDate(range.endDate)) return "One of the dates is not a real calendar date.";
    if (range.startDate > range.endDate) return "The start date is after the end date.";
    return range;
  }
  return periodRange(period ?? "all_time");
}
const rangeText = (range: DateRange) => `${range.startDate} to ${range.endDate}`;

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

type ListFilter = "products" | "categories" | "colors" | "sizes" | "channels" | "customerIds" | "fulfillmentStatuses" | "returnReasons";
type Filters = Record<ListFilter, string[]> & { customerType: "new" | "repeat" | null; returnedOnly: boolean };

const lower = (value: string) => value.toLowerCase().trim();
const norm = (value: string) => lower(value).replace(/[_-]+/g, " ");
/** "jackets" -> ["jackets", "jacket"]; only used for substring matching. */
const forms = (term: string) => {
  const t = lower(term);
  return [t, ...(t.endsWith("ies") ? [`${t.slice(0, -3)}y`] : []), ...(t.endsWith("es") ? [t.slice(0, -2)] : []), ...(t.endsWith("s") ? [t.slice(0, -1)] : [])].filter((form, index) => index === 0 || form.length >= 3);
};
const contains = (value: string, term: string) => forms(term).some((form) => lower(value).includes(form));
const SIZE_ALIAS: Record<string, string> = { small: "s", medium: "m", large: "l", "extra large": "xl", "extra small": "xs" };
const OFFLINE_WORDS = ["offline", "in-store", "in store", "instore", "store", "physical", "retail", "pos"];

const MATCHERS: Record<ListFilter, (item: LineItem, term: string) => boolean> = {
  products: (item, term) => contains(item.product, term) || lower(item.productId) === lower(term),
  categories: (item, term) => contains(item.category, term),
  colors: (item, term) => lower(item.color) === lower(term),
  sizes: (item, term) => lower(item.size) === (SIZE_ALIAS[lower(term)] ?? lower(term)),
  channels: (item, term) => {
    const t = lower(term);
    if (lower(item.salesChannel) === t) return true;
    if (t === "online") return item.channel === "online";
    if (OFFLINE_WORDS.includes(t)) return item.channel === "offline";
    return t.length >= 3 && lower(item.salesChannel).includes(t);
  },
  customerIds: (item, term) => lower(item.customerId) === lower(term),
  fulfillmentStatuses: (item, term) => norm(item.fulfillmentStatus) === norm(term) || norm(item.fulfillmentStatus).includes(norm(term)),
  returnReasons: (item, term) => contains(item.returnReason, term)
};
const LIST_FILTERS = Object.keys(MATCHERS) as ListFilter[];
const FILTER_LABEL: Record<ListFilter, string> = { products: "product", categories: "category", colors: "color", sizes: "size", channels: "sales channel", customerIds: "customer", fulfillmentStatuses: "fulfillment status", returnReasons: "return reason" };

const clean = (values?: string[] | null) => (values ?? []).map((value) => value.trim()).filter(Boolean);
function readFilters(input: QueryInput): Filters {
  return {
    products: clean(input.products), categories: clean(input.categories), colors: clean(input.colors), sizes: clean(input.sizes),
    channels: clean(input.channels), customerIds: clean(input.customerIds), fulfillmentStatuses: clean(input.fulfillmentStatuses),
    returnReasons: clean(input.returnReasons), customerType: input.customerType ?? null, returnedOnly: input.returnedOnly ?? false
  };
}

function passes(item: LineItem, filters: Filters) {
  return LIST_FILTERS.every((key) => filters[key].length === 0 || filters[key].some((term) => MATCHERS[key](item, term)))
    && (!filters.customerType || (filters.customerType === "repeat") === item.isRepeatCustomer)
    && (!filters.returnedOnly || item.returned);
}

const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
function knownValues(key: ListFilter): string[] {
  switch (key) {
    case "products": return uniq(lineItems.map((item) => item.product));
    case "categories": return uniq(lineItems.map((item) => item.category));
    case "colors": return uniq(lineItems.map((item) => item.color));
    case "sizes": return uniq(lineItems.map((item) => item.size));
    case "channels": return ["online", "offline", ...uniq(lineItems.map((item) => item.salesChannel))];
    case "customerIds": return uniq(lineItems.map((item) => item.customerId));
    case "fulfillmentStatuses": return uniq(lineItems.map((item) => item.fulfillmentStatus));
    case "returnReasons": return uniq(lineItems.map((item) => item.returnReason));
  }
}

/** Filter terms that match nothing in the whole dataset, e.g. a product that does not exist. */
function unknownFilterMessage(filters: Filters): string | null {
  const problems: string[] = [];
  for (const key of LIST_FILTERS) {
    const missing = filters[key].filter((term) => !lineItems.some((item) => MATCHERS[key](item, term)));
    if (missing.length) problems.push(`I couldn't find ${FILTER_LABEL[key]} ${missing.map((term) => `“${term}”`).join(", ")} in the data. Known ${FILTER_LABEL[key]} values: ${knownValues(key).slice(0, 25).join(", ")}.`);
  }
  return problems.length ? problems.join(" ") : null;
}

/** Catalog text for the system prompt so the model uses real product, color, size and channel names. */
export function catalogText(): string {
  const categories = uniq(lineItems.map((item) => item.category));
  const byCategory = categories.map((category) => `  - ${category}: ${uniq(lineItems.filter((item) => item.category === category).map((item) => item.product)).join(", ")}`).join("\n");
  const channels = uniq(lineItems.map((item) => item.salesChannel)).map((raw) => `${raw} (${lineItems.find((item) => item.salesChannel === raw)?.channel})`).join(", ");
  const orderBounds = bounds("order_date");
  const returnBounds = bounds("return_date");
  return [
    `Categories and products:\n${byCategory}`,
    `Colors: ${knownValues("colors").join(", ")}`,
    `Sizes: ${knownValues("sizes").join(", ")}`,
    `Sales channels (and whether they count as online/offline): ${channels}`,
    `Return reasons: ${knownValues("returnReasons").join(", ")}`,
    `Fulfillment statuses: ${knownValues("fulfillmentStatuses").join(", ")}`,
    `Orders span ${rangeText(orderBounds)}; returns were processed ${rangeText(returnBounds)}. The dataset covers ${rangeText(datasetBounds())}.`,
    `Fields recorded in the data (nothing else exists): ${dataColumns.join(", ")}`
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Measuring and grouping                                              */
/* ------------------------------------------------------------------ */

const round2 = (value: number) => Math.round(value * 100) / 100;
const fieldDate = (item: LineItem, field: DateField) => field === "order_date" ? item.orderDate : item.returnDate;

function measure(items: LineItem[], metric: Metric): number {
  const sum = (pick: (item: LineItem) => number) => items.reduce((total, item) => total + pick(item), 0);
  const orderCount = () => new Set(items.map((item) => item.orderId)).size;
  switch (metric) {
    case "units_sold": return sum((item) => item.quantity);
    case "revenue": return round2(sum((item) => item.lineTotal));
    case "discounts": return round2(sum((item) => item.discount));
    case "orders": return orderCount();
    case "customers": return new Set(items.map((item) => item.customerId)).size;
    case "avg_order_value": { const count = orderCount(); return count ? round2(sum((item) => item.lineTotal) / count) : 0; }
    case "units_returned": return sum((item) => item.returned ? item.quantity : 0);
    case "refunds": return round2(sum((item) => item.returned ? item.refund : 0));
    case "return_rate": { const sold = sum((item) => item.quantity); return sold ? sum((item) => item.returned ? item.quantity : 0) / sold : 0; }
  }
}

function groupLabel(item: LineItem, group: Group, field: DateField): string {
  const date = fieldDate(item, field);
  switch (group) {
    case "product": return item.product;
    case "category": return item.category;
    case "color": return item.color;
    case "size": return item.size;
    case "channel": return item.channel === "online" ? "Online" : "Offline";
    case "sales_channel": return item.salesChannel;
    case "customer_type": return item.isRepeatCustomer ? "Repeat" : "New";
    case "customer": return item.customerId;
    case "fulfillment_status": return norm(item.fulfillmentStatus);
    case "return_reason": return item.returnReason || "Not returned";
    case "day": return date;
    case "week": return mondayOf(date);
    case "month": return date.slice(0, 7);
  }
}

function select(range: DateRange, field: DateField, filters: Filters): LineItem[] {
  return lineItems.filter((item) => {
    const date = fieldDate(item, field);
    return date !== "" && date >= range.startDate && date <= range.endDate && passes(item, filters);
  });
}

function computeGroups(items: LineItem[], metric: Metric, dims: Group[], field: DateField): GroupRow[] {
  const buckets = new Map<string, { labels: string[]; items: LineItem[] }>();
  for (const item of items) {
    const labels = dims.map((dim) => groupLabel(item, dim, field));
    const key = labels.join("\u0000");
    const bucket = buckets.get(key) ?? { labels, items: [] };
    bucket.items.push(item);
    buckets.set(key, bucket);
  }
  return [...buckets.values()].map((bucket) => ({ labels: bucket.labels, value: measure(bucket.items, metric) }));
}

/** Zero-fills empty days/weeks/months between the first and last bucket in range so trends are honest. */
function fillTimeline(rows: GroupRow[], dim: Group, range: DateRange, field: DateField): GroupRow[] {
  const edge = bounds(field);
  const start = range.startDate > edge.startDate ? range.startDate : edge.startDate;
  const end = range.endDate < edge.endDate ? range.endDate : edge.endDate;
  const keys: string[] = [];
  if (dim === "month") { for (let month = start.slice(0, 7); month <= end.slice(0, 7) && keys.length < 400; month = nextMonth(month)) keys.push(month); }
  else { const step = dim === "week" ? 7 : 1; for (let day = dim === "week" ? mondayOf(start) : start; day <= end && keys.length < 400; day = addDays(day, step)) keys.push(day); }
  const values = new Map(rows.map((row) => [row.labels[0], row.value]));
  return keys.map((key) => ({ labels: [key], value: values.get(key) ?? 0 }));
}

/* ------------------------------------------------------------------ */
/* Formatting and wording                                              */
/* ------------------------------------------------------------------ */

function fmt(value: number, format: Format) {
  if (format === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
const signed = (value: number, format: Format) => `${value < 0 ? "-" : "+"}${fmt(Math.abs(value), format)}`;
const message = (answer: string, range = ""): QueryOutput => ({ answer, range, data: { kind: "message" } });
const CAPABILITIES = "units sold, revenue, discounts, orders, customers, average order value, units returned, refunds and return rate, by product, category, color, size, channel, customer type, fulfillment status, return reason, or day/week/month";
const outOfScope = (reason: string, range = ""): QueryOutput => ({ answer: `This metric is out of scope. ${reason}`, range, data: { kind: "out_of_scope", reason } });
const outsideCoverage = (range: DateRange) => { const coverage = datasetBounds(); return range.endDate < coverage.startDate || range.startDate > coverage.endDate; };
const coverageReason = (range: DateRange) => `There is no data for ${rangeText(range)}. The dataset covers ${rangeText(datasetBounds())}.`;

function scopeText(filters: Filters): string {
  const parts = [...filters.products, ...filters.categories, ...filters.colors, ...filters.sizes, ...filters.channels, ...filters.fulfillmentStatuses, ...filters.returnReasons.map((reason) => `returned: ${reason}`), ...filters.customerIds];
  if (filters.customerType) parts.push(`${filters.customerType} customers`);
  if (filters.returnedOnly) parts.push("returned items only");
  return parts.length ? ` (${parts.join(", ")})` : "";
}
const names = (rows: GroupRow[]) => rows.slice(0, 5).map((row) => row.labels.join(" · ")).join(", ") + (rows.length > 5 ? `, +${rows.length - 5} more` : "");

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function runQuery(input: QueryInput): QueryOutput {
  if (input.outOfScope?.trim()) return outOfScope(`“${input.outOfScope.trim()}” isn't recorded in this dataset. I can answer questions about ${CAPABILITIES}.`);
  const filters = readFilters(input);
  const unknown = unknownFilterMessage(filters);
  if (unknown) return outOfScope(unknown);

  const metric: Metric = input.metric ?? "units_sold";
  const meta = METRIC_META[metric];
  const returnDefault = metric === "units_returned" || metric === "refunds" || (input.show === "rows" && filters.returnedOnly);
  const field: DateField = metric === "return_rate" ? "order_date" : input.dateField ?? (returnDefault ? "return_date" : "order_date");
  const range = resolveRange(input);
  if (typeof range === "string") return message(range);
  const rangeLabel = rangeText(range);
  if (outsideCoverage(range)) return outOfScope(coverageReason(range), rangeLabel);
  const scope = scopeText(filters);
  const sort = input.sort ?? "desc";

  /* ---- raw rows ---- */
  if (input.show === "rows") {
    const matched = select(range, field, filters).sort((a, b) => (fieldDate(a, field) < fieldDate(b, field) ? -1 : 1) * (sort === "desc" ? -1 : 1) || a.lineItemId.localeCompare(b.lineItemId));
    const limit = input.limit ?? 25;
    const shown = matched.slice(0, limit);
    const columns = ["Order date", "Order", "Customer", "Product", "Variant", "Channel", "Qty", "Total", "Status", "Return"];
    const rows = shown.map((item) => [item.orderDate, item.orderId, item.customerId, item.product, item.variant, item.salesChannel, item.quantity, fmt(item.lineTotal, "currency"), norm(item.fulfillmentStatus), item.returned ? `${item.returnDate} · ${item.returnReason}` : ""]);
    if (!matched.length) return message(`No order lines matched${scope} between ${rangeLabel}.`, rangeLabel);
    return { answer: `${matched.length} order line${matched.length === 1 ? "" : "s"} matched${scope}${matched.length > shown.length ? `; showing the first ${shown.length}` : ""}.`, range: rangeLabel, data: { kind: "rows", columns, rows, total: matched.length } };
  }

  const dims = input.groupBy ?? [];
  const dimNames = dims.map((dim) => GROUP_LABEL[dim]);
  const items = select(range, field, filters);

  /* ---- comparison between two periods ---- */
  if (input.compareStartDate || input.compareEndDate || input.comparePeriod) {
    if (dims.some(isTime)) return message("A period comparison can't also be split by day, week or month. Ask for the trend, or compare two periods without the time split.", rangeLabel);
    const previousRange = resolveRange({ startDate: input.compareStartDate, endDate: input.compareEndDate, period: input.comparePeriod });
    if (typeof previousRange === "string") return message(previousRange, rangeLabel);
    if (outsideCoverage(previousRange)) return outOfScope(coverageReason(previousRange), rangeText(previousRange));
    const previousItems = select(previousRange, field, filters);
    if (!items.length && !previousItems.length) return message(`No order lines matched${scope} in either period.`, `${rangeLabel} vs ${rangeText(previousRange)}`);
    const makeRow = (labels: string[], cur: number, prev: number) => ({ labels, current: cur, previous: prev, change: round2(cur - prev), changePct: prev === 0 ? null : (cur - prev) / prev });
    let rows: ReturnType<typeof makeRow>[];
    if (dims.length) {
      const current = computeGroups(items, metric, dims, field);
      const previous = computeGroups(previousItems, metric, dims, field);
      const keys = new Map<string, string[]>();
      [...current, ...previous].forEach((row) => keys.set(row.labels.join("\u0000"), row.labels));
      const lookup = (list: GroupRow[], labels: string[]) => list.find((row) => row.labels.join("\u0000") === labels.join("\u0000"))?.value ?? 0;
      rows = [...keys.values()].map((labels) => makeRow(labels, lookup(current, labels), lookup(previous, labels)));
    } else rows = [makeRow(["Total"], measure(items, metric), measure(previousItems, metric))];
    rows.sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.labels.join().localeCompare(b.labels.join()));
    const pct = (row: { changePct: number | null }) => row.changePct === null ? "n/a" : `${row.changePct >= 0 ? "+" : "-"}${Math.abs(row.changePct * 100).toFixed(1)}%`;
    const top = rows[0];
    const prevText = rangeText(previousRange);
    const answer = dims.length
      ? `${meta.label}${scope} by ${dimNames.join(" and ").toLowerCase()}, ${rangeLabel} vs ${prevText}. Biggest change: ${top.labels.join(" · ")} (${fmt(top.previous, meta.format)} → ${fmt(top.current, meta.format)}, ${signed(top.change, meta.format)}, ${pct(top)}).`
      : `${meta.label}${scope}: ${fmt(top.current, meta.format)} (${rangeLabel}) vs ${fmt(top.previous, meta.format)} (${prevText}), ${signed(top.change, meta.format)} (${pct(top)}).`;
    return { answer, range: `${rangeLabel} vs ${prevText}`, data: { kind: "comparison", label: meta.label, format: meta.format, currentRange: rangeLabel, previousRange: prevText, dims: dimNames, rows } };
  }

  /* ---- single value ---- */
  if (!dims.length) {
    const value = measure(items, metric);
    const answer = items.length ? `${meta.label}${scope}: ${fmt(value, meta.format)} (${rangeLabel}).` : `${meta.label}${scope}: ${fmt(0, meta.format)}. No matching order lines between ${rangeLabel}.`;
    return { answer, range: rangeLabel, data: { kind: "value", label: meta.label, format: meta.format, value, matched: items.length, scope: scope.replace(/^ \(|\)$/g, "") } };
  }

  /* ---- grouped: ranking, comparison between values, or trend ---- */
  if (!items.length) return message(`No order lines matched${scope} between ${rangeLabel}.`, rangeLabel);
  let rows = computeGroups(items, metric, dims, field);
  const timeline = dims.length === 1 && isTime(dims[0]);
  if (timeline) rows = fillTimeline(rows, dims[0], range, field);
  if (dims.some(isTime)) rows.sort((a, b) => a.labels.join().localeCompare(b.labels.join()));
  else rows.sort((a, b) => (sort === "desc" ? b.value - a.value : a.value - b.value) || a.labels.join().localeCompare(b.labels.join()));
  const all = rows;
  const limit = input.limit ?? (dims.length === 1 ? 10 : 25);
  const total = all.length;
  rows = all.slice(0, limit);
  const chart = timeline ? "line" : dims.length === 1 ? "bar" : "table";

  let answer: string;
  if (timeline) {
    const peak = [...all].sort((a, b) => b.value - a.value)[0];
    answer = `${meta.label}${scope} by ${dimNames[0].toLowerCase()} (${rangeLabel}): peak ${peak.labels[0]} at ${fmt(peak.value, meta.format)}${meta.additive ? `; total ${fmt(round2(all.reduce((sum, row) => sum + row.value, 0)), meta.format)}` : ""}.`;
  } else if (dims.length === 1) {
    const best = all[0].value;
    const tied = all.filter((row) => row.value === best);
    const word = sort === "asc" ? "Lowest" : "Top";
    answer = `${word} ${dimNames[0].toLowerCase()} by ${meta.label.toLowerCase()}${scope} (${rangeLabel}): ${tied.length > 1 ? `${names(tied)} tied at ${fmt(best, meta.format)}` : `${all[0].labels[0]} (${fmt(best, meta.format)})`}.${total > rows.length ? ` Showing ${rows.length} of ${total}.` : ""}`;
  } else {
    answer = `${meta.label}${scope} by ${dimNames.join(" and ").toLowerCase()} (${rangeLabel}): ${total} combination${total === 1 ? "" : "s"}${total > rows.length ? `, showing ${rows.length}` : ""}.`;
  }
  return { answer, range: rangeLabel, data: { kind: "groups", label: meta.label, format: meta.format, dims: dimNames, chart, rows, total } };
}
