const express = require("express");
const cors    = require("cors");
const multer  = require("multer");

const applicationsRouter = require("./routes/applications");
const progressRouter     = require("./routes/progress");
const verifyRouter       = require("./routes/verify");
const jobsRouter         = require("./routes/jobs");
const authRouter         = require("./routes/auth");

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
  app.use(`${prefix}/jobs`,         jobsRouter);
  app.use(`${prefix}/auth`,         authRouter);

  // Health check
  app.get(`${prefix}/health`, (_req, res) => res.json({ ok: true }));

  // Error-handling middleware — must be registered last, after all routes.
  // Without this, errors thrown by multer (e.g. an unexpected file field, a
  // file over the configured size limit) or anything else in a route bubble
  // up to Express's default handler and come back as an opaque 500 with no
  // useful message for the client.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      console.error("Multer error:", err.code, err.message);
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
      console.error("Unhandled error:", err.message);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
    return res.status(404).json({ error: "Not found." });
  });

  return app;
}

module.exports = createApp;
