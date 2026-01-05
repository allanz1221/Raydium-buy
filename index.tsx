
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchHistoricalData, fetchMarketStats } from './services/cryptoService.ts';
import { getMarketAnalysis } from './services/geminiService.ts';
import { connectWallet, fetchRayBalance, executeSwap } from './services/solanaService.ts';
import { PriceChart } from './components/PriceChart.tsx';
import { PriceData, MarketStats, AlertConfig, TradingBotConfig, AlertHistoryItem } from './types.ts';
import { 
  Bell, TrendingUp, TrendingDown, RefreshCcw, BrainCircuit, Activity, ShieldAlert,
  Calculator, Wallet, ArrowUpRight, Circle, Settings2, History, Clock,
  ExternalLink, Link as LinkIcon, Cpu, Eye, EyeOff, Play, Square, AlertTriangle, Zap,
  Server, Download, Copy, Check, Terminal, ArrowRightLeft, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';

const MXN_EXCHANGE_RATE = 20.0;

const App = () => {
  const [history, setHistory] = useState<PriceData[]>([]);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [alertHistory, setAlertHistory] = useState<AlertHistoryItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'bot' | 'server'>('bot');
  const [copied, setCopied] = useState(false);
  
  // States
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [realRayBalance, setRealRayBalance] = useState<number>(0);
  const [showKey, setShowKey] = useState(false);
  const [botLogs, setBotLogs] = useState<string[]>(["SISTEMA LISTO: Esperando configuración..."]);

  // Trading Bot Config
  const [botConfig, setBotConfig] = useState<TradingBotConfig>({
    active: false,
    privateKey: '',
    takeProfitPct: 5,
    buyDipPct: 5,
    lastTradeType: null,
    entryPrice: 0,
    tradingPair: 'RAY_SOL',
    amountSol: 0.1
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
    const interval = setInterval(() => refreshPrice(), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const refreshPrice = async () => {
    const currentStats = await fetchMarketStats();
    if (currentStats) {
      setStats(currentStats);
      setLastUpdate(new Date());
      if (botConfig.active) monitorBot(currentStats.currentPrice);
    }
  };

  const addLog = (msg: string) => {
    setBotLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  // Cálculo de Sentimiento Técnico (RSI / Semáforo)
  const technicalSentiment = useMemo(() => {
    if (history.length < 15) return { signal: 'HOLD', rsi: 50 };
    const slice = history.slice(-15);
    let gains = 0, losses = 0;
    for (let i = 1; i < slice.length; i++) {
      const diff = slice[i].price - slice[i-1].price;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const rs = (losses === 0) ? 100 : (gains / 14) / (losses / 14);
    const rsi = 100 - (100 / (1 + rs));
    
    if (rsi > 65) return { signal: 'SELL', rsi, label: 'VENTA FUERTE', color: 'text-rose-500', bg: 'bg-rose-500/10' };
    if (rsi < 35) return { signal: 'BUY', rsi, label: 'COMPRA FUERTE', color: 'text-emerald-500', bg: 'bg-emerald-500/10' };
    return { signal: 'HOLD', rsi, label: 'NEUTRAL / ESPERAR', color: 'text-amber-500', bg: 'bg-amber-500/10' };
  }, [history]);

  const monitorBot = async (currentPrice: number) => {
    if (!botConfig.active || !botConfig.privateKey || botConfig.entryPrice === 0) return;

    const diff = ((currentPrice - botConfig.entryPrice) / botConfig.entryPrice) * 100;
    
    // Venta Automática
    if (diff >= botConfig.takeProfitPct && botConfig.lastTradeType !== 'SELL') {
      addLog(`🚀 OBJETIVO ALCANZADO: +${diff.toFixed(2)}%. Vendiendo...`);
      try {
        const tx = await executeSwap(botConfig.privateKey, 'SELL', realRayBalance);
        addLog(`✅ VENTA EXITOSA: TXID ${tx.slice(0,8)}...`);
        setBotConfig(prev => ({ ...prev, lastTradeType: 'SELL' }));
        setAlertHistory(prev => [{
          id: tx, 
          timestamp: Date.now(), 
          price: currentPrice, 
          percentageChange: diff, 
          type: 'TRADE_SELL'
        }, ...prev]);
        if (walletAddress) fetchRayBalance(walletAddress).then(setRealRayBalance);
      } catch (e) {
        addLog(`❌ ERROR VENTA: ${e.message}`);
      }
    }
    
    // Compra Automática
    if (diff <= -botConfig.buyDipPct && botConfig.lastTradeType !== 'BUY') {
      addLog(`🔻 CAÍDA DETECTADA: ${diff.toFixed(2)}%. Comprando...`);
      try {
        const tx = await executeSwap(botConfig.privateKey, 'BUY', botConfig.amountSol);
        addLog(`✅ COMPRA EXITOSA: TXID ${tx.slice(0,8)}...`);
        setBotConfig(prev => ({ ...prev, lastTradeType: 'BUY', entryPrice: currentPrice }));
        setAlertHistory(prev => [{
          id: tx, 
          timestamp: Date.now(), 
          price: currentPrice, 
          percentageChange: diff, 
          type: 'TRADE_BUY'
        }, ...prev]);
        if (walletAddress) fetchRayBalance(walletAddress).then(setRealRayBalance);
      } catch (e) {
        addLog(`❌ ERROR COMPRA: ${e.message}`);
      }
    }
  };

  const toggleBot = () => {
    if (!botConfig.privateKey) {
      alert("Introduce tu llave privada primero.");
      return;
    }
    if (!botConfig.active && stats) {
      setBotConfig(prev => ({ ...prev, active: true, entryPrice: stats.currentPrice }));
      addLog(`🤖 BOT INICIADO. Precio base: $${stats.currentPrice}`);
    } else {
      setBotConfig(prev => ({ ...prev, active: false }));
      addLog(`🛑 BOT DETENIDO.`);
    }
  };

  const handleConnect = async () => {
    try {
      const address = await connectWallet();
      setWalletAddress(address);
      const balance = await fetchRayBalance(address);
      setRealRayBalance(balance);
    } catch (err) { alert(err.message); }
  };

  if (loading && history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#020617] text-blue-500">
        <Cpu className="animate-spin mb-4" size={48} />
        <h2 className="text-sm font-black uppercase tracking-widest">Iniciando Terminal de Trading...</h2>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-center border-b border-white/5 pb-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
            <Zap className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter">RAYDIUM <span className="text-blue-500 italic">PULSE</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Live Trading Dashboard</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          {/* SEÑAL DE TRADING EN HEADER */}
          <div className={`hidden lg:flex items-center gap-3 px-6 py-2 rounded-2xl border border-white/5 ${technicalSentiment.bg}`}>
            <Circle size={10} className={technicalSentiment.color} fill="currentColor" />
            <span className={`text-[10px] font-black uppercase tracking-widest ${technicalSentiment.color}`}>
              Sugerencia: {technicalSentiment.label}
            </span>
          </div>
          
          <button onClick={handleConnect} className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${walletAddress ? 'bg-slate-800 border border-emerald-500/30 text-emerald-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            {walletAddress ? `Wallet: ${walletAddress.slice(0,4)}...` : 'Phantom Connect'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* BOT CONTROL CENTER */}
        <div className={`xl:col-span-4 glass-card p-0 rounded-[2rem] transition-all duration-500 overflow-hidden ${botConfig.active ? 'bot-active' : 'opacity-90'}`}>
          <div className="flex border-b border-white/5">
            <button onClick={() => setActiveTab('bot')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'bot' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              <Cpu size={14} /> Trading Bot
            </button>
            <button onClick={() => setActiveTab('server')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'server' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              <Server size={14} /> Servidor 24/7
            </button>
          </div>

          <div className="p-8 space-y-6">
            {activeTab === 'bot' ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Activity size={18} className="text-blue-400" />
                    <h2 className="font-black text-sm tracking-tight uppercase">Browser Monitor</h2>
                  </div>
                  <button onClick={toggleBot} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${botConfig.active ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'}`}>
                    {botConfig.active ? <><Square size={10} fill="currentColor" /> Stop</> : <><Play size={10} fill="currentColor" /> Start</>}
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Private Key</label>
                    <input 
                      type={showKey ? 'text' : 'password'}
                      value={botConfig.privateKey}
                      onChange={e => setBotConfig(prev => ({ ...prev, privateKey: e.target.value }))}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs mono text-blue-400 focus:outline-none"
                    />
                    <button onClick={() => setShowKey(!showKey)} className="absolute right-3 bottom-3 text-slate-500">
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                      <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Take Profit (%)</label>
                      <input type="number" value={botConfig.takeProfitPct} onChange={e => setBotConfig(prev => ({ ...prev, takeProfitPct: Number(e.target.value) }))} className="w-full bg-transparent text-xl font-black text-emerald-400 focus:outline-none" />
                    </div>
                    <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                      <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Buy Dip (%)</label>
                      <input type="number" value={botConfig.buyDipPct} onChange={e => setBotConfig(prev => ({ ...prev, buyDipPct: Number(e.target.value) }))} className="w-full bg-transparent text-xl font-black text-rose-400 focus:outline-none" />
                    </div>
                  </div>
                </div>

                <div className="h-32 bg-black/60 rounded-xl border border-white/5 p-4 overflow-y-auto mono text-[9px] leading-relaxed space-y-1">
                  {botLogs.map((log, i) => (
                    <div key={i} className={log.includes('✅') ? 'text-emerald-400' : log.includes('❌') ? 'text-rose-400' : 'text-slate-400'}>
                      {log}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-[10px] text-slate-400 italic">Copia este código en Replit para monitoreo constante:</p>
                <div className="code-block h-64 overflow-y-auto">
                   {`// Raydium Server Bot
const { Connection, Keypair } = require("@solana/web3.js");
const bs58 = require("bs58");
// Config... (Ver logica de swap)`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TABLA DE ÚLTIMOS MOVIMIENTOS Y GRÁFICO */}
        <div className="xl:col-span-8 space-y-8">
           <div className="glass-card p-10 rounded-[2.5rem]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <Activity className="text-blue-500" />
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Market Activity</h2>
                </div>
                <div className="flex items-baseline gap-2">
                   <span className="text-4xl font-black tracking-tighter">${stats?.currentPrice.toFixed(4)}</span>
                </div>
              </div>
              <div className="h-[300px]">
                <PriceChart data={history} />
              </div>
           </div>

           {/* TABLA DE TRANSACCIONES REAL-TIME */}
           <div className="glass-card p-8 rounded-[2.5rem] border-blue-500/20">
              <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-3">
                    <History className="text-blue-400" />
                    <h3 className="font-black text-xl uppercase tracking-tighter">Últimos Movimientos del Bot</h3>
                 </div>
                 <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black text-emerald-500 uppercase">Actualización en Vivo</span>
                 </div>
              </div>

              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          <th className="pb-4">Fecha / Hora</th>
                          <th className="pb-4">Operación</th>
                          <th className="pb-4">Precio RAY</th>
                          <th className="pb-4">Variación</th>
                          <th className="pb-4">TX Hash</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {alertHistory.filter(a => a.type.startsWith('TRADE')).length > 0 ? (
                         alertHistory.filter(a => a.type.startsWith('TRADE')).map((item) => (
                           <tr key={item.id} className="group hover:bg-white/5 transition-colors">
                              <td className="py-5">
                                 <div className="flex items-center gap-2">
                                    <Clock size={12} className="text-slate-600" />
                                    <span className="text-xs font-bold text-slate-300">{new Date(item.timestamp).toLocaleTimeString()}</span>
                                 </div>
                              </td>
                              <td className="py-5">
                                 <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg font-black text-[10px] ${item.type === 'TRADE_BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {item.type === 'TRADE_BUY' ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                                    {item.type === 'TRADE_BUY' ? 'COMPRA' : 'VENTA'}
                                 </div>
                              </td>
                              <td className="py-5 font-mono text-xs font-black text-white">
                                 ${item.price.toFixed(4)}
                              </td>
                              <td className={`py-5 font-black text-xs ${item.percentageChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                 {item.percentageChange >= 0 ? '+' : ''}{item.percentageChange.toFixed(2)}%
                              </td>
                              <td className="py-5">
                                 <a 
                                    href={`https://solscan.io/tx/${item.id}`} 
                                    target="_blank" 
                                    className="flex items-center gap-2 text-[10px] font-mono text-blue-400 hover:text-white transition-colors"
                                 >
                                    {item.id.slice(0, 8)}... <ExternalLink size={12} />
                                 </a>
                              </td>
                           </tr>
                         ))
                       ) : (
                         <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest">
                               Esperando primera operación del bot...
                            </td>
                         </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>

      {/* AI & SENTIMIENTO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-8 glass-card p-12 rounded-[3rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5"><BrainCircuit size={150} /></div>
            <div className="relative z-10 space-y-8">
               <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-black tracking-tighter uppercase">AI Market Strategy</h2>
                  <button 
                    onClick={async () => {
                      setAnalyzing(true);
                      const analysis = await getMarketAnalysis(stats?.currentPrice || 0, stats?.priceChange24h || 0, history);
                      setAiAnalysis(analysis);
                      setAnalyzing(false);
                    }}
                    className="px-6 py-3 bg-purple-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all shadow-xl shadow-purple-600/20"
                  >
                    {analyzing ? 'Procesando...' : 'Consultar Gemini'}
                  </button>
               </div>
               <div className="bg-black/40 p-8 rounded-3xl border border-white/5 min-h-[200px] text-slate-300 leading-relaxed">
                  {aiAnalysis || "Solicita un análisis para ver la estrategia sugerida por la IA."}
               </div>
            </div>
         </div>

         {/* SEMÁFORO VISUAL */}
         <div className="lg:col-span-4 glass-card p-10 rounded-[3rem] border-white/5 flex flex-col justify-between items-center text-center">
            <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-6">Estado Técnico (RSI)</h3>
            <div className="space-y-6">
               <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl ${technicalSentiment.signal === 'SELL' ? 'bg-rose-500 shadow-rose-500/40 scale-110' : 'bg-rose-950/20 opacity-20'}`}>
                  <TrendingDown size={40} className="text-white" />
               </div>
               <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl ${technicalSentiment.signal === 'HOLD' ? 'bg-amber-500 shadow-amber-500/40 scale-110' : 'bg-amber-950/20 opacity-20'}`}>
                  <Circle size={40} className="text-white" fill="currentColor" />
               </div>
               <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-700 shadow-2xl ${technicalSentiment.signal === 'BUY' ? 'bg-emerald-500 shadow-emerald-500/40 scale-110' : 'bg-emerald-950/20 opacity-20'}`}>
                  <TrendingUp size={40} className="text-white" />
               </div>
            </div>
            <div className="mt-8">
               <span className={`text-2xl font-black uppercase tracking-tighter block mb-1 ${technicalSentiment.color}`}>
                  {technicalSentiment.label}
               </span>
               <span className="text-[10px] text-slate-500 font-mono">RSI Actual: {technicalSentiment.rsi.toFixed(2)}</span>
            </div>
         </div>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
