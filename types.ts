
export enum OrderStatus {
  PENDING = "Pending",
  OUT_FOR_DELIVERY = "Out for Delivery",
  DELIVERED = "Delivered",
  CANCELLED = "Cancelled"
}

export interface OrderBlock {
  order_id: string;
  name: string;
  contact: string;
  codBill: string;
  address: string;
  status: OrderStatus;
  delivery_agent?: string;
  delivery_time?: string;
  cancel_reason?: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  orders: OrderBlock[];
  sourceType: 'image' | 'text';
}

export interface ProcessingState {
  isProcessing: boolean;
  error: string | null;
  result: OrderBlock[] | null;
}
