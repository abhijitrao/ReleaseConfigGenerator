(() => {
  const U16 = (b, o) => b[o] | (b[o + 1] << 8);
  const U32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

  function findEocd(bytes) {
    const min = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= min; i--) {
      if (U32(bytes, i) === 0x06054b50) return i;
    }
    throw new Error('Invalid APK/ZIP: end of central directory not found.');
  }

  async function readZipEntry(file, entryName) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const eocd = findEocd(bytes);
    const cdSize = U32(bytes, eocd + 12);
    const cdOffset = U32(bytes, eocd + 16);
    let p = cdOffset;
    const end = cdOffset + cdSize;

    while (p < end && U32(bytes, p) === 0x02014b50) {
      const method = U16(bytes, p + 10);
      const compressedSize = U32(bytes, p + 20);
      const nameLen = U16(bytes, p + 28);
      const extraLen = U16(bytes, p + 30);
      const commentLen = U16(bytes, p + 32);
      const localOffset = U32(bytes, p + 42);
      const name = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;

      if (name !== entryName) continue;
      if (U32(bytes, localOffset) !== 0x04034b50) throw new Error(`Invalid local ZIP header for ${entryName}.`);
      const localNameLen = U16(bytes, localOffset + 26);
      const localExtraLen = U16(bytes, localOffset + 28);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      const compressed = bytes.slice(start, start + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) {
        if (typeof DecompressionStream === 'undefined') throw new Error('This browser does not support local ZIP decompression. Use a recent Chrome or Edge.');
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      }
      throw new Error(`Unsupported APK compression method: ${method}.`);
    }
    throw new Error('AndroidManifest.xml was not found in the APK.');
  }

  function decodeUtf16(bytes, offset, length) {
    let out = '';
    for (let i = 0; i < length; i += 2) out += String.fromCharCode(bytes[offset + i] | (bytes[offset + i + 1] << 8));
    return out;
  }

  function parseStringPool(bytes, offset) {
    if (offset + 28 > bytes.length) throw new Error('Invalid AndroidManifest.xml: string pool is truncated.');
    const type = U16(bytes, offset);
    if (type !== 0x0001) throw new Error('Invalid AndroidManifest.xml: string pool not found.');
    const headerSize = U16(bytes, offset + 2);
    const chunkSize = U32(bytes, offset + 4);
    const stringCount = U32(bytes, offset + 8);
    const flags = U32(bytes, offset + 16);
    const stringsStart = U32(bytes, offset + 20);
    if (headerSize < 28 || chunkSize < headerSize || offset + chunkSize > bytes.length) throw new Error('Invalid AndroidManifest.xml: malformed string pool.');
    if (stringsStart < headerSize || stringsStart >= chunkSize) throw new Error('Invalid AndroidManifest.xml: invalid string pool offset.');

    const offsetsStart = offset + headerSize;
    const utf8 = (flags & 0x00000100) !== 0;
    const strings = [];

    const readLen8 = (pos) => {
      if (pos >= bytes.length) throw new Error('Invalid AndroidManifest.xml: malformed UTF-8 string length.');
      let len = bytes[pos++];
      if (len & 0x80) {
        if (pos >= bytes.length) throw new Error('Invalid AndroidManifest.xml: malformed UTF-8 string length.');
        len = ((len & 0x7f) << 8) | bytes[pos++];
      }
      return { len, pos };
    };
    const readLen16 = (pos) => {
      if (pos + 2 > bytes.length) throw new Error('Invalid AndroidManifest.xml: malformed UTF-16 string length.');
      let len = U16(bytes, pos); pos += 2;
      if (len & 0x8000) {
        if (pos + 2 > bytes.length) throw new Error('Invalid AndroidManifest.xml: malformed UTF-16 string length.');
        len = ((len & 0x7fff) << 16) | U16(bytes, pos); pos += 2;
      }
      return { len, pos };
    };

    for (let i = 0; i < stringCount; i++) {
      const rel = U32(bytes, offsetsStart + i * 4);
      let pos = offset + stringsStart + rel;
      if (utf8) {
        const charLength = readLen8(pos); pos = charLength.pos;
        const byteLength = readLen8(pos); pos = byteLength.pos;
        strings.push(new TextDecoder('utf-8').decode(bytes.slice(pos, pos + byteLength.len)));
      } else {
        const length = readLen16(pos); pos = length.pos;
        strings.push(decodeUtf16(bytes, pos, length.len * 2));
      }
    }
    return { strings, next: offset + chunkSize };
  }

  function parseTypedValue(dataType, data, strings) {
    if (dataType === 0x03) return strings[data] ?? '';
    if (dataType === 0x10) return String(data >>> 0);
    return '';
  }

  function parseManifest(bytes) {
    if (bytes.length < 8 || U16(bytes, 0) !== 0x0003) throw new Error('Invalid AndroidManifest.xml root chunk.');

    // Android binary XML layout is:
    // XML root chunk (8 bytes) -> String Pool -> Resource Map/other chunks.
    // The previous parser incorrectly skipped the entire root chunk size and
    // therefore tried to read the string pool from the wrong offset.
    let p = U16(bytes, 4);
    if (p < 8 || p > bytes.length) p = 8;
    const pool = parseStringPool(bytes, p);
    const strings = pool.strings;
    p = pool.next;
    let packageName = '';
    let versionName = '';
    let versionCode = '';

    while (p + 8 <= bytes.length) {
      const type = U16(bytes, p);
      const headerSize = U16(bytes, p + 2);
      const size = U32(bytes, p + 4);
      if (!size || size < headerSize || p + size > bytes.length) break;

      if (type === 0x0180) {
        p += size;
        continue;
      }

      // RES_XML_START_ELEMENT_TYPE
      if (type === 0x0102 && headerSize >= 36) {
        const nameIndex = U32(bytes, p + 20);
        const attrStart = U16(bytes, p + 24);
        const attrSize = U16(bytes, p + 26);
        const attrCount = U16(bytes, p + 28);
        const elementName = strings[nameIndex] || '';
        if (elementName === 'manifest' && attrSize >= 20) {
          const attrs = p + attrStart;
          for (let i = 0; i < attrCount; i++) {
            const a = attrs + i * attrSize;
            if (a + 20 > p + size) break;
            const attrName = strings[U32(bytes, a + 4)] || '';
            const rawIndex = U32(bytes, a + 8);
            const dataType = bytes[a + 15];
            const data = U32(bytes, a + 16);
            const value = rawIndex !== 0xffffffff ? (strings[rawIndex] || '') : parseTypedValue(dataType, data, strings);
            if (attrName === 'package') packageName = value;
            else if (attrName === 'versionName') versionName = value;
            else if (attrName === 'versionCode') versionCode = value;
          }
          if (packageName) break;
        }
      }
      p += size;
    }

    if (!packageName) throw new Error('Package name could not be read from AndroidManifest.xml.');
    return { packageName, versionName, versionCode };
  }

  window.readApkMetadata = async function(file) {
    if (!(file instanceof File)) throw new Error('Please select an APK file.');
    if (!/\.apk$/i.test(file.name)) throw new Error('Selected file must have an .apk extension.');
    const manifest = await readZipEntry(file, 'AndroidManifest.xml');
    return { ...parseManifest(manifest), fileName: file.name, zipFileName: file.name.replace(/\.apk$/i, '.zip') };
  };
})();
