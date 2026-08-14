// Netlify Function entry point. Netlify's [[redirects]] rule in netlify.toml
// sends every /api/* request here.
//
// In practice, exactly what path Netlify hands to the function (does it
// strip "/.netlify/functions/api", does it keep "/api", etc.) is not
// consistently documented and can vary. Rather than guess, we normalize
// whatever path arrives down to the same "/api/..." shape that server/app.js
// uses locally (mounted with prefix "/api"), by stripping any of the known
// prefix variants and re-adding "/api" if it's missing.
require("dotenv").config();

const express     = require("express");
const serverless  = require("serverless-http");
const createApp   = require("../../app");

const apiApp = createApp({ prefix: "/api" });

const wrapper = express();
wrapper.use((req, _res, next) => {
  let url = req.url;
  url = url.replace(/^\/\.netlify\/functions\/api/, "");
  if (!url.startsWith("/api")) url = `/api${url}`;
  req.url = url;
  next();
});
wrapper.use(apiApp);

exports.handler = serverless(wrapper, {
  // Treat file-upload bodies (resume/video) as binary so multer receives
  // an actual Buffer instead of a mangled UTF-8 string.
  binary: ["multipart/form-data"],
});
