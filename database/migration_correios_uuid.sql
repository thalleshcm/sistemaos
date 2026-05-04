-- Migration: Adicionar Correios, UUID, e forçar status AUTORIZADO

-- 1. Se product_delivery fosse um ENUM, nós alteraríamos. Como é VARCHAR, não precisa alterar a coluna.
-- 2. Alterar o status padrão para 'AUTORIZADO'
ALTER TABLE service_orders ALTER COLUMN status SET DEFAULT 'AUTORIZADO';

-- 3. Adicionar UUID público
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid() UNIQUE;
UPDATE service_orders SET uuid = gen_random_uuid() WHERE uuid IS NULL;
ALTER TABLE service_orders ALTER COLUMN uuid SET NOT NULL;

-- 4. Criar trigger para forçar status no INSERT
CREATE OR REPLACE FUNCTION force_os_status_autorizado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.status = 'AUTORIZADO';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_os_status_autorizado ON service_orders;
CREATE TRIGGER trg_force_os_status_autorizado
  BEFORE INSERT ON service_orders
  FOR EACH ROW EXECUTE FUNCTION force_os_status_autorizado();
