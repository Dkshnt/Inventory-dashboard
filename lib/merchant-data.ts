import fs from "node:fs";
import path from "node:path";
import type { Order, ReturnRecord } from "./types";

type CsvRow = Record<string, string>;
const filePath = path.join(process.cwd(), "data", "store-order-history.csv");
const [header, ...lines] = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
const columns = header.split(",");
const rows: CsvRow[] = lines.map((line) => Object.fromEntries(columns.map((column, index) => [column, line.split(",")[index] ?? ""])));
const channel = (value: string) => value === "Point of Sale" ? "offline" as const : "online" as const;
const color = (variant: string) => variant.split("/").at(-1)?.trim() ?? "";

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
