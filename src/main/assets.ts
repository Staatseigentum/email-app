import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { deflateSync } from 'zlib'
import { app } from 'electron'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** MailWave-Logo: violette Kachel (#8250f2) mit weißem „mail-check"-Zeichen. */
function renderIcon(size = 256): Buffer {
  const px = Buffer.alloc(size * size * 4)
  const radius = size * 0.2
  const accent = [0x82, 0x50, 0xf2]

  const ex0 = size * 0.24
  const ex1 = size * 0.76
  const ey0 = size * 0.3
  const ey1 = size * 0.7
  const cx = (ex0 + ex1) / 2
  const flapY = ey0 + (ey1 - ey0) * 0.46
  const stroke = size * 0.045

  const segments: number[][] = [
    [ex0, ey0, ex1, ey0],
    [ex0, ey1, ex1, ey1],
    [ex0, ey0, ex0, ey1],
    [ex1, ey0, ex1, ey1],
    [ex0, ey0, cx, flapY],
    [cx, flapY, cx + (ex1 - cx) * 0.35, ey0 + (flapY - ey0) * 0.6],
    [ex1 - (ex1 - ex0) * 0.16, ey0 - size * 0.02, ex1 - (ex1 - ex0) * 0.04, ey0 + size * 0.1],
    [ex1 - (ex1 - ex0) * 0.04, ey0 + size * 0.1, ex1 + (ex1 - ex0) * 0.14, ey0 - size * 0.12]
  ]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
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
      let md = Infinity
      for (const s of segments) {
        const d = distToSegment(x + 0.5, y + 0.5, s[0], s[1], s[2], s[3])
        if (d < md) md = d
      }
      const half = stroke / 2
      const markA = md <= half ? 1 : md <= half + 1.2 ? (half + 1.2 - md) / 1.2 : 0
      px[i] = Math.round(accent[0] * (1 - markA) + 255 * markA)
      px[i + 1] = Math.round(accent[1] * (1 - markA) + 255 * markA)
      px[i + 2] = Math.round(accent[2] * (1 - markA) + 255 * markA)
      px[i + 3] = Math.round(255 * tileA)
    }
  }
  // Scanlines mit Filter-Byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

let cached: string | null = null

/** Pfad zu einem PNG-App-Icon; wird beim ersten Aufruf in userData erzeugt. */
export function notificationIconPath(): string {
  if (cached && existsSync(cached)) return cached
  const path = join(app.getPath('userData'), 'app-icon.png')
  try {
    if (!existsSync(path)) writeFileSync(path, renderIcon(256))
    cached = path
  } catch {
    return ''
  }
  return cached
}
