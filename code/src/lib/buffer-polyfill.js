/**
 * Minimal browser-safe Buffer for client payment code.
 * Plain JS so Vite optimizeDeps can load it without TS stripping issues.
 */

function bytesFrom(value, encoding = 'utf8') {
  if (typeof value === 'string') {
    if (encoding === 'base64' || encoding === 'base64url') {
      const normalized =
        encoding === 'base64url'
          ? value.replace(/-/g, '+').replace(/_/g, '/')
          : value
      const binary = globalThis.atob(normalized)
      const out = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
      return out
    }
    if (encoding === 'hex') {
      const hex = value.length % 2 === 0 ? value : `0${value}`
      const out = new Uint8Array(hex.length / 2)
      for (let i = 0; i < out.length; i++) {
        out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
      }
      return out
    }
    return new TextEncoder().encode(value)
  }

  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  return Uint8Array.from(value)
}

function toEncodedString(bytes, encoding) {
  if (encoding === 'base64') {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return globalThis.btoa(binary)
  }
  if (encoding === 'hex') {
    let hex = ''
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0')
    }
    return hex
  }
  if (encoding === 'ascii') {
    let ascii = ''
    for (let i = 0; i < bytes.length; i++) {
      ascii += String.fromCharCode(bytes[i] & 0x7f)
    }
    return ascii
  }
  return new TextDecoder('utf-8').decode(bytes)
}

function wrap(bytes) {
  bytes.toString = (encoding = 'utf8') => toEncodedString(bytes, encoding)
  bytes.copy = (target, targetStart = 0, sourceStart = 0, sourceEnd = bytes.length) => {
    const start = Math.max(0, sourceStart)
    const end = Math.min(bytes.length, sourceEnd)
    const sliced = bytes.subarray(start, end)
    target.set(sliced, targetStart)
    return sliced.length
  }
  return bytes
}

export function Buffer(sizeOrData) {
  if (!(this instanceof Buffer)) {
    return new Buffer(sizeOrData)
  }
  let bytes
  if (typeof sizeOrData === 'number') bytes = new Uint8Array(sizeOrData)
  else if (sizeOrData instanceof ArrayBuffer) bytes = new Uint8Array(sizeOrData)
  else if (sizeOrData) bytes = Uint8Array.from(sizeOrData)
  else bytes = new Uint8Array()
  return wrap(bytes)
}

Buffer.from = (value, encodingOrMapfn, thisArg) => {
  if (typeof encodingOrMapfn === 'function') {
    return wrap(Uint8Array.from(value, encodingOrMapfn, thisArg))
  }
  return wrap(bytesFrom(value, encodingOrMapfn ?? 'utf8'))
}

Buffer.alloc = (size, fill = 0) => {
  const buf = wrap(new Uint8Array(size))
  if (fill === 0) return buf
  if (typeof fill === 'number') {
    buf.fill(fill)
    return buf
  }
  const encoded = bytesFrom(fill, 'utf8')
  for (let i = 0; i < size; i++) buf[i] = encoded[i % encoded.length]
  return buf
}

Buffer.allocUnsafe = (size) => wrap(new Uint8Array(size))

Buffer.concat = (list, totalLength) => {
  const length =
    totalLength ?? list.reduce((sum, item) => sum + item.length, 0)
  const out = new Uint8Array(length)
  let offset = 0
  for (const item of list) {
    out.set(item.subarray(0, length - offset), offset)
    offset += item.length
    if (offset >= length) break
  }
  return wrap(out)
}

Buffer.isBuffer = (value) =>
  value instanceof Uint8Array && typeof value.copy === 'function'

export function ensureBufferGlobal() {
  if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = Buffer
  }
}

ensureBufferGlobal()
