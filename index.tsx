
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
  Server, Download, Copy, Check, Terminal
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

  const monitorBot = async (currentPrice: number) => {
    if (!botConfig.active || !botConfig.privateKey || botConfig.entryPrice === 0) return;

    const diff = ((currentPrice - botConfig.entryPrice) / botConfig.entryPrice) * 100;
    
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

  const serverScriptCode = useMemo(() => {
    return `// BOT DE TRADING RAYDIUM 24/7 (Node.js)
const web3 = require("@solana/web3.js");
const bs58 = require("bs58");
const fetch = require("node-fetch");

const CONFIG = {
  privateKey: "${botConfig.privateKey || 'TU_LLAVE_AQUI'}",
  takeProfitPct: ${botConfig.takeProfitPct},
  buyDipPct: ${botConfig.buyDipPct},
  amountSol: ${botConfig.amountSol},
  entryPrice: ${botConfig.entryPrice || 0},
  rpc: "https://api.mainnet-beta.solana.com"
};

const RAY_MINT = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
const SOL_MINT = "So11111111111111111111111111111111111111112";

async function monitor() {
  console.log("Monitor pulse check...");
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=raydium&vs_currencies=usd");
    const data = await res.json();
    const currentPrice = data.raydium.usd;
    
    const diff = ((currentPrice - CONFIG.entryPrice) / CONFIG.entryPrice) * 100;
    console.log(\`Precio: \${currentPrice} | Dif: \${diff.toFixed(2)}%\`);

    if (diff >= CONFIG.takeProfitPct) {
      console.log("VENDIENDO...");
      // Aquí iría la lógica de swap de Jupiter (ver solanaService.ts)
    }
  } catch (e) { console.error(e); }
}

setInterval(monitor, 30000);
console.log("Bot iniciado en modo servidor...");`;
  }, [botConfig]);

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
        <div className={`xl:col-span-4 glass-card p-0 rounded-[2rem] transition-all duration-500 overflow-hidden ${botConfig.active ? 'bot-active' : 'opacity-90'}`}>
          {/* Internal Navigation Tabs */}
          <div className="flex border-b border-white/5">
            <button 
              onClick={() => setActiveTab('bot')}
              className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'bot' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Cpu size={14} /> Bot Browser
            </button>
            <button 
              onClick={() => setActiveTab('server')}
              className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'server' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Server size={14} /> Modo Servidor (24/7)
            </button>
          </div>

          <div className="p-8 space-y-6">
            {activeTab === 'bot' ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Activity size={18} className="text-blue-400" />
                    <h2 className="font-black text-sm tracking-tight uppercase">Control Navegador</h2>
                  </div>
                  <button onClick={toggleBot} className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${botConfig.active ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'}`}>
                    {botConfig.active ? <><Square size={10} fill="currentColor" /> Stop</> : <><Play size={10} fill="currentColor" /> Start</>}
                  </button>
                </div>

                {/* Private Key Field */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <ShieldAlert size={12} className="text-amber-500" /> Secret Key (BS58)
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
                </div>

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

                <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                    <label className="text-[9px] font-black text-slate-500 uppercase block mb-2">Amount (SOL)</label>
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

                <div className="h-40 bg-black/60 rounded-xl border border-white/5 p-4 overflow-y-auto mono text-[9px] leading-relaxed space-y-1">
                  {botLogs.map((log, i) => (
                    <div key={i} className={log.includes('✅') ? 'text-emerald-400' : log.includes('❌') ? 'text-rose-400' : 'text-slate-400'}>
                      {log}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Terminal size={18} className="text-indigo-400" />
                  <h2 className="font-black text-sm tracking-tight uppercase">Ejecución en Nube</h2>
                </div>
                
                <p className="text-[11px] text-slate-400 leading-relaxed italic">
                  Para que funcione con el navegador cerrado, copia este código en un servidor Node.js (Replit es gratis).
                </p>

                <div className="relative">
                  <div className="code-block">
                    {serverScriptCode}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(serverScriptCode);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute top-2 right-2 p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>

                <div className="bg-indigo-600/10 border border-indigo-500/30 p-4 rounded-xl space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-indigo-400">Pasos para 24/7:</h4>
                  <ul className="text-[10px] text-slate-300 space-y-2 list-disc pl-4">
                    <li>Crea una cuenta en <b>Replit.com</b></li>
                    <li>Crea un "Repl" de <b>Node.js</b></li>
                    <li>Pega el código anterior en <code className="text-white">index.js</code></li>
                    <li>Dale a <b>Run</b> y el bot estará vivo 24/7</li>
                  </ul>
                </div>
              </div>
            )}
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
