// Local / traditional-host entry point (node index.js). Netlify does NOT use
// this file — it invokes netlify/functions/api.js instead, which reuses the
// same app via ./app.js. Kept here for local dev (npm run dev) and in case
// you ever want to run this server on a persistent host (Render/Railway/Fly).
require("dotenv").config();

const createApp = require("./app");
const app = createApp({ prefix: "/api" });

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
