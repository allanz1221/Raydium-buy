
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
  ExternalLink, Link as LinkIcon, Cpu, Eye, EyeOff, Play, Square, AlertTriangle, Zap
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

  const monitorBot = async (currentPrice: number) => {
    if (!botConfig.active || !botConfig.privateKey || botConfig.entryPrice === 0) return;

    const diff = ((currentPrice - botConfig.entryPrice) / botConfig.entryPrice) * 100;
    
    // Lógica Take Profit (Venta)
    if (diff >= botConfig.takeProfitPct && botConfig.lastTradeType !== 'SELL') {
      addLog(`🚀 UMBRAL DE VENTA ALCANZADO: +${diff.toFixed(2)}%. Ejecutando swap...`);
      try {
        const tx = await executeSwap(botConfig.privateKey, 'SELL', realRayBalance);
        addLog(`✅ VENTA EXITOSA: TXID ${tx.slice(0,8)}...`);
        setBotConfig(prev => ({ ...prev, lastTradeType: 'SELL' }));
        setAlertHistory(prev => [{
          id: crypto.randomUUID(), timestamp: Date.now(), price: currentPrice, 
          percentageChange: diff, type: 'TRADE_SELL'
        }, ...prev]);
      } catch (e) {
        addLog(`❌ ERROR EN VENTA: ${e.message}`);
      }
    }
    
    // Lógica Buy Dip (Compra)
    if (diff <= -botConfig.buyDipPct && botConfig.lastTradeType !== 'BUY') {
      addLog(`🔻 UMBRAL DE COMPRA ALCANZADO: ${diff.toFixed(2)}%. Recomprando...`);
      try {
        const tx = await executeSwap(botConfig.privateKey, 'BUY', botConfig.amountSol);
        addLog(`✅ COMPRA EXITOSA: TXID ${tx.slice(0,8)}...`);
        setBotConfig(prev => ({ ...prev, lastTradeType: 'BUY', entryPrice: currentPrice }));
        setAlertHistory(prev => [{
          id: crypto.randomUUID(), timestamp: Date.now(), price: currentPrice, 
          percentageChange: diff, type: 'TRADE_BUY'
        }, ...prev]);
      } catch (e) {
        addLog(`❌ ERROR EN COMPRA: ${e.message}`);
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
      addLog(`🛑 BOT DETENIDO POR EL USUARIO.`);
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
      {/* Header Pro */}
      <header className="flex flex-col md:flex-row justify-between items-center border-b border-white/5 pb-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
            <Zap className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter">RAYDIUM <span className="text-blue-500 italic">PULSE</span></h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Advanced Automated Terminal</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button onClick={handleConnect} className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${walletAddress ? 'bg-slate-800 border border-emerald-500/30 text-emerald-400' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            {walletAddress ? `Connected: ${walletAddress.slice(0,4)}...` : 'Phantom Connect'}
          </button>
          <button onClick={refreshPrice} className="p-3 glass-card rounded-xl text-slate-400 hover:text-white transition-colors">
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* BOT CONTROL CENTER */}
        <div className={`xl:col-span-4 glass-card p-8 rounded-[2rem] transition-all duration-500 ${botConfig.active ? 'bot-active' : 'opacity-90'}`}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Cpu className={botConfig.active ? 'text-blue-400' : 'text-slate-600'} size={24} />
              <h2 className="font-black text-xl tracking-tight uppercase">Trading Bot</h2>
            </div>
            <button onClick={toggleBot} className={`px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${botConfig.active ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'}`}>
              {botConfig.active ? <><Square size={12} fill="currentColor" /> Stop Bot</> : <><Play size={12} fill="currentColor" /> Start Bot</>}
            </button>
          </div>

          <div className="space-y-6">
            {/* Private Key Field */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <ShieldAlert size={12} className="text-amber-500" /> Private Key (BS58)
              </label>
              <div className="relative">
                <input 
                  type={showKey ? 'text' : 'password'}
                  value={botConfig.privateKey}
                  onChange={e => setBotConfig(prev => ({ ...prev, privateKey: e.target.value }))}
                  placeholder="Secret Key..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs mono text-blue-400 focus:outline-none focus:border-blue-500 transition-all"
                />
                <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[9px] text-slate-600 italic">Nunca se guarda fuera de tu navegador. Úsala con precaución.</p>
            </div>

            {/* Thresholds */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Take Profit (%)</label>
                <input 
                  type="number" 
                  value={botConfig.takeProfitPct}
                  onChange={e => setBotConfig(prev => ({ ...prev, takeProfitPct: Number(e.target.value) }))}
                  className="w-full bg-transparent text-xl font-black text-emerald-400 focus:outline-none"
                />
              </div>
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Buy Dip (%)</label>
                <input 
                  type="number" 
                  value={botConfig.buyDipPct}
                  onChange={e => setBotConfig(prev => ({ ...prev, buyDipPct: Number(e.target.value) }))}
                  className="w-full bg-transparent text-xl font-black text-rose-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Trade Amount */}
            <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Amount to Buy (SOL)</label>
                <div className="flex items-center justify-between">
                    <input 
                    type="number" 
                    value={botConfig.amountSol}
                    onChange={e => setBotConfig(prev => ({ ...prev, amountSol: Number(e.target.value) }))}
                    className="bg-transparent text-xl font-black text-white focus:outline-none"
                    />
                    <span className="text-[10px] font-black text-slate-500">SOL</span>
                </div>
            </div>

            {/* Real-time Logs Console */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Consola del Bot</h4>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
              </div>
              <div className="h-40 bg-black/60 rounded-xl border border-white/5 p-4 overflow-y-auto mono text-[10px] leading-relaxed space-y-1">
                {botLogs.map((log, i) => (
                  <div key={i} className={log.includes('✅') ? 'text-emerald-400' : log.includes('❌') ? 'text-rose-400' : 'text-slate-400'}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CHART & STATS */}
        <div className="xl:col-span-8 space-y-8">
           <div className="glass-card p-10 rounded-[2.5rem]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <Activity className="text-blue-500" />
                  <h2 className="text-2xl font-black uppercase tracking-tighter">Live Price Flow</h2>
                </div>
                <div className="flex items-baseline gap-2">
                   <span className="text-4xl font-black tracking-tighter">${stats?.currentPrice.toFixed(4)}</span>
                   <span className={`text-sm font-bold ${stats?.priceChange24h! >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                     {stats?.priceChange24h! >= 0 ? '▲' : '▼'} {Math.abs(stats?.priceChange24h!).toFixed(2)}%
                   </span>
                </div>
              </div>
              <div className="h-[400px]">
                <PriceChart data={history} />
              </div>
           </div>

           {/* Quick Stats Grid */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card p-6 rounded-3xl flex flex-col justify-between">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Balance Actual (RAY)</p>
                 <div className="flex items-center gap-3">
                    <img src="https://assets.coingecko.com/coins/images/15163/small/raydium.png" className="w-8 h-8" />
                    <span className="text-2xl font-black">{realRayBalance.toLocaleString()} RAY</span>
                 </div>
              </div>
              <div className="glass-card p-6 rounded-3xl flex flex-col justify-between">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Value in MXN</p>
                 <span className="text-2xl font-black text-emerald-400">
                    ${((realRayBalance * (stats?.currentPrice || 0)) * MXN_EXCHANGE_RATE).toLocaleString()} MXN
                 </span>
              </div>
              <div className="glass-card p-6 rounded-3xl flex flex-col justify-between relative overflow-hidden">
                 <div className="absolute top-2 right-2 flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className="text-[8px] font-black text-blue-400 uppercase">Synced</span>
                 </div>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Trading Pair</p>
                 <span className="text-2xl font-black">RAY / SOL</span>
              </div>
           </div>
        </div>
      </div>

      {/* AI ANALYSIS SECTION */}
      <section className="glass-card p-12 rounded-[3.5rem] relative overflow-hidden">
         <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <BrainCircuit size={200} />
         </div>
         <div className="relative z-10">
            <div className="flex items-center justify-between mb-10">
               <div className="flex items-center gap-4">
                  <BrainCircuit className="text-purple-500" size={32} />
                  <h2 className="text-3xl font-black tracking-tighter uppercase">AI Strategy Insight</h2>
               </div>
               <button 
                  onClick={async () => {
                    setAnalyzing(true);
                    const analysis = await getMarketAnalysis(stats?.currentPrice || 0, stats?.priceChange24h || 0, history);
                    setAiAnalysis(analysis);
                    setAnalyzing(false);
                  }}
                  disabled={analyzing}
                  className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50"
               >
                  {analyzing ? 'Reading Market...' : 'Analyze Market'}
               </button>
            </div>
            <div className="bg-black/40 p-10 rounded-[2.5rem] border border-white/5 min-h-[200px]">
               {aiAnalysis ? (
                 <div className="text-slate-300 leading-relaxed text-lg whitespace-pre-wrap">{aiAnalysis}</div>
               ) : (
                 <p className="text-slate-600 italic text-center py-10">Pulse el botón para generar un análisis estratégico de Raydium.</p>
               )}
            </div>
         </div>
      </section>

      {/* FOOTER INFO */}
      <footer className="text-center pb-20 pt-10">
        <div className="inline-flex items-center gap-4 px-6 py-2 bg-slate-900/50 rounded-full border border-white/10">
           <AlertTriangle size={14} className="text-amber-500" />
           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
             Criptomonedas son volátiles. Este bot opera bajo tu propia llave y responsabilidad.
           </p>
        </div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
