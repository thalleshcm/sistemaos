import { OSData, SettingsData } from '../types';

const BASE_URL = 'https://api-db.thalleshcm.com.br';

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function getHeaders(jwt?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  const token = jwt ?? sessionStorage.getItem('jwt_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Converts "dd/MM/yyyy" (Brazilian format) to "yyyy-MM-dd" (ISO) for PostgreSQL DATE columns.
// Returns undefined for blank/invalid strings.
function toISODate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.split('/');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr || undefined; // already ISO or unknown format — pass through
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${body}`);
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types that mirror DB rows
// ---------------------------------------------------------------------------

export interface CustomerRow {
  id?: number;
  name: string;
  cpf_cnpj?: string;
  email?: string;
  phone?: string;
  wpp_auth?: boolean;
  type?: string;
  cep?: string;
  address_street?: string;
  address_number?: string;
  address_comp?: string;
  neighborhood?: string;
  city?: string;
  uf?: string;
}

export interface ServiceOrderRow {
  id?: number;
  os_number: number;
  date_created?: string;
  eta?: string;
  status?: string;
  observations?: string;
  product_name?: string;
  product_service?: string;
  product_type?: string;
  product_delivery?: string;
  damages?: string[];
  other_damages?: string;
  technician_id?: number | null;
  seller_id?: number | null;
  total_value?: number;
  deposit_value?: number;
  balance_value?: number;
  img_front?: string | null;
  img_back?: string | null;
  customer_id: number;
  created_by?: number | null;
  synced?: boolean;
}

// ---------------------------------------------------------------------------
// Converters: OSData <-> DB rows
// ---------------------------------------------------------------------------

export function osDataToRow(os: OSData, customerId: number, technicianId?: number | null, sellerId?: number | null): ServiceOrderRow {
  return {
    os_number: os.os_info.number,
    date_created: toISODate(os.os_info.date_created),
    eta: toISODate(os.os_info.eta),
    status: os.status,
    observations: os.observations || undefined,
    product_name: os.product.name,
    product_service: os.product.service,
    product_type: os.product.type,
    product_delivery: os.product.delivery,
    damages: os.screening.damages,
    other_damages: os.screening.other_damages || undefined,
    technician_id: technicianId ?? null,
    seller_id: sellerId ?? null,
    total_value: os.billing.total,
    deposit_value: os.billing.deposit,
    img_front: os.images.front,
    img_back: os.images.back,
    customer_id: customerId,
    synced: true,
  };
}

export function osDataFromRow(
  row: ServiceOrderRow & { customers?: CustomerRow; technicians?: { name: string } | null; sellers?: { name: string } | null }
): OSData {
  const c = row.customers;
  return {
    os_info: {
      number: row.os_number,
      date_created: row.date_created ?? new Date().toLocaleDateString('pt-BR'),
      eta: row.eta ?? '',
      synced: row.synced ?? true,
    },
    product: {
      name: row.product_name ?? '',
      service: row.product_service ?? '',
      type: row.product_type ?? 'Pulso com Bateria',
      delivery: row.product_delivery ?? 'Na Loja',
    },
    customer: {
      id: c?.id ?? 0,
      name: c?.name ?? '',
      cpf_cnpj: c?.cpf_cnpj ?? '',
      email: c?.email ?? '',
      contact: { main: c?.phone ?? '', wpp_auth: c?.wpp_auth ?? true },
      address: {
        cep: c?.cep ?? '',
        street: c?.address_street ?? '',
        number: c?.address_number ?? '',
        complement: c?.address_comp ?? '',
        neighborhood: c?.neighborhood ?? '',
        city: c?.city ?? '',
        uf: c?.uf ?? '',
      },
      type: (c?.type as OSData['customer']['type']) ?? 'CONSUMIDOR FINAL',
    },
    screening: {
      damages: row.damages ?? [],
      other_damages: row.other_damages ?? '',
      technician: row.technicians?.name ?? '',
    },
    billing: {
      vendedor: row.sellers?.name ?? '',
      total: row.total_value ?? 0,
      deposit: row.deposit_value ?? 0,
      balance: row.balance_value ?? 0,
    },
    status: (row.status as OSData['status']) ?? 'AGUARDANDO AUTORIZAC.',
    observations: row.observations ?? '',
    images: { front: row.img_front ?? null, back: row.img_back ?? null },
  };
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function getCustomerByCpfOrName(query: string): Promise<CustomerRow[]> {
  const params = new URLSearchParams({
    or: `(cpf_cnpj.ilike.*${query}*,name.ilike.*${query}*)`,
    limit: '10',
  });
  const res = await fetch(`${BASE_URL}/customers?${params}`, { headers: getHeaders() });
  return handleResponse<CustomerRow[]>(res);
}

export async function upsertCustomer(customer: CustomerRow): Promise<CustomerRow> {
  if (customer.id && customer.id > 0) {
    // Customer already exists — PATCH to update
    const { id, ...patch } = customer;
    const res = await fetch(`${BASE_URL}/customers?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        ...getHeaders() as Record<string, string>,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patch),
    });
    const rows = await handleResponse<CustomerRow[]>(res);
    return rows[0] ?? { ...patch, id };
  }

  // New customer — INSERT
  const res = await fetch(`${BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      ...getHeaders() as Record<string, string>,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(customer),
  });
  const rows = await handleResponse<CustomerRow[]>(res);
  return rows[0];
}

export async function updateCustomer(id: number, patch: Partial<CustomerRow>): Promise<void> {
  const res = await fetch(`${BASE_URL}/customers?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...getHeaders() as Record<string, string>, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  return handleResponse<void>(res);
}

// ---------------------------------------------------------------------------
// Service Orders
// ---------------------------------------------------------------------------

const OS_SELECT = 'select=*,customers(*),technicians(name),sellers(name)';

export async function getServiceOrders(limit = 50): Promise<OSData[]> {
  const res = await fetch(
    `${BASE_URL}/service_orders?${OS_SELECT}&order=date_created.desc,os_number.desc&limit=${limit}`,
    { headers: getHeaders() }
  );
  const rows = await handleResponse<(ServiceOrderRow & { customers: CustomerRow; technicians: { name: string } | null; sellers: { name: string } | null })[]>(res);
  return rows.map(osDataFromRow);
}

export async function getServiceOrderByNumber(osNumber: number): Promise<OSData | null> {
  const res = await fetch(
    `${BASE_URL}/service_orders?os_number=eq.${osNumber}&${OS_SELECT}&limit=1`,
    { headers: getHeaders() }
  );
  const rows = await handleResponse<(ServiceOrderRow & { customers: CustomerRow; technicians: { name: string } | null; sellers: { name: string } | null })[]>(res);
  return rows.length ? osDataFromRow(rows[0]) : null;
}

export async function upsertServiceOrder(row: ServiceOrderRow): Promise<ServiceOrderRow> {
  const res = await fetch(`${BASE_URL}/service_orders`, {
    method: 'POST',
    headers: {
      ...getHeaders() as Record<string, string>,
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify(row),
  });
  const rows = await handleResponse<ServiceOrderRow[]>(res);
  return rows[0];
}

export async function updateServiceOrderStatus(osNumber: number, status: OSData['status']): Promise<void> {
  const res = await fetch(`${BASE_URL}/service_orders?os_number=eq.${osNumber}`, {
    method: 'PATCH',
    headers: { ...getHeaders() as Record<string, string>, Prefer: 'return=minimal' },
    body: JSON.stringify({ status }),
  });
  return handleResponse<void>(res);
}

export async function updateServiceOrderCustomer(osNumber: number, customerPatch: Partial<CustomerRow> & { customerId: number }): Promise<void> {
  const { customerId, ...patch } = customerPatch;
  await updateCustomer(customerId, patch);
}

// ---------------------------------------------------------------------------
// Technicians & Sellers (lookup lists)
// ---------------------------------------------------------------------------

export async function getTechnicians(): Promise<{ id: number; name: string }[]> {
  const res = await fetch(`${BASE_URL}/technicians?active=eq.true&select=id,name`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function getSellers(): Promise<{ id: number; name: string }[]> {
  const res = await fetch(`${BASE_URL}/sellers?active=eq.true&select=id,name`, { headers: getHeaders() });
  return handleResponse(res);
}

// ---------------------------------------------------------------------------
// System Settings
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<Partial<SettingsData>> {
  const res = await fetch(`${BASE_URL}/system_settings?key=in.(company,workflow,webhooks)`, { headers: getHeaders() });
  const rows = await handleResponse<{ key: string; value: unknown }[]>(res);
  return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {} as Partial<SettingsData>);
}

export async function upsertSetting(key: string, value: unknown): Promise<void> {
  const res = await fetch(`${BASE_URL}/system_settings`, {
    method: 'POST',
    headers: {
      ...getHeaders() as Record<string, string>,
      Prefer: 'return=minimal,resolution=merge-duplicates',
    },
    body: JSON.stringify({ key, value }),
  });
  return handleResponse<void>(res);
}

// ---------------------------------------------------------------------------
// Search (full-text across service_orders + customers)
// ---------------------------------------------------------------------------

export async function searchServiceOrders(term: string, limit = 30): Promise<OSData[]> {
  const isNumber = /^\d+$/.test(term.trim());
  let filterParam: string;

  if (isNumber) {
    filterParam = `os_number=eq.${term}`;
  } else {
    filterParam = `customers.name=ilike.*${encodeURIComponent(term)}*`;
  }

  const res = await fetch(
    `${BASE_URL}/service_orders?${filterParam}&${OS_SELECT}&order=date_created.desc&limit=${limit}`,
    { headers: getHeaders() }
  );
  const rows = await handleResponse<(ServiceOrderRow & { customers: CustomerRow; technicians: { name: string } | null; sellers: { name: string } | null })[]>(res);
  return rows.map(osDataFromRow);
}
