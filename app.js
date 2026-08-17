const express = require("express");
const cors    = require("cors");

const applicationsRouter = require("./routes/applications");
const progressRouter     = require("./routes/progress");
const verifyRouter       = require("./routes/verify");

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:5174",
  // Production frontend — update this to your actual frontend URL
  process.env.FRONTEND_URL,
  process.env.ADMIN_URL,
].filter(Boolean);

// Builds the Express app. `prefix` lets the same app be mounted at "/api"
// for local dev (node index.js) and at "" when running inside a Netlify
// Function, where Netlify has already stripped the "/api" segment off
// the path before invoking the function.
function createApp({ prefix = "" } = {}) {
  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, same-origin)
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );
  app.use(express.json());

  // Mount routes
  app.use(`${prefix}/applications`, applicationsRouter);
  app.use(`${prefix}/progress`,     progressRouter);
  app.use(`${prefix}/verify`,       verifyRouter);

  // Health check
  app.get(`${prefix}/health`, (_req, res) => res.json({ ok: true }));

  return app;
}

module.exports = createApp;
