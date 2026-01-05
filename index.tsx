
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchHistoricalData, fetchMarketStats } from './services/cryptoService';
import { getMarketAnalysis } from './services/geminiService';
import { PriceChart } from './components/PriceChart';
import { PriceData, MarketStats, AlertConfig, SentimentSignal, SimulationResult, AlertHistoryItem } from './types';
import { 
  Bell, 
  TrendingUp, 
  TrendingDown, 
  RefreshCcw, 
  BrainCircuit, 
  Activity, 
  ShieldAlert,
  ChevronRight,
  Calculator,
  Wallet,
  ArrowUpRight,
  Circle,
  Settings2,
  History,
  Clock
} from 'lucide-react';

const MXN_EXCHANGE_RATE = 20.0; // Fixed approximation for Peso to USD

const App = () => {
  const [history, setHistory] = useState<PriceData[]>([]);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [investmentAmount, setInvestmentAmount] = useState<number>(10000);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([]);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    threshold: 5,
    basePrice: 0,
    enabled: false,
    lastTriggered: null
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [hist, currentStats] = await Promise.all([
      fetchHistoricalData(365),
      fetchMarketStats()
    ]);
    setHistory(hist);
    setStats(currentStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      refreshPrice();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const refreshPrice = async () => {
    const currentStats = await fetchMarketStats();
    if (currentStats) {
      setStats(currentStats);
      checkAlerts(currentStats.currentPrice);
    }
  };

  const checkAlerts = (currentPrice: number) => {
    if (!alertConfig.enabled || alertConfig.basePrice === 0) return;
    const diff = ((currentPrice - alertConfig.basePrice) / alertConfig.basePrice) * 100;
    
    if (Math.abs(diff) >= alertConfig.threshold) {
      const now = Date.now();
      // Hour debounce for notification but we log all crosses in this logic
      if (!alertConfig.lastTriggered || (now - alertConfig.lastTriggered > 3600000)) {
        sendNotification(diff, currentPrice, alertConfig.threshold);
        
        const newItem: AlertHistoryItem = {
          id: crypto.randomUUID(),
          timestamp: now,
          price: currentPrice,
          percentageChange: diff,
          type: diff > 0 ? 'UP' : 'DOWN'
        };
        
        setAlertHistory(prev => [newItem, ...prev].slice(0, 10)); // Keep last 10
        setAlertConfig(prev => ({ ...prev, lastTriggered: now }));
      }
    }
  };

  const sendNotification = (diff: number, price: number, threshold: number) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      const type = diff > 0 ? "🚀 Subida" : "🔻 Caída";
      new Notification(`Alerta Raydium: ${type} ${Math.abs(diff).toFixed(2)}%`, {
        body: `RAY ha cruzado tu umbral del ${threshold}%. Precio actual: $${price.toFixed(3)}.`,
        icon: 'https://assets.coingecko.com/coins/images/15163/small/raydium.png'
      });
    }
  };

  const toggleAlerts = async () => {
    if (!alertConfig.enabled) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted' && stats) {
        setAlertConfig({
          ...alertConfig,
          enabled: true,
          basePrice: stats.currentPrice,
          lastTriggered: null
        });
      }
    } else {
      setAlertConfig({ ...alertConfig, enabled: false });
    }
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setAlertConfig(prev => ({ ...prev, threshold: value }));
    }
  };

  const generateAIInsight = async () => {
    if (!stats || history.length === 0) return;
    setAnalyzing(true);
    const analysis = await getMarketAnalysis(stats.currentPrice, stats.priceChange24h, history);
    setAiAnalysis(analysis);
    setAnalyzing(false);
  };

  // Technical Sentiment (RSI Calculation)
  const technicalSentiment = useMemo((): { signal: SentimentSignal; rsi: number } => {
    if (history.length < 15) return { signal: 'HOLD', rsi: 50 };
    
    const slice = history.slice(-15);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i < slice.length; i++) {
      const diff = slice[i].price - slice[i-1].price;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    if (rsi > 70) return { signal: 'SELL', rsi };
    if (rsi < 30) return { signal: 'BUY', rsi };
    return { signal: 'HOLD', rsi };
  }, [history]);

  // Simulation Logic
  const simulation = useMemo((): SimulationResult | null => {
    if (!stats) return null;
    const amountInUsd = investmentAmount / MXN_EXCHANGE_RATE;
    const tokens = amountInUsd / stats.currentPrice;
    
    const entryPrice = stats.currentPrice / (1 + (stats.priceChange24h / 100));
    const tokensBoughtYesterday = (investmentAmount / MXN_EXCHANGE_RATE) / entryPrice;
    const currentValueMxn = (tokensBoughtYesterday * stats.currentPrice) * MXN_EXCHANGE_RATE;
    const profitMxn = currentValueMxn - investmentAmount;
    
    return {
      initialInvestment: investmentAmount,
      tokens: tokensBoughtYesterday,
      currentValue: currentValueMxn,
      profit: profitMxn,
      profitPercentage: (profitMxn / investmentAmount) * 100
    };
  }, [stats, investmentAmount]);

  if (loading && history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <Activity className="animate-pulse text-blue-500" size={48} />
        <p className="text-xl font-medium text-slate-400">Cargando datos de Raydium...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-20">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30">
            <img 
              src="https://assets.coingecko.com/coins/images/15163/small/raydium.png" 
              alt="Raydium" 
              className="w-10 h-10"
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Raydium Pulse
            </h1>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Dashboard de Alerta & Simulación</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={refreshPrice}
            className="p-3 glass-card hover:bg-white/10 transition-all rounded-xl"
            title="Refrescar precio"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={toggleAlerts}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
              alertConfig.enabled 
                ? 'bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500/20' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
            }`}
          >
            <Bell size={18} fill={alertConfig.enabled ? "currentColor" : "none"} />
            {alertConfig.enabled ? `Alerta ${alertConfig.threshold}% ON` : `Activar Alerta ${alertConfig.threshold}%`}
          </button>
        </div>
      </header>

      {/* Main Grid: Sentiment & Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SEMAFORO (Traffic Light) */}
        <div className="lg:col-span-4 glass-card p-8 rounded-[2.5rem] flex flex-col items-center justify-center relative overflow-hidden border-white/5">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
          <h3 className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-8">Semáforo de Mercado</h3>
          
          <div className="bg-slate-900/80 p-6 rounded-3xl border border-white/10 flex flex-col gap-6 shadow-inner">
            {/* Red Light */}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${technicalSentiment.signal === 'SELL' ? 'bg-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.6)]' : 'bg-rose-950/30'}`}>
              <TrendingDown size={32} className={technicalSentiment.signal === 'SELL' ? 'text-white' : 'text-rose-900/50'} />
            </div>
            {/* Yellow Light */}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${technicalSentiment.signal === 'HOLD' ? 'bg-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.6)]' : 'bg-amber-950/30'}`}>
              <Circle size={32} className={technicalSentiment.signal === 'HOLD' ? 'text-white' : 'text-amber-900/50'} />
            </div>
            {/* Green Light */}
            <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${technicalSentiment.signal === 'BUY' ? 'bg-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.6)]' : 'bg-emerald-950/30'}`}>
              <TrendingUp size={32} className={technicalSentiment.signal === 'BUY' ? 'text-white' : 'text-emerald-900/50'} />
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <span className={`text-2xl font-black uppercase tracking-tighter ${
              technicalSentiment.signal === 'BUY' ? 'text-emerald-400' : 
              technicalSentiment.signal === 'SELL' ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {technicalSentiment.signal === 'BUY' ? 'Es momento de COMPRAR' : 
               technicalSentiment.signal === 'SELL' ? 'Es momento de VENDER' : 'Mantener / Observar'}
            </span>
            <p className="text-slate-500 text-xs mt-2 font-medium">Basado en RSI Técnico: {technicalSentiment.rsi.toFixed(2)}</p>
          </div>
        </div>

        {/* SIMULADOR DE INVERSION */}
        <div className="lg:col-span-8 glass-card p-8 rounded-[2.5rem] border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 rounded-2xl">
                <Calculator className="text-blue-400" size={24} />
              </div>
              <h3 className="text-xl font-bold">Simulador de Inversión (MXN)</h3>
            </div>
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-xl border border-white/10">
              <span className="text-slate-400 text-xs font-bold">$1 USD ≈ 20.00 MXN</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="text-slate-400 text-xs font-bold uppercase block mb-3">Monto a Invertir (Pesos)</label>
                <div className="relative group">
                  <input 
                    type="number" 
                    value={investmentAmount}
                    onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 px-6 text-2xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all group-hover:border-white/20"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 font-bold">MXN</div>
                </div>
              </div>
              
              <div className="bg-blue-600/10 p-5 rounded-2xl border border-blue-500/20">
                <p className="text-blue-400 text-xs font-bold uppercase mb-2">Si hubieras invertido hace 24h:</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="text-blue-300" size={18} />
                    <span className="text-lg font-bold">Adquiriste:</span>
                  </div>
                  <span className="text-xl font-mono text-white">{simulation?.tokens.toFixed(2)} RAY</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between bg-slate-900/40 p-8 rounded-[2rem] border border-white/5 relative overflow-hidden">
               <div className="absolute -right-4 -top-4 opacity-5">
                 <ArrowUpRight size={120} />
               </div>
               
               <div>
                 <p className="text-slate-400 text-xs font-bold uppercase mb-1">Valor Actual de tu Inversión</p>
                 <h4 className="text-4xl font-black text-white">${simulation?.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</h4>
               </div>

               <div className="mt-8 pt-8 border-t border-white/5">
                 <div className="flex items-center justify-between">
                   <p className="text-slate-400 text-sm font-medium">Ganancia Estimada (24h)</p>
                   <span className={`text-2xl font-black ${simulation && simulation.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                     {simulation && simulation.profit >= 0 ? '+' : ''}${simulation?.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                   </span>
                 </div>
                 <div className={`mt-2 text-right font-bold text-sm ${simulation && simulation.profit >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                    ({simulation?.profitPercentage.toFixed(2)}%)
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Stats (Row) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-6 rounded-3xl">
          <p className="text-slate-400 text-[10px] uppercase tracking-widest font-black mb-1">Precio RAY/USD</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${stats?.currentPrice.toFixed(3)}</span>
            <span className={`text-sm font-bold flex items-center ${stats && stats.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats && stats.priceChange24h >= 0 ? <TrendingUp size={14} className="mr-1"/> : <TrendingDown size={14} className="mr-1"/>}
              {Math.abs(stats?.priceChange24h || 0).toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="glass-card p-6 rounded-3xl">
          <p className="text-slate-400 text-[10px] uppercase tracking-widest font-black mb-1">Volumen 24h</p>
          <p className="text-2xl font-bold">${stats?.volume24h.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6 rounded-3xl">
          <p className="text-slate-400 text-[10px] uppercase tracking-widest font-black mb-1">Market Cap</p>
          <p className="text-2xl font-bold">${(Number(stats?.marketCap) / 1000000).toFixed(1)}M</p>
        </div>
        <div className="glass-card p-6 rounded-3xl">
          <p className="text-slate-400 text-[10px] uppercase tracking-widest font-black mb-1">Rango 24h</p>
          <div className="flex items-center gap-2 text-xs font-bold mt-2">
            <span className="text-rose-400">${stats?.low24h.toFixed(3)}</span>
            <div className="h-1.5 flex-1 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500" 
                style={{ width: `${((stats?.currentPrice! - stats?.low24h!) / (stats?.high24h! - stats?.low24h!)) * 100}%` }}
              ></div>
            </div>
            <span className="text-emerald-400">${stats?.high24h.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <section className="glass-card p-6 md:p-10 rounded-[3rem] border-white/5">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <Activity className="text-blue-500" size={28} />
            Evolución de Raydium
          </h2>
          <div className="flex gap-2">
            <span className="px-4 py-2 bg-blue-500 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/20 tracking-tighter uppercase">365 Días</span>
          </div>
        </div>
        <PriceChart data={history} />
      </section>

      {/* AI Analysis Section & Alert Guardia */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-10 rounded-[3rem] relative overflow-hidden border-white/5">
          <div className="absolute top-0 right-0 p-10 opacity-5">
            <BrainCircuit size={160} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black flex items-center gap-3">
                <BrainCircuit className="text-purple-400" size={28} />
                Perspectiva AI Gemini
              </h2>
              <button 
                onClick={generateAIInsight}
                disabled={analyzing}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl transition-all text-sm font-black disabled:opacity-50 shadow-lg shadow-purple-600/20"
              >
                {analyzing ? 'Pensando...' : aiAnalysis ? 'Actualizar Análisis' : 'Analizar Mercado'}
              </button>
            </div>
            
            <div className="prose prose-invert max-w-none">
              {aiAnalysis ? (
                <div className="space-y-4 text-slate-300 leading-relaxed text-lg whitespace-pre-wrap">
                  {aiAnalysis}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 italic">
                  <BrainCircuit size={48} className="mb-4 opacity-20" />
                  <p>Obtén una opinión experta impulsada por inteligencia artificial sobre el futuro de RAY.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert Status Info (Now with Threshold Config) */}
        <div className="glass-card p-10 rounded-[3rem] flex flex-col justify-between border-blue-500/10 bg-blue-500/[0.02]">
          <div>
            <div className="flex items-center gap-3 text-blue-400 mb-6">
              <ShieldAlert size={32} />
              <h3 className="font-black text-xl uppercase tracking-tighter">Guardia de Alertas</h3>
            </div>
            
            <div className="mb-8 space-y-4">
              <label className="text-slate-400 text-xs font-bold uppercase block">Umbral de Alerta Personalizado</label>
              <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-white/10">
                <Settings2 className="text-slate-500 ml-2" size={20} />
                <input 
                  type="range" 
                  min="0.1" 
                  max="20" 
                  step="0.1"
                  disabled={alertConfig.enabled}
                  value={alertConfig.threshold}
                  onChange={handleThresholdChange}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
                />
                <div className="bg-slate-800 px-3 py-1 rounded-xl font-mono text-blue-400 font-bold min-w-[60px] text-center">
                  {alertConfig.threshold}%
                </div>
              </div>
              <p className="text-slate-500 text-[10px] italic">
                {alertConfig.enabled 
                  ? "Desactiva la alerta para cambiar el umbral." 
                  : "Desliza para elegir el % de cambio que activará el aviso."}
              </p>
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center py-4 border-b border-white/5">
                <span className="text-slate-400 text-sm font-bold">Estado</span>
                <span className={`text-xs font-black px-3 py-1 rounded-lg ${alertConfig.enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                  {alertConfig.enabled ? 'VIGILANDO' : 'DETENIDO'}
                </span>
              </div>
              <div className="flex justify-between items-center py-4 border-b border-white/5">
                <span className="text-slate-400 text-sm font-bold">Precio Ref.</span>
                <span className="text-white font-mono font-bold">${alertConfig.basePrice > 0 ? alertConfig.basePrice.toFixed(3) : '---'}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b border-white/5">
                <span className="text-slate-400 text-sm font-bold">Variación Activa</span>
                <span className="text-white font-mono font-bold">±{alertConfig.threshold.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="mt-10">
             <div className="bg-slate-800/30 p-6 rounded-3xl text-xs text-slate-500 border border-white/5 italic">
                <p className="font-bold mb-2 flex items-center gap-2 not-italic text-slate-400">
                  <ChevronRight size={14} className="text-blue-500" /> RECOMENDACIÓN
                </p>
                Un umbral más bajo (1-2%) generará más avisos. Un umbral más alto (10%+) solo te avisará de movimientos masivos.
             </div>
          </div>
        </div>
      </section>

      {/* Alert History Section */}
      <section className="glass-card p-10 rounded-[3rem] border-white/5">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black flex items-center gap-3">
            <History className="text-slate-400" size={28} />
            Historial de Alertas Activadas
          </h2>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Últimas 10 alertas</span>
        </div>

        {alertHistory.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alertHistory.map((alert) => (
              <div key={alert.id} className="bg-slate-900/40 p-5 rounded-2xl border border-white/5 flex flex-col gap-3 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                <div className={`absolute top-0 right-0 w-1 h-full ${alert.type === 'UP' ? 'bg-emerald-500/50' : 'bg-rose-500/50'}`}></div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase">
                    <Clock size={12} />
                    {new Date(alert.timestamp).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className={`text-xs font-black px-2 py-0.5 rounded-md ${alert.type === 'UP' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {alert.type === 'UP' ? '+' : ''}{alert.percentageChange.toFixed(2)}%
                  </div>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-slate-400 text-xs font-medium">Precio en cruce:</span>
                  <span className="text-lg font-bold text-white font-mono">${alert.price.toFixed(3)}</span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  {alert.type === 'UP' ? (
                    <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold uppercase">
                      <TrendingUp size={14} /> Subida detectada
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-rose-400 text-[10px] font-bold uppercase">
                      <TrendingDown size={14} /> Caída detectada
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-slate-600 bg-slate-900/20 rounded-[2rem] border border-dashed border-white/10">
            <Bell size={40} className="mb-4 opacity-20" />
            <p className="font-medium italic">No se han registrado alertas aún. El sistema está vigilando...</p>
          </div>
        )}
      </section>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
