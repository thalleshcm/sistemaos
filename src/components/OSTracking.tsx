import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Search, 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  User,
  Calendar,
  MapPin,
  MessageSquare
} from 'lucide-react';
import { motion } from 'motion/react';
import { OSData, SettingsData, initialSettingsData } from '../types';
import { getServiceOrderByNumber, updateCustomer, getSettings } from '../lib/api';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function OSTracking() {
  const { osNumber, id } = useParams();
  const trackingId = id || osNumber;
  const navigate = useNavigate();
  const [os, setOs] = useState<OSData | null>(null);
  const [settings, setSettings] = useState<SettingsData>(initialSettingsData);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regData, setRegData] = useState({
    cpf_cnpj: '',
    email: '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    uf: ''
  });

  useEffect(() => {
    // Load settings for branding (API first, localStorage as fallback)
    getSettings().then(remote => {
      if (remote.company) {
        setSettings(prev => ({
          ...prev,
          company: { ...initialSettingsData.company, ...(remote.company as any) },
          webhooks: { ...initialSettingsData.webhooks, ...(remote.webhooks as any) },
        }));
      }
    }).catch(() => {
      const savedSettings = localStorage.getItem('app_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({
          ...prev,
          company: { ...initialSettingsData.company, ...parsed.company },
          webhooks: { ...initialSettingsData.webhooks, ...parsed.webhooks },
        }));
      }
    });

    // Fetch OS from PostgreSQL
    if (!trackingId) { setLoading(false); return; }
    
    // Se for pelo link público com ID/UUID, buscar do Express
    if (id) {
      fetch(`/api/public/os/${id}`)
        .then(res => res.ok ? res.json() : null)
        .then(found => {
          if (found) {
            setOs(found);
            const needsReg = !found.customer.cpf_cnpj || !found.customer.email || !found.customer.address.street;
            setIsRegistering(needsReg);
            if (needsReg) {
              setRegData({
                cpf_cnpj: found.customer.cpf_cnpj || '',
                email: found.customer.email || '',
                cep: found.customer.address.cep || '',
                street: found.customer.address.street || '',
                number: found.customer.address.number || '',
                complement: found.customer.address.complement || '',
                neighborhood: found.customer.address.neighborhood || '',
                city: found.customer.address.city || '',
                uf: found.customer.address.uf || '',
              });
            }
          } else {
            setOs(null);
          }
        })
        .finally(() => setLoading(false));
      return;
    }

    getServiceOrderByNumber(Number(trackingId)).then(found => {
      if (found) {
        setOs(found);
        const needsReg = !found.customer.cpf_cnpj || !found.customer.email || !found.customer.address.street;
        setIsRegistering(needsReg);
        if (needsReg) {
          setRegData({
            cpf_cnpj: found.customer.cpf_cnpj || '',
            email: found.customer.email || '',
            cep: found.customer.address.cep || '',
            street: found.customer.address.street || '',
            number: found.customer.address.number || '',
            complement: found.customer.address.complement || '',
            neighborhood: found.customer.address.neighborhood || '',
            city: found.customer.address.city || '',
            uf: found.customer.address.uf || '',
          });
        }
      } else {
        setOs(null);
      }
    }).catch(() => {
      // Fallback to local cache
      const savedList = localStorage.getItem('os_list');
      if (savedList) {
        const osList = JSON.parse(savedList);
        const found = osList.find((item: OSData) => item.os_info.number.toString() === trackingId);
        setOs(found ?? null);
      } else {
        setOs(null);
      }
    }).finally(() => setLoading(false));
  }, [trackingId, id]);

  const handleRegSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!os) return;

    const updatedOS: OSData = {
      ...os,
      customer: {
        ...os.customer,
        cpf_cnpj: regData.cpf_cnpj,
        email: regData.email,
        address: {
          ...os.customer.address,
          cep: regData.cep,
          street: regData.street,
          number: regData.number,
          complement: regData.complement,
          neighborhood: regData.neighborhood,
          city: regData.city,
          uf: regData.uf
        }
      }
    };

    // Persist customer data to PostgreSQL
    if (updatedOS.customer.id) {
      updateCustomer(updatedOS.customer.id, {
        cpf_cnpj: updatedOS.customer.cpf_cnpj || undefined,
        email: updatedOS.customer.email || undefined,
        cep: updatedOS.customer.address.cep || undefined,
        address_street: updatedOS.customer.address.street || undefined,
        address_number: updatedOS.customer.address.number || undefined,
        address_comp: updatedOS.customer.address.complement || undefined,
        neighborhood: updatedOS.customer.address.neighborhood || undefined,
        city: updatedOS.customer.address.city || undefined,
        uf: updatedOS.customer.address.uf || undefined,
      }).catch(err => console.error('Erro ao atualizar cliente:', err));
    }

    // Update local cache
    const savedList = localStorage.getItem('os_list');
    if (savedList) {
      const osList = JSON.parse(savedList);
      const index = osList.findIndex((item: OSData) => item.os_info.number === os.os_info.number);
      if (index >= 0) {
        osList[index] = updatedOS;
        localStorage.setItem('os_list', JSON.stringify(osList));
      }
    }

    setOs(updatedOS);
    setIsRegistering(false);

    // Trigger Webhook if enabled
    if (settings.webhooks.enabled && settings.webhooks.url && settings.webhooks.on_update) {
      fetch('/api/webhook-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: settings.webhooks.url,
          data: {
            event: 'os.updated',
            source: 'customer_registration',
            timestamp: new Date().toISOString(),
            data: updatedOS
          }
        })
      }).catch(err => console.error('Webhook error:', err));
    }
  };

  const handleCEPBlur = async () => {
    const cep = regData.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const result = await response.json();
        if (!result.erro) {
          setRegData(prev => ({
            ...prev,
            street: result.logradouro,
            neighborhood: result.bairro,
            city: result.localidade,
            uf: result.uf
          }));
        }
      } catch (e) {
        console.error('CEP fetch failed', e);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-deep flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-brand/20 border-t-brand rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Localizando sua Ordem de Serviço...</p>
      </div>
    );
  }

  if (!os) {
    return (
      <div className="min-h-screen bg-bg-deep flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={40} />
        </div>
        <h2 className="text-2xl font-black mb-2">OS não encontrada</h2>
        <p className="text-gray-500 mb-8 max-w-xs">Não conseguimos localizar uma Ordem de Serviço com o identificador #{trackingId}. Verifique o link e tente novamente.</p>
        <button 
          onClick={() => navigate('/')}
          className="px-8 py-4 bg-brand text-white rounded-2xl font-black text-sm shadow-xl shadow-brand/20"
        >
          Voltar para o Início
        </button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRONTO': return 'text-success bg-success/10';
      case 'ENTREGUE': return 'text-gray-400 bg-white/5';
      case 'AUTORIZADO': return 'text-brand bg-brand/10';
      default: return 'text-warning bg-warning/10';
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep text-text-soft flex flex-col">
      {/* Header Branding */}
      <header className="p-6 bg-bg-card border-b border-border-soft flex items-center justify-between sticky top-0 z-10 backdrop-blur-md bg-bg-card/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 shadow-lg">
            {settings.company.logo ? (
              <img src={settings.company.logo} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-brand rounded-lg" />
            )}
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-widest">{settings.company.name}</h1>
            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-[0.2em]">Acompanhamento de OS</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/')}
          className="p-2 hover:bg-white/5 rounded-full transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-6 space-y-6">
        {isRegistering ? (
          <motion.section 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bg-card rounded-[40px] p-8 border border-border-soft shadow-2xl"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand/10 text-brand rounded-2xl flex items-center justify-center mx-auto mb-4">
                <User size={32} />
              </div>
              <h2 className="text-2xl font-black mb-2">Bem-vindo, {os.customer.name}!</h2>
              <p className="text-gray-500 text-sm font-medium">Para sua segurança e emissão da garantia, complete seu cadastro abaixo para visualizar sua Ordem de Serviço.</p>
            </div>

            <form onSubmit={handleRegSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">CPF / CNPJ</label>
                  <input 
                    required
                    className="w-full bg-bg-deep border border-border-soft rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                    value={regData.cpf_cnpj}
                    onChange={e => setRegData({...regData, cpf_cnpj: e.target.value})}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">E-mail</label>
                  <input 
                    required
                    type="email"
                    className="w-full bg-bg-deep border border-border-soft rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                    value={regData.email}
                    onChange={e => setRegData({...regData, email: e.target.value})}
                    placeholder="seu@email.com"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border-soft">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">CEP</label>
                    <input 
                      required
                      className="w-full bg-bg-deep border border-border-soft rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                      value={regData.cep}
                      onChange={e => setRegData({...regData, cep: e.target.value})}
                      onBlur={handleCEPBlur}
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Rua / Logradouro</label>
                    <input 
                      required
                      className="w-full bg-bg-deep border border-border-soft rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                      value={regData.street}
                      onChange={e => setRegData({...regData, street: e.target.value})}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Número</label>
                    <input 
                      required
                      className="w-full bg-bg-deep border border-border-soft rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                      value={regData.number}
                      onChange={e => setRegData({...regData, number: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Bairro</label>
                    <input 
                      required
                      className="w-full bg-bg-deep border border-border-soft rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-brand transition-all"
                      value={regData.neighborhood}
                      onChange={e => setRegData({...regData, neighborhood: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-4 bg-brand text-white rounded-2xl font-black text-sm shadow-xl shadow-brand/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
              >
                Concluir Cadastro e Ver Status
              </button>
            </form>
          </motion.section>
        ) : (
          <>
            {/* Status Hero */}
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-bg-card rounded-[40px] p-8 border border-border-soft shadow-2xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-brand" />
              <div className="flex flex-col items-center gap-4">
                <div className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em]", getStatusColor(os.status))}>
                  {os.status}
                </div>
                <h2 className="text-4xl font-black">#{os.os_info.number}</h2>
                <p className="text-gray-500 font-medium">Previsão de Entrega: <span className="text-text-soft font-bold">{os.os_info.eta || 'A definir'}</span></p>
              </div>
            </motion.section>

            {/* Progress Steps */}
            <section className="bg-bg-card rounded-3xl p-6 border border-border-soft shadow-xl">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-8">Linha do Tempo</h3>
              <div className="space-y-8 relative">
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border-soft" />
                
                <TimelineStep 
                  icon={<Calendar size={14} />} 
                  label="OS Aberta" 
                  date={os.os_info.date_created} 
                  completed 
                />
                <TimelineStep 
                  icon={<CheckCircle2 size={14} />} 
                  label="Em Análise / Autorizado" 
                  date={os.status !== 'AGUARDANDO AUTORIZAC.' ? 'Concluído' : 'Pendente'} 
                  completed={os.status !== 'AGUARDANDO AUTORIZAC.'} 
                />
                <TimelineStep 
                  icon={<Clock size={14} />} 
                  label="Serviço Concluído" 
                  date={os.status === 'PRONTO' || os.status === 'ENTREGUE' ? 'Concluído' : 'Em andamento'} 
                  completed={os.status === 'PRONTO' || os.status === 'ENTREGUE'} 
                />
                <TimelineStep 
                  icon={<Package size={14} />} 
                  label="Disponível para Retirada" 
                  date={os.status === 'PRONTO' ? 'Sim' : 'Aguardando'} 
                  completed={os.status === 'PRONTO'} 
                />
              </div>
            </section>

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-bg-card rounded-3xl p-6 border border-border-soft shadow-xl">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-4">Informações</h3>
                <div className="space-y-4">
                  <DetailItem icon={<User size={14} />} label="Cliente" value={os.customer.name} />
                  <DetailItem icon={<MessageSquare size={14} />} label="E-mail" value={os.customer.email || 'Não informado'} />
                  <DetailItem icon={<Package size={14} />} label="Produto" value={os.product.name} />
                  <DetailItem icon={<MessageSquare size={14} />} label="Serviço" value={os.product.service} />
                </div>
              </section>

              <section className="bg-bg-card rounded-3xl p-6 border border-border-soft shadow-xl">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-4">Local de Retirada</h3>
                <div className="space-y-4">
                  <DetailItem icon={<MapPin size={14} />} label="Endereço" value={settings.company.address} />
                  <DetailItem icon={<Clock size={14} />} label="Horário" value="Seg a Sex: 09h às 18h" />
                </div>
              </section>
            </div>

            {/* Product Photos */}
            {(os.images?.front || os.images?.back) && (
              <section className="bg-bg-card rounded-3xl p-6 border border-border-soft shadow-xl mt-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-4">Fotos do Produto</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {os.images.front && (
                    <div className="rounded-xl overflow-hidden border border-border-soft aspect-video">
                      <img src={os.images.front} alt="Frente" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {os.images.back && (
                    <div className="rounded-xl overflow-hidden border border-border-soft aspect-video">
                      <img src={os.images.back} alt="Fundo" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Footer Action */}
            <div className="pt-8 text-center">
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-4">Dúvidas sobre sua OS?</p>
              <button 
                onClick={() => window.open(`https://wa.me/55${settings.company.phone.replace(/\D/g, '')}`, '_blank')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#25D366]/10 text-[#25D366] rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#25D366]/20 transition-all border border-[#25D366]/20"
              >
                Falar com Atendimento
              </button>
            </div>
          </>
        )}
      </main>

      <footer className="p-8 text-center opacity-40">
        <p className="text-[10px] font-bold uppercase tracking-widest">© 2026 {settings.company.name} • Todos os direitos reservados</p>
      </footer>
    </div>
  );
}

function TimelineStep({ icon, label, date, completed }: { icon: React.ReactNode, label: string, date: string, completed: boolean }) {
  return (
    <div className="flex items-start gap-4 relative z-10">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
        completed ? "bg-brand border-brand text-white shadow-lg shadow-brand/20" : "bg-bg-deep border-border-soft text-gray-600"
      )}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className={cn("text-sm font-black", completed ? "text-text-soft" : "text-gray-500")}>{label}</span>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{date}</span>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-brand mt-0.5">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
        <span className="text-sm font-bold">{value}</span>
      </div>
    </div>
  );
}
