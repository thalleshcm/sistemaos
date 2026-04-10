import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  PlusCircle, 
  Search, 
  Settings as SettingsIcon, 
  BarChart3, 
  Clock, 
  ChevronRight,
  ShieldCheck,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SettingsData, initialSettingsData } from '../types';
import { getSettings } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import LoginModal from './LoginModal';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const [settings, setSettings] = useState<SettingsData>(initialSettingsData);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then(remote => {
      if (remote.company) {
        setSettings(prev => ({
          ...prev,
          company: { ...initialSettingsData.company, ...(remote.company as any) },
        }));
      }
    }).catch(() => {
      const saved = localStorage.getItem('app_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({
          ...prev,
          ...parsed,
          company: { ...initialSettingsData.company, ...parsed.company },
        }));
      }
    });
  }, []);

  const menuItems = [
    { 
      title: 'Nova Ordem de Serviço', 
      desc: 'Criar um novo registro de assistência técnica', 
      icon: <PlusCircle size={24} />, 
      path: '/os',
      color: 'bg-brand'
    },
    { 
      title: 'Pesquisar OS', 
      desc: 'Localizar ordens existentes por cliente ou número', 
      icon: <Search size={24} />, 
      path: '/search',
      color: 'bg-white/10'
    }
  ];

  const handleAction = (path: string) => {
    setAccessError(null);
    if (isAuthenticated) {
      if (path === '/settings' && user?.level !== 'Admin') {
        setAccessError('Acesso restrito: Apenas administradores podem acessar as configurações.');
        setTimeout(() => setAccessError(null), 3000);
        return;
      }
      if (path === '/os') {
        localStorage.removeItem('current_os');
      }
      navigate(path);
    } else {
      setPendingPath(path);
      setIsLoginModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep text-text-soft flex flex-col overflow-hidden">
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)}
        onSuccess={() => {
          if (pendingPath) {
            // Check if user is admin for settings
            const savedSession = sessionStorage.getItem('auth_session');
            const loggedUser = savedSession ? JSON.parse(savedSession) : null;
            
            if (pendingPath === '/settings' && loggedUser?.level !== 'Admin') {
              setAccessError('Acesso restrito: Apenas administradores podem acessar as configurações.');
              setTimeout(() => setAccessError(null), 3000);
              setPendingPath(null);
              return;
            }

            if (pendingPath === '/os') localStorage.removeItem('current_os');
            navigate(pendingPath);
          }
        }}
      />
      {/* Background Accents */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-brand/10 rounded-full blur-[120px] -mr-64 -mt-64 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[500px] h-[500px] bg-brand/5 rounded-full blur-[120px] -ml-64 -mb-64 pointer-events-none" />

      {/* Header */}
      <header className="p-6 flex flex-col gap-4 relative z-10">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-brand/20 p-1.5 overflow-hidden">
              {settings.company.logo ? (
                <img src={settings.company.logo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <path d="M20 45 Q15 75 50 90 Q85 75 80 45 Q70 65 60 35 Q50 65 50 25 Q50 65 40 35 Q30 65 20 45 Z" fill="#FF6600" />
                  <circle cx="15" cy="40" r="6" fill="#2E1A47" />
                  <circle cx="50" cy="15" r="6" fill="#2E1A47" />
                  <circle cx="85" cy="40" r="6" fill="#2E1A47" />
                </svg>
              )}
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest">{settings.company.name}</h1>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{settings.company.slogan}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {isAuthenticated && (
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-brand">{user?.name}</span>
                <button 
                  onClick={logout}
                  className="text-[8px] font-bold text-gray-500 uppercase tracking-widest hover:text-error transition-colors"
                >
                  Sair do Sistema
                </button>
              </div>
            )}
            {(!isAuthenticated || user?.level === 'Admin') && (
              <button 
                onClick={() => handleAction('/settings')}
                className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center hover:bg-brand/10 hover:border-brand/40 transition-all group"
                title="Configurações"
              >
                <SettingsIcon size={24} className="text-gray-400 group-hover:text-brand transition-colors" />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {accessError && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-error/10 border border-error/20 p-3 rounded-xl flex items-center gap-3 text-error text-[10px] font-black uppercase tracking-widest"
            >
              <ShieldCheck size={16} />
              {accessError}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl md:text-7xl font-black mb-4 tracking-tighter">
            Gestão <span className="text-brand">Especializada</span>
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto text-lg font-medium">
            Sistema inteligente de ordens de serviço.
          </p>
        </motion.div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
          {menuItems.map((item, index) => (
            <motion.button
              key={item.title}
              initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleAction(item.path)}
              className="group bg-bg-card border border-border-soft p-6 rounded-[32px] flex items-center gap-6 text-left hover:border-brand/40 hover:bg-brand/5 transition-all shadow-xl hover:shadow-brand/10"
            >
              <div className={`w-16 h-16 ${item.color} rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform`}>
                {item.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500 font-medium">{item.desc}</p>
              </div>
              <ChevronRight size={24} className="text-gray-700 group-hover:text-brand group-hover:translate-x-1 transition-all" />
            </motion.button>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 w-full max-w-4xl border-t border-white/5 pt-10">
          <StatItem icon={<Clock className="text-brand" size={16} />} label="OS Hoje" value="0" />
          <StatItem icon={<ShieldCheck className="text-success" size={16} />} label="Prontas" value="0" />
          <StatItem icon={<BarChart3 className="text-blue-500" size={16} />} label="Faturamento" value="R$ 0.00" />
          <StatItem icon={<Users className="text-purple-500" size={16} />} label="Clientes" value="0" />
        </div>
      </main>

      {/* Footer */}
      <footer className="p-8 text-center text-[10px] font-bold text-gray-600 uppercase tracking-[0.3em]">
        © 2026 {settings.company.name} • Todos os direitos reservados
      </footer>
    </div>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex flex-col items-center md:items-start gap-1">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</span>
      </div>
      <span className="text-2xl font-black">{value}</span>
    </div>
  );
}
