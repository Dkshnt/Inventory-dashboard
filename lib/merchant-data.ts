import type { Order, ReturnRecord } from "./types";

// Replace these arrays with a database query in production. Dates are ISO calendar dates.
export const orders: Order[] = [
  { id: "O-100", orderDate: "2025-05-28", customerId: "C-01", product: "Classic Tee", category: "Apparel", color: "Black", channel: "online", quantity: 1, total: 30 },
  { id: "O-101", orderDate: "2025-06-03", customerId: "C-02", product: "Canvas Tote", category: "Accessories", color: "Natural", channel: "offline", quantity: 2, total: 40 },
  { id: "O-102", orderDate: "2025-06-09", customerId: "C-01", product: "Classic Tee", category: "Apparel", color: "Black", channel: "online", quantity: 3, total: 90 },
  { id: "O-103", orderDate: "2025-06-16", customerId: "C-03", product: "Classic Tee", category: "Apparel", color: "White", channel: "offline", quantity: 2, total: 60 },
  { id: "O-104", orderDate: "2025-06-24", customerId: "C-04", product: "Everyday Mug", category: "Home", color: "Black", channel: "online", quantity: 1, total: 24 },
  { id: "O-105", orderDate: "2025-07-02", customerId: "C-05", product: "Cloud Hoodie", category: "Apparel", color: "Blue", channel: "online", quantity: 1, total: 72 },
  { id: "O-106", orderDate: "2025-07-10", customerId: "C-03", product: "Classic Tee", category: "Apparel", color: "Black", channel: "offline", quantity: 1, total: 30 },
  { id: "O-107", orderDate: "2025-07-18", customerId: "C-06", product: "Trail Cap", category: "Accessories", color: "Green", channel: "online", quantity: 2, total: 48 },
  { id: "O-108", orderDate: "2025-07-22", customerId: "C-07", product: "Classic Tee", category: "Apparel", color: "Black", channel: "online", quantity: 4, total: 120 },
  { id: "O-109", orderDate: "2025-09-10", customerId: "C-08", product: "Cloud Hoodie", category: "Apparel", color: "Black", channel: "online", quantity: 1, total: 72 },
  { id: "O-110", orderDate: "2025-09-10", customerId: "C-01", product: "Canvas Tote", category: "Accessories", color: "Black", channel: "offline", quantity: 2, total: 40 },
  { id: "O-111", orderDate: "2025-09-11", customerId: "C-09", product: "Everyday Mug", category: "Home", color: "Black", channel: "online", quantity: 1, total: 24 }
];

export const returns: ReturnRecord[] = [
  { id: "R-01", orderId: "O-102", returnDate: "2025-06-18", channel: "online", quantity: 1 },
  { id: "R-02", orderId: "O-103", returnDate: "2025-06-20", channel: "offline", quantity: 1 },
  { id: "R-03", orderId: "O-107", returnDate: "2025-07-26", channel: "online", quantity: 1 },
  { id: "R-04", orderId: "O-106", returnDate: "2025-08-01", channel: "offline", quantity: 1 }
];
