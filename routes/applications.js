const express  = require("express");
const multer   = require("multer");
const supabase = require("../lib/supabase");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload a file buffer to Supabase Storage and return the public URL.
async function uploadFile(bucket, folder, file) {
  if (!file) return null;

  const ext      = file.originalname.split(".").pop();
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}

// POST /api/applications
router.post(
  "/",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "video",  maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        firstName, lastName, email, phone, location,
        linkedin, portfolio, role, experience, whyUs,
        coverLetter, salary, startDate, referral, workAuth,
      } = req.body;

      // Basic server-side validation
      if (!firstName || !lastName || !email || !role || !experience) {
        return res.status(400).json({ error: "Missing required fields." });
      }
      if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ error: "Invalid email address." });
      }

      // Upload files in parallel
      const [resumeUrl, videoUrl] = await Promise.all([
        uploadFile("resumes", role.replace(/\s+/g, "-").toLowerCase(), req.files?.resume?.[0]),
        uploadFile("videos",  role.replace(/\s+/g, "-").toLowerCase(), req.files?.video?.[0]),
      ]);

      // Insert into Supabase table
      const { data, error } = await supabase
        .from("applications")
        .insert({
          first_name:   firstName,
          last_name:    lastName,
          email,
          phone:        phone        || null,
          location:     location     || null,
          linkedin:     linkedin     || null,
          portfolio:    portfolio    || null,
          role,
          experience,
          why_us:       whyUs        || null,
          cover_letter: coverLetter  || null,
          salary:       salary       || null,
          start_date:   startDate    || null,
          referral:     referral     || null,
          work_auth:    workAuth     || null,
          resume_url:   resumeUrl,
          video_url:    videoUrl,
        })
        .select("id")
        .single();

      if (error) throw new Error(`DB insert failed: ${error.message}`);

      return res.status(201).json({ success: true, id: data.id });
    } catch (err) {
      console.error("Application submit error:", err.message);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  }
);

module.exports = router;
