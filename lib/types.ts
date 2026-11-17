export type Channel = "online" | "offline";

export type Order = {
  id: string;
  orderDate: string;
  customerId: string;
  product: string;
  category: string;
  color: string;
  channel: Channel;
  quantity: number;
  total: number;
};

export type ReturnRecord = { id: string; orderId: string; returnDate: string; channel: Channel; quantity: number };
