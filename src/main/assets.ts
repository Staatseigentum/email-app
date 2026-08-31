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

/** Erzeugt ein einfaches, hübsches App-Icon (blauer Verlauf, runde Ecken) als PNG-Buffer. */
function renderIcon(size = 256): Buffer {
  const px = Buffer.alloc(size * size * 4)
  const radius = size * 0.22
  // Verlauf von hellblau (#598cff) nach kräftigem Blau (#1f42f5), diagonal
  const from = [0x59, 0x8c, 0xff]
  const to = [0x1f, 0x42, 0xf5]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size)
      let alpha = 255
      // runde Ecken
      const cx = Math.min(x, size - 1 - x)
      const cy = Math.min(y, size - 1 - y)
      if (cx < radius && cy < radius) {
        const d = Math.hypot(radius - cx, radius - cy)
        if (d > radius) alpha = 0
        else if (d > radius - 1.5) alpha = Math.round(255 * (radius - d) / 1.5)
      }
      // dezente „Welle": heller Bogen quer über das Icon
      let wave = 0
      const wy = size * 0.5 + Math.sin((x / size) * Math.PI * 2) * size * 0.13
      if (Math.abs(y - wy) < size * 0.06) wave = 40 * (1 - Math.abs(y - wy) / (size * 0.06))
      const i = (y * size + x) * 4
      px[i] = Math.min(255, Math.round(from[0] + (to[0] - from[0]) * t) + wave)
      px[i + 1] = Math.min(255, Math.round(from[1] + (to[1] - from[1]) * t) + wave)
      px[i + 2] = Math.min(255, Math.round(from[2] + (to[2] - from[2]) * t) + wave)
      px[i + 3] = alpha
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
