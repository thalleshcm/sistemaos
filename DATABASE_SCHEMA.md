# Estrutura do Banco de Dados - Sistema de Gestão de OS

Este documento descreve a modelagem sugerida para o banco de dados relacional do sistema.

## 1. Tabela: `users` (Usuários do Sistema)
Armazena as credenciais e níveis de acesso de quem opera o sistema.

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID / INT (PK) | Identificador único do usuário. |
| `name` | VARCHAR(100) | Nome completo do usuário. |
| `email` | VARCHAR(150) | E-mail (usado para login). Único. |
| `password_hash` | TEXT | Senha criptografada. |
| `level` | ENUM | 'Admin' ou 'Operador'. |
| `last_access` | TIMESTAMP | Data/Hora do último login. |
| `created_at` | TIMESTAMP | Data de criação da conta. |

---

## 2. Tabela: `customers` (Clientes)
Dados cadastrais dos clientes para evitar redigitação em novas OS.

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID / INT (PK) | Identificador único do cliente. |
| `name` | VARCHAR(150) | Nome completo ou Razão Social. |
| `cpf_cnpj` | VARCHAR(20) | Documento de identificação. |
| `email` | VARCHAR(150) | E-mail de contato. |
| `phone` | VARCHAR(20) | Telefone/Celular principal. |
| `wpp_auth` | BOOLEAN | Autorização para envio de WhatsApp. |
| `cep` | VARCHAR(10) | Código postal. |
| `address_street` | VARCHAR(200) | Logradouro. |
| `address_number` | VARCHAR(20) | Número. |
| `address_comp` | VARCHAR(100) | Complemento. |
| `neighborhood` | VARCHAR(100) | Bairro. |
| `city` | VARCHAR(100) | Cidade. |
| `uf` | CHAR(2) | Estado (Sigla). |
| `type` | ENUM | 'CONSUMIDOR FINAL' ou 'RELOJOARIA'. |

---

## 3. Tabela: `service_orders` (Ordens de Serviço)
A tabela principal que vincula todas as informações da OS.

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID / INT (PK) | Identificador único da OS. |
| `os_number` | INT | Número sequencial da OS (ex: 1001). |
| `date_created` | TIMESTAMP | Data de abertura. |
| `eta` | DATE | Previsão de entrega. |
| `status` | VARCHAR(50) | Status atual (ex: 'Aguardando Autoriz.'). |
| `customer_id` | FK (customers) | Referência ao cliente. |
| `product_name` | VARCHAR(200) | Nome/Modelo do produto. |
| `product_service` | TEXT | Descrição do serviço solicitado. |
| `product_type` | VARCHAR(100) | Tipo (ex: 'Pulso com Bateria'). |
| `product_delivery` | VARCHAR(100) | Forma de entrega (ex: 'Na Loja'). |
| `technician_id` | FK (technicians) | Técnico responsável. |
| `seller_id` | FK (sellers) | Vendedor que abriu a OS. |
| `total_value` | DECIMAL(10,2) | Valor total do serviço. |
| `deposit_value` | DECIMAL(10,2) | Valor pago como sinal. |
| `balance_value` | DECIMAL(10,2) | Saldo restante a pagar. |
| `observations` | TEXT | Observações gerais. |
| `img_front_url` | TEXT | URL da foto frontal (armazenada em Cloud Storage). |
| `img_back_url` | TEXT | URL da foto traseira. |

---

## 4. Tabela: `os_history` (Histórico / Auditoria)
Registra cada mudança de status ou edição importante.

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID / INT (PK) | Identificador do log. |
| `os_id` | FK (service_orders) | OS relacionada. |
| `user_id` | FK (users) | Usuário que realizou a alteração. |
| `action` | VARCHAR(100) | Ação realizada (ex: 'Mudança de Status'). |
| `old_status` | VARCHAR(50) | Status anterior. |
| `new_status` | VARCHAR(50) | Novo status. |
| `timestamp` | TIMESTAMP | Data/Hora exata da ação. |

---

## 5. Tabelas de Apoio (Configurações)

### `technicians` (Técnicos)
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | INT (PK) | ID. |
| `name` | VARCHAR(100) | Nome do técnico. |
| `active` | BOOLEAN | Se está ativo para novas OS. |

### `sellers` (Vendedores)
| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | INT (PK) | ID. |
| `name` | VARCHAR(100) | Nome do vendedor. |
| `active` | BOOLEAN | Se está ativo. |

### `system_settings` (Configurações Gerais)
Armazena dados da empresa e preferências em formato JSON ou chave-valor.

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `key` | VARCHAR(50) (PK) | Nome da config (ex: 'company_info'). |
| `value` | JSON / TEXT | Dados da configuração. |

---

## Relacionamentos Principais:
1. **Uma OS** pertence a **Um Cliente**.
2. **Uma OS** pode ter **Muitos Registros de Histórico**.
3. **Um Usuário** pode criar/editar **Muitas OS**.
4. **Um Técnico** pode ser responsável por **Muitas OS**.
