(() => {
  const $ = id => document.getElementById(id);
  const textDecoder = new TextDecoder();
  const signature = (bytes, offset) => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  const u16 = (bytes, offset) => bytes[offset] | (bytes[offset + 1] << 8);
  const u32 = (bytes, offset) => (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;

  async function inflateRaw(data) {
    if (!('DecompressionStream' in window)) throw new Error('This browser does not support compressed ZIP entries.');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function findEndOfCentralDirectory(bytes) {
    const min = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= min; i--) {
      if (signature(bytes, i) === 0x06054b50) return i;
    }
    throw new Error('Invalid AppStore ZIP package: central directory was not found.');
  }

  async function readZip(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const eocd = findEndOfCentralDirectory(bytes);
    const entryCount = u16(bytes, eocd + 10);
    const centralSize = u32(bytes, eocd + 12);
    const centralOffset = u32(bytes, eocd + 16);
    if (entryCount === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff) {
      throw new Error('ZIP64 AppStore packages are not supported.');
    }

    const entries = [];
    let offset = centralOffset;
    for (let i = 0; i < entryCount; i++) {
      if (signature(bytes, offset) !== 0x02014b50) throw new Error('Invalid AppStore ZIP central directory.');
      const method = u16(bytes, offset + 10);
      const compressedSize = u32(bytes, offset + 20);
      const uncompressedSize = u32(bytes, offset + 24);
      const nameLength = u16(bytes, offset + 28);
      const extraLength = u16(bytes, offset + 30);
      const commentLength = u16(bytes, offset + 32);
      const localOffset = u32(bytes, offset + 42);
      const name = textDecoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
      offset += 46 + nameLength + extraLength + commentLength;

      if (localOffset === 0xffffffff || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
        throw new Error(`ZIP64 entry is not supported for: ${name}`);
      }
      if (signature(bytes, localOffset) !== 0x04034b50) throw new Error(`Invalid local ZIP header for: ${name}`);

      const localNameLength = u16(bytes, localOffset + 26);
      const localExtraLength = u16(bytes, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > bytes.length) throw new Error(`Truncated ZIP entry: ${name}`);

      const compressed = bytes.slice(dataStart, dataEnd);
      let data;
      if (method === 0) data = compressed;
      else if (method === 8) data = await inflateRaw(compressed);
      else throw new Error(`Unsupported ZIP compression for: ${name}`);

      if (data.length !== uncompressedSize) throw new Error(`Invalid ZIP entry size for: ${name}`);
      entries.push({ name: normalizeZipPath(name), data, directory: name.endsWith('/') });
    }
    return entries;
  }

  function normalizeZipPath(path) {
    return String(path || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .filter(part => part && part !== '.')
      .join('/');
  }

  function normalizeRoot(entries) {
    // config.json may be directly at root OR buried under any number of wrapper folders,
    // e.g. X990/config.json, X990/backup/config.json, X990/backup/2026/config.json.
    // Keep stripping the common parent folder until config.json is at the logical root.
    let normalized = entries.map(entry => ({ ...entry, name: normalizeZipPath(entry.name) }));

    for (let depth = 0; depth < 50; depth++) {
      const configEntry = normalized.find(e => !e.directory && e.name.toLowerCase() === 'config.json');
      if (configEntry) return normalized;

      const nestedConfig = normalized.find(e => !e.directory && /(^|\/)config\.json$/i.test(e.name));
      if (!nestedConfig) throw new Error('config.json was not found in the AppStore package.');

      const slashIndex = nestedConfig.name.indexOf('/');
      if (slashIndex < 0) return normalized;
      const wrapper = nestedConfig.name.slice(0, slashIndex);
      const prefix = `${wrapper}/`;
      const hasRootEntry = normalized.some(e => e.name === wrapper || e.name.startsWith(prefix));
      if (!hasRootEntry) throw new Error('Invalid AppStore package folder structure.');

      normalized = normalized
        .filter(entry => entry.name === wrapper || entry.name.startsWith(prefix))
        .map(entry => ({ ...entry, name: entry.name === wrapper ? '' : entry.name.slice(prefix.length) }));
    }

    throw new Error('AppStore package folder nesting is too deep.');
  }

  function resetPackageFiles() {
    const maps = window.phase2ConfigFiles;
    if (maps) Object.values(maps).forEach(map => map.clear());
    if (window.phase2PackageFiles) Object.values(window.phase2PackageFiles).forEach(map => map.clear());
  }

  function findEntry(entries, path) { return entries.find(entry => entry.name === path && !entry.directory); }

  async function importPackage(file) {
    const entries = normalizeRoot(await readZip(file));
    const configEntry = findEntry(entries, 'config.json');
    if (!configEntry) throw new Error('config.json was not found in the AppStore package.');

    let data;
    try { data = JSON.parse(textDecoder.decode(configEntry.data)); }
    catch { throw new Error('Invalid config.json in the AppStore package.'); }
    if (!Array.isArray(data.appsConfig)) throw new Error('Invalid AppStore package: appsConfig is missing.');

    $('runBackground').checked = !!data.isRunOnBackground;
    $('confirmation').checked = !!data.isConfirmationRequired;
    $('showError').checked = !!data.isShowErrorMsg;
    $('wifiOnly').checked = !!data.isDownloadOverWifiOnly;
    state.appsConfig = data.appsConfig.map(typeof normalizeApp === 'function' ? normalizeApp : app => app);
    state.whiteListPackageName = data.whiteListPackageName || '';
    state.imageConfig = data.imageConfig || { config: [], timeStamp: '' };
    state.pfxConfig = data.pfxConfig || { pfxFileName: '', timeStamp: '' };
    state.bannerConfig = Array.isArray(data.bannerConfig) ? data.bannerConfig : [];
    state.supportConfig = data.supportConfig || state.supportConfig;
    if (typeof enforceDependencyAutoInstall === 'function') enforceDependencyAutoInstall();

    resetPackageFiles();
    const configFiles = window.phase2ConfigFiles || { image: new Map(), pfx: new Map(), banner: new Map() };

    state.appsConfig.forEach(app => {
      const entry = findEntry(entries, `${app.packageName}/${app.appName}`);
      app.sourceApkFile = entry ? new File([entry.data], app.appName, { type: 'application/zip' }) : null;
    });
    (state.imageConfig.config || []).forEach((item, index) => {
      const entry = findEntry(entries, `imageConfig/${item.imageFileName}`);
      if (entry) configFiles.image.set(String(index), new File([entry.data], item.imageFileName));
    });
    if (state.pfxConfig?.pfxFileName) {
      const entry = findEntry(entries, `pfxConfig/${state.pfxConfig.pfxFileName}`);
      if (entry) configFiles.pfx.set('0', new File([entry.data], state.pfxConfig.pfxFileName));
    }
    (state.bannerConfig || []).forEach((item, index) => {
      const entry = findEntry(entries, `bannerConfig/${item.bannerName}`);
      if (entry) configFiles.banner.set(String(index), new File([entry.data], item.bannerName));
    });

    window.phase2PackageFiles = window.phase2PackageFiles || { image: new Map(), pfx: new Map(), banner: new Map(), apk: new Map() };
    configFiles.image.forEach((value, key) => window.phase2PackageFiles.image.set(key, value));
    configFiles.pfx.forEach((value, key) => window.phase2PackageFiles.pfx.set(key, value));
    configFiles.banner.forEach((value, key) => window.phase2PackageFiles.banner.set(key, value));
    state.appsConfig.forEach((app, index) => { if (app.sourceApkFile) window.phase2PackageFiles.apk.set(String(index), app.sourceApkFile); });

    window.phase2PackageFileName = file.name;
    renderApps();
    refreshPreview();
    if (typeof window.refreshPreview === 'function') window.refreshPreview();
    toast(`Imported package: ${state.appsConfig.length} application(s)`);
  }

  function init() {
    const button = $('importPackageBtn'), input = $('packageFileInput');
    if (!button || !input || button.dataset.bound) return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try { await importPackage(file); }
      catch (error) { toast(error.message || 'Unable to import AppStore package.'); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();