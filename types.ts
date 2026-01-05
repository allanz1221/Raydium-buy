
export interface PriceData {
  timestamp: number;
  price: number;
}

export interface AlertConfig {
  threshold: number; // percentage, e.g., 5
  basePrice: number;
  enabled: boolean;
  lastTriggered: number | null;
}

export interface MarketStats {
  currentPrice: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

export type SentimentSignal = 'BUY' | 'HOLD' | 'SELL';

export interface SimulationResult {
  initialInvestment: number;
  tokens: number;
  currentValue: number;
  profit: number;
  profitPercentage: number;
}

export interface AlertHistoryItem {
  id: string;
  timestamp: number;
  price: number;
  percentageChange: number;
  type: 'UP' | 'DOWN';
}
