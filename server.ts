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
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const JWT_SECRET = process.env.JWT_SECRET ?? "change_me_in_development";
const JWT_EXPIRES_IN = "8h";

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
      const result = await pool.query(
        `SELECT id, name, email, level
           FROM users
          WHERE (lower(email) = lower($1) OR lower(name) = lower($1))
            AND password_hash = crypt($2, password_hash)
          LIMIT 1`,
        [identifier, password]
      );

      if (result.rowCount === 0) {
        return res.status(401).json({ error: "Usuário ou senha incorretos." });
      }

      const user = result.rows[0] as { id: number; name: string; email: string; level: string };

      // Update last_access
      pool.query("UPDATE users SET last_access = NOW() WHERE id = $1", [user.id]).catch(() => {});

      const token = jwt.sign(
        { role: "app_user", user_id: user.id, level: user.level },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      return res.json({ token, user });
    } catch (err) {
      console.error("Login error:", err);
      return res.status(500).json({ error: "Erro interno ao processar login." });
    }
  });

  // ---------------------------------------------------------------------------
  // Webhook Proxy: POST /api/webhook-proxy
  // ---------------------------------------------------------------------------
  app.post("/api/webhook-proxy", async (req, res) => {
    const { url, data } = req.body as { url?: string; data?: unknown };

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      console.log(`Proxying webhook to: ${url}`);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "OS-System-Proxy/1.0",
        },
        body: JSON.stringify(data),
      });

      const responseText = await response.text();
      res.status(response.status).send(responseText);
    } catch (error) {
      console.error("Webhook Proxy Error:", error);
      res.status(500).json({
        error: "Failed to fetch webhook",
        details: error instanceof Error ? error.message : String(error),
      });
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
