export interface OSData {
  os_info: {
    number: number;
    date_created: string;
    eta: string;
    synced: boolean;
  };
  product: {
    name: string;
    service: string;
    type: string;
    delivery: string;
  };
  customer: {
    id: number;
    name: string;
    cpf_cnpj: string;
    email: string;
    contact: {
      main: string;
      wpp_auth: boolean;
    };
    address: {
      cep: string;
      street: string;
      number: string;
      complement: string;
      neighborhood: string;
      city: string;
      uf: string;
    };
    type: 'CONSUMIDOR FINAL' | 'RELOJOARIA';
  };
  screening: {
    damages: string[];
    other_damages: string;
    technician: string;
  };
  billing: {
    vendedor: string;
    total: number;
    deposit: number;
    balance: number;
  };
  status: 'AGUARDANDO AUTORIZAC.' | 'AUTORIZADO' | 'PRONTO' | 'ENTREGUE';
  observations: string;
  images: {
    front: string | null;
    back: string | null;
  };
}

export const initialOSData: OSData = {
  os_info: {
    number: 0,
    date_created: new Date().toLocaleDateString('pt-BR'),
    eta: "",
    synced: false
  },
  product: {
    name: "",
    service: "",
    type: "Pulso com Bateria",
    delivery: "Na Loja"
  },
  customer: {
    id: 0,
    name: "",
    cpf_cnpj: "",
    email: "",
    contact: { main: "", wpp_auth: true },
    address: {
      cep: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      uf: ""
    },
    type: 'CONSUMIDOR FINAL'
  },
  screening: {
    damages: [],
    other_damages: "",
    technician: ""
  },
  billing: {
    vendedor: "",
    total: 0,
    deposit: 0,
    balance: 0
  },
  status: "AGUARDANDO AUTORIZAC.",
  observations: "",
  images: {
    front: null,
    back: null
  }
};

export interface FieldConfig {
  id: string;
  label: string;
  enabled: boolean;
  required: boolean;
  section: 'Cliente' | 'Produto' | 'Triagem' | 'Financeiro';
}

export interface SettingsData {
  company: {
    name: string;
    slogan: string;
    logo: string | null;
    email: string;
    phone: string;
    address: string;
  };
  team: {
    technicians: string[];
    vendedores: string[];
  };
  workflow: {
    statuses: string[];
    notifyWhatsApp: boolean;
    notifyDelay: boolean;
    cloudBackup: boolean;
  };
  security: {
    users: { name: string; email: string; level: 'Admin' | 'Operador'; lastAccess: string; password?: string }[];
  };
  webhooks: {
    url: string;
    enabled: boolean;
    on_create: boolean;
    on_update: boolean;
  };
  fields: FieldConfig[];
}

export const initialSettingsData: SettingsData = {
  company: {
    name: "Rei dos Estojos",
    slogan: "Assistência Técnica Especializada",
    logo: null,
    email: "contato@reidosestojos.com.br",
    phone: "(31) 3222-4455",
    address: "Rua Espírito Santo, 123 - Centro"
  },
  team: {
    technicians: ['Relojoeiro 1', 'Relojoeiro 2', 'Relojoeiro 3', 'Dep. Técnico'],
    vendedores: ['Vanildo Ferreira', 'Maria Silva', 'João Souza']
  },
  workflow: {
    statuses: ['Aguardando Autoriz.', 'Autorizado', 'Pronto', 'Entregue', 'Cancelado'],
    notifyWhatsApp: true,
    notifyDelay: false,
    cloudBackup: true
  },
  security: {
    users: [
      { name: 'Thalles', email: 'thalles@meto.do', level: 'Admin', lastAccess: 'Hoje, 10:45', password: 'admin' },
      { name: 'Operador 1', email: 'operador1@empresa.com', level: 'Operador', lastAccess: 'Ontem, 18:20', password: '123' }
    ]
  },
  webhooks: {
    url: "",
    enabled: false,
    on_create: true,
    on_update: true
  },
  fields: [
    // Cliente
    { id: 'customer_name', label: 'Nome Completo', enabled: true, required: true, section: 'Cliente' },
    { id: 'customer_cpf', label: 'CPF / CNPJ', enabled: true, required: false, section: 'Cliente' },
    { id: 'customer_email', label: 'E-mail', enabled: true, required: false, section: 'Cliente' },
    { id: 'customer_phone', label: 'Celular', enabled: true, required: true, section: 'Cliente' },
    { id: 'customer_cep', label: 'CEP', enabled: true, required: false, section: 'Cliente' },
    { id: 'customer_address', label: 'Endereço Completo', enabled: true, required: true, section: 'Cliente' },
    // Produto
    { id: 'product_name', label: 'Descrição do Produto', enabled: true, required: true, section: 'Produto' },
    { id: 'product_service', label: 'Serviço a Executar', enabled: true, required: true, section: 'Produto' },
    { id: 'product_type', label: 'Tipo de Relógio', enabled: true, required: false, section: 'Produto' },
    { id: 'product_delivery', label: 'Forma de Entrega', enabled: true, required: false, section: 'Produto' },
    // Triagem
    { id: 'screening_damages', label: 'Avarias / Detalhes', enabled: true, required: false, section: 'Triagem' },
    { id: 'screening_tech', label: 'Técnico Responsável', enabled: true, required: false, section: 'Triagem' },
    // Financeiro
    { id: 'billing_vendedor', label: 'Vendedor', enabled: true, required: true, section: 'Financeiro' },
    { id: 'billing_total', label: 'Valor Total', enabled: true, required: true, section: 'Financeiro' },
    { id: 'billing_deposit', label: 'Sinal / Adiantamento', enabled: true, required: false, section: 'Financeiro' },
  ]
};
