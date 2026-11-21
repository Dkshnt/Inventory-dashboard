export type Channel = "online" | "offline";

export type Order = {
  id: string;
  orderDate: string;
  customerId: string;
  isRepeatCustomer: boolean;
  product: string;
  category: string;
  color: string;
  channel: Channel;
  quantity: number;
  total: number;
};

export type ReturnRecord = { id: string; orderId: string; returnDate: string; channel: Channel; quantity: number };

/** One CSV row with every column, used by the general query engine (lib/query.ts). */
export type LineItem = {
  lineItemId: string; orderId: string; orderDate: string; customerId: string; isRepeatCustomer: boolean;
  productId: string; product: string; category: string; variant: string; size: string; color: string;
  quantity: number; unitPrice: number; discount: number; lineTotal: number;
  salesChannel: string; channel: Channel; fulfillmentStatus: string;
  returned: boolean; returnDate: string; returnReason: string; refund: number;
};
