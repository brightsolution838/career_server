/**
 * Creates (or promotes) the super admin account.
 * Usage:
 *   SUPER_ADMIN_EMAIL=you@example.com SUPER_ADMIN_PASSWORD=yourpassword node scripts/seed-super-admin.js
 *
 * On Windows cmd:
 *   set SUPER_ADMIN_EMAIL=you@example.com && set SUPER_ADMIN_PASSWORD=yourpassword && node scripts/seed-super-admin.js
 */
require("dotenv").config();
const bcrypt   = require("bcryptjs");
const supabase = require("../lib/supabase");

const email    = process.env.SUPER_ADMIN_EMAIL;
const password = process.env.SUPER_ADMIN_PASSWORD;

if (!email || !password) {
  console.error("Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars.");
  process.exit(1);
}

(async () => {
  const hash = await bcrypt.hash(password, 10);

  // Upsert: update if exists, insert if not
  const { data: existing } = await supabase
    .from("admin_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("admin_users")
      .update({ password_hash: hash, role: "super_admin", approved: true })
      .eq("id", existing.id);
    if (error) { console.error("Update failed:", error.message); process.exit(1); }
    console.log(`✅ Promoted existing account to super_admin: ${email}`);
  } else {
    const { error } = await supabase.from("admin_users").insert({
      email,
      password_hash: hash,
      role: "super_admin",
      approved: true,
    });
    if (error) { console.error("Insert failed:", error.message); process.exit(1); }
    console.log(`✅ Super admin created: ${email}`);
  }

  process.exit(0);
})();
