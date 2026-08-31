// Erzeugt das MailWave-App-Icon ohne Fremdbibliotheken:
// violette Kachel (#8250f2, runde Ecken) mit weißem „mail-check"-Zeichen
// (Umschlag-Umriss + Haken). Die Pixel-Logik ist bewusst mit
// src/main/assets.ts synchron gehalten.

import { deflateSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

/** RGBA-Pixelpuffer des Icons (violette Kachel + weißes mail-check). */
export function renderPixels(size) {
  const px = Buffer.alloc(size * size * 4)
  const radius = size * 0.2
  const accent = [0x82, 0x50, 0xf2]

  // Umschlag-Box
  const ex0 = size * 0.24
  const ex1 = size * 0.76
  const ey0 = size * 0.3
  const ey1 = size * 0.7
  const cx = (ex0 + ex1) / 2
  const flapY = ey0 + (ey1 - ey0) * 0.46
  const stroke = size * 0.045

  const segments = [
    [ex0, ey0, ex1, ey0],
    [ex0, ey1, ex1, ey1],
    [ex0, ey0, ex0, ey1],
    [ex1, ey0, ex1, ey1],
    [ex0, ey0, cx, flapY],
    [cx, flapY, cx + (ex1 - cx) * 0.35, ey0 + (flapY - ey0) * 0.6],
    // Haken oben rechts
    [ex1 - (ex1 - ex0) * 0.16, ey0 - size * 0.02, ex1 - (ex1 - ex0) * 0.04, ey0 + size * 0.1],
    [ex1 - (ex1 - ex0) * 0.04, ey0 + size * 0.1, ex1 + (ex1 - ex0) * 0.14, ey0 - size * 0.12]
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      // Kachel-Alpha (runde Ecken)
      let tileA = 1
      const qx = Math.min(x, size - 1 - x)
      const qy = Math.min(y, size - 1 - y)
      if (qx < radius && qy < radius) {
        const d = Math.hypot(radius - qx, radius - qy)
        tileA = d > radius ? 0 : d > radius - 1.5 ? (radius - d) / 1.5 : 1
      }
      if (tileA <= 0) {
        px[i + 3] = 0
        continue
      }

      // weißes Zeichen: minimale Distanz zu allen Segmenten
      let md = Infinity
      for (const s of segments) {
        const d = distToSegment(x + 0.5, y + 0.5, s[0], s[1], s[2], s[3])
        if (d < md) md = d
      }
      const half = stroke / 2
      const markA = md <= half ? 1 : md <= half + 1.2 ? (half + 1.2 - md) / 1.2 : 0

      const r = Math.round(accent[0] * (1 - markA) + 255 * markA)
      const g = Math.round(accent[1] * (1 - markA) + 255 * markA)
      const b = Math.round(accent[2] * (1 - markA) + 255 * markA)
      px[i] = r
      px[i + 1] = g
      px[i + 2] = b
      px[i + 3] = Math.round(255 * tileA)
    }
  }
  return px
}

export function renderIconPng(size = 256) {
  const pixels = renderPixels(size)
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** .ico mit je einem PNG-Frame pro Größe (Vista+ unterstützt PNG in ICO). */
export function renderIconIco(sizes = [16, 24, 32, 48, 64, 128, 256]) {
  const frames = sizes.map((s) => ({ size: s, png: renderIconPng(s) }))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)

  const dir = Buffer.alloc(16 * frames.length)
  let offset = 6 + dir.length
  frames.forEach((f, i) => {
    const o = i * 16
    dir[o] = f.size >= 256 ? 0 : f.size
    dir[o + 1] = f.size >= 256 ? 0 : f.size
    dir.writeUInt16LE(1, o + 4)
    dir.writeUInt16LE(32, o + 6)
    dir.writeUInt32LE(f.png.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += f.png.length
  })

  return Buffer.concat([header, dir, ...frames.map((f) => f.png)])
}
