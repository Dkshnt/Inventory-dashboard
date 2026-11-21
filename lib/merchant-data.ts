import fs from "node:fs";
import path from "node:path";
import type { LineItem, Order, ReturnRecord } from "./types";

type CsvRow = Record<string, string>;
const filePath = path.join(process.cwd(), "data", "store-order-history.csv");

/** Minimal CSV line parser that understands "quoted, values" and "" escapes. */
function parseLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') { if (line[i + 1] === '"') { current += '"'; i++; } else quoted = false; }
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { cells.push(current); current = ""; }
    else current += char;
  }
  cells.push(current);
  return cells;
}

const [headerLine, ...lines] = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
const columns = parseLine(headerLine);
const rows: CsvRow[] = lines.filter((line) => line.trim()).map((line) => {
  const cells = parseLine(line);
  return Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ""]));
});
const channel = (value: string) => value === "Point of Sale" ? "offline" as const : "online" as const;
const color = (variant: string) => variant.split("/").at(-1)?.trim() ?? "";
const size = (variant: string) => variant.split("/")[0]?.trim() ?? "";

/** The checked-in CSV is the development database. Keep its date fields in ISO YYYY-MM-DD form. */
export const orders: Order[] = rows.map((row) => ({
  id: row.line_item_id, orderDate: row.order_date, customerId: row.customer_id,
  isRepeatCustomer: row.is_repeat_customer === "true", product: row.product_title,
  category: row.product_category, color: color(row.variant), channel: channel(row.sales_channel),
  quantity: Number(row.quantity), total: Number(row.line_total)
}));

export const returns: ReturnRecord[] = rows.filter((row) => row.returned === "true" && row.return_date).map((row) => ({
  id: `return-${row.line_item_id}`, orderId: row.line_item_id, returnDate: row.return_date,
  channel: channel(row.sales_channel), quantity: Number(row.quantity)
}));

/** Every column of every row, for the general query engine. */
export const lineItems: LineItem[] = rows.map((row) => ({
  lineItemId: row.line_item_id, orderId: row.order_id, orderDate: row.order_date, customerId: row.customer_id,
  isRepeatCustomer: row.is_repeat_customer === "true", productId: row.product_id, product: row.product_title,
  category: row.product_category, variant: row.variant, size: size(row.variant), color: color(row.variant),
  quantity: Number(row.quantity), unitPrice: Number(row.unit_price), discount: Number(row.discount_amount || 0),
  lineTotal: Number(row.line_total), salesChannel: row.sales_channel, channel: channel(row.sales_channel),
  fulfillmentStatus: row.fulfillment_status, returned: row.returned === "true", returnDate: row.return_date,
  returnReason: row.return_reason, refund: Number(row.refund_amount || 0)
}));
