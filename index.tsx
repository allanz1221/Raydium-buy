
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { fetchHistoricalData, fetchMarketStats } from './services/cryptoService';
import { getMarketAnalysis } from './services/geminiService';
import { PriceChart } from './components/PriceChart';
import { PriceData, MarketStats, AlertConfig } from './types';
import { 
  Bell, 
  TrendingUp, 
  TrendingDown, 
  RefreshCcw, 
  BrainCircuit, 
  Activity, 
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

const App = () => {
  const [history, setHistory] = useState<PriceData[]>([]);
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
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
    }, 60000); // Check every minute
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
      // Avoid spamming notifications
      const now = Date.now();
      if (!alertConfig.lastTriggered || (now - alertConfig.lastTriggered > 3600000)) { // Max once per hour
        sendNotification(diff, currentPrice);
        setAlertConfig(prev => ({ ...prev, lastTriggered: now }));
      }
    }
  };

  const sendNotification = (diff: number, price: number) => {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
      const type = diff > 0 ? "🚀 Subida" : "🔻 Caída";
      new Notification(`Alerta Raydium: ${type} ${Math.abs(diff).toFixed(2)}%`, {
        body: `El precio actual de RAY es $${price.toFixed(3)}.`,
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

  const generateAIInsight = async () => {
    if (!stats || history.length === 0) return;
    setAnalyzing(true);
    const analysis = await getMarketAnalysis(stats.currentPrice, stats.priceChange24h, history);
    setAiAnalysis(analysis);
    setAnalyzing(false);
  };

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
            <p className="text-slate-400 text-sm font-medium">RAY Monitor & Alerts</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={refreshPrice}
            className="p-2 glass-card hover:bg-white/10 transition-all rounded-xl"
            title="Refrescar precio"
          >
            <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            onClick={toggleAlerts}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg ${
              alertConfig.enabled 
                ? 'bg-red-500/10 border border-red-500/50 text-red-500 hover:bg-red-500/20' 
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
            }`}
          >
            <Bell size={18} fill={alertConfig.enabled ? "currentColor" : "none"} />
            {alertConfig.enabled ? 'Desactivar Alerta 5%' : 'Activar Alerta ±5%'}
          </button>
        </div>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-6 rounded-3xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Precio Actual</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${stats?.currentPrice.toFixed(3)}</span>
            <span className={`text-sm font-bold flex items-center ${stats && stats.priceChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats && stats.priceChange24h >= 0 ? <TrendingUp size={14} className="mr-1"/> : <TrendingDown size={14} className="mr-1"/>}
              {Math.abs(stats?.priceChange24h || 0).toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="glass-card p-6 rounded-3xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Volumen 24h</p>
          <p className="text-2xl font-bold">${stats?.volume24h.toLocaleString()}</p>
        </div>
        <div className="glass-card p-6 rounded-3xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Market Cap</p>
          <p className="text-2xl font-bold">${(Number(stats?.marketCap) / 1000000).toFixed(1)}M</p>
        </div>
        <div className="glass-card p-6 rounded-3xl">
          <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Rango 24h</p>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="text-rose-400">${stats?.low24h.toFixed(3)}</span>
            <div className="h-1 flex-1 bg-slate-700 rounded-full overflow-hidden">
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
      <section className="glass-card p-4 md:p-8 rounded-[2rem]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="text-blue-500" />
            Gráfica Diaria (365 días)
          </h2>
          <div className="flex gap-2">
            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-bold border border-blue-500/20">1 Año</span>
          </div>
        </div>
        <PriceChart data={history} />
      </section>

      {/* AI Analysis Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-8 rounded-[2rem] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <BrainCircuit size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BrainCircuit className="text-purple-400" />
                Análisis Inteligente Gemini
              </h2>
              <button 
                onClick={generateAIInsight}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-xl hover:bg-purple-500/20 transition-all text-sm font-bold disabled:opacity-50"
              >
                {analyzing ? 'Procesando...' : aiAnalysis ? 'Regenerar' : 'Obtener Análisis'}
              </button>
            </div>
            
            <div className="prose prose-invert max-w-none">
              {aiAnalysis ? (
                <div className="space-y-4 text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {aiAnalysis}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500 italic">
                  <p>Haz clic en "Obtener Análisis" para que la IA procese los datos de mercado.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alert Status Info */}
        <div className="glass-card p-8 rounded-[2rem] flex flex-col justify-between border-blue-500/20">
          <div>
            <div className="flex items-center gap-2 text-blue-400 mb-4">
              <ShieldAlert size={24} />
              <h3 className="font-bold text-lg">Estado de Alertas</h3>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              El sistema monitoriza el precio de Raydium cada 60 segundos. Recibirás una notificación nativa si el precio varía más del 5% respecto al precio de referencia.
            </p>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-700/50">
                <span className="text-slate-400 text-sm">Monitoreo</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${alertConfig.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                  {alertConfig.enabled ? 'ACTIVO' : 'INACTIVO'}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-700/50">
                <span className="text-slate-400 text-sm">Precio Ref.</span>
                <span className="text-white font-mono">${alertConfig.basePrice > 0 ? alertConfig.basePrice.toFixed(3) : '---'}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-700/50">
                <span className="text-slate-400 text-sm">Umbral</span>
                <span className="text-white font-mono">±5.00%</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
             <div className="bg-slate-800/50 p-4 rounded-2xl text-xs text-slate-400 border border-slate-700/50">
                <p className="font-bold mb-1 flex items-center gap-1">
                  <ChevronRight size={12} className="text-blue-500" /> Nota de uso
                </p>
                Asegúrate de permitir las notificaciones en tu navegador para recibir los avisos en tiempo real.
             </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
