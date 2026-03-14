
export interface OrderBlock {
  orderId: string;
  name: string;
  contact: string;
  codBill: string;
  address: string;
  tracking: string;
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
