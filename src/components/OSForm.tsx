import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Save, 
  Search, 
  Printer, 
  LogOut, 
  Camera, 
  CheckCircle2, 
  Clock, 
  User, 
  Package, 
  Wrench, 
  CreditCard,
  Info,
  Cloud,
  CloudCheck,
  AlertCircle,
  X,
  RefreshCw,
  Trash2,
  Maximize2,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Webcam from 'react-webcam';
import { OSData, initialOSData, SettingsData, initialSettingsData } from '../types';
import { getSettings, getTechnicians, getSellers, upsertCustomer, upsertServiceOrder, osDataToRow } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function OSForm() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<OSData>(initialOSData);
  const [settings, setSettings] = useState<SettingsData>(initialSettingsData);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeImageSlot, setActiveImageSlot] = useState<'front' | 'back' | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [shareError, setShareError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const webcamRef = useRef<Webcam>(null);

  const isFieldVisible = (id: string) => {
    return settings.fields?.find(f => f.id === id)?.enabled ?? true;
  };

  const isFieldRequired = (id: string) => {
    return settings.fields?.find(f => f.id === id)?.required ?? false;
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // Load settings from API (fallback to localStorage for offline support)
    getSettings().then(remoteSettings => {
      if (remoteSettings.company || remoteSettings.workflow) {
        setSettings(prev => ({
          ...prev,
          ...remoteSettings,
          company: { ...initialSettingsData.company, ...(remoteSettings.company as any) },
          workflow: { ...initialSettingsData.workflow, ...(remoteSettings.workflow as any) },
          webhooks: { ...initialSettingsData.webhooks, ...(remoteSettings.webhooks as any) },
        }));
        localStorage.setItem('app_settings', JSON.stringify({ ...remoteSettings }));
      }
    }).catch(() => {
      const saved = localStorage.getItem('app_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({
          ...prev,
          ...parsed,
          company: { ...initialSettingsData.company, ...parsed.company },
          team: { ...initialSettingsData.team, ...parsed.team },
          webhooks: { ...initialSettingsData.webhooks, ...parsed.webhooks },
          fields: initialSettingsData.fields.map(initialField => {
            const savedField = parsed.fields?.find((f: any) => f.id === initialField.id);
            return savedField ? { ...initialField, ...savedField } : initialField;
          }),
        }));
      }
    });

    // Load current OS if editing
    const currentOS = localStorage.getItem('current_os');
    if (currentOS) {
      const parsedOS = JSON.parse(currentOS);
      setData(parsedOS);
    } else if (data.os_info.number === 0) {
      const nextNumber = Math.floor(Math.random() * 90000) + 10000;
      setData(prev => ({
        ...prev,
        os_info: { ...prev.os_info, number: nextNumber }
      }));
    }
  }, []);

  // Auto-calculate balance
  useEffect(() => {
    setData(prev => ({
      ...prev,
      billing: {
        ...prev.billing,
        balance: prev.billing.total - prev.billing.deposit
      }
    }));
  }, [data.billing.total, data.billing.deposit]);

  const handleInputChange = (section: keyof OSData, field: string, value: any) => {
    setData(prev => {
      if (typeof prev[section] === 'string') {
        return { ...prev, [section]: value };
      }
      return {
        ...prev,
        [section]: {
          ...(prev[section] as any),
          [field]: value
        }
      };
    });
  };

  const handleCustomerChange = (field: string, value: any) => {
    setData(prev => ({
      ...prev,
      customer: {
        ...prev.customer,
        [field]: value
      }
    }));
  };

  const handleAddressChange = (field: string, value: any) => {
    setData(prev => ({
      ...prev,
      customer: {
        ...prev.customer,
        address: {
          ...prev.customer.address,
          [field]: value
        }
      }
    }));
  };

  const handleMaskedInput = (value: string, maskType: 'phone' | 'cpf' | 'cep' | 'currency') => {
    let digits = value.replace(/\D/g, '');
    
    if (maskType === 'phone') {
      if (digits.length > 11) digits = digits.slice(0, 11);
      if (digits.length > 10) {
        return digits.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      } else if (digits.length > 6) {
        return digits.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
      } else if (digits.length > 2) {
        return digits.replace(/^(\d{2})(\d{0,4})/, '($1) $2');
      } else if (digits.length > 0) {
        return digits.replace(/^(\d*)/, '($1');
      }
      return digits;
    } else if (maskType === 'cpf') {
      if (digits.length > 14) digits = digits.slice(0, 14);
      if (digits.length > 11) { // CNPJ
        return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      }
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else if (maskType === 'cep') {
      if (digits.length > 8) digits = digits.slice(0, 8);
      return digits.replace(/^(\d{5})(\d)/, '$1-$2');
    }
    return digits;
  };

  const validate = () => {
    const newErrors: string[] = [];
    
    if (isFieldRequired('customer_name') && !data.customer.name) newErrors.push('customer.name');
    if (isFieldRequired('customer_email') && !data.customer.email) newErrors.push('customer.email');
    if (isFieldRequired('customer_phone') && !data.customer.contact.main) newErrors.push('customer.contact.main');
    if (isFieldRequired('product_name') && !data.product.name) newErrors.push('product.name');
    if (isFieldRequired('product_service') && !data.product.service) newErrors.push('product.service');
    if (isFieldRequired('customer_address') && !data.customer.address.street) newErrors.push('customer.address.street');
    if (isFieldRequired('customer_address') && !data.customer.address.neighborhood) newErrors.push('customer.address.neighborhood');
    if (isFieldRequired('customer_address') && !data.customer.address.city) newErrors.push('customer.address.city');
    if (isFieldRequired('customer_address') && !data.customer.address.uf) newErrors.push('customer.address.uf');
    if (isFieldRequired('billing_vendedor') && !data.billing.vendedor) newErrors.push('billing.vendedor');
    if (isFieldRequired('billing_total') && !data.billing.total) newErrors.push('billing.total');
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc && activeImageSlot) {
      setData(prev => ({
        ...prev,
        images: {
          ...prev.images,
          [activeImageSlot]: imageSrc
        }
      }));
      setIsCameraOpen(false);
      setActiveImageSlot(null);
    }
  }, [webcamRef, activeImageSlot]);

  const handleSave = async () => {
    if (!validate()) return;

    setSaveError(null);
    setIsSyncing(true);
    
    // Ensure we have a valid number before saving
    let currentNumber = data.os_info.number;
    if (currentNumber === 0) {
      currentNumber = Math.floor(Math.random() * 90000) + 10000;
    }

    const updatedData: OSData = {
      ...data,
      os_info: { 
        ...data.os_info, 
        number: currentNumber,
        synced: true 
      }
    };

    // Persist to PostgreSQL via PostgREST
    try {
      // 1. Upsert customer
      const [techList, sellerList] = await Promise.all([getTechnicians(), getSellers()]);
      const techId = techList.find(t => t.name === updatedData.screening.technician)?.id ?? null;
      const sellerId = sellerList.find(s => s.name === updatedData.billing.vendedor)?.id ?? null;

      const customerRow = await upsertCustomer({
        id: updatedData.customer.id > 0 ? updatedData.customer.id : undefined,
        name: updatedData.customer.name,
        cpf_cnpj: updatedData.customer.cpf_cnpj || undefined,
        email: updatedData.customer.email || undefined,
        phone: updatedData.customer.contact.main || undefined,
        wpp_auth: updatedData.customer.contact.wpp_auth,
        type: updatedData.customer.type,
        cep: updatedData.customer.address.cep || undefined,
        address_street: updatedData.customer.address.street || undefined,
        address_number: updatedData.customer.address.number || undefined,
        address_comp: updatedData.customer.address.complement || undefined,
        neighborhood: updatedData.customer.address.neighborhood || undefined,
        city: updatedData.customer.address.city || undefined,
        uf: updatedData.customer.address.uf || undefined,
      });

      // 2. Upsert service order
      const row = osDataToRow(updatedData, customerRow.id!, techId, sellerId);
      await upsertServiceOrder(row);

      // 3. Update local cache for OSList
      const savedList = localStorage.getItem('os_list');
      const osList: OSData[] = savedList ? JSON.parse(savedList) : [];
      const existingIndex = osList.findIndex(os => os.os_info.number === updatedData.os_info.number);
      const isUpdate = existingIndex >= 0;
      if (isUpdate) osList[existingIndex] = updatedData; else osList.unshift(updatedData);
      localStorage.setItem('os_list', JSON.stringify(osList));

      // 4. Webhook — fire-and-forget, never blocks or propagates errors
      if (settings.webhooks.enabled && settings.webhooks.url) {
        const shouldTrigger = (isUpdate && settings.webhooks.on_update) || (!isUpdate && settings.webhooks.on_create);
        if (shouldTrigger) {
          fetch('/api/webhook-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: settings.webhooks.url,
              data: { event: isUpdate ? 'os.updated' : 'os.created', timestamp: new Date().toISOString(), data: updatedData },
            }),
          }).catch(err => console.error('Webhook failed silently:', err));
        }
      }

      setData(updatedData);
      localStorage.setItem('current_os', JSON.stringify(updatedData));
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Erro ao salvar OS no banco:', err);
      const message = err instanceof Error ? err.message : String(err);
      setSaveError(`Erro ao salvar: ${message}`);
    }

    setIsSyncing(false);
  };

  const handleWhatsAppShare = () => {
    setShareError(null);
    const phone = data.customer.contact.main.replace(/\D/g, '');
    if (!phone) {
      setShareError('Número de telefone não informado.');
      setTimeout(() => setShareError(null), 3000);
      return;
    }

    const message = encodeURIComponent(
      `Olá ${data.customer.name}! Sua Ordem de Serviço #${data.os_info.number} foi registrada na ${settings.company.name}.\n\n` +
      `Produto: ${data.product.name}\n` +
      `Status: ${data.status}\n\n` +
      `Você pode acompanhar o status da sua OS através deste link: ${window.location.origin}/track/${data.os_info.number}`
    );

    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  };

  const handlePrint = () => {
    localStorage.setItem('current_os', JSON.stringify(data));
    window.open('/print', '_blank');
  };

  const handleCEPBlur = async () => {
    const cep = data.customer.address.cep.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const result = await response.json();
        if (!result.erro) {
          setData(prev => ({
            ...prev,
            customer: {
              ...prev.customer,
              address: {
                ...prev.customer.address,
                street: result.logradouro,
                neighborhood: result.bairro,
                city: result.localidade,
                uf: result.uf
              }
            }
          }));
        }
      } catch (e) {
        console.error('CEP fetch failed', e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-bg-deep text-text-soft p-4 lg:p-6 flex flex-col gap-6">
      {/* Top Action Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-bg-card/80 p-3 rounded-2xl border border-border-soft backdrop-blur-md sticky top-0 z-40 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-brand/20 overflow-hidden p-1">
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
            <h1 className="text-sm font-black tracking-widest uppercase hidden sm:block">{settings.company.name}</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">Sistema de OS</span>
              {data.os_info.synced && (
                <div className="flex items-center gap-1 text-[10px] text-success font-bold bg-success/10 px-2 py-0.5 rounded-full">
                  <CloudCheck size={10} />
                  Sincronizado com CRM
                </div>
              )}
            </div>
          </div>
        </div>
        
        <nav className="flex items-center gap-1 sm:gap-2">
          <ActionButton icon={<ArrowLeft size={18} />} label="Voltar" onClick={() => navigate('/')} />
          <ActionButton icon={<Plus size={18} />} label="Incluir" onClick={() => {
            localStorage.removeItem('current_os');
            const nextNumber = Math.floor(Math.random() * 90000) + 10000;
            setData({
              ...initialOSData,
              os_info: {
                ...initialOSData.os_info,
                number: nextNumber,
                date_created: new Date().toLocaleDateString('pt-BR')
              }
            });
          }} />
          <ActionButton icon={<Search size={18} />} label="Pesquisar" shortcut="F6" onClick={() => navigate('/search')} />
          <ActionButton icon={<Printer size={18} />} label="Imprimir" shortcut="F7" onClick={handlePrint} />
          <div className="w-px h-8 bg-border-soft mx-1" />
          <ActionButton 
            icon={isSyncing ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} 
            label={isSyncing ? "Gravando..." : "Gravar OS"} 
            shortcut="F5" 
            variant="primary" 
            onClick={handleSave}
            disabled={isSyncing}
          />
          <ActionButton icon={<LogOut size={18} />} label="Fechar" shortcut="Ctrl+X" onClick={() => navigate('/')} />
        </nav>
      </header>

      {saveError && (
        <div className="mb-4 bg-error/10 border border-error/20 p-3 rounded-xl flex items-center gap-3 text-error text-[10px] font-black uppercase tracking-widest">
          <AlertCircle size={16} />
          {saveError}
        </div>
      )}

      <main className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          
          {/* Card #1: OS Header */}
          <section className="bg-bg-card rounded-3xl p-6 border border-border-soft relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-black text-gray-500 uppercase tracking-[0.3em]">Número da OS</span>
                <h2 className="text-4xl font-black text-brand drop-shadow-[0_0_15px_rgba(255,102,0,0.3)]">#{data.os_info.number}</h2>
              </div>
              <div className="flex flex-wrap gap-8">
                <InfoItem label="Data Emissão" value={data.os_info.date_created} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Previsão Entrega</label>
                  <input 
                    type="date" 
                    className="bg-bg-deep border border-border-soft rounded-xl px-3 py-1.5 text-sm font-bold text-brand focus:outline-none focus:border-brand transition-colors"
                    value={data.os_info.eta}
                    onChange={(e) => handleInputChange('os_info', 'eta', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Card #2: Customer Data */}
          <section className="bg-bg-card rounded-3xl p-6 border border-border-soft flex flex-col gap-8 shadow-xl">
            <SectionHeader icon={<User className="text-brand" size={20} />} title="Dados do Cliente" />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
                {isFieldVisible('customer_name') && (
                  <div className="sm:col-span-2">
                    <InputGroup 
                      label="Nome Completo" 
                      value={data.customer.name} 
                      onChange={(val) => handleCustomerChange('name', val)}
                      required={isFieldRequired('customer_name')}
                      error={errors.includes('customer.name')}
                    />
                  </div>
                )}
                {isFieldVisible('customer_cpf') && (
                  <InputGroup 
                    label="CPF / CNPJ" 
                    value={data.customer.cpf_cnpj} 
                    onChange={(val) => handleCustomerChange('cpf_cnpj', handleMaskedInput(val, 'cpf'))}
                    required={isFieldRequired('customer_cpf')}
                  />
                )}
                {isFieldVisible('customer_email') && (
                  <InputGroup 
                    label="E-mail" 
                    value={data.customer.email} 
                    onChange={(val) => handleCustomerChange('email', val)}
                    required={isFieldRequired('customer_email')}
                    error={errors.includes('customer.email')}
                  />
                )}
                {isFieldVisible('customer_phone') && (
                  <div className="space-y-2">
                    <InputGroup 
                      label="Celular" 
                      value={data.customer.contact.main} 
                      onChange={(val) => handleCustomerChange('contact', { ...data.customer.contact, main: handleMaskedInput(val, 'phone') })}
                      required={isFieldRequired('customer_phone')}
                      error={errors.includes('customer.contact.main')}
                    />
                    <label className="flex items-center gap-2 cursor-pointer group w-fit">
                      <input 
                        type="checkbox" 
                        checked={data.customer.contact.wpp_auth} 
                        onChange={(e) => handleCustomerChange('contact', { ...data.customer.contact, wpp_auth: e.target.checked })}
                        className="accent-brand w-4 h-4 rounded-md"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-brand transition-colors">Autorizar WhatsApp</span>
                    </label>
                  </div>
                )}
              </div>
              
              <div className="bg-bg-deep/50 p-5 rounded-2xl border border-border-soft flex flex-col gap-4">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tipo de Cliente</p>
                <div className="flex flex-col gap-3">
                  <RadioButton 
                    label="CONSUMIDOR FINAL" 
                    checked={data.customer.type === 'CONSUMIDOR FINAL'} 
                    onClick={() => handleCustomerChange('type', 'CONSUMIDOR FINAL')}
                  />
                  <RadioButton 
                    label="RELOJOARIA" 
                    checked={data.customer.type === 'RELOJOARIA'} 
                    onClick={() => handleCustomerChange('type', 'RELOJOARIA')}
                  />
                </div>
              </div>
            </div>

            {isFieldVisible('customer_address') && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5 pt-4 border-t border-border-soft/50">
                {isFieldVisible('customer_cep') && (
                  <InputGroup 
                    label="CEP" 
                    value={data.customer.address.cep} 
                    onChange={(val) => handleAddressChange('cep', handleMaskedInput(val, 'cep'))}
                    onBlur={handleCEPBlur}
                    required={isFieldRequired('customer_cep')}
                  />
                )}
                <div className="col-span-2 md:col-span-3">
                  <InputGroup 
                    label="Logradouro" 
                    value={data.customer.address.street} 
                    onChange={(val) => handleAddressChange('street', val)} 
                    required={isFieldRequired('customer_address')}
                    error={errors.includes('customer.address.street')}
                  />
                </div>
                <InputGroup label="Número" value={data.customer.address.number} onChange={(val) => handleAddressChange('number', val)} />
                <InputGroup label="Complemento" value={data.customer.address.complement} onChange={(val) => handleAddressChange('complement', val)} />
                <InputGroup 
                  label="Bairro" 
                  value={data.customer.address.neighborhood} 
                  onChange={(val) => handleAddressChange('neighborhood', val)} 
                  required={isFieldRequired('customer_address')}
                  error={errors.includes('customer.address.neighborhood')}
                />
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <InputGroup 
                      label="Cidade" 
                      value={data.customer.address.city} 
                      onChange={(val) => handleAddressChange('city', val)} 
                      required={isFieldRequired('customer_address')}
                      error={errors.includes('customer.address.city')}
                    />
                  </div>
                  <div>
                    <InputGroup 
                      label="UF" 
                      value={data.customer.address.uf} 
                      onChange={(val) => handleAddressChange('uf', val.toUpperCase())} 
                      required={isFieldRequired('customer_address')}
                      error={errors.includes('customer.address.uf')}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Card #3: Product Data */}
          <section className="bg-bg-card rounded-3xl p-6 border border-border-soft flex flex-col gap-8 shadow-xl">
            <SectionHeader icon={<Package className="text-brand" size={20} />} title="Dados do Produto" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5">
                {isFieldVisible('product_name') && (
                  <InputGroup 
                    label="Descrição do Produto" 
                    value={data.product.name} 
                    onChange={(val) => handleInputChange('product', 'name', val)}
                    multiline
                    required={isFieldRequired('product_name')}
                    error={errors.includes('product.name')}
                  />
                )}
                {isFieldVisible('product_service') && (
                  <InputGroup 
                    label="Serviço a ser executado" 
                    value={data.product.service} 
                    onChange={(val) => handleInputChange('product', 'service', val)}
                    multiline
                    required={isFieldRequired('product_service')}
                    error={errors.includes('product.service')}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-6">
                {isFieldVisible('product_type') && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tipo de Relógio</p>
                    <div className="flex flex-col gap-3">
                      {["Pulso com Bateria", "Pulso Automático", "Parede / Mesa", "Outros"].map(type => (
                        <RadioButton 
                          key={type} 
                          label={type} 
                          checked={data.product.type === type} 
                          onClick={() => handleInputChange('product', 'type', type)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {isFieldVisible('product_delivery') && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Forma Entrega</p>
                      <div className="flex flex-col gap-3">
                        {["Na Loja", "Motoboy"].map(delivery => (
                          <RadioButton 
                            key={delivery} 
                            label={delivery} 
                            checked={data.product.delivery === delivery} 
                            onClick={() => handleInputChange('product', 'delivery', delivery)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Card #4: Technical Observations (Moved from footer) */}
          <section className="bg-bg-card rounded-3xl p-6 border border-border-soft shadow-xl">
            <SectionHeader icon={<Info className="text-brand" size={20} />} title="Observações Técnicas" />
            <textarea 
              className="w-full h-24 bg-bg-deep border border-border-soft rounded-2xl p-4 mt-4 text-sm font-medium focus:outline-none focus:border-brand transition-all resize-none"
              placeholder="Detalhes adicionais sobre o estado do relógio ou serviço..."
              value={data.observations}
              onChange={(e) => handleInputChange('observations', '', e.target.value)}
            />
          </section>
        </div>

        {/* Right Column */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          
          {/* Card #5: Screening & Assignment */}
          <section className="bg-bg-card rounded-3xl p-6 border border-border-soft flex flex-col gap-6 shadow-xl">
            <SectionHeader icon={<Wrench className="text-brand" size={20} />} title="Triagem e Atribuição" />
            
            <div className="grid grid-cols-2 gap-8">
              {isFieldVisible('screening_damages') && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Avarias</p>
                  <div className="flex flex-col gap-2.5">
                    {["BOTÕES", "CAIXA", "COROA", "FUNDO", "FUNCIONAMENTO", "MOSTRADOR", "PULSEIRA", "VIDRO"].map(item => (
                      <CheckboxItem 
                        key={item} 
                        label={item} 
                        checked={data.screening.damages.includes(item)}
                        onChange={(checked) => {
                          const newDamages = checked 
                            ? [...data.screening.damages, item]
                            : data.screening.damages.filter(d => d !== item);
                          handleInputChange('screening', 'damages', newDamages);
                        }}
                      />
                    ))}
                    <div className="pt-2">
                      <input 
                        type="text" 
                        placeholder="Outros..."
                        className="w-full bg-bg-deep border border-border-soft rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand"
                        value={data.screening.other_damages}
                        onChange={(e) => handleInputChange('screening', 'other_damages', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
              {isFieldVisible('screening_tech') && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Local do Conserto</p>
                  <div className="flex flex-col gap-3">
                    {settings.team.technicians.map(tech => (
                      <RadioButton 
                        key={tech} 
                        label={tech} 
                        checked={data.screening.technician === tech} 
                        onClick={() => handleInputChange('screening', 'technician', tech)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Card #6: Registro Visual */}
          <section className="bg-bg-card rounded-3xl p-5 border border-border-soft flex flex-col gap-5 shadow-xl">
            <SectionHeader icon={<Camera className="text-brand" size={18} />} title="Registro Visual" />
            
            <div className="grid grid-cols-2 gap-3">
              <ImageSlot 
                label="FRENTE" 
                image={data.images.front} 
                onCapture={() => { setActiveImageSlot('front'); setIsCameraOpen(true); }}
                onClear={() => setData(prev => ({ ...prev, images: { ...prev.images, front: null } }))}
              />
              <ImageSlot 
                label="FUNDO" 
                image={data.images.back} 
                onCapture={() => { setActiveImageSlot('back'); setIsCameraOpen(true); }}
                onClear={() => setData(prev => ({ ...prev, images: { ...prev.images, back: null } }))}
              />
            </div>
            
            <button 
              onClick={() => { setActiveImageSlot('front'); setIsCameraOpen(true); }}
              className="w-full py-2.5 bg-bg-deep border border-dashed border-brand/30 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-gray-500 hover:border-brand/60 hover:text-brand transition-all group"
            >
              <Camera size={14} className="group-hover:scale-110 transition-transform" />
              Ativar Câmera (F8)
            </button>
          </section>

          {/* Card #7: Financeiro (Compact) */}
          <section className="bg-brand rounded-3xl p-5 shadow-2xl shadow-brand/30 flex flex-col gap-5 text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
            
            <div className="flex items-center justify-between relative z-10">
              <SectionHeader icon={<CreditCard className="text-white" size={18} />} title="Financeiro" light />
              <div className="px-2 py-0.5 bg-white/20 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-sm">
                {data.status}
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              {isFieldVisible('billing_vendedor') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest opacity-80">
                    Vendedor {isFieldRequired('billing_vendedor') && <span className="text-white">*</span>}
                  </label>
                  <select 
                    className={cn(
                      "bg-white/20 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:bg-white/30 transition-all appearance-none cursor-pointer",
                      errors.includes('billing.vendedor') && "border-white/60 ring-2 ring-white/20"
                    )}
                    value={data.billing.vendedor}
                    onChange={(e) => handleInputChange('billing', 'vendedor', e.target.value)}
                  >
                    <option value="" className="bg-bg-card">Selecione...</option>
                    {settings.team.vendedores.map(v => (
                      <option key={v} value={v} className="bg-bg-card">{v}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {isFieldVisible('billing_total') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-80">
                      Total {isFieldRequired('billing_total') && <span className="text-white">*</span>}
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black opacity-60">R$</span>
                      <input 
                        type="number" 
                        className={cn(
                          "w-full bg-white/20 border border-white/10 rounded-xl pl-6 pr-2 py-1.5 text-xs font-black focus:outline-none focus:bg-white/30 transition-all",
                          errors.includes('billing.total') && "border-white/60 ring-2 ring-white/20"
                        )}
                        value={data.billing.total || ''}
                        onChange={(e) => handleInputChange('billing', 'total', Number(e.target.value))}
                      />
                    </div>
                  </div>
                )}
                {isFieldVisible('billing_deposit') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black uppercase tracking-widest opacity-80">
                      Sinal {isFieldRequired('billing_deposit') && <span className="text-white">*</span>}
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-black opacity-60">R$</span>
                      <input 
                        type="number" 
                        className="w-full bg-white/20 border border-white/10 rounded-xl pl-6 pr-2 py-1.5 text-xs font-black focus:outline-none focus:bg-white/30 transition-all"
                        value={data.billing.deposit || ''}
                        onChange={(e) => handleInputChange('billing', 'deposit', Number(e.target.value))}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm border border-white/20 flex items-center justify-between">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-80">A Pagar</label>
                <p className="text-lg font-black">R$ {data.billing.balance.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/20 relative z-10">
              <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Status</p>
              <div className="grid grid-cols-2 gap-2">
                {["AGUARDANDO AUTORIZAC.", "AUTORIZADO", "PRONTO", "ENTREGUE"].map(s => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer group">
                    <div 
                      onClick={() => setData(prev => ({ ...prev, status: s as any }))}
                      className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                        data.status === s ? "bg-white border-white" : "border-white/40 group-hover:border-white"
                      )}
                    >
                      {data.status === s && <div className="w-1.5 h-1.5 bg-brand rounded-full" />}
                    </div>
                    <span className={cn("text-[9px] font-black transition-colors", data.status === s ? "text-white" : "text-white/60 group-hover:text-white")}>{s}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* Card #8: Entrega Final (Moved from footer) */}
          <section className="bg-bg-card rounded-3xl p-5 border border-border-soft shadow-xl flex flex-col gap-4">
            <SectionHeader icon={<Clock className="text-brand" size={18} />} title="Entrega Final" />
            <div className="grid grid-cols-2 gap-3">
              <InputGroup label="Data Entrega" value="" disabled />
              <InputGroup label="Vendedor" value="" disabled />
            </div>
          </section>
        </div>
      </main>

      {/* Removed Footer - Sections moved into columns */}
      <div className="h-4" /> {/* Bottom spacing */}

      {/* Camera Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-bg-card w-full max-w-2xl rounded-3xl border border-border-soft overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-bottom border-border-soft flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Camera className="text-brand" size={18} />
                  Capturar Foto: {activeImageSlot === 'front' ? 'Frente' : 'Fundo'}
                </h3>
                <button onClick={() => setIsCameraOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="aspect-video bg-black relative">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full h-full object-cover"
                  videoConstraints={{ facingMode: "environment" }}
                  mirrored={false}
                  imageSmoothing={true}
                  forceScreenshotSourceSize={false}
                  disablePictureInPicture={true}
                  onUserMedia={() => {}}
                  onUserMediaError={() => {}}
                  screenshotQuality={0.92}
                />
                <div className="absolute inset-0 border-2 border-brand/20 pointer-events-none" />
              </div>
              
              <div className="p-6 flex items-center justify-center gap-4">
                <button 
                  onClick={() => setIsCameraOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={capture}
                  className="px-8 py-2.5 bg-brand rounded-xl font-black text-sm text-white shadow-lg shadow-brand/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Capturar Imagem
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-bg-card w-full max-w-md rounded-[40px] border border-border-soft p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              
              <h3 className="text-2xl font-black mb-2">OS #{data.os_info.number} Gravada!</h3>
              <p className="text-gray-500 font-medium mb-8">O que você deseja fazer agora?</p>
              
              {shareError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-error/10 border border-error/20 p-3 rounded-xl flex items-center gap-3 text-error text-[10px] font-black uppercase tracking-widest mb-4"
                >
                  <AlertCircle size={16} />
                  {shareError}
                </motion.div>
              )}

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleWhatsAppShare}
                  className="w-full py-4 bg-[#25D366] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:scale-[1.02] transition-all shadow-lg shadow-green-500/20"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Enviar para WhatsApp
                </button>
                <button 
                  onClick={handlePrint}
                  className="w-full py-4 bg-bg-deep border border-border-soft rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-white/5 transition-all"
                >
                  <Printer size={20} />
                  Imprimir OS
                </button>
                <button 
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/');
                  }}
                  className="w-full py-4 text-gray-500 font-bold text-sm hover:text-text-soft transition-colors"
                >
                  Voltar para o Início
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper Components
function ActionButton({ icon, label, shortcut, variant = 'secondary', onClick, disabled = false }: { icon: React.ReactNode, label: string, shortcut?: string, variant?: 'primary' | 'secondary', onClick?: () => void, disabled?: boolean }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center justify-center min-w-[72px] p-2 rounded-xl transition-all group relative",
        variant === 'primary' ? "bg-brand text-white shadow-xl shadow-brand/20" : "hover:bg-white/5 text-gray-400 hover:text-text-soft",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className="mb-1 group-hover:scale-110 transition-transform">{icon}</span>
      <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
      {shortcut && <span className="text-[7px] opacity-40 font-mono mt-0.5">{shortcut}</span>}
    </button>
  );
}

function InfoItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
      <span className="text-lg font-black text-text-soft">{value}</span>
    </div>
  );
}

function SectionHeader({ icon, title, light = false }: { icon: React.ReactNode, title: string, light?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("p-2 rounded-lg", light ? "bg-white/10" : "bg-brand/10")}>{icon}</div>
      <h3 className={cn("text-xs font-black uppercase tracking-[0.25em]", light ? "text-white" : "text-gray-400")}>{title}</h3>
    </div>
  );
}

function InputGroup({ label, value, onChange, onBlur, required = false, disabled = false, multiline = false, error = false, light = false }: { label: string, value: string, onChange?: (val: string) => void, onBlur?: () => void, required?: boolean, disabled?: boolean, multiline?: boolean, error?: boolean, light?: boolean }) {
  const InputTag = multiline ? 'textarea' : 'input';
  return (
    <div className="flex flex-col gap-2">
      <label className={cn("text-[10px] font-black uppercase tracking-widest", light ? "text-white/80" : "text-gray-500")}>
        {label} {required && <span className="text-brand">*</span>}
      </label>
      <InputTag 
        value={value}
        onChange={(e: any) => onChange?.(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        className={cn(
          "w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all outline-none border",
          light 
            ? "bg-white/20 border-white/10 text-white placeholder:text-white/40 focus:bg-white/30" 
            : "bg-bg-deep border-border-soft text-text-soft focus:border-brand focus:ring-4 focus:ring-brand/10",
          error && "border-error focus:border-error focus:ring-error/10",
          disabled && "opacity-50 cursor-not-allowed",
          multiline && "h-24 resize-none"
        )}
      />
    </div>
  );
}

function RadioButton({ label, checked, onClick }: { label: string, checked: boolean, onClick: () => void, key?: any }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group w-fit" onClick={onClick}>
      <div className={cn(
        "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
        checked ? "border-brand bg-brand/10" : "border-border-soft group-hover:border-brand/40"
      )}>
        {checked && <div className="w-2 h-2 bg-brand rounded-full shadow-[0_0_10px_rgba(255,102,0,0.6)]" />}
      </div>
      <span className={cn("text-xs font-bold transition-colors", checked ? "text-text-soft" : "text-gray-500 group-hover:text-gray-300")}>{label}</span>
    </label>
  );
}

function CheckboxItem({ label, checked, onChange }: { label: string, checked: boolean, onChange: (val: boolean) => void, key?: any }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className={cn(
        "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all",
        checked ? "bg-brand border-brand" : "border-border-soft group-hover:border-brand/40"
      )}>
        <input 
          type="checkbox" 
          className="hidden" 
          checked={checked} 
          onChange={(e) => onChange(e.target.checked)} 
        />
        {checked && <CheckCircle2 size={12} className="text-white" />}
      </div>
      <span className={cn("text-xs font-bold transition-colors", checked ? "text-text-soft" : "text-gray-500 group-hover:text-gray-300")}>{label}</span>
    </label>
  );
}

function ImageSlot({ label, image, onCapture, onClear }: { label: string, image: string | null, onCapture: () => void, onClear: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-square bg-bg-deep rounded-2xl border border-border-soft overflow-hidden relative group">
        {image ? (
          <>
            <img src={image} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button onClick={onCapture} className="p-2 bg-brand rounded-lg text-white shadow-lg hover:scale-110 transition-transform">
                <RefreshCw size={18} />
              </button>
              <button onClick={onClear} className="p-2 bg-error rounded-lg text-white shadow-lg hover:scale-110 transition-transform">
                <Trash2 size={18} />
              </button>
            </div>
          </>
        ) : (
          <div 
            onClick={onCapture}
            className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/5 transition-colors"
          >
            <Camera size={24} className="text-gray-600 group-hover:text-brand transition-colors" />
            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Vazio</span>
          </div>
        )}
      </div>
      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">{label}</span>
    </div>
  );
}
