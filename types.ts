
export interface OrderBlock {
  name: string;
  contact: string;
  codBill: string;
  address: string;
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
