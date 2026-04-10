import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Settings, 
  Users, 
  Wrench, 
  Layout, 
  Shield, 
  Plus, 
  Trash2, 
  Save,
  ChevronRight,
  Store,
  Bell,
  Camera,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  RefreshCw,
  Globe,
  Link,
  LogOut,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SettingsData, initialSettingsData } from '../types';
import { useAuth } from '../context/AuthContext';
import { getSettings, upsertSetting } from '../lib/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TabType = 'geral' | 'equipe' | 'workflow' | 'layout' | 'seguranca' | 'webhooks';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsData>(initialSettingsData);
  const [confirmDelete, setConfirmDelete] = useState<{
    show: boolean;
    title: string;
    onConfirm: () => void;
  }>({ show: false, title: '', onConfirm: () => {} });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }
    if (user?.level !== 'Admin') {
      navigate('/');
      return;
    }
    getSettings().then(remote => {
      setSettings(prev => ({
        ...prev,
        company: { ...initialSettingsData.company, ...(remote.company as any) },
        workflow: { ...initialSettingsData.workflow, ...(remote.workflow as any) },
        webhooks: { ...initialSettingsData.webhooks, ...(remote.webhooks as any) },
      }));
      localStorage.setItem('app_settings', JSON.stringify(remote));
    }).catch(() => {
      const saved = localStorage.getItem('app_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({
          ...initialSettingsData,
          ...parsed,
          company: { ...initialSettingsData.company, ...parsed.company },
          team: { ...initialSettingsData.team, ...parsed.team },
          workflow: { ...initialSettingsData.workflow, ...parsed.workflow },
          security: { ...initialSettingsData.security, ...parsed.security },
          webhooks: { ...initialSettingsData.webhooks, ...parsed.webhooks },
          fields: initialSettingsData.fields.map(initialField => {
            const savedField = parsed.fields?.find((f: any) => f.id === initialField.id);
            return savedField ? { ...initialField, ...savedField } : initialField;
          }),
        });
      }
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        upsertSetting('company', settings.company),
        upsertSetting('workflow', settings.workflow),
        upsertSetting('webhooks', settings.webhooks),
      ]);
      localStorage.setItem('app_settings', JSON.stringify(settings));
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      // Fallback: save locally
      localStorage.setItem('app_settings', JSON.stringify(settings));
    } finally {
      setIsSaving(false);
    }
  };

  const updateCompany = (field: keyof SettingsData['company'], value: string | null) => {
    setSettings(prev => ({
      ...prev,
      company: { ...prev.company, [field]: value }
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateCompany('logo', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const tabs = [
    { id: 'geral', label: 'Geral', icon: <Store size={18} /> },
    { id: 'equipe', label: 'Equipe', icon: <Users size={18} /> },
    { id: 'workflow', label: 'Fluxo de Trabalho', icon: <RefreshCw size={18} /> },
    { id: 'layout', label: 'Layout & Campos', icon: <Layout size={18} /> },
    { id: 'webhooks', label: 'Webhooks', icon: <Globe size={18} /> },
    { id: 'seguranca', label: 'Segurança', icon: <Shield size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-bg-deep text-text-soft flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-72 bg-bg-card border-r border-border-soft p-6 flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-black uppercase tracking-widest">Ajustes</h1>
        </div>

        <nav className="flex flex-col gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all group",
                activeTab === tab.id 
                  ? "bg-brand text-white shadow-lg shadow-brand/20" 
                  : "text-gray-500 hover:bg-white/5 hover:text-text-soft"
              )}
            >
              <span className={cn("transition-transform group-hover:scale-110", activeTab === tab.id ? "text-white" : "text-gray-500")}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
          <div className="px-4 py-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-brand">{user?.name}</p>
            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">{user?.level}</p>
          </div>
          
          <button 
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="w-full py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-[10px] text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-error/10 hover:text-error hover:border-error/20 transition-all"
          >
            <LogOut size={16} />
            Sair do Sistema
          </button>

          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-4 bg-brand rounded-2xl font-black text-sm text-white shadow-xl shadow-brand/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Save size={18} />
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-12 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="max-w-4xl mx-auto"
          >
            {activeTab === 'geral' && (
              <GeneralSettings 
                data={settings.company} 
                update={updateCompany} 
                onLogoUpload={handleLogoUpload} 
              />
            )}
            {activeTab === 'equipe' && (
              <TeamSettings 
                data={settings.team} 
                setSettings={setSettings} 
                setConfirmDelete={setConfirmDelete}
              />
            )}
            {activeTab === 'workflow' && (
              <WorkflowSettings 
                data={settings.workflow} 
                setSettings={setSettings} 
              />
            )}
            {activeTab === 'layout' && (
              <LayoutSettings 
                data={settings.fields} 
                setSettings={setSettings} 
              />
            )}
            {activeTab === 'seguranca' && (
              <SecuritySettings 
                data={settings.security} 
                setSettings={setSettings}
                setConfirmDelete={setConfirmDelete}
              />
            )}
            {activeTab === 'webhooks' && (
              <WebhookSettings 
                data={settings.webhooks} 
                setSettings={setSettings}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {confirmDelete.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete({ ...confirmDelete, show: false })}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-bg-card border border-border-soft w-full max-w-sm rounded-[32px] p-8 relative z-10 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black mb-2">Confirmar Exclusão</h3>
              <p className="text-gray-500 font-medium mb-8">
                Tem certeza que deseja remover <span className="text-white font-bold">{confirmDelete.title}</span>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDelete({ ...confirmDelete, show: false })}
                  className="flex-1 py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    confirmDelete.onConfirm();
                    setConfirmDelete({ ...confirmDelete, show: false });
                  }}
                  className="flex-1 py-3 bg-error text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-error/80 transition-all shadow-lg shadow-error/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GeneralSettings({ data, update, onLogoUpload }: { 
  data: SettingsData['company'], 
  update: (field: keyof SettingsData['company'], value: string | null) => void,
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-3xl font-black mb-2">Configurações Gerais</h2>
        <p className="text-gray-500 font-medium">Gerencie as informações básicas da sua empresa e do sistema.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <SettingCard title="Identidade Visual">
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center p-2 shadow-2xl relative group overflow-hidden">
                {data.logo ? (
                  <img src={data.logo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <path d="M20 45 Q15 75 50 90 Q85 75 80 45 Q70 65 60 35 Q50 65 50 25 Q50 65 40 35 Q30 65 20 45 Z" fill="#FF6600" />
                    <circle cx="15" cy="40" r="6" fill="#2E1A47" />
                    <circle cx="50" cy="15" r="6" fill="#2E1A47" />
                    <circle cx="85" cy="40" r="6" fill="#2E1A47" />
                  </svg>
                )}
                <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera size={20} className="text-white mb-1" />
                  <span className="text-[8px] font-black text-white uppercase">Alterar</span>
                  <input type="file" className="hidden" accept="image/*" onChange={onLogoUpload} />
                </label>
              </div>
              <div className="space-y-2">
                <button 
                  onClick={() => update('logo', null)}
                  className="px-4 py-2 bg-bg-deep border border-border-soft rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-error transition-colors"
                >
                  Remover Logo
                </button>
              </div>
            </div>
            <InputGroup label="Nome da Empresa" value={data.name} onChange={(v) => update('name', v)} />
            <InputGroup label="Slogan / Subtítulo" value={data.slogan} onChange={(v) => update('slogan', v)} />
          </div>
        </SettingCard>

        <SettingCard title="Contato e Endereço">
          <div className="space-y-4">
            <InputGroup label="E-mail de Suporte" value={data.email} onChange={(v) => update('email', v)} />
            <InputGroup 
              label="Telefone" 
              value={data.phone} 
              onChange={(v) => {
                let digits = v.replace(/\D/g, '');
                if (digits.length > 11) digits = digits.slice(0, 11);
                let masked = digits;
                if (digits.length > 10) {
                  masked = digits.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
                } else if (digits.length > 6) {
                  masked = digits.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
                } else if (digits.length > 2) {
                  masked = digits.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
                } else if (digits.length > 0) {
                  masked = digits.replace(/^(\d*)/, '($1');
                }
                update('phone', masked);
              }} 
            />
            <InputGroup label="Endereço" value={data.address} onChange={(v) => update('address', v)} />
          </div>
        </SettingCard>
      </div>
    </div>
  );
}

function TeamSettings({ data, setSettings, setConfirmDelete }: { 
  data: SettingsData['team'], 
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>,
  setConfirmDelete: React.Dispatch<React.SetStateAction<{ show: boolean; title: string; onConfirm: () => void; }>>
}) {
  const [newTech, setNewTech] = useState('');
  const [newSeller, setNewSeller] = useState('');

  const addItem = (field: keyof SettingsData['team'], name: string) => {
    if (name.trim()) {
      setSettings(prev => ({
        ...prev,
        team: { ...prev.team, [field]: [...prev.team[field], name.trim()] }
      }));
      if (field === 'technicians') setNewTech('');
      else setNewSeller('');
    }
  };

  const removeItem = (field: keyof SettingsData['team'], index: number, name: string) => {
    setConfirmDelete({
      show: true,
      title: name,
      onConfirm: () => {
        setSettings(prev => ({
          ...prev,
          team: { ...prev.team, [field]: prev.team[field].filter((_, i) => i !== index) }
        }));
      }
    });
  };

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-3xl font-black mb-2">Equipe e Colaboradores</h2>
        <p className="text-gray-500 font-medium">Cadastre técnicos e vendedores para atribuição nas Ordens de Serviço.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <SettingCard title="Técnicos">
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Novo técnico..."
                className="flex-1 bg-bg-deep border border-border-soft rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                value={newTech}
                onChange={(e) => setNewTech(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem('technicians', newTech)}
              />
              <button 
                onClick={() => addItem('technicians', newTech)}
                className="p-2 bg-brand text-white rounded-xl hover:bg-brand/80 transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {data.technicians.map((name, i) => (
                <ListItem key={i} label={name} onDelete={() => removeItem('technicians', i, name)} />
              ))}
            </div>
          </div>
        </SettingCard>

        <SettingCard title="Vendedores">
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Novo vendedor..."
                className="flex-1 bg-bg-deep border border-border-soft rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                value={newSeller}
                onChange={(e) => setNewSeller(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem('vendedores', newSeller)}
              />
              <button 
                onClick={() => addItem('vendedores', newSeller)}
                className="p-2 bg-brand text-white rounded-xl hover:bg-brand/80 transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="space-y-2">
              {data.vendedores.map((name, i) => (
                <ListItem key={i} label={name} onDelete={() => removeItem('vendedores', i, name)} />
              ))}
            </div>
          </div>
        </SettingCard>
      </div>
    </div>
  );
}

function WorkflowSettings({ data, setSettings }: { 
  data: SettingsData['workflow'], 
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>> 
}) {
  const [newStatus, setNewStatus] = useState('');

  const addStatus = () => {
    if (newStatus.trim()) {
      setSettings(prev => ({
        ...prev,
        workflow: { ...prev.workflow, statuses: [...prev.workflow.statuses, newStatus.trim()] }
      }));
      setNewStatus('');
    }
  };

  const removeStatus = (index: number) => {
    setSettings(prev => ({
      ...prev,
      workflow: { ...prev.workflow, statuses: prev.workflow.statuses.filter((_, i) => i !== index) }
    }));
  };

  const toggle = (field: keyof SettingsData['workflow']) => {
    setSettings(prev => ({
      ...prev,
      workflow: { ...prev.workflow, [field]: !prev.workflow[field] }
    }));
  };

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-3xl font-black mb-2">Fluxo de Trabalho</h2>
        <p className="text-gray-500 font-medium">Personalize os estados e processos das suas Ordens de Serviço.</p>
      </header>

      <div className="grid grid-cols-1 gap-8">
        <SettingCard title="Status de OS">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.statuses.map((status, i) => (
              <div key={i} className="p-4 bg-bg-deep border border-border-soft rounded-2xl flex items-center justify-between group">
                <span className="text-xs font-bold uppercase tracking-widest">{status}</span>
                <button onClick={() => removeStatus(i)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-error transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="flex gap-2 p-1 border-2 border-dashed border-border-soft rounded-2xl focus-within:border-brand/40 transition-all">
              <input 
                type="text" 
                placeholder="Novo status..."
                className="flex-1 bg-transparent px-3 py-2 text-xs font-bold focus:outline-none"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addStatus()}
              />
              <button 
                onClick={addStatus}
                className="p-2 text-brand hover:bg-brand/10 rounded-xl transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </SettingCard>

        <SettingCard title="Notificações Automáticas">
          <div className="space-y-4">
            <ToggleItem label="Enviar WhatsApp ao finalizar OS" enabled={data.notifyWhatsApp} onToggle={() => toggle('notifyWhatsApp')} />
            <ToggleItem label="Notificar vendedor sobre atrasos" enabled={data.notifyDelay} onToggle={() => toggle('notifyDelay')} />
            <ToggleItem label="Backup diário em nuvem" enabled={data.cloudBackup} onToggle={() => toggle('cloudBackup')} />
          </div>
        </SettingCard>
      </div>
    </div>
  );
}


import { getUsers, createUser, deleteUser, UserRow } from '../lib/userApi';

function SecuritySettings({ }: { 
  data: SettingsData['security'],
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>>,
  setConfirmDelete: React.Dispatch<React.SetStateAction<{ show: boolean; title: string; onConfirm: () => void; }>>
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    level: 'Operador' as 'Admin' | 'Operador',
    password: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; id?: number; name?: string }>({ show: false });
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      setError('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) return;
    try {
      const created = await createUser(newUser);
      setUsers((prev) => [...prev, created]);
      setNewUser({ name: '', email: '', level: 'Operador', password: '' });
      setShowAddForm(false);
      setError(null);
    } catch (err: any) {
      setError('Erro ao criar usuário');
    }
  };

  const handleRemoveUser = (id: number, name: string) => {
    setConfirmDelete({ show: true, id, name });
  };

  const confirmRemoveUser = async () => {
    if (!confirmDelete.id) return;
    try {
      await deleteUser(confirmDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== confirmDelete.id));
      setConfirmDelete({ show: false });
      setError(null);
    } catch (err: any) {
      setError('Erro ao remover usuário');
    }
  };

  return (
    <div className="space-y-10">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black mb-2">Segurança e Acesso</h2>
          <p className="text-gray-500 font-medium">Gerencie usuários, permissões e logs de auditoria.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-6 py-3 bg-brand text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all"
        >
          <Plus size={18} />
          Novo Usuário
        </button>
      </header>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <SettingCard title="Cadastrar Novo Usuário">
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Nome</label>
                  <input 
                    type="text"
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="w-full bg-bg-deep border border-border-soft rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">E-mail</label>
                  <input 
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full bg-bg-deep border border-border-soft rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Senha</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      required
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      className="w-full bg-bg-deep border border-border-soft rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-brand transition-all pr-10"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-brand transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Nível</label>
                  <select 
                    value={newUser.level}
                    onChange={(e) => setNewUser({...newUser, level: e.target.value as any})}
                    className="w-full bg-bg-deep border border-border-soft rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                  >
                    <option value="Operador">Operador</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-3 mt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-6 py-2 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-text-soft transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2 bg-brand text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand/80 transition-all"
                  >
                    Salvar Usuário
                  </button>
                </div>
              </form>
              {error && <div className="text-error text-xs mt-2">{error}</div>}
            </SettingCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-8">
        <SettingCard title="Usuários do Sistema">
          <div className="overflow-hidden border border-border-soft rounded-2xl">
            {loading ? (
              <div className="p-6 text-center text-gray-500">Carregando usuários...</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-deep text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="px-6 py-4">Usuário</th>
                    <th className="px-6 py-4">E-mail</th>
                    <th className="px-6 py-4">Nível</th>
                    <th className="px-6 py-4">Último Acesso</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((row) => (
                    <tr key={row.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold">{row.name}</td>
                      <td className="px-6 py-4 text-gray-500">{row.email}</td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                          row.level === 'Admin' ? "bg-brand/10 text-brand" : "bg-white/10 text-gray-400"
                        )}>
                          {row.level}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 font-medium">{row.lastAccess || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleRemoveUser(row.id!, row.name)}
                          className="text-gray-600 hover:text-error transition-colors p-2"
                          title="Remover Usuário"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {error && <div className="text-error text-xs p-2 text-center">{error}</div>}
          </div>
        </SettingCard>
      </div>

      <AnimatePresence>
        {confirmDelete.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete({ show: false })}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-bg-card border border-border-soft w-full max-w-sm rounded-[32px] p-8 relative z-10 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black mb-2">Confirmar Exclusão</h3>
              <p className="text-gray-500 font-medium mb-8">
                Tem certeza que deseja remover <span className="text-white font-bold">{confirmDelete.name}</span>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmDelete({ show: false })}
                  className="flex-1 py-3 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmRemoveUser}
                  className="flex-1 py-3 bg-error text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-error/80 transition-all shadow-lg shadow-error/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LayoutSettings({ data, setSettings }: { 
  data: SettingsData['fields'], 
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>> 
}) {
  const toggleField = (id: string, property: 'enabled' | 'required') => {
    setSettings(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === id ? { ...f, [property]: !f[property] } : f)
    }));
  };

  const sections = ['Cliente', 'Produto', 'Triagem', 'Financeiro'];

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-3xl font-black mb-2">Layout & Campos</h2>
        <p className="text-gray-500 font-medium">Personalize quais campos aparecem no formulário de OS e quais são obrigatórios.</p>
      </header>

      <div className="space-y-8">
        {sections.map(section => (
          <SettingCard key={section} title={`Campos de ${section}`}>
            <div className="grid grid-cols-1 gap-4">
              {data.filter(f => f.section === section).map(field => (
                <div key={field.id} className="flex items-center justify-between p-4 bg-bg-deep border border-border-soft rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold">{field.label}</span>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{field.id}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => toggleField(field.id, 'enabled')}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        field.enabled ? "bg-brand/10 text-brand" : "bg-white/5 text-gray-500"
                      )}
                    >
                      {field.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                      {field.enabled ? 'Ativo' : 'Inativo'}
                    </button>
                    <button 
                      onClick={() => toggleField(field.id, 'required')}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        field.required ? "bg-error/10 text-error" : "bg-white/5 text-gray-500"
                      )}
                    >
                      {field.required ? <Lock size={14} /> : <Unlock size={14} />}
                      {field.required ? 'Obrigatório' : 'Opcional'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SettingCard>
        ))}
      </div>
    </div>
  );
}

function WebhookSettings({ data, setSettings }: { 
  data: SettingsData['webhooks'], 
  setSettings: React.Dispatch<React.SetStateAction<SettingsData>> 
}) {
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const update = (field: keyof SettingsData['webhooks'], value: any) => {
    setSettings(prev => ({
      ...prev,
      webhooks: { ...prev.webhooks, [field]: value }
    }));
  };

  const testWebhook = async () => {
    if (!data.url) return;
    setTestStatus('loading');
    try {
      const response = await fetch('/api/webhook-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: data.url,
          data: {
            event: 'test',
            timestamp: new Date().toISOString(),
            message: 'Teste de conexão do sistema de OS'
          }
        })
      });
      if (response.ok) setTestStatus('success');
      else setTestStatus('error');
    } catch (error) {
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  return (
    <div className="space-y-10">
      <header>
        <h2 className="text-3xl font-black mb-2">Integração Webhook</h2>
        <p className="text-gray-500 font-medium">Envie dados das Ordens de Serviço para sistemas externos em tempo real.</p>
      </header>

      <div className="grid grid-cols-1 gap-8">
        <SettingCard 
          title="Configuração do Endpoint"
          action={
            <button 
              onClick={testWebhook}
              disabled={!data.url || testStatus === 'loading'}
              className={cn(
                "px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all",
                testStatus === 'idle' && "bg-brand/10 text-brand hover:bg-brand/20",
                testStatus === 'loading' && "bg-gray-800 text-gray-500 cursor-wait",
                testStatus === 'success' && "bg-success/10 text-success",
                testStatus === 'error' && "bg-error/10 text-error"
              )}
            >
              {testStatus === 'idle' && <><Link size={14} /> Testar Conexão</>}
              {testStatus === 'loading' && <><RefreshCw size={14} className="animate-spin" /> Testando...</>}
              {testStatus === 'success' && <><CheckCircle2 size={14} /> Webhook OK!</>}
              {testStatus === 'error' && <><AlertCircle size={14} /> Falha no Teste</>}
            </button>
          }
        >
          <div className="space-y-6">
            <ToggleItem 
              label="Ativar Webhooks" 
              enabled={data.enabled} 
              onToggle={() => update('enabled', !data.enabled)} 
            />
            
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">URL do Webhook (Endpoint)</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Link className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="url" 
                    value={data.url}
                    onChange={(e) => update('url', e.target.value)}
                    placeholder="https://seu-sistema.com/webhook"
                    className="w-full bg-bg-deep border border-border-soft rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                  />
                </div>
              </div>
              <p className="text-[10px] text-gray-500 font-medium">Os dados serão enviados via método POST em formato JSON.</p>
            </div>
          </div>
        </SettingCard>

        <SettingCard title="Eventos de Gatilho">
          <div className="space-y-4">
            <ToggleItem 
              label="Enviar ao criar nova OS" 
              enabled={data.on_create} 
              onToggle={() => update('on_create', !data.on_create)} 
            />
            <ToggleItem 
              label="Enviar ao atualizar OS existente" 
              enabled={data.on_update} 
              onToggle={() => update('on_update', !data.on_update)} 
            />
          </div>
        </SettingCard>
      </div>
    </div>
  );
}

// Helper Components
interface SettingCardProps {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

const SettingCard: React.FC<SettingCardProps> = ({ title, children, action }) => {
  return (
    <section className="bg-bg-card border border-border-soft rounded-[32px] p-8 shadow-xl">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
};

function InputGroup({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</label>
      <input 
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-deep border border-border-soft rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all"
      />
    </div>
  );
}

interface ListItemProps {
  label: string;
  onDelete: () => void;
}

const ListItem: React.FC<ListItemProps> = ({ label, onDelete }) => {
  return (
    <div className="flex items-center justify-between p-4 bg-bg-deep border border-border-soft rounded-2xl group">
      <span className="text-sm font-bold">{label}</span>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-error transition-all">
        <Trash2 size={16} />
      </button>
    </div>
  );
};

function ToggleItem({ label, enabled, onToggle }: { label: string, enabled: boolean, onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-bg-deep border border-border-soft rounded-2xl">
      <span className="text-sm font-bold">{label}</span>
      <button 
        onClick={onToggle}
        className={cn(
          "w-12 h-6 rounded-full relative transition-all",
          enabled ? "bg-brand" : "bg-gray-800"
        )}
      >
        <div className={cn(
          "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
          enabled ? "left-7" : "left-1"
        )} />
      </button>
    </div>
  );
}
