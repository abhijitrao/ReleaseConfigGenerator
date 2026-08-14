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

  async function readZip(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = [];
    let offset = 0;
    while (offset + 4 <= bytes.length) {
      const sig = signature(bytes, offset);
      if (sig === 0x04034b50) {
        const flags = u16(bytes, offset + 6);
        const method = u16(bytes, offset + 8);
        const compressedSize = u32(bytes, offset + 18);
        const nameLength = u16(bytes, offset + 26);
        const extraLength = u16(bytes, offset + 28);
        const name = textDecoder.decode(bytes.slice(offset + 30, offset + 30 + nameLength));
        const dataStart = offset + 30 + nameLength + extraLength;
        if (flags & 0x08) throw new Error(`Unsupported ZIP data descriptor for: ${name}`);
        const compressed = bytes.slice(dataStart, dataStart + compressedSize);
        let data;
        if (method === 0) data = compressed;
        else if (method === 8) data = await inflateRaw(compressed);
        else throw new Error(`Unsupported ZIP compression for: ${name}`);
        entries.push({ name, data, directory: name.endsWith('/') });
        offset = dataStart + compressedSize;
      } else if (sig === 0x02014b50 || sig === 0x06054b50) {
        break;
      } else {
        throw new Error('Invalid AppStore ZIP package.');
      }
    }
    return entries;
  }

  function resetPackageFiles() {
    const maps = window.phase2ConfigFiles;
    if (maps) Object.values(maps).forEach(map => map.clear());
    if (window.phase2PackageFiles) Object.values(window.phase2PackageFiles).forEach(map => map.clear());
  }

  function findEntry(entries, path) {
    return entries.find(entry => entry.name === path && !entry.directory);
  }

  async function importPackage(file) {
    const entries = await readZip(file);
    const configEntry = findEntry(entries, 'config.json');
    if (!configEntry) throw new Error('config.json was not found in the AppStore package.');

    let data;
    try { data = JSON.parse(textDecoder.decode(configEntry.data)); }
    catch { throw new Error('Invalid config.json in the AppStore package.'); }

    if (!Array.isArray(data.appsConfig)) throw new Error('Invalid AppStore package: appsConfig is missing.');

    // Load the configuration first, exactly like Import JSON.
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

    // Applications: package/<appName>.zip contains the APK bytes with a .zip extension.
    state.appsConfig.forEach(app => {
      const path = `${app.packageName}/${app.appName}`;
      const entry = findEntry(entries, path);
      if (entry) {
        app.sourceApkFile = new File([entry.data], app.appName, { type: 'application/zip' });
      } else {
        app.sourceApkFile = null;
      }
    });

    // Configuration files are mapped using the current config filenames. The config remains the source of truth.
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

    // Keep the package file maps available to Package Builder without adding file choosers to that screen.
    window.phase2PackageFiles = window.phase2PackageFiles || { image: new Map(), pfx: new Map(), banner: new Map(), apk: new Map() };
    configFiles.image.forEach((value, key) => window.phase2PackageFiles.image.set(key, value));
    configFiles.pfx.forEach((value, key) => window.phase2PackageFiles.pfx.set(key, value));
    configFiles.banner.forEach((value, key) => window.phase2PackageFiles.banner.set(key, value));
    state.appsConfig.forEach((app, index) => { if (app.sourceApkFile) window.phase2PackageFiles.apk.set(String(index), app.sourceApkFile); });

    renderApps();
    refreshPreview();
    if (typeof window.refreshPreview === 'function') window.refreshPreview();
    toast(`Imported package: ${state.appsConfig.length} application(s)`);
  }

  function init() {
    const button = $('importPackageBtn');
    const input = $('packageFileInput');
    if (!button || !input || button.dataset.bound) return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', async event => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        await importPackage(file);
      } catch (error) {
        toast(error.message || 'Unable to import AppStore package.');
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();