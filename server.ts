import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const JWT_SECRET = process.env.JWT_SECRET ?? "change_me_in_development";
const JWT_EXPIRES_IN = "7d";

async function startServer() {
  const app = express();
  const PORT = 3000;

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
  // Frontend
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
