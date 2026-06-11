import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
// @ts-ignore
import prerender from "prerender-node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env theo môi trường
if (process.env.NODE_ENV === "production") {
  dotenv.config({
    path: path.resolve(__dirname, ".env.production"),
    override: true,
  });
} else {
  dotenv.config({
    path: path.resolve(__dirname, ".env.development"),
    override: true,
  });
}

const app = express();

// Robots & sitemap
app.use(
  "/robots.txt",
  express.static(path.join(__dirname, "public", "robots.txt"))
);

app.use(
  "/sitemap.xml",
  express.static(path.join(__dirname, "public", "sitemap.xml"))
);

// Prerender chỉ bật nếu có PRERENDER_SERVICE_URL
const PRERENDER_SERVICE_URL = process.env.PRERENDER_SERVICE_URL;

if (PRERENDER_SERVICE_URL) {
  prerender.set("prerenderServiceUrl", PRERENDER_SERVICE_URL);
  app.use(prerender);
}

// Serve React build
const reactDistPath = path.resolve(__dirname, "dist");
app.use(express.static(reactDistPath));

// SPA fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(reactDistPath, "index.html"));
});

// Dùng PORT từ môi trường deploy
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
  console.log("NODE_ENV =", process.env.NODE_ENV);
  console.log("VITE_BASE_API =", process.env.VITE_BASE_API);
  console.log("PRERENDER_SERVICE_URL =", PRERENDER_SERVICE_URL || "disabled");
});