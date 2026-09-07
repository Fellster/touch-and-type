import { writeFileSync } from "fs";
import { resolve } from "path";

const rawBaseUrl =
  process.env.VITE_SITE_URL ||
  process.env.URL ||
  "http://localhost:5173";

const BASE_URL = rawBaseUrl.replace(/\/$/, "");

const entries = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/preview", changefreq: "weekly", priority: "0.9" },
];

function generateSitemap(entries) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.changefreq
        ? `    <changefreq>${e.changefreq}</changefreq>`
        : null,
      e.priority
        ? `    <priority>${e.priority}</priority>`
        : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n")
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

const robots = [
  "User-agent: Googlebot",
  "Allow: /",
  "",
  "User-agent: Bingbot",
  "Allow: /",
  "",
  "User-agent: Twitterbot",
  "Allow: /",
  "",
  "User-agent: facebookexternalhit",
  "Allow: /",
  "",
  "User-agent: *",
  "Allow: /",
  "",
  `Sitemap: ${BASE_URL}/sitemap.xml`,
  "",
].join("\n");

writeFileSync(
  resolve("public/sitemap.xml"),
  generateSitemap(entries)
);

writeFileSync(
  resolve("public/robots.txt"),
  robots
);

console.log(`sitemap.xml and robots.txt written for ${BASE_URL}`);
