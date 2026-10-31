#!/usr/bin/env node
/**
 * Generate a small Caddy / nginx / generic cache-control snippet next to
 * dist/. Tells the static host to:
 *   - serve hashed assets with immutable 1-year cache
 *   - serve index.html with must-revalidate (so deploys pick up new builds)
 *   - never compress JPEGs / WebPs / MP4s (they'\''re already compressed;
 *     brotli-ing a JPEG wastes CPU and grows the file)
 *
 *   node scripts/emit-cache-headers.mjs
 */
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");
if (!existsSync(DIST)) {
  console.error("dist/ missing — run `vite build` first");
  process.exit(1);
}

const caddy = `# Caddy snippet — paste into a site block.
# Hashed asset bundles (Vite emits /assets/index-<hash>.js) are
# content-addressed and never change, so cache them forever.
@hashed {
  path /assets/*
}
header @hashed Cache-Control "public, max-age=31536000, immutable"

# index.html must round-trip to the server on every visit so a redeploy
# reaches the kiosk without manual cache busting.
@index path /index.html
header @index Cache-Control "no-cache, must-revalidate"

# Compressible text. The rest of /images/* / *.mp4 are already
# compressed; do not pass them through gzip / brotli.
encode zstd gzip
`;

const nginx = `# nginx snippet — paste into the server {} block.
location /assets/ {
  add_header Cache-Control "public, max-age=31536000, immutable";
  access_log off;
  expires 1y;
  types {
    text/javascript js mjs;
    text/css css;
    image/webp webp;
  }
}
location = /index.html {
  add_header Cache-Control "no-cache, must-revalidate";
}
# Other images and videos: long cache but not immutable (filenames may
# be reorganised during content updates).
location ~* \\.(jpe?g|png|webp|avif|mp4|webm)$ {
  expires 30d;
  add_header Cache-Control "public, max-age=2592000";
}
# Enable gzip / brotli for text only.
gzip on;
gzip_types text/plain text/css application/javascript application/json image/svg+xml;
gzip_min_length 1024;
brotli on;
brotli_types text/plain text/css application/javascript application/json image/svg+xml;
`;

writeFileSync(join(DIST, "_cache-headers.caddy"), caddy, "utf8");
writeFileSync(join(DIST, "_cache-headers.nginx.conf"), nginx, "utf8");
console.log("wrote dist/_cache-headers.caddy");
console.log("wrote dist/_cache-headers.nginx.conf");
