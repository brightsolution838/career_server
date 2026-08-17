const express  = require("express");
const supabase = require("../lib/supabase");

const router = express.Router();

// ─── Admin key guard ────────────────────────────────────────────────────────
// Simple shared-secret auth. Set ADMIN_SECRET in your server .env.
// The admin frontend sends it as: Authorization: Bearer <secret>
function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    // If no secret is configured, block all write operations in production
    if (process.env.NODE_ENV === "production") {
      return res.status(500).json({ error: "ADMIN_SECRET is not configured." });
    }
    // In dev without a secret, allow through with a warning
    console.warn("Warning: ADMIN_SECRET not set — admin routes are unprotected.");
    return next();
  }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token !== secret) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  next();
}

// ─── GET /api/jobs ───────────────────────────────────────────────────────────
// Public — returns all active jobs, ordered by created_at asc.
// Optionally pass ?all=1 (admin only) to include inactive jobs.
router.get("/", async (req, res) => {
  try {
    let query = supabase
      .from("jobs")
      .select("id, title, dept, location, type, is_active, summary, responsibilities, requirements, nice_to_have, created_at, updated_at")
      .order("created_at", { ascending: true });

    // Only admins (who send ?all=1 + auth header) see inactive jobs
    const wantsAll = req.query.all === "1";
    const secret   = process.env.ADMIN_SECRET;
    const auth     = req.headers.authorization || "";
    const token    = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const isAdmin  = secret ? token === secret : process.env.NODE_ENV !== "production";

    if (!wantsAll || !isAdmin) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    console.error("GET /jobs error:", err.message);
    res.status(500).json({ error: "Failed to load jobs." });
  }
});

// ─── GET /api/jobs/:id ───────────────────────────────────────────────────────
// Public — returns a single job by id.
router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ error: "Job not found." });
    res.json(data);
  } catch (err) {
    console.error("GET /jobs/:id error:", err.message);
    res.status(500).json({ error: "Failed to load job." });
  }
});

// ─── POST /api/jobs ──────────────────────────────────────────────────────────
// Admin — create a new job.
router.post("/", requireAdmin, async (req, res) => {
  try {
    const {
      title, dept, location, type, is_active,
      summary, responsibilities, requirements, nice_to_have,
    } = req.body;

    if (!title || !dept) {
      return res.status(400).json({ error: "title and dept are required." });
    }

    const { data, error } = await supabase
      .from("jobs")
      .insert({
        title,
        dept,
        location:        location        ?? "Remote",
        type:            type            ?? "Full-time",
        is_active:       is_active       ?? true,
        summary:         summary         ?? null,
        responsibilities: toArray(responsibilities),
        requirements:    toArray(requirements),
        nice_to_have:    toArray(nice_to_have),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (err) {
    console.error("POST /jobs error:", err.message);
    res.status(500).json({ error: "Failed to create job." });
  }
});

// ─── PATCH /api/jobs/:id ─────────────────────────────────────────────────────
// Admin — partial update of a job.
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const allowed = [
      "title", "dept", "location", "type", "is_active",
      "summary", "responsibilities", "requirements", "nice_to_have",
    ];
    const patch = {};
    for (const key of allowed) {
      if (key in req.body) {
        patch[key] = ["responsibilities", "requirements", "nice_to_have"].includes(key)
          ? toArray(req.body[key])
          : req.body[key];
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "No valid fields to update." });
    }

    const { data, error } = await supabase
      .from("jobs")
      .update(patch)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ error: "Job not found." });
    res.json(data);
  } catch (err) {
    console.error("PATCH /jobs/:id error:", err.message);
    res.status(500).json({ error: "Failed to update job." });
  }
});

// ─── DELETE /api/jobs/:id ────────────────────────────────────────────────────
// Admin — permanently delete a job.
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from("jobs")
      .delete()
      .eq("id", req.params.id);

    if (error) throw new Error(error.message);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /jobs/:id error:", err.message);
    res.status(500).json({ error: "Failed to delete job." });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Accept both a newline-separated string and an actual array.
function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value.split("\n").map(s => s.trim()).filter(Boolean);
}

module.exports = router;
