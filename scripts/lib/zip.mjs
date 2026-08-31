// Minimaler ZIP-Writer (nur was wir brauchen): pro Eintrag Deflate oder Store,
// Zip64 für große Archive. Liest sich mit System.IO.Compression (.NET) problemlos.
import { deflateRawSync } from 'node:zlib'

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

// DOS-Zeitstempel (fix – Reproduzierbarkeit ist uns wichtiger als die echte mtime)
const DOS_TIME = 0
const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1
const ZIP64_LIMIT = 0xffffffff

/**
 * @param {{name: string, data: Buffer}[]} entries  Pfade mit '/' als Trenner
 * @returns {Buffer}
 */
export function createZip(entries) {
  const chunks = []
  const central = []
  let offset = 0

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8')
    const raw = entry.data
    const crc = crc32(raw)
    const deflated = deflateRawSync(raw, { level: 9 })
    const useStore = deflated.length >= raw.length
    const body = useStore ? raw : deflated
    const method = useStore ? 0 : 8

    const zip64 = raw.length > ZIP64_LIMIT || body.length > ZIP64_LIMIT || offset > ZIP64_LIMIT
    const localExtra = zip64
      ? buildZip64Extra([raw.length, body.length])
      : Buffer.alloc(0)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(zip64 ? 45 : 20, 4)
    local.writeUInt16LE(0x0800, 6) // UTF-8-Flag
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(zip64 ? ZIP64_LIMIT : body.length, 18)
    local.writeUInt32LE(zip64 ? ZIP64_LIMIT : raw.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(localExtra.length, 28)

    chunks.push(local, nameBuf, localExtra, body)

    const centralExtra = zip64
      ? buildZip64Extra([raw.length, body.length, offset])
      : Buffer.alloc(0)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(zip64 ? 45 : 20, 4)
    cd.writeUInt16LE(zip64 ? 45 : 20, 6)
    cd.writeUInt16LE(0x0800, 8)
    cd.writeUInt16LE(method, 10)
    cd.writeUInt16LE(DOS_TIME, 12)
    cd.writeUInt16LE(DOS_DATE, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(zip64 ? ZIP64_LIMIT : body.length, 20)
    cd.writeUInt32LE(zip64 ? ZIP64_LIMIT : raw.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt16LE(centralExtra.length, 30)
    cd.writeUInt16LE(0, 32)
    cd.writeUInt16LE(0, 34)
    cd.writeUInt16LE(0, 36)
    cd.writeUInt32LE(0, 38)
    cd.writeUInt32LE(zip64 ? ZIP64_LIMIT : offset, 42)
    central.push(Buffer.concat([cd, nameBuf, centralExtra]))

    offset += local.length + nameBuf.length + localExtra.length + body.length
  }

  const centralBuf = Buffer.concat(central)
  const centralOffset = offset
  const needsZip64End = centralOffset > ZIP64_LIMIT || centralBuf.length > ZIP64_LIMIT || entries.length > 0xffff

  const tail = []
  if (needsZip64End) {
    const z64 = Buffer.alloc(56)
    z64.writeUInt32LE(0x06064b50, 0)
    z64.writeBigUInt64LE(44n, 4)
    z64.writeUInt16LE(45, 12)
    z64.writeUInt16LE(45, 14)
    z64.writeUInt32LE(0, 16)
    z64.writeUInt32LE(0, 20)
    z64.writeBigUInt64LE(BigInt(entries.length), 24)
    z64.writeBigUInt64LE(BigInt(entries.length), 32)
    z64.writeBigUInt64LE(BigInt(centralBuf.length), 40)
    z64.writeBigUInt64LE(BigInt(centralOffset), 48)
    const loc = Buffer.alloc(20)
    loc.writeUInt32LE(0x07064b50, 0)
    loc.writeUInt32LE(0, 4)
    loc.writeBigUInt64LE(BigInt(centralOffset + centralBuf.length), 8)
    loc.writeUInt32LE(1, 16)
    tail.push(z64, loc)
  }

  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(needsZip64End ? 0xffff : entries.length, 8)
  end.writeUInt16LE(needsZip64End ? 0xffff : entries.length, 10)
  end.writeUInt32LE(needsZip64End ? ZIP64_LIMIT : centralBuf.length, 12)
  end.writeUInt32LE(needsZip64End ? ZIP64_LIMIT : centralOffset, 16)
  end.writeUInt16LE(0, 20)
  tail.push(end)

  return Buffer.concat([...chunks, centralBuf, ...tail])
}

function buildZip64Extra(values) {
  const buf = Buffer.alloc(4 + values.length * 8)
  buf.writeUInt16LE(0x0001, 0)
  buf.writeUInt16LE(values.length * 8, 2)
  values.forEach((v, i) => buf.writeBigUInt64LE(BigInt(v), 4 + i * 8))
  return buf
}
