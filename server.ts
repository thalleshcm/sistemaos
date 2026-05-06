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

const JWT_SECRET = process.env.JWT_SECRET ?? "change_me_in_development";
const JWT_EXPIRES_IN = "7d";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

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
      
      // Fetch directly from PostgREST to avoid direct PostgreSQL connection dependency locally
      const response = await fetch(
        `https://api-db.thalleshcm.com.br/service_orders?${filterParam}&select=os_number,date_created,eta,status,observations,product_name,product_service,product_type,product_delivery,damages,other_damages,img_front,img_back,customers(name,email,cpf_cnpj,cep,address_street,address_number,address_comp,neighborhood,city,uf)`,
        {
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(`PostgREST error: ${response.status}`);
      }

      const rows = await response.json();
      
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: "OS não encontrada." });
      }
      
      const row = rows[0];
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
