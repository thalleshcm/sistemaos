import React, { useEffect, useState } from 'react';
import { Printer, Download, Share2, ArrowLeft } from 'lucide-react';
import { OSData, SettingsData, initialSettingsData } from '../types';

export default function OSPrintView() {
  const [data, setData] = useState<OSData | null>(null);
  const [settings, setSettings] = useState<SettingsData>(initialSettingsData);

  useEffect(() => {
    const savedOS = localStorage.getItem('current_os');
    if (savedOS) {
      setData(JSON.parse(savedOS));
    }
    const savedSettings = localStorage.getItem('app_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  if (!data) return <div className="p-10 text-center">Carregando dados da OS...</div>;

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar - Hidden on Print */}
      <header className="no-print bg-bg-deep text-white p-4 flex items-center justify-between sticky top-0 z-50 shadow-xl">
        <div className="flex items-center gap-4">
          <button onClick={() => window.close()} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-sm font-black uppercase tracking-widest">Visualização de OS #{data.os_info.number}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-brand rounded-xl font-bold text-xs text-white shadow-lg shadow-brand/20">
            <Printer size={16} />
            Imprimir (Ctrl+P)
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl font-bold text-xs hover:bg-white/20 transition-colors">
            <Download size={16} />
            Baixar PDF
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl font-bold text-xs hover:bg-white/20 transition-colors">
            <Share2 size={16} />
            Compartilhar
          </button>
        </div>
      </header>

      {/* OS Document */}
      <main className="max-w-[210mm] mx-auto my-8 bg-white shadow-2xl p-[20mm] print:shadow-none print:my-0 print:p-[10mm] text-black font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white border border-gray-200 flex items-center justify-center rounded-xl p-1 overflow-hidden">
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
              <h2 className="text-2xl font-black uppercase tracking-tighter">{settings.company.name}</h2>
              <p className="text-xs font-bold text-gray-600">{settings.company.slogan}</p>
            </div>
          </div>
          <div className="text-right">
            <h3 className="text-3xl font-black text-gray-900 tracking-tighter">OS #{data.os_info.number}</h3>
            <p className="text-xs font-bold text-gray-500 mt-1">Emitida em: {data.os_info.date_created}</p>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          {/* Customer */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest border-b border-gray-200 pb-1">Dados do Cliente</h4>
            <div className="space-y-1">
              <p className="text-sm font-black">{data.customer.name}</p>
              <p className="text-xs font-medium text-gray-600">CPF/CNPJ: {data.customer.cpf_cnpj || 'N/A'}</p>
              <p className="text-xs font-medium text-gray-600">E-mail: {data.customer.email || 'N/A'}</p>
              <p className="text-xs font-medium text-gray-600">Celular: {data.customer.contact.main}</p>
              <p className="text-xs font-medium text-gray-600">
                {data.customer.address.street}, {data.customer.address.number}
                {data.customer.address.complement && ` - ${data.customer.address.complement}`}
              </p>
              <p className="text-xs font-medium text-gray-600">
                {data.customer.address.neighborhood} - {data.customer.address.city}/{data.customer.address.uf}
              </p>
              <p className="text-xs font-medium text-gray-600">CEP: {data.customer.address.cep}</p>
            </div>
          </section>

          {/* Product */}
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest border-b border-gray-200 pb-1">Dados do Produto</h4>
            <div className="space-y-1">
              <p className="text-sm font-black">{data.product.name}</p>
              <p className="text-xs font-medium text-gray-600">Tipo: {data.product.type}</p>
              <p className="text-xs font-medium text-gray-600">Entrega: {data.product.delivery}</p>
              <p className="text-xs font-bold text-brand mt-2">Previsão: {data.os_info.eta || 'A definir'}</p>
            </div>
          </section>
        </div>

        {/* Service Details */}
        <section className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <h4 className="text-[10px] font-black uppercase tracking-widest mb-3">Serviço a ser executado</h4>
          <p className="text-sm font-medium leading-relaxed">{data.product.service}</p>
        </section>

        {/* Screening */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest border-b border-gray-200 pb-1">Triagem / Avarias</h4>
            <div className="flex flex-wrap gap-2">
              {data.screening.damages.map(d => (
                <span key={d} className="text-[9px] font-bold bg-gray-200 px-2 py-1 rounded-md">{d}</span>
              ))}
              {data.screening.other_damages && (
                <span className="text-[9px] font-bold bg-gray-200 px-2 py-1 rounded-md">{data.screening.other_damages}</span>
              )}
              {data.screening.damages.length === 0 && !data.screening.other_damages && (
                <span className="text-[9px] font-bold text-gray-400 italic">Nenhuma avaria relatada</span>
              )}
            </div>
          </section>
          <section className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest border-b border-gray-200 pb-1">Atribuição</h4>
            <p className="text-xs font-bold">Técnico Responsável: {data.screening.technician}</p>
            <p className="text-xs font-bold">Vendedor: {data.billing.vendedor}</p>
          </section>
        </div>

        {/* Images */}
        <section className="mb-8">
          <h4 className="text-[10px] font-black uppercase tracking-widest border-b border-gray-200 pb-1 mb-4">Registro Visual</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center">
              {data.images.front ? (
                <img src={data.images.front} alt="Frente" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-bold text-gray-400">Sem foto da frente</span>
              )}
            </div>
            <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center">
              {data.images.back ? (
                <img src={data.images.back} alt="Fundo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] font-bold text-gray-400">Sem foto do fundo</span>
              )}
            </div>
          </div>
        </section>

        {/* Finance */}
        <section className="mb-12 p-6 bg-gray-900 text-white rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Status da OS</p>
            <p className="text-xl font-black">{data.status}</p>
          </div>
          <div className="flex gap-10 text-right">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total</p>
              <p className="text-lg font-black">R$ {data.billing.total.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Sinal</p>
              <p className="text-lg font-black">R$ {data.billing.deposit.toFixed(2)}</p>
            </div>
            <div className="bg-brand px-4 py-2 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-widest">Saldo a Pagar</p>
              <p className="text-2xl font-black">R$ {data.billing.balance.toFixed(2)}</p>
            </div>
          </div>
        </section>

        {/* Footer / Signatures */}
        <div className="grid grid-cols-2 gap-16 mt-20">
          <div className="border-t border-black pt-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest">Assinatura do Cliente</p>
            <p className="text-[8px] text-gray-500 mt-1">Concordo com os termos de serviço e orçamento acima.</p>
          </div>
          <div className="border-t border-black pt-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest">Rei dos Estojos</p>
            <p className="text-[8px] text-gray-500 mt-1">Responsável Técnico</p>
          </div>
        </div>

        {/* Terms */}
        <div className="mt-12 text-[7px] text-gray-400 leading-tight">
          <p>TERMOS E CONDIÇÕES: 1. A garantia é de 90 dias para os serviços executados. 2. Peças substituídas não têm garantia se o defeito for por mau uso. 3. Relógios não retirados em 90 dias após a data de entrega prevista serão descartados ou vendidos para cobrir custos de serviço. 4. A vedação só é garantida se expressamente solicitada e aprovada no orçamento.</p>
        </div>
      </main>
    </div>
  );
}
