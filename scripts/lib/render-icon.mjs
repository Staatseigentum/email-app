// Erzeugt das MailWave-App-Icon ohne Fremdbibliotheken:
// – ein PNG pro Größe (blauer Verlauf, runde Ecken, dezente „Welle")
// – daraus ein .ico (Windows) mit mehreren PNG-Frames.
// Die PNG-Logik ist bewusst identisch zu src/main/assets.ts gehalten.

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

/** RGBA-Pixelpuffer des Icons in der angegebenen Kantenlänge. */
function renderPixels(size) {
  const px = Buffer.alloc(size * size * 4)
  const radius = size * 0.22
  const from = [0x59, 0x8c, 0xff]
  const to = [0x1f, 0x42, 0xf5]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size)
      let alpha = 255
      const cx = Math.min(x, size - 1 - x)
      const cy = Math.min(y, size - 1 - y)
      if (cx < radius && cy < radius) {
        const d = Math.hypot(radius - cx, radius - cy)
        if (d > radius) alpha = 0
        else if (d > radius - 1.5) alpha = Math.round((255 * (radius - d)) / 1.5)
      }
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
  return px
}

/** PNG-Buffer des Icons. */
export function renderIconPng(size = 256) {
  const px = renderPixels(size)
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
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

/** .ico-Buffer mit je einem PNG-Frame pro Größe (Vista+ unterstützt PNG in ICO). */
export function renderIconIco(sizes = [16, 24, 32, 48, 64, 128, 256]) {
  const frames = sizes.map((s) => ({ size: s, png: renderIconPng(s) }))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserviert
  header.writeUInt16LE(1, 2) // Typ 1 = Icon
  header.writeUInt16LE(frames.length, 4)

  const dir = Buffer.alloc(16 * frames.length)
  let offset = 6 + dir.length
  frames.forEach((f, i) => {
    const o = i * 16
    dir[o] = f.size >= 256 ? 0 : f.size
    dir[o + 1] = f.size >= 256 ? 0 : f.size
    dir[o + 2] = 0 // Farben in Palette
    dir[o + 3] = 0 // reserviert
    dir.writeUInt16LE(1, o + 4) // Farbebenen
    dir.writeUInt16LE(32, o + 6) // Bits pro Pixel
    dir.writeUInt32LE(f.png.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += f.png.length
  })

  return Buffer.concat([header, dir, ...frames.map((f) => f.png)])
}
