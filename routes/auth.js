const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const supabase = require("../lib/supabase");

const router = express.Router();

const JWT_SECRET    = process.env.JWT_SECRET || process.env.ADMIN_SECRET;
const SALT_ROUNDS   = 10;
const TOKEN_EXPIRES = "8h";

// ---------------------------------------------------------------------------
// Middleware: require a valid JWT
// ---------------------------------------------------------------------------
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

// ---------------------------------------------------------------------------
// Middleware: require super_admin role
// ---------------------------------------------------------------------------
function requireSuperAdmin(req, res, next) {
  if (req.admin?.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin access required." });
  }
  next();
}

// ---------------------------------------------------------------------------
// POST /api/auth/signup
// Creates a new pending admin account (approved: false).
// Body: { name, email, password }
// ---------------------------------------------------------------------------
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const { data: existing } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const { error } = await supabase.from("admin_users").insert({
    name:          name.trim(),
    email,
    password_hash: passwordHash,
    role:          "admin",
    approved:      false,
    created_at:    new Date().toISOString(),
  });

  if (error) {
    console.error("Signup error:", error.message);
    return res.status(500).json({ error: "Could not create account." });
  }

  return res.status(201).json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// Body: { email, password }
// Returns: { token, role }
// ---------------------------------------------------------------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required." });
  }

  const { data: user, error } = await supabase
    .from("admin_users")
    .select("id, email, name, password_hash, role, approved")
    .eq("email", email)
    .maybeSingle();

  if (error || !user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  if (!user.approved) {
    return res.status(403).json({ error: "Your account is pending approval by a super admin." });
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name || "", role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES }
  );

  return res.json({ token, role: user.role, name: user.name || "" });
});

// ---------------------------------------------------------------------------
// GET /api/auth/me  — verify token & return identity
// ---------------------------------------------------------------------------
router.get("/me", requireAuth, (req, res) => {
  return res.json({ 
    email: req.admin.email, 
    name: req.admin.name || "", 
    role: req.admin.role 
  });
});

// ---------------------------------------------------------------------------
// GET /api/auth/admins  — list all admin accounts (super admin only)
// ---------------------------------------------------------------------------
router.get("/admins", requireAuth, requireSuperAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, email, name, role, approved, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("List admins error:", error.message);
    return res.status(500).json({ error: "Could not fetch admins." });
  }

  return res.json(data);
});

// ---------------------------------------------------------------------------
// PATCH /api/auth/admins/:id/approve  — approve a pending admin (super admin only)
// ---------------------------------------------------------------------------
router.patch("/admins/:id/approve", requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("admin_users")
    .update({ approved: true })
    .eq("id", id)
    .neq("role", "super_admin"); // can't accidentally re-approve super admin via this route

  if (error) {
    console.error("Approve error:", error.message);
    return res.status(500).json({ error: "Could not approve admin." });
  }

  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// DELETE /api/auth/admins/:id  — delete an admin account (super admin only)
// Cannot delete yourself or another super_admin.
// ---------------------------------------------------------------------------
router.delete("/admins/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params;

  if (id === req.admin.sub) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }

  // Prevent deleting other super admins
  const { data: target } = await supabase
    .from("admin_users")
    .select("role")
    .eq("id", id)
    .maybeSingle();

  if (!target) return res.status(404).json({ error: "Admin not found." });
  if (target.role === "super_admin") {
    return res.status(403).json({ error: "Cannot delete a super admin account." });
  }

  const { error } = await supabase.from("admin_users").delete().eq("id", id);

  if (error) {
    console.error("Delete admin error:", error.message);
    return res.status(500).json({ error: "Could not delete admin." });
  }

  return res.json({ ok: true });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireSuperAdmin = requireSuperAdmin;
