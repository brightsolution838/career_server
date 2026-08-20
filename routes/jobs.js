const express  = require("express");
const supabase = require("../lib/supabase");
const { requireAuth } = require("./auth");

const router = express.Router();

// ─── GET /api/jobs ───────────────────────────────────────────────────────────
// Public — returns all active jobs, ordered by created_at asc.
// Optionally pass ?all=1 (admin only) to include inactive jobs.
// For regular admins: only shows their own jobs when ?all=1.
router.get("/", async (req, res) => {
  try {
    let query = supabase
      .from("jobs")
      .select("id, title, dept, location, type, is_active, summary, responsibilities, requirements, nice_to_have, created_at, updated_at, owner_id")
      .order("created_at", { ascending: true });

    const wantsAll = req.query.all === "1";
    
    // Check if request has admin auth
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "").trim();
    let isAdmin = false;
    let adminId = null;
    let adminRole = null;

    if (token) {
      try {
        const jwt = require("jsonwebtoken");
        const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_SECRET;
        const payload = jwt.verify(token, JWT_SECRET);
        isAdmin = true;
        adminId = payload.sub;
        adminRole = payload.role;
      } catch {
        // Invalid token, treat as public
      }
    }

    if (wantsAll && isAdmin) {
      // Admin requesting all jobs
      if (adminRole === "super_admin") {
        // Super admin sees all jobs
      } else {
        // Regular admin only sees their own jobs
        query = query.eq("owner_id", adminId);
      }
    } else {
      // Public request - only active jobs, no owner filtering
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    
    // Don't expose owner_id to public requests
    if (!isAdmin) {
      data.forEach(job => delete job.owner_id);
    }
    
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
// Admin — create a new job, attaching owner_id.
router.post("/", requireAuth, async (req, res) => {
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
        owner_id:        req.admin.sub, // Set the creating admin as owner
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
// Admin — partial update of a job (only if owner or super admin).
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    // Check ownership first
    const { data: job } = await supabase
      .from("jobs")
      .select("owner_id")
      .eq("id", req.params.id)
      .single();

    if (!job) return res.status(404).json({ error: "Job not found." });

    // Only owner or super admin can edit
    if (job.owner_id !== req.admin.sub && req.admin.role !== "super_admin") {
      return res.status(403).json({ error: "You can only edit your own jobs." });
    }

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
    res.json(data);
  } catch (err) {
    console.error("PATCH /jobs/:id error:", err.message);
    res.status(500).json({ error: "Failed to update job." });
  }
});

// ─── DELETE /api/jobs/:id ────────────────────────────────────────────────────
// Admin — permanently delete a job (only if owner or super admin).
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    // Check ownership first
    const { data: job } = await supabase
      .from("jobs")
      .select("owner_id")
      .eq("id", req.params.id)
      .single();

    if (!job) return res.status(404).json({ error: "Job not found." });

    // Only owner or super admin can delete
    if (job.owner_id !== req.admin.sub && req.admin.role !== "super_admin") {
      return res.status(403).json({ error: "You can only delete your own jobs." });
    }

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