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
    throw new Error(`${entryName} was not found in the APK.`);
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
    let p = pool.next, packageName = '', versionName = '', versionCode = '', label = '', labelResourceId = 0;
    while (p + 8 <= bytes.length) {
      const type = U16(bytes, p), headerSize = U16(bytes, p + 2), size = U32(bytes, p + 4);
      if (headerSize < 8 || size < headerSize || p + size > bytes.length) break;
      if (type === 0x0102 && headerSize >= 16) {
        const nameIndex = U32(bytes, p + 20), elementName = strings[nameIndex] || '';
        const attrStart = U16(bytes, p + 24), attrSize = U16(bytes, p + 26), attrCount = U16(bytes, p + 28);
        if (attrSize < 20) throw new Error('Invalid AndroidManifest.xml: invalid attribute size.');
        const attrs = p + 16 + attrStart;
        for (let i = 0; i < attrCount; i++) {
          const a = attrs + i * attrSize;
          if (a + 20 > p + size) break;
          const attrName = strings[U32(bytes, a + 4)] || '';
          const rawIndex = U32(bytes, a + 8), dataType = bytes[a + 15], data = U32(bytes, a + 16);
          const value = rawIndex !== 0xffffffff ? (strings[rawIndex] || '') : (dataType === 0x03 ? (strings[data] || '') : String(data >>> 0));
          if (elementName === 'manifest') {
            if (attrName === 'package') packageName = value;
            else if (attrName === 'versionName') versionName = value;
            else if (attrName === 'versionCode') versionCode = value;
          } else if (elementName === 'application' && attrName === 'label') {
            if (dataType === 0x01) labelResourceId = data;
            else if (dataType === 0x03) label = value;
          }
        }
      }
      p += size;
    }
    if (!packageName) throw new Error('Package name could not be read from AndroidManifest.xml.');
    return { packageName, versionName, versionCode, label, labelResourceId };
  }

  function parseTableStringPool(bytes) {
    if (bytes.length < 28 || U16(bytes, 0) !== 0x0002) return null;
    return parseStringPool(bytes, U16(bytes, 2));
  }

  function resolveResourceString(bytes, resourceId) {
    if (!resourceId || bytes.length < 12 || U16(bytes, 0) !== 0x0002) return '';
    const tableSize = U32(bytes, 4);
    if (tableSize > bytes.length) return '';
    const tablePool = parseTableStringPool(bytes);
    if (!tablePool) return '';
    const packageId = (resourceId >>> 24) & 0xff, targetType = (resourceId >>> 16) & 0xff, targetEntry = resourceId & 0xffff;
    let p = tablePool.next;
    while (p + 8 <= bytes.length) {
      const type = U16(bytes, p), headerSize = U16(bytes, p + 2), size = U32(bytes, p + 4);
      if (size < headerSize || p + size > bytes.length || headerSize < 8) break;
      if (type === 0x0200 && headerSize >= 284) {
        const id = U32(bytes, p + 8) & 0xff;
        if (id === packageId) {
          const packageEnd = p + size;
          let q = p + headerSize;
          while (q + 8 <= packageEnd) {
            const childType = U16(bytes, q), childHeader = U16(bytes, q + 2), childSize = U32(bytes, q + 4);
            if (childSize < childHeader || q + childSize > packageEnd || childHeader < 8) break;
            if (childType === 0x0201 && childHeader >= 24) {
              const typeId = bytes[q + 8], entryCount = U32(bytes, q + 12), entriesStart = U32(bytes, q + 16);
              if (typeId === targetType && targetEntry < entryCount) {
                const offsetsBase = q + childHeader;
                if (offsetsBase + entryCount * 4 <= q + childSize) {
                  const entryOffset = U32(bytes, offsetsBase + targetEntry * 4);
                  if (entryOffset !== 0xffffffff && entryOffset + 8 <= childSize - entriesStart) {
                    const entryPos = q + entriesStart + entryOffset, entrySize = U16(bytes, entryPos), entryFlags = U16(bytes, entryPos + 2);
                    if (entryFlags & 0x0001) return '';
                    const valuePos = entryPos + entrySize;
                    if (valuePos + 8 <= q + childSize && U16(bytes, valuePos) >= 8 && bytes[valuePos + 3] === 0x03) return tablePool.strings[U32(bytes, valuePos + 4)] || '';
                  }
                }
              }
            }
            q += childSize;
          }
        }
      }
      p += size;
    }
    return '';
  }

  function extractRevisionId(fileName) {
    const base = String(fileName || '').replace(/\.apk$/i, '').replace(/\.zip$/i, '');
    const matches = base.match(/(?:^|[_-])(\d{6})(?=[_-]|$)/g) || [];
    if (!matches.length) return '';
    const last = matches[matches.length - 1].match(/\d{6}/);
    return last ? last[0] : '';
  }

  window.readApkMetadata = async function(file) {
    if (!(file instanceof File)) throw new Error('Please select an APK file.');
    if (!/\.apk$/i.test(file.name)) throw new Error('Selected file must have an .apk extension.');
    const manifest = await readZipEntry(file, 'AndroidManifest.xml');
    const metadata = parseManifest(manifest);
    let title = metadata.label;
    if (!title && metadata.labelResourceId) {
      try { const resources = await readZipEntry(file, 'resources.arsc'); title = resolveResourceString(resources, metadata.labelResourceId); } catch { /* Some APKs do not contain resources.arsc. */ }
    }
    return { ...metadata, title, revisionId: extractRevisionId(file.name), fileName: file.name, zipFileName: file.name.replace(/\.apk$/i, '.zip') };
  };
})();