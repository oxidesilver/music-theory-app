// アプリのアイコン画像（PNG・SVG）を作るスクリプト。外部ツール不要。
// 実行方法：node scripts/generate-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const BG_TOP = [99, 102, 241]; // #6366f1
const BG_BOTTOM = [124, 58, 237]; // #7c3aed
const WHITE = [255, 255, 255];
const BLACK = [15, 23, 42];

/** 0〜1 の座標系で、その点の色を返す（鍵盤のデザイン） */
function colorAt(x, y) {
  // SVG 版と同じ配置（100×100 の座標で考える）
  const X = x * 100, Y = y * 100;
  let c = BG_TOP.map((v, i) => Math.round(v + (BG_BOTTOM[i] - v) * y));
  const whiteKeys = [[20, 34], [35, 49], [50, 64], [65, 80]];
  if (Y >= 28 && Y <= 74 && whiteKeys.some(([a, b]) => X >= a && X <= b)) c = WHITE;
  const blackKeys = [30.5, 45.5, 60.5];
  if (Y >= 28 && Y <= 55.6 && blackKeys.some((a) => X >= a && X <= a + 9)) c = BLACK;
  return c;
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const ss = 3; // なめらかにするための重ね塗り
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const c = colorAt((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
        }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = acc[0] / (ss * ss);
      raw[o + 1] = acc[1] / (ss * ss);
      raw[o + 2] = acc[2] / (ss * ss);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(name, OUT), png(size));
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>
  <rect width="100" height="100" rx="22" fill="url(#g)"/>
  <g fill="#fff"><rect x="20" y="28" width="14" height="46"/><rect x="35" y="28" width="14" height="46"/><rect x="50" y="28" width="14" height="46"/><rect x="65" y="28" width="15" height="46"/></g>
  <g fill="#0f172a"><rect x="30.5" y="28" width="9" height="27.6"/><rect x="45.5" y="28" width="9" height="27.6"/><rect x="60.5" y="28" width="9" height="27.6"/></g>
</svg>
`;
writeFileSync(new URL('icon.svg', OUT), svg);
console.log('アイコンを作成しました：public/icons/');
