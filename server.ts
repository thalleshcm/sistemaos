import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is missing.");
  process.exit(1);
}
const JWT_EXPIRES_IN = "7d";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  app.use(express.json({ limit: "10mb" }));

  // ---------------------------------------------------------------------------
  // Auth: POST /api/auth/login
  // ---------------------------------------------------------------------------
  app.post("/api/auth/login", async (req, res) => {
    const { identifier, password } = req.body as { identifier?: string; password?: string };

    if (!identifier || !password) {
      return res.status(400).json({ error: "identifier e password são obrigatórios." });
    }

    try {
      console.log("[auth] Login attempt:", { identifier });

      // Step 1: find user by email or name (case-insensitive)
      const lookup = await pool.query(
        `SELECT id, name, email, level, password_hash
           FROM users
          WHERE lower(email) = lower($1) OR lower(name) = lower($1)
          LIMIT 1`,
        [identifier]
      );
      console.log("[auth] User lookup rows:", lookup.rowCount, lookup.rows[0] ? { id: lookup.rows[0].id, email: lookup.rows[0].email } : null);

      if (lookup.rowCount === 0) {
        return res.status(401).json({ error: "Usuário ou senha incorretos." });
      }

      // Step 2: verify password with crypt()
      const pwCheck = await pool.query(
        `SELECT id FROM users WHERE id = $1 AND password_hash = crypt($2, password_hash)`,
        [lookup.rows[0].id, password]
      );
      console.log("[auth] Password check rows:", pwCheck.rowCount);

      if (pwCheck.rowCount === 0) {
        return res.status(401).json({ error: "Usuário ou senha incorretos." });
      }

      const result = lookup;
      const user = result.rows[0] as { id: number; name: string; email: string; level: string; password_hash: string };
      // Remove hash from response
      const { password_hash: _ph, ...safeUser } = user;

      // Update last_access
      pool.query("UPDATE users SET last_access = NOW() WHERE id = $1", [user.id]).catch(() => {});

      const payload = { role: "app_user", user_id: user.id, level: user.level };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

      console.log("[auth] JWT payload:", payload);
      console.log("[auth] JWT secret (first 8 chars):", JWT_SECRET.substring(0, 8));

      return res.json({ token, user: safeUser });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Erro interno ao processar login." });
    }
  });

  // ---------------------------------------------------------------------------
  // Health check: GET /api/health
  // ---------------------------------------------------------------------------
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true, db: "connected" });
    } catch (err) {
      res.status(500).json({ ok: false, db: "error", error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // DB Test: GET /api/test-db
  // ---------------------------------------------------------------------------
  app.get("/api/test-db", async (_req, res) => {
    try {
      const result = await pool.query("SELECT current_user, current_database()");
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // Photo Upload: POST /api/upload
  // ---------------------------------------------------------------------------
  app.post("/api/upload", async (req, res) => {
    try {
      const { image } = req.body as { image?: string };
      if (!image) return res.status(400).json({ error: "Image is required" });

      const result = await cloudinary.uploader.upload(image, {
        folder: "sistema-os",
      });

      res.json({ url: result.secure_url });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // ---------------------------------------------------------------------------
  // Webhook Proxy: POST /api/webhook-proxy — fire-and-forget, always 202
  // ---------------------------------------------------------------------------
  app.post("/api/webhook-proxy", (req, res) => {
    const { url, data } = req.body as { url?: string; data?: unknown };

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // Respond immediately — webhook delivery is best-effort
    res.status(202).json({ queued: true });

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "OS-System-Proxy/1.0",
      },
      body: JSON.stringify(data),
    })
      .then((r) => console.log(`[webhook] ${url} → ${r.status}`))
      .catch((err) => console.error("[webhook] failed silently:", err));
  });

  // ---------------------------------------------------------------------------
  // Public OS Status: GET /api/public/os/:uuid
  // ---------------------------------------------------------------------------
  app.get("/api/public/os/:uuid", async (req, res) => {
    try {
      const { uuid } = req.params;
      
      const isNumber = /^\d+$/.test(uuid);
      const filterParam = isNumber ? `os_number=eq.${uuid}` : `uuid=eq.${uuid}`;
      
      // Fetch directly from Neon via pg pool
      const result = await pool.query(
        `SELECT so.*, 
                json_build_object('name', c.name, 'email', c.email, 'cpf_cnpj', c.cpf_cnpj, 'cep', c.cep, 'address_street', c.address_street, 'address_number', c.address_number, 'address_comp', c.address_comp, 'neighborhood', c.neighborhood, 'city', c.city, 'uf', c.uf) as customers
         FROM service_orders so
         JOIN customers c ON so.customer_id = c.id
         WHERE ${filterParam} LIMIT 1`
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "OS não encontrada." });
      }
      
      const row = result.rows[0];
      const c = row.customers;
      
      // Removendo dados financeiros intencionalmente
      const publicData = {
        os_info: {
          number: row.os_number,
          date_created: row.date_created,
          eta: row.eta,
          synced: true
        },
        product: {
          name: row.product_name,
          service: row.product_service,
          type: row.product_type,
          delivery: row.product_delivery
        },
        customer: {
          name: c?.name || "",
          email: c?.email || "",
          cpf_cnpj: c?.cpf_cnpj || "",
          address: {
            cep: c?.cep || "",
            street: c?.address_street || "",
            number: c?.address_number || "",
            complement: c?.address_comp || "",
            neighborhood: c?.neighborhood || "",
            city: c?.city || "",
            uf: c?.uf || ""
          }
        },
        status: row.status,
        images: {
          front: row.img_front,
          back: row.img_back
        }
      };
      
      return res.json(publicData);
    } catch (err) {
      console.error("Public OS fetch error:", err);
      return res.status(500).json({ error: "Erro ao buscar a OS." });
    }
  });

  // ---------------------------------------------------------------------------
  // User CRUD: /api/users
  // ---------------------------------------------------------------------------
  // GET /api/users — lista usuários
  app.get('/api/users', async (_req, res) => {
    try {
      const result = await pool.query('SELECT id, name, email, level, to_char(last_access, \'DD/MM/YYYY HH24:MI\') as lastAccess FROM users ORDER BY name');
      res.json(result.rows);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/users — cria usuário com senha hasheada
  app.post('/api/users', async (req, res) => {
    const { name, email, password, level } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO users (name, email, password_hash, level)
         VALUES ($1, $2, crypt($3, gen_salt('bf')), $4)
         RETURNING id, name, email, level, to_char(last_access, 'DD/MM/YYYY HH24:MI') as lastAccess`,
        [name, email, password, level]
      );
      res.json(result.rows[0]);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/users/:id — apaga usuário
  app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // Customers
  // ---------------------------------------------------------------------------
  app.get("/api/customers/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.json([]);
      const result = await pool.query(
        `SELECT * FROM customers 
         WHERE name ILIKE $1 OR cpf_cnpj ILIKE $1 
         ORDER BY id DESC LIMIT 10`,
        [`%${q}%`]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar clientes" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const data = req.body;
      const result = await pool.query(
        `INSERT INTO customers (name, cpf_cnpj, email, phone, wpp_auth, type, cep, address_street, address_number, address_comp, neighborhood, city, uf)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [data.name, data.cpf_cnpj, data.email, data.phone, data.wpp_auth, data.type, data.cep, data.address_street, data.address_number, data.address_comp, data.neighborhood, data.city, data.uf]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao criar cliente" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      const keys = Object.keys(data).filter(k => k !== 'id');
      if (keys.length === 0) return res.json({});
      
      const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
      const values = keys.map(k => data[k]);
      
      const result = await pool.query(
        `UPDATE customers SET ${setClause} WHERE id = $1 RETURNING *`,
        [id, ...values]
      );
      res.json(result.rows[0] || {});
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao atualizar cliente" });
    }
  });

  // ---------------------------------------------------------------------------
  // Service Orders (OS)
  // ---------------------------------------------------------------------------
  app.get("/api/os", async (req, res) => {
    try {
      const limit = parseInt((req.query.limit as string) || "50", 10);
      const result = await pool.query(
        `SELECT so.*, 
                json_build_object('id', c.id, 'name', c.name, 'cpf_cnpj', c.cpf_cnpj, 'email', c.email, 'phone', c.phone, 'cep', c.cep, 'address_street', c.address_street, 'address_number', c.address_number, 'address_comp', c.address_comp, 'neighborhood', c.neighborhood, 'city', c.city, 'uf', c.uf) as customers,
                json_build_object('name', t.name) as technicians,
                json_build_object('name', s.name) as sellers
         FROM service_orders so
         JOIN customers c ON so.customer_id = c.id
         LEFT JOIN technicians t ON so.technician_id = t.id
         LEFT JOIN sellers s ON so.seller_id = s.id
         ORDER BY so.date_created DESC, so.os_number DESC
         LIMIT $1`,
         [limit]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao listar OS" });
    }
  });

  app.get("/api/os/search", async (req, res) => {
    try {
      const { q } = req.query;
      const limit = parseInt((req.query.limit as string) || "30", 10);
      if (!q) return res.json([]);
      
      const isNumber = /^\\d+$/.test(q as string);
      let queryStr = "";
      let params = [];
      
      if (isNumber) {
        queryStr = `so.os_number = $1`;
        params = [parseInt(q as string, 10)];
      } else {
        queryStr = `c.name ILIKE $1`;
        params = [`%${q}%`];
      }

      const result = await pool.query(
        `SELECT so.*, 
                json_build_object('id', c.id, 'name', c.name, 'cpf_cnpj', c.cpf_cnpj, 'email', c.email, 'phone', c.phone, 'cep', c.cep, 'address_street', c.address_street, 'address_number', c.address_number, 'address_comp', c.address_comp, 'neighborhood', c.neighborhood, 'city', c.city, 'uf', c.uf) as customers,
                json_build_object('name', t.name) as technicians,
                json_build_object('name', s.name) as sellers
         FROM service_orders so
         JOIN customers c ON so.customer_id = c.id
         LEFT JOIN technicians t ON so.technician_id = t.id
         LEFT JOIN sellers s ON so.seller_id = s.id
         WHERE ${queryStr}
         ORDER BY so.date_created DESC, so.os_number DESC
         LIMIT $2`,
         [...params, limit]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar OS" });
    }
  });

  app.get("/api/os/:number", async (req, res) => {
    try {
      const { number } = req.params;
      const result = await pool.query(
        `SELECT so.*, 
                json_build_object('id', c.id, 'name', c.name, 'cpf_cnpj', c.cpf_cnpj, 'email', c.email, 'phone', c.phone, 'cep', c.cep, 'address_street', c.address_street, 'address_number', c.address_number, 'address_comp', c.address_comp, 'neighborhood', c.neighborhood, 'city', c.city, 'uf', c.uf) as customers,
                json_build_object('name', t.name) as technicians,
                json_build_object('name', s.name) as sellers
         FROM service_orders so
         JOIN customers c ON so.customer_id = c.id
         LEFT JOIN technicians t ON so.technician_id = t.id
         LEFT JOIN sellers s ON so.seller_id = s.id
         WHERE so.os_number = $1`,
         [parseInt(number, 10)]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: "OS não encontrada" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao buscar OS" });
    }
  });

  app.post("/api/os", async (req, res) => {
    try {
      const data = req.body;
      
      // Upsert logic: Check if exists
      const check = await pool.query(`SELECT id FROM service_orders WHERE os_number = $1`, [data.os_number]);
      
      if (check.rowCount && check.rowCount > 0) {
        // Update
        const keys = Object.keys(data).filter(k => k !== 'id' && k !== 'os_number');
        if (keys.length === 0) return res.json(check.rows[0]);
        const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
        const values = keys.map(k => data[k]);
        
        const updateRes = await pool.query(
          `UPDATE service_orders SET ${setClause} WHERE os_number = $1 RETURNING *`,
          [data.os_number, ...values]
        );
        return res.json(updateRes.rows[0]);
      } else {
        // Insert
        const keys = Object.keys(data).filter(k => k !== 'id');
        const cols = keys.join(", ");
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
        const values = keys.map(k => data[k]);
        
        const insertRes = await pool.query(
          `INSERT INTO service_orders (${cols}) VALUES (${placeholders}) RETURNING *`,
          values
        );
        return res.json(insertRes.rows[0]);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao criar/atualizar OS" });
    }
  });

  app.patch("/api/os/:number/status", async (req, res) => {
    try {
      const { number } = req.params;
      const { status } = req.body;
      await pool.query(
        `UPDATE service_orders SET status = $1 WHERE os_number = $2`,
        [status, parseInt(number, 10)]
      );
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao atualizar status da OS" });
    }
  });

  // ---------------------------------------------------------------------------
  // Technicians & Sellers
  // ---------------------------------------------------------------------------
  app.get("/api/technicians", async (req, res) => {
    try {
      const result = await pool.query(`SELECT id, name FROM technicians WHERE active = true ORDER BY name`);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar técnicos" });
    }
  });

  app.get("/api/sellers", async (req, res) => {
    try {
      const result = await pool.query(`SELECT id, name FROM sellers WHERE active = true ORDER BY name`);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar vendedores" });
    }
  });

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  app.get("/api/settings", async (req, res) => {
    try {
      const result = await pool.query(`SELECT key, value FROM system_settings WHERE key IN ('company', 'workflow', 'webhooks')`);
      const data = result.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Erro ao buscar configurações" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { key, value } = req.body;
      await pool.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value]
      );
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: "Erro ao salvar configuração" });
    }
  });

  // ---------------------------------------------------------------------------
  // Frontend
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // If running from root via tsx, __dirname is root. If running from build, it might be different.
    // Using process.cwd() is generally safer, but let's stick to the path.join convention requested.
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
