import { orders, returns } from "./merchant-data";
import type { Channel, Order } from "./types";

export type DateRange = { startDate: string; endDate: string };
/** The "current date" for all relative phrases (last week, this month, ...). Fixed so the sample dataset stays reproducible; change it to today's date for a live store. */
export const FIXED_TODAY = "2025-10-28";
const inRange = (date: string, { startDate, endDate }: DateRange) => date >= startDate && date <= endDate;
const rangeOrders = (range: DateRange) => orders.filter((order) => inRange(order.orderDate, range));

/** Sales metric: ranks products by units sold using orderDate. */
export function mostSoldProduct(startDate: string, endDate: string) {
  const units = new Map<string, number>();
  rangeOrders({ startDate, endDate }).forEach((o) => units.set(o.product, (units.get(o.product) ?? 0) + o.quantity));
  const winner = [...units.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return winner ? { product: winner[0], units: winner[1] } : null;
}

/** Return metric: counts returned units by channel using returnDate. */
export function returnsOnlineVsOffline(startDate: string, endDate: string): Record<Channel, number> {
  return returns.filter((item) => inRange(item.returnDate, { startDate, endDate })).reduce<Record<Channel, number>>((total, item) => {
    total[item.channel] += item.quantity; return total;
  }, { online: 0, offline: 0 });
}

/** Sales metric: uses the database's is_repeat_customer flag and filters with orderDate. */
export function repeatVsNewCustomerSales(startDate: string, endDate: string) {
  return rangeOrders({ startDate, endDate }).reduce((total, order) => {
    total[order.isRepeatCustomer ? "repeatSales" : "newSales"] += order.total;
    return total;
  }, { repeatSales: 0, newSales: 0 });
}

/** Sales metric: total revenue for black products using orderDate. */
export function totalSalesForBlackItems(startDate: string, endDate: string) {
  return rangeOrders({ startDate, endDate }).filter((order) => order.color.toLowerCase() === "black").reduce((sum, order) => sum + order.total, 0);
}

/** Sales metric: ranks categories by units sold using orderDate. */
export function topProductCategory(startDate: string, endDate: string) {
  const units = new Map<string, number>();
  rangeOrders({ startDate, endDate }).forEach((o) => units.set(o.category, (units.get(o.category) ?? 0) + o.quantity));
  const winner = [...units.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return winner ? { category: winner[0], units: winner[1] } : null;
}

export function latestOrderDate() { return orders.reduce((latest, order) => order.orderDate > latest ? order.orderDate : latest, orders[0].orderDate); }

/** Calendar rules: "last week" is the Mon–Sun week before the current date; "this month" runs from the 1st of the current month through the current date. */
export function resolveDateRule(rule: "last week" | "this month", fixedDate = FIXED_TODAY) {
  if (rule === "this month") return { startDate: `${fixedDate.slice(0, 7)}-01`, endDate: fixedDate };
  const anchor = new Date(`${fixedDate}T00:00:00Z`);
  const day = anchor.getUTCDay() || 7;
  anchor.setUTCDate(anchor.getUTCDate() - day - 6);
  const startDate = anchor.toISOString().slice(0, 10);
  anchor.setUTCDate(anchor.getUTCDate() + 6);
  return { startDate, endDate: anchor.toISOString().slice(0, 10) };
}

export function ordersInRange(startDate: string, endDate: string): Order[] { return rangeOrders({ startDate, endDate }); }
