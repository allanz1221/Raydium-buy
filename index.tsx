
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
  Clock,
  ExternalLink
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
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
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
    setLastUpdate(new Date());
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
      setLastUpdate(new Date());
      checkAlerts(currentStats.currentPrice);
    }
  };

  const checkAlerts = (currentPrice: number) => {
    if (!alertConfig.enabled || alertConfig.basePrice === 0) return;
    const diff = ((currentPrice - alertConfig.basePrice) / alertConfig.basePrice) * 100;
    
    if (Math.abs(diff) >= alertConfig.threshold) {
      const now = Date.now();
      if (!alertConfig.lastTriggered || (now - alertConfig.lastTriggered > 3600000)) {
        sendNotification(diff, currentPrice, alertConfig.threshold);
        
        const newItem: AlertHistoryItem = {
          id: crypto.randomUUID(),
          timestamp: now,
          price: currentPrice,
          percentageChange: diff,
          type: diff > 0 ? 'UP' : 'DOWN'
        };
        
        setAlertHistory(prev => [newItem, ...prev].slice(0, 10));
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

  const technicalSentiment = useMemo((): { signal: SentimentSignal; rsi: number } => {
    if (history.length < 15) return { signal: 'HOLD', rsi: 50 };
    const slice = history.slice(-15);
    let gains = 0, losses = 0;
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

  const simulation = useMemo((): SimulationResult | null => {
    if (!stats) return null;
    const amountInUsd = investmentAmount / MXN_EXCHANGE_RATE;
    const entryPrice = stats.currentPrice / (1 + (stats.priceChange24h / 100));
    const tokensBoughtYesterday = amountInUsd / entryPrice;
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
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 bg-[#0f172a]">
        <div className="relative">
            <Activity className="text-blue-500 animate-pulse" size={64} />
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
        </div>
        <p className="text-xl font-black text-slate-400 tracking-tighter uppercase">Sincronizando Pulse...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-24">
      {/* Dynamic Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div className="flex items-center gap-5">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-3 rounded-2xl shadow-lg shadow-blue-500/20">
            <img 
              src="https://assets.coingecko.com/coins/images/15163/small/raydium.png" 
              alt="Raydium" 
              className="w-12 h-12 drop-shadow-md"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-500 tracking-tighter">
                Raydium Pulse
              </h1>
              <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-black text-emerald-400 uppercase">Live</span>
              </div>
            </div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mt-1">Terminal de Inteligencia Cripto</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-[10px] font-black text-slate-500 uppercase">Última actualización</span>
            <span className="text-xs font-mono text-slate-400">{lastUpdate.toLocaleTimeString()}</span>
          </div>
          <button 
            onClick={refreshPrice}
            className="p-4 glass-card hover:bg-white/10 transition-all rounded-2xl group active:scale-95"
          >
            <RefreshCcw size={20} className={`${loading ? 'animate-spin text-blue-400' : 'text-slate-400 group-hover:text-white'}`} />
          </button>
          <button 
            onClick={toggleAlerts}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 ${
              alertConfig.enabled 
                ? 'bg-rose-500/10 border border-rose-500/50 text-rose-500 hover:bg-rose-500/20' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
            }`}
          >
            <Bell size={20} fill={alertConfig.enabled ? "currentColor" : "none"} />
            <span className="uppercase tracking-tighter text-sm">
              {alertConfig.enabled ? `Vigilando ±${alertConfig.threshold}%` : 'Activar Alerta'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Grid: Sentiment & Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* SEMAFORO (Traffic Light) */}
        <div className="lg:col-span-4 glass-card p-10 rounded-[3rem] flex flex-col items-center justify-center relative border-white/5 group">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-blue-500/5 blur-[80px] rounded-full"></div>
          <h3 className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] mb-10">Sentimiento Técnico</h3>
          
          <div className="bg-slate-950/80 p-8 rounded-[2.5rem] border border-white/5 flex flex-col gap-8 shadow-2xl relative z-10">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-700 ${technicalSentiment.signal === 'SELL' ? 'bg-rose-500 shadow-[0_0_60px_rgba(244,63,94,0.4)] scale-110' : 'bg-rose-950/20 opacity-30 grayscale'}`}>
              <TrendingDown size={40} className="text-white" />
            </div>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-700 ${technicalSentiment.signal === 'HOLD' ? 'bg-amber-500 shadow-[0_0_60px_rgba(245,158,11,0.4)] scale-110' : 'bg-amber-950/20 opacity-30 grayscale'}`}>
              <Circle size={40} className="text-white" fill="currentColor" />
            </div>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-700 ${technicalSentiment.signal === 'BUY' ? 'bg-emerald-500 shadow-[0_0_60px_rgba(16,185,129,0.4)] scale-110' : 'bg-emerald-950/20 opacity-30 grayscale'}`}>
              <TrendingUp size={40} className="text-white" />
            </div>
          </div>
          
          <div className="mt-12 text-center relative z-10">
            <span className={`text-3xl font-black uppercase tracking-tighter block mb-2 ${
              technicalSentiment.signal === 'BUY' ? 'text-emerald-400' : 
              technicalSentiment.signal === 'SELL' ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {technicalSentiment.signal === 'BUY' ? 'Fuerte Compra' : 
               technicalSentiment.signal === 'SELL' ? 'Fuerte Venta' : 'Neutral / Esperar'}
            </span>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">RSI Index</span>
                <span className="text-white font-mono font-bold text-xs">{technicalSentiment.rsi.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* SIMULADOR DE INVERSION */}
        <div className="lg:col-span-8 glass-card p-10 rounded-[3rem] border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent flex flex-col justify-between">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <Calculator className="text-blue-400" size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black tracking-tighter">Simulador de Inversión</h3>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Previsión en MXN</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
              <span className="text-slate-500 text-[10px] font-black uppercase">Tasa de cambio</span>
              <span className="text-blue-400 font-mono font-bold text-sm">$20.00</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-8">
              <div className="relative">
                <label className="text-slate-500 text-[10px] font-black uppercase tracking-widest block mb-4">Capital a Simular (Pesos)</label>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 font-black text-xl">$</div>
                  <input 
                    type="number" 
                    value={investmentAmount}
                    onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/5 rounded-3xl py-6 pl-12 pr-20 text-4xl font-black focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all shadow-2xl group-hover:border-white/10"
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 font-black text-sm uppercase tracking-widest">MXN</div>
                </div>
              </div>
              
              <div className="bg-blue-600/5 p-6 rounded-3xl border border-blue-500/10 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-2">
                    <Wallet className="text-blue-400" size={18} />
                    <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">Posición Estimada</p>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-white">{simulation?.tokens.toFixed(2)}</span>
                  <span className="text-xl font-black text-slate-500 mb-1">RAY</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between bg-gradient-to-br from-slate-900 to-black p-10 rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl">
               <div className="absolute -right-6 -top-6 opacity-[0.03]">
                 <ArrowUpRight size={180} />
               </div>
               
               <div>
                 <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Valor de Portafolio Actual</p>
                 <h4 className="text-5xl font-black text-white tracking-tighter">
                   ${simulation?.currentValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                   <span className="text-2xl text-slate-500 ml-2 font-black">MXN</span>
                 </h4>
               </div>

               <div className="mt-12 pt-8 border-t border-white/5">
                 <div className="flex items-center justify-between">
                   <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Retorno (24h)</p>
                   <span className={`text-3xl font-black ${simulation && simulation.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                     {simulation && simulation.profit >= 0 ? '+' : ''}${simulation?.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                   </span>
                 </div>
                 <div className={`mt-3 flex items-center justify-end gap-2 ${simulation && simulation.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${simulation && simulation.profit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    <span className="text-lg font-black">{simulation?.profitPercentage.toFixed(2)}%</span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Precio RAY/USD', value: `$${stats?.currentPrice.toFixed(3)}`, change: stats?.priceChange24h, icon: TrendingUp },
          { label: 'Volumen 24h', value: `$${stats?.volume24h.toLocaleString()}`, icon: Activity },
          { label: 'Market Cap', value: `$${(Number(stats?.marketCap) / 1000000).toFixed(1)}M`, icon: ExternalLink },
          { label: 'Rango Diario', type: 'range' }
        ].map((item, idx) => (
          <div key={idx} className="glass-card p-8 rounded-[2.5rem] hover:translate-y-[-4px] transition-all">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3">{item.label}</p>
            {item.type === 'range' ? (
              <div className="space-y-3">
                <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                    style={{ width: `${((stats?.currentPrice! - stats?.low24h!) / (stats?.high24h! - stats?.low24h!)) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] font-black font-mono">
                  <span className="text-rose-500">${stats?.low24h.toFixed(2)}</span>
                  <span className="text-emerald-500">${stats?.high24h.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-3xl font-black tracking-tighter">{item.value}</span>
                {item.change !== undefined && (
                  <span className={`text-xs font-black px-2 py-1 rounded-lg ${item.change >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chart Section */}
      <section className="glass-card p-10 rounded-[3.5rem] border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-blue-500/5 blur-[120px] rounded-full"></div>
        <div className="flex items-center justify-between mb-12 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
                <Activity className="text-blue-500" size={32} />
            </div>
            <h2 className="text-3xl font-black tracking-tighter uppercase">Evolución Histórica</h2>
          </div>
          <div className="px-6 py-2 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">
            Últimos 365 Días
          </div>
        </div>
        <div className="relative z-10 h-[450px]">
          <PriceChart data={history} />
        </div>
      </section>

      {/* AI & Alerts Config */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Gemini Panel */}
        <div className="lg:col-span-8 glass-card p-12 rounded-[3.5rem] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:rotate-12 transition-all duration-700">
            <BrainCircuit size={200} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <BrainCircuit className="text-purple-500" size={36} />
                <h2 className="text-3xl font-black tracking-tighter uppercase">Análisis Gemini 3</h2>
              </div>
              <button 
                onClick={generateAIInsight}
                disabled={analyzing}
                className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-purple-600/20 disabled:opacity-50 active:scale-95"
              >
                {analyzing ? 'Pensando...' : 'Consultar IA'}
              </button>
            </div>
            
            <div className="prose prose-invert max-w-none">
              {aiAnalysis ? (
                <div className="bg-slate-950/40 p-8 rounded-[2rem] border border-white/5 text-slate-300 leading-relaxed text-lg whitespace-pre-wrap font-medium">
                  {aiAnalysis}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-950/20 rounded-[2.5rem] border border-dashed border-white/5">
                  <BrainCircuit size={64} className="text-slate-800 mb-6" />
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">IA lista para procesar datos de mercado</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert Config Panel */}
        <div className="lg:col-span-4 glass-card p-10 rounded-[3.5rem] flex flex-col justify-between border-blue-500/20 bg-blue-500/[0.03]">
          <div>
            <div className="flex items-center gap-4 text-blue-400 mb-8">
              <ShieldAlert size={40} />
              <h3 className="font-black text-2xl uppercase tracking-tighter leading-none">Guardia de<br/>Alertas</h3>
            </div>
            
            <div className="mb-10 space-y-6">
              <div className="flex justify-between items-end mb-2">
                <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Umbral de Notificación</label>
                <span className="text-2xl font-black text-blue-400 font-mono">{alertConfig.threshold.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-3xl border border-white/5 shadow-inner">
                <input 
                  type="range" min="0.5" max="25" step="0.5"
                  disabled={alertConfig.enabled}
                  value={alertConfig.threshold}
                  onChange={handleThresholdChange}
                  className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-30"
                />
              </div>
              <div className="flex items-center gap-2 p-4 bg-slate-900/50 rounded-2xl border border-white/5 italic text-xs text-slate-500">
                <Settings2 size={14} className="flex-shrink-0" />
                <span>Configura el porcentaje de cambio para recibir alertas nativas.</span>
              </div>
            </div>
            
            <div className="space-y-5">
              {[
                { label: 'Servicio', value: alertConfig.enabled ? 'ACTIVO' : 'PAUSADO', highlight: alertConfig.enabled },
                { label: 'Referencia', value: `$${alertConfig.basePrice > 0 ? alertConfig.basePrice.toFixed(3) : '---'}` },
                { label: 'Variación', value: `±${alertConfig.threshold}%` }
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center py-4 border-b border-white/5 last:border-0">
                  <span className="text-slate-500 text-xs font-black uppercase tracking-widest">{row.label}</span>
                  <span className={`font-mono font-black ${row.highlight ? 'text-emerald-400' : 'text-white'}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 bg-slate-950/60 p-6 rounded-[2rem] border border-white/5">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Clock size={12} className="text-blue-500" /> Vercel Pulse Mode
            </p>
            <p className="text-slate-500 text-[10px] leading-relaxed italic">
                Optimizado para monitoreo continuo. Mantén esta pestaña visible para notificaciones inmediatas.
            </p>
          </div>
        </div>
      </div>

      {/* History Table */}
      <section className="glass-card p-12 rounded-[3.5rem] border-white/5">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <History className="text-slate-500" size={32} />
            <h2 className="text-3xl font-black tracking-tighter uppercase">Logs de Alertas</h2>
          </div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">Sesión Actual</span>
        </div>

        {alertHistory.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {alertHistory.map((alert) => (
              <div key={alert.id} className="bg-slate-950/60 p-6 rounded-[2rem] border border-white/5 hover:border-blue-500/30 transition-all flex flex-col gap-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black">
                    <Clock size={12} />
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <span className={`text-xs font-black px-3 py-1 rounded-full ${alert.type === 'UP' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {alert.type === 'UP' ? '+' : ''}{alert.percentageChange.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Ejecutado a:</span>
                  <span className="text-2xl font-black text-white font-mono tracking-tighter">${alert.price.toFixed(3)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-950/20 rounded-[2.5rem] border border-dashed border-white/5">
            <Bell size={48} className="text-slate-800 mb-4 opacity-20" />
            <p className="text-slate-600 font-bold uppercase tracking-widest text-xs">No hay alertas registradas aún</p>
          </div>
        )}
      </section>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
