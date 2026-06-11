import fs from "fs";
import path from "path";
import axios from "axios";

const DOMAIN = "https://lms-project-nhanthiengg123-8117s-projects.vercel.app";
const API_BASE_URL =
  process.env.VITE_BASE_API || "https://lms-project-t5k1.onrender.com";

const OUTPUT_PATH = path.join(process.cwd(), "dist", "sitemap.xml");

async function generateSitemap() {
  try {
    const blogRes = await axios.get(`${API_BASE_URL}/blogs`);

    const blogs = blogRes.data.data || [];

    let urls = [];

    // ----- Các trang cố định -----
    urls.push(`${DOMAIN}/`);
    urls.push(`${DOMAIN}/blogs`);

    // ----- Các blog động -----
    blogs.forEach((blog) => {
      urls.push(`${DOMAIN}/blogs/${blog.slug}`);
    });

    // ----- Tạo XML -----
    const xmlItems = urls
      .map((url) => {
        return `
      <url>
        <loc>${url}</loc>
        <changefreq>daily</changefreq>
        <priority>0.8</priority>
      </url>`;
      })
      .join("");

    const xml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${xmlItems}
    </urlset>`;

    // ----- Xuất file -----
    fs.writeFileSync(OUTPUT_PATH, xml.trim());
    console.log("✅ Đã tạo sitemap.xml thành công!");
    console.log("📍 Output:", OUTPUT_PATH);
  } catch (error) {
    console.error("❌ Lỗi tạo sitemap:", error);
  }
}

generateSitemap();
