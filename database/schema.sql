-- =============================================================================
-- Sistema de Ordem de Serviço - Rei dos Estojos
-- Schema SQL para PostgreSQL + PostgREST
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSÕES
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- TIPOS ENUMERADOS
-- -----------------------------------------------------------------------------
CREATE TYPE customer_type AS ENUM ('CONSUMIDOR FINAL', 'RELOJOARIA');
CREATE TYPE user_level    AS ENUM ('Admin', 'Operador');
CREATE TYPE os_status     AS ENUM (
  'AGUARDANDO AUTORIZAC.',
  'AUTORIZADO',
  'PRONTO',
  'ENTREGUE',
  'CANCELADO'
);

-- =============================================================================
-- TABELAS DE APOIO
-- =============================================================================

-- -----------------------------------------------------------------------------
-- technicians
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS technicians (
  id         SERIAL      PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- sellers (vendedores)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sellers (
  id         SERIAL       PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABELAS PRINCIPAIS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL       PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  level         user_level   NOT NULL DEFAULT 'Operador',
  last_access   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- customers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id               SERIAL          PRIMARY KEY,
  name             VARCHAR(150)    NOT NULL,
  cpf_cnpj         VARCHAR(20),
  email            VARCHAR(150),
  phone            VARCHAR(20),
  wpp_auth         BOOLEAN         NOT NULL DEFAULT TRUE,
  type             customer_type   NOT NULL DEFAULT 'CONSUMIDOR FINAL',
  cep              VARCHAR(10),
  address_street   VARCHAR(200),
  address_number   VARCHAR(20),
  address_comp     VARCHAR(100),
  neighborhood     VARCHAR(100),
  city             VARCHAR(100),
  uf               CHAR(2),
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_cpf_cnpj ON customers (cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_customers_name     ON customers (name);

-- -----------------------------------------------------------------------------
-- service_orders
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_orders (
  id               SERIAL          PRIMARY KEY,
  os_number        INT             NOT NULL UNIQUE,
  date_created     DATE            NOT NULL DEFAULT CURRENT_DATE,
  eta              DATE,
  status           os_status       NOT NULL DEFAULT 'AUTORIZADO',
  uuid             UUID            NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  observations     TEXT,
  -- Produto
  product_name     VARCHAR(200)    NOT NULL DEFAULT '',
  product_service  TEXT,
  product_type     VARCHAR(100)    NOT NULL DEFAULT 'Pulso com Bateria',
  product_delivery VARCHAR(100)    NOT NULL DEFAULT 'Na Loja',
  -- Triagem
  damages          TEXT[]          NOT NULL DEFAULT '{}',
  other_damages    TEXT,
  technician_id    INT             REFERENCES technicians (id) ON DELETE SET NULL,
  -- Financeiro
  seller_id        INT             REFERENCES sellers (id) ON DELETE SET NULL,
  total_value      NUMERIC(10, 2)  NOT NULL DEFAULT 0,
  deposit_value    NUMERIC(10, 2)  NOT NULL DEFAULT 0,
  balance_value    NUMERIC(10, 2)  GENERATED ALWAYS AS (total_value - deposit_value) STORED,
  -- Imagens (base64 ou URL)
  img_front        TEXT,
  img_back         TEXT,
  -- Relações
  customer_id      INT             NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  created_by       INT             REFERENCES users (id) ON DELETE SET NULL,
  -- Metadados
  synced           BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_so_os_number    ON service_orders (os_number);
CREATE INDEX IF NOT EXISTS idx_so_customer_id  ON service_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_so_status       ON service_orders (status);
CREATE INDEX IF NOT EXISTS idx_so_date_created ON service_orders (date_created DESC);
CREATE INDEX IF NOT EXISTS idx_so_seller_id    ON service_orders (seller_id);

-- -----------------------------------------------------------------------------
-- os_history (auditoria de status)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS os_history (
  id         SERIAL       PRIMARY KEY,
  os_id      INT          NOT NULL REFERENCES service_orders (id) ON DELETE CASCADE,
  user_id    INT          REFERENCES users (id) ON DELETE SET NULL,
  action     VARCHAR(100) NOT NULL,
  old_status os_status,
  new_status os_status,
  notes      TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_os_history_os_id ON os_history (os_id);

-- -----------------------------------------------------------------------------
-- system_settings (configurações gerais - uma linha por chave)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_settings (
  key        VARCHAR(50)  PRIMARY KEY,
  value      JSONB        NOT NULL,
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TRIGGER: updated_at automático
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_service_orders_updated_at
  BEFORE UPDATE ON service_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- TRIGGER: forçar status 'AUTORIZADO' no momento do INSERT
-- =============================================================================
CREATE OR REPLACE FUNCTION force_os_status_autorizado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.status = 'AUTORIZADO';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_force_os_status_autorizado
  BEFORE INSERT ON service_orders
  FOR EACH ROW EXECUTE FUNCTION force_os_status_autorizado();

-- =============================================================================
-- TRIGGER: registra histórico automaticamente ao mudar status
-- =============================================================================
CREATE OR REPLACE FUNCTION log_os_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO os_history (os_id, action, old_status, new_status)
    VALUES (NEW.id, 'Mudança de Status', OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_os_status_change
  AFTER UPDATE OF status ON service_orders
  FOR EACH ROW EXECUTE FUNCTION log_os_status_change();

-- =============================================================================
-- ROLES E PERMISSÕES POSTGREST
-- =============================================================================

-- Role autenticado para operadores internos (usa JWT)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'change_me_in_production';
  END IF;
END $$;

-- Role anônimo (acesso público — somente rastreamento de OS)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

-- Role para usuários autenticados via JWT
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END $$;

GRANT anon     TO authenticator;
GRANT app_user TO authenticator;

-- Permissões anon: apenas leitura pública para rastreamento
GRANT USAGE  ON SCHEMA public TO anon;
GRANT SELECT ON service_orders  TO anon;
GRANT SELECT ON customers        TO anon;
GRANT SELECT ON system_settings  TO anon;

-- Permissões app_user: CRUD completo nas tabelas operacionais
GRANT USAGE  ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_orders  TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON customers        TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON technicians      TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON sellers          TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON os_history       TO app_user;
GRANT SELECT, INSERT, UPDATE          ON system_settings  TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON users            TO app_user;

-- Sequências
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- =============================================================================
-- DADOS INICIAIS (SEED)
-- =============================================================================

-- Técnicos padrão
INSERT INTO technicians (name) VALUES
  ('Relojoeiro 1'),
  ('Relojoeiro 2'),
  ('Relojoeiro 3'),
  ('Dep. Técnico')
ON CONFLICT DO NOTHING;

-- Vendedores padrão
INSERT INTO sellers (name) VALUES
  ('Vanildo Ferreira'),
  ('Maria Silva'),
  ('João Souza')
ON CONFLICT DO NOTHING;

-- Usuário admin padrão (senha: admin — alterar imediatamente em produção)
INSERT INTO users (name, email, password_hash, level) VALUES
  ('Thalles', 'thalles@meto.do', crypt('admin', gen_salt('bf')), 'Admin'),
  ('Operador 1', 'operador1@empresa.com', crypt('123', gen_salt('bf')), 'Operador')
ON CONFLICT (email) DO NOTHING;

-- Configurações da empresa
INSERT INTO system_settings (key, value) VALUES
  ('company', '{
    "name": "Rei dos Estojos",
    "slogan": "Assistência Técnica Especializada",
    "logo": null,
    "email": "contato@reidosestojos.com.br",
    "phone": "(31) 3222-4455",
    "address": "Rua Espírito Santo, 123 - Centro"
  }'),
  ('workflow', '{
    "statuses": ["AGUARDANDO AUTORIZAC.", "AUTORIZADO", "PRONTO", "ENTREGUE", "CANCELADO"],
    "notifyWhatsApp": true,
    "notifyDelay": false,
    "cloudBackup": true
  }'),
  ('webhooks', '{
    "url": "",
    "enabled": false,
    "on_create": true,
    "on_update": true
  }')
ON CONFLICT (key) DO NOTHING;
