(() => {
  const U16 = (b, o) => b[o] | (b[o + 1] << 8);
  const U32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

  async function readZipEntry(file, entryName) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const min = Math.max(0, bytes.length - 65557);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= min; i--) if (U32(bytes, i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Invalid APK/ZIP: end of central directory not found.');
    const cdSize = U32(bytes, eocd + 12), cdOffset = U32(bytes, eocd + 16);
    if (cdOffset + cdSize > bytes.length) throw new Error('Invalid APK/ZIP: central directory is truncated.');
    let p = cdOffset, end = cdOffset + cdSize;
    while (p + 46 <= end && U32(bytes, p) === 0x02014b50) {
      const method = U16(bytes, p + 10), compressedSize = U32(bytes, p + 20);
      const nameLen = U16(bytes, p + 28), extraLen = U16(bytes, p + 30), commentLen = U16(bytes, p + 32), localOffset = U32(bytes, p + 42);
      const nameEnd = p + 46 + nameLen;
      if (nameEnd > end) throw new Error('Invalid APK/ZIP: central directory entry is truncated.');
      const name = new TextDecoder().decode(bytes.slice(p + 46, nameEnd));
      p = nameEnd + extraLen + commentLen;
      if (name !== entryName) continue;
      if (localOffset + 30 > bytes.length || U32(bytes, localOffset) !== 0x04034b50) throw new Error(`Invalid local ZIP header for ${entryName}.`);
      const localNameLen = U16(bytes, localOffset + 26), localExtraLen = U16(bytes, localOffset + 28);
      const start = localOffset + 30 + localNameLen + localExtraLen;
      if (start + compressedSize > bytes.length) throw new Error(`Invalid ZIP entry: ${entryName} is truncated.`);
      const compressed = bytes.slice(start, start + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) {
        if (typeof DecompressionStream === 'undefined') throw new Error('This browser does not support local ZIP decompression. Use a recent Chrome or Edge.');
        try { return new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); }
        catch { throw new Error(`Unable to decompress ${entryName} from the APK.`); }
      }
      throw new Error(`Unsupported APK compression method: ${method}.`);
    }
    throw new Error('AndroidManifest.xml was not found in the APK.');
  }

  function parseStringPool(bytes, offset) {
    if (offset + 28 > bytes.length) throw new Error('Invalid AndroidManifest.xml: string pool is truncated.');
    if (U16(bytes, offset) !== 0x0001) throw new Error(`Invalid AndroidManifest.xml: string pool not found (chunk type 0x${U16(bytes, offset).toString(16)}).`);
    const headerSize = U16(bytes, offset + 2), chunkSize = U32(bytes, offset + 4), count = U32(bytes, offset + 8), flags = U32(bytes, offset + 16), stringsStart = U32(bytes, offset + 20);
    if (headerSize < 28 || chunkSize < headerSize || offset + chunkSize > bytes.length) throw new Error('Invalid AndroidManifest.xml: malformed string pool.');
    const offsetsStart = offset + headerSize, poolEnd = offset + chunkSize;
    if (offsetsStart + count * 4 > poolEnd || stringsStart < headerSize || stringsStart >= chunkSize) throw new Error('Invalid AndroidManifest.xml: string pool offsets are truncated.');
    const utf8 = (flags & 0x100) !== 0, strings = [];
    const len8 = pos => { let n = bytes[pos++]; if (n & 0x80) n = ((n & 0x7f) << 8) | bytes[pos++]; return [n, pos]; };
    const len16 = pos => { let n = U16(bytes, pos); pos += 2; if (n & 0x8000) { n = ((n & 0x7fff) << 16) | U16(bytes, pos); pos += 2; } return [n, pos]; };
    for (let i = 0; i < count; i++) {
      let pos = offset + stringsStart + U32(bytes, offsetsStart + i * 4);
      if (pos < offset + stringsStart || pos >= poolEnd) throw new Error('Invalid AndroidManifest.xml: string pool entry is truncated.');
      if (utf8) {
        let r = len8(pos); pos = r[1]; r = len8(pos); pos = r[1]; const byteLen = r[0];
        if (pos + byteLen > poolEnd) throw new Error('Invalid AndroidManifest.xml: UTF-8 string is truncated.');
        strings.push(new TextDecoder().decode(bytes.slice(pos, pos + byteLen)));
      } else {
        const r = len16(pos); pos = r[1]; const charLen = r[0];
        if (pos + charLen * 2 > poolEnd) throw new Error('Invalid AndroidManifest.xml: UTF-16 string is truncated.');
        let s = ''; for (let j = 0; j < charLen; j++) s += String.fromCharCode(U16(bytes, pos + j * 2)); strings.push(s);
      }
    }
    return { strings, next: offset + chunkSize };
  }

  function parseManifest(bytes) {
    if (bytes.length < 8 || U16(bytes, 0) !== 0x0003) throw new Error('Invalid AndroidManifest.xml root chunk.');
    const rootHeaderSize = U16(bytes, 2), rootSize = U32(bytes, 4);
    if (rootHeaderSize < 8 || rootSize < rootHeaderSize || rootSize > bytes.length) throw new Error('Invalid AndroidManifest.xml root chunk size.');
    const pool = parseStringPool(bytes, rootHeaderSize);
    const strings = pool.strings;
    let p = pool.next, packageName = '', versionName = '', versionCode = '';
    while (p + 8 <= bytes.length) {
      const type = U16(bytes, p), headerSize = U16(bytes, p + 2), size = U32(bytes, p + 4);
      if (headerSize < 8 || size < headerSize || p + size > bytes.length) break;
      if (type === 0x0102 && headerSize >= 16) {
        const nameIndex = U32(bytes, p + 20), elementName = strings[nameIndex] || '';
        if (elementName === 'manifest') {
          // ResXMLTree_attrExt follows the 16-byte ResXMLTree_node header.
          // attributeStart is relative to the start of ResXMLTree_attrExt.
          const attrStart = U16(bytes, p + 24), attrSize = U16(bytes, p + 26), attrCount = U16(bytes, p + 28);
          if (attrSize < 20) throw new Error('Invalid AndroidManifest.xml: invalid attribute size.');
          const attrs = p + 16 + attrStart;
          for (let i = 0; i < attrCount; i++) {
            const a = attrs + i * attrSize;
            if (a + 20 > p + size) break;
            const attrName = strings[U32(bytes, a + 4)] || '';
            const rawIndex = U32(bytes, a + 8), dataType = bytes[a + 15], data = U32(bytes, a + 16);
            const value = rawIndex !== 0xffffffff ? (strings[rawIndex] || '') : (dataType === 0x03 ? (strings[data] || '') : String(data >>> 0));
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