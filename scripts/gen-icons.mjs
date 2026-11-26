// Generates solid rounded-square PWA icons (192 & 512) without external deps.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outDir = `${root}/public/icons`
mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixelFn) {
  // RGBA8, no interlace
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size)
      const o = y * (size * 4 + 1) + 1 + x * 4
      rows[o] = r
      rows[o + 1] = g
      rows[o + 2] = b
      rows[o + 3] = a
    }
  }
  const idat = deflateSync(rows, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const BG = [15, 23, 42] // slate-900
const FG = [56, 189, 248] // sky-400

// rounded-rect bg + simple waveform glyph, drawn per-pixel
function pixel(x, y, s) {
  const r = s * 0.18
  const inRadius =
    (x < r && y < r && (x - r) ** 2 + (y - r) ** 2 > r ** 2) ||
    (x >= s - r && y < r && (x - (s - r)) ** 2 + (y - r) ** 2 > r ** 2) ||
    (x < r && y >= s - r && (x - r) ** 2 + (y - (s - r)) ** 2 > r ** 2) ||
    (x >= s - r && y >= s - r && (x - (s - r)) ** 2 + (y - (s - r)) ** 2 > r ** 2)
  if (inRadius) return [0, 0, 0, 0]

  // waveform: 5 vertical rounded bars centered vertically
  const barW = s * 0.055
  const gap = s * 0.065
  const total = 5 * barW + 4 * gap
  const startX = (s - total) / 2
  const heights = [0.28, 0.5, 0.36, 0.6, 0.24].map((h) => s * h)
  let onBg = true
  for (let i = 0; i < 5; i++) {
    const bx = startX + i * (barW + gap)
    if (x >= bx && x <= bx + barW) {
      const h = heights[i]
      const top = (s - h) / 2
      const bot = (s + h) / 2
      const nearEnd = x <= bx + barW / 2 || x >= bx + barW - barW / 2
      const yy = y - top
      const xx = x - bx
      const edge =
        (yy < barW / 2 && xx < barW / 2 && (yy - barW / 2) ** 2 + (xx - barW / 2) ** 2 > (barW / 2) ** 2) ||
        (yy > h - barW / 2 && xx < barW / 2 && (yy - (h - barW / 2)) ** 2 + (xx - barW / 2) ** 2 > (barW / 2) ** 2) ||
        (yy < barW / 2 && xx > h - barW / 2 && (yy - barW / 2) ** 2 + (xx - (h - barW / 2)) ** 2 > (barW / 2) ** 2) ||
        (yy > h - barW / 2 && xx > h - barW / 2 && (yy - (h - barW / 2)) ** 2 + (xx - (h - barW / 2)) ** 2 > (barW / 2) ** 2)
      if (!edge && y >= top && y <= bot) onBg = false
      void nearEnd
      break
    }
  }
  return onBg ? BG : [...FG, 255]
}

for (const size of [192, 512]) {
  writeFileSync(`${outDir}/icon-${size}.png`, png(size, pixel))
  console.log(`wrote icon-${size}.png`)
}
