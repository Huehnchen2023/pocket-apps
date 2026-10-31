// Generates the launcher's home-screen icons (PNG) without any dependencies.
// Usage: node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a + (b - a) * t;
function inRoundRect(x, y, cx, cy, h, r) {
  const dx = Math.max(Math.abs(x - cx) - (h - r), 0);
  const dy = Math.max(Math.abs(y - cy) - (h - r), 0);
  return Math.abs(x - cx) <= h && Math.abs(y - cy) <= h && dx * dx + dy * dy <= r * r;
}

// Colour of the icon at normalized coordinates (0..1)
function sample(u, v) {
  const t = (u + v) / 2; // diagonal gradient purple -> blue
  let col = [mix(124, 56, t), mix(92, 140, t), mix(255, 240, t)];
  const tiles = [
    [0.355, 0.355, [255, 255, 255]],
    [0.645, 0.355, [255, 255, 255]],
    [0.355, 0.645, [255, 255, 255]],
    [0.645, 0.645, [255, 214, 92]], // the "new app" tile
  ];
  for (const [cx, cy, c] of tiles) {
    if (inRoundRect(u, v, cx, cy, 0.115, 0.045)) col = c;
  }
  return col;
}

function render(size) {
  const ss = 4; // supersampling for smooth edges
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = sample((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
        r += c[0]; g += c[1]; b += c[2];
      }
      const i = (y * size + x) * 4, n = ss * ss;
      buf[i] = r / n; buf[i + 1] = g / n; buf[i + 2] = b / n; buf[i + 3] = 255;
    }
  }
  return encodePNG(size, buf);
}

mkdirSync(join(root, 'icons'), { recursive: true });
for (const size of [180, 512]) {
  writeFileSync(join(root, 'icons', `icon-${size}.png`), render(size));
  console.log(`icons/icon-${size}.png`);
}
