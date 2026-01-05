
import { PriceData, MarketStats } from '../types.ts';

const RAYDIUM_ID = 'raydium';

export const fetchHistoricalData = async (days: number = 365): Promise<PriceData[]> => {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${RAYDIUM_ID}/market_chart?vs_currency=usd&days=${days}&interval=daily`
    );
    const data = await response.json();
    return data.prices.map((item: [number, number]) => ({
      timestamp: item[0],
      price: item[1]
    }));
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return [];
  }
};

export const fetchMarketStats = async (): Promise<MarketStats | null> => {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${RAYDIUM_ID}&order=market_cap_desc&per_page=1&page=1&sparkline=false`
    );
    const data = await response.json();
    const stats = data[0];
    return {
      currentPrice: stats.current_price,
      priceChange24h: stats.price_change_percentage_24h,
      marketCap: stats.market_cap,
      volume24h: stats.total_volume,
      high24h: stats.high_24h,
      low24h: stats.low_24h
    };
  } catch (error) {
    console.error('Error fetching market stats:', error);
    return null;
  }
};
