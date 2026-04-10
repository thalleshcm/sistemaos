import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  ArrowLeft, 
  Filter, 
  ChevronRight, 
  Calendar, 
  User, 
  Clock,
  ExternalLink,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { OSData } from '../types';
import { getServiceOrders } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function OSSearch() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<OSData[]>([]);
  const [allOS, setAllOS] = useState<OSData[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('TODOS');
  const [filterSeller, setFilterSeller] = useState('TODOS');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  // Get unique sellers for the filter
  const sellers = Array.from(new Set(allOS.map(os => os.billing.vendedor).filter(Boolean)));

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    getServiceOrders(100).then(list => {
      setAllOS(list);
      setResults(list.slice(0, 30));
      // keep local cache for offline/print
      localStorage.setItem('os_list', JSON.stringify(list));
    }).catch(() => {
      // Fallback to local cache
      const saved = localStorage.getItem('os_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        setAllOS(parsed);
        setResults(parsed.slice(0, 30));
      }
    });
  }, []);

  const handleSearch = (
    term: string = searchTerm, 
    status: string = filterStatus, 
    seller: string = filterSeller,
    dateStart: string = filterDateStart,
    dateEnd: string = filterDateEnd
  ) => {
    setSearchTerm(term);
    setFilterStatus(status);
    setFilterSeller(seller);
    setFilterDateStart(dateStart);
    setFilterDateEnd(dateEnd);
    
    let filtered = allOS;

    // 1. Text Search
    if (term.trim()) {
      filtered = filtered.filter(os => 
        os.os_info.number.toString().includes(term) ||
        os.customer.name.toLowerCase().includes(term.toLowerCase()) ||
        os.customer.cpf_cnpj.includes(term)
      );
    }

    // 2. Status Filter
    if (status !== 'TODOS') {
      filtered = filtered.filter(os => os.status === status);
    }

    // 3. Seller Filter
    if (seller !== 'TODOS') {
      filtered = filtered.filter(os => os.billing.vendedor === seller);
    }

    // 4. Date Period Filter
    if (dateStart || dateEnd) {
      filtered = filtered.filter(os => {
        // Parse "DD/MM/YYYY" to Date object
        const [day, month, year] = os.os_info.date_created.split('/').map(Number);
        const osDate = new Date(year, month - 1, day);
        
        if (dateStart) {
          const start = new Date(dateStart);
          start.setHours(0, 0, 0, 0);
          if (osDate < start) return false;
        }
        
        if (dateEnd) {
          const end = new Date(dateEnd);
          end.setHours(23, 59, 59, 999);
          if (osDate > end) return false;
        }
        
        return true;
      });
    }

    // 5. Limit to 30 results for performance
    setResults(filtered.slice(0, 30));
  };

  return (
    <div className="min-h-screen bg-bg-deep text-text-soft p-4 lg:p-8 flex flex-col gap-8">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-3 bg-bg-card border border-border-soft rounded-2xl hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest">Pesquisar OS</h1>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Localizar registros no sistema</p>
          </div>
        </div>
      </header>

      {/* Search Bar Section */}
      <section className="bg-bg-card rounded-[32px] p-6 border border-border-soft shadow-2xl">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input 
              type="text" 
              placeholder="Pesquisar por número, nome do cliente ou CPF..."
              className="w-full bg-bg-deep border border-border-soft rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "px-6 py-4 bg-bg-deep border border-border-soft rounded-2xl flex items-center gap-2 text-sm font-bold transition-all",
              showFilters ? "border-brand text-brand bg-brand/5" : "hover:bg-white/5"
            )}
          >
            <Filter size={18} />
            Filtros Avançados
          </button>
        </div>

        {showFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-6 pt-6 border-t border-border-soft grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Status da OS</label>
              <select 
                className="w-full bg-bg-deep border border-border-soft rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                value={filterStatus}
                onChange={(e) => handleSearch(searchTerm, e.target.value, filterSeller, filterDateStart, filterDateEnd)}
              >
                <option value="TODOS">Todos os Status</option>
                <option value="AGUARDA AUTORIZ.">Aguardando Autorização</option>
                <option value="AUTORIZADO">Autorizado</option>
                <option value="PRONTO">Pronto</option>
                <option value="ENTREGUE">Entregue</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Vendedor</label>
              <select 
                className="w-full bg-bg-deep border border-border-soft rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                value={filterSeller}
                onChange={(e) => handleSearch(searchTerm, filterStatus, e.target.value, filterDateStart, filterDateEnd)}
              >
                <option value="TODOS">Todos os Vendedores</option>
                {sellers.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Período</label>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  className="flex-1 bg-bg-deep border border-border-soft rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-brand transition-all" 
                  value={filterDateStart}
                  onChange={(e) => handleSearch(searchTerm, filterStatus, filterSeller, e.target.value, filterDateEnd)}
                />
                <span className="text-gray-500 text-[10px] font-bold">até</span>
                <input 
                  type="date" 
                  className="flex-1 bg-bg-deep border border-border-soft rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-brand transition-all" 
                  value={filterDateEnd}
                  onChange={(e) => handleSearch(searchTerm, filterStatus, filterSeller, filterDateStart, e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-end">
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('TODOS');
                  setFilterSeller('TODOS');
                  setFilterDateStart('');
                  setFilterDateEnd('');
                  setResults(allOS.slice(0, 30));
                }}
                className="w-full py-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-brand transition-colors border border-dashed border-border-soft rounded-xl"
              >
                Limpar Filtros
              </button>
            </div>
          </motion.div>
        )}
      </section>

      {/* Results Section */}
      <main className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">
            {results.length} Resultados encontrados {allOS.length > 30 && results.length === 30 && "(Limitado aos 30 mais recentes)"}
          </h3>
        </div>

        {results.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {results.map((os, index) => (
              <motion.div
                key={os.os_info.number}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group bg-bg-card border border-border-soft p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-brand/40 transition-all shadow-xl"
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-brand/10 rounded-2xl flex flex-col items-center justify-center text-brand">
                    <FileText size={24} />
                    <span className="text-[8px] font-black mt-1">#{os.os_info.number}</span>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-black">{os.customer.name}</h4>
                    <div className="flex flex-wrap gap-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><User size={12} /> {os.customer.cpf_cnpj || 'Sem CPF'}</span>
                      <span className="flex items-center gap-1.5"><Calendar size={12} /> {os.os_info.date_created}</span>
                      <span className="flex items-center gap-1.5"><Clock size={12} /> Previsão: {os.os_info.eta || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className={cn(
                    "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                    os.status === 'PRONTO' ? "bg-success/10 text-success" : "bg-brand/10 text-brand"
                  )}>
                    {os.status}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        localStorage.setItem('current_os', JSON.stringify(os));
                        navigate('/os');
                      }}
                      className="p-3 bg-bg-deep border border-border-soft rounded-xl hover:border-brand/40 hover:text-brand transition-all"
                      title="Editar OS"
                    >
                      <ExternalLink size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        localStorage.setItem('current_os', JSON.stringify(os));
                        window.open('/print', '_blank');
                      }}
                      className="p-3 bg-bg-deep border border-border-soft rounded-xl hover:border-brand/40 hover:text-brand transition-all"
                      title="Imprimir OS"
                    >
                      <FileText size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-40">
            <Search size={64} className="mb-4" />
            <h4 className="text-xl font-black uppercase tracking-widest">Nenhum resultado</h4>
            <p className="text-sm font-medium">Tente pesquisar por outro termo ou número de OS.</p>
          </div>
        )}
      </main>
    </div>
  );
}
