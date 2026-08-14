(() => {
  let modal;
  let buildButton;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(value) { return [value & 255, (value >>> 8) & 255]; }
  function u32(value) { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }

  function dosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    return { date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(), time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2) };
  }

  function makeZip(entries) {
    const encoder = new TextEncoder();
    const localParts = [], centralParts = [];
    let offset = 0;
    const dt = dosDateTime();

    entries.forEach(entry => {
      const name = encoder.encode(entry.name);
      const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
      const crc = crc32(data);
      const localHeader = new Uint8Array([
        ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0),
        ...u16(dt.time), ...u16(dt.date), ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(name.length), ...u16(0), ...name
      ]);
      localParts.push(localHeader, data);

      const centralHeader = new Uint8Array([
        ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
        ...u16(dt.time), ...u16(dt.date), ...u32(crc), ...u32(data.length), ...u32(data.length),
        ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name
      ]);
      centralParts.push(centralHeader);
      offset += localHeader.length + data.length;
    });

    const centralSize = centralParts.reduce((n, p) => n + p.length, 0);
    const centralOffset = offset;
    const end = new Uint8Array([
      ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length),
      ...u32(centralSize), ...u32(centralOffset), ...u16(0)
    ]);
    return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
  }

  function ensureModal() {
    if (modal) return;
    modal = document.createElement('div');
    modal.id = 'packageBuilderModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-dialog package-builder-dialog" role="dialog" aria-modal="true" aria-labelledby="packageBuilderTitle">
        <div class="modal-header"><div><h2 id="packageBuilderTitle">Build AppStore Package</h2><p>Prepare the AppStore folder structure locally.</p></div><button type="button" id="closePackageBuilder" class="icon-btn" aria-label="Close">×</button></div>
        <div class="modal-body">
          <div id="packageBuilderSummary" class="package-builder-summary"></div>
          <div id="packageBuilderList" class="package-builder-list"></div>
          <div id="packageBuilderError" class="form-error hidden"></div>
        </div>
        <div class="modal-footer"><button type="button" id="cancelPackageBuilder">Cancel</button><button type="button" id="buildPackageBtn" class="primary">Build & Download ZIP</button></div>
      </div>`;
    document.body.appendChild(modal);
    $('closePackageBuilder').addEventListener('click', close);
    $('cancelPackageBuilder').addEventListener('click', close);
    $('buildPackageBtn').addEventListener('click', buildPackage);
  }

  function getApplications() {
    return (state.appsConfig || []).map((app, index) => ({ app, index, file: app.sourceApkFile || null })).filter(x => x.app && x.app.packageName);
  }

  function open() {
    ensureModal();
    const apps = getApplications();
    const missing = apps.filter(x => !x.file);
    $('packageBuilderSummary').innerHTML = `<b>${apps.length}</b> application(s) configured · <b>${missing.length}</b> APK file(s) missing`;
    $('packageBuilderList').innerHTML = apps.length ? apps.map(({ app, file }) => `<div class="package-builder-row"><div><b>${esc(app.title || app.appName)}</b><div>${esc(app.packageName)} · v${esc(app.appVersion)}</div></div><span class="package-file-status ${file ? 'ready' : 'missing'}">${file ? `✓ ${esc(file.name)}` : '⚠ APK not selected'}</span></div>`).join('') : '<div class="empty">No applications added yet.</div>';
    $('packageBuilderError').classList.add('hidden');
    modal.classList.remove('hidden');
  }

  async function buildPackage() {
    const apps = getApplications();
    const missing = apps.filter(x => !x.file);
    const error = $('packageBuilderError');
    if (!apps.length) { error.textContent = 'Add at least one application before building the package.'; error.classList.remove('hidden'); return; }
    if (missing.length) { error.textContent = `APK file is missing for: ${missing.map(x => x.app.title || x.app.appName || x.app.packageName).join(', ')}.`; error.classList.remove('hidden'); return; }

    const button = $('buildPackageBtn');
    button.disabled = true;
    button.textContent = 'Building…';
    try {
      const entries = [];
      for (const { app, file } of apps) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const zipName = (app.appName || file.name.replace(/\.apk$/i, '.zip')).replace(/\.apk$/i, '.zip');
        entries.push({ name: `${app.packageName}/${zipName}`, data: bytes });
      }
      const config = JSON.stringify(buildOutput(), null, 4);
      entries.push({ name: 'config.json', data: new TextEncoder().encode(config) });
      const blob = makeZip(entries);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AppStore_Package_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      close();
      if (typeof toast === 'function') toast('AppStore package downloaded');
    } catch (e) {
      error.textContent = e.message || 'Unable to build AppStore package.';
      error.classList.remove('hidden');
    } finally {
      button.disabled = false;
      button.textContent = 'Build & Download ZIP';
    }
  }

  function close() { if (modal) modal.classList.add('hidden'); }

  function init() {
    if ($('buildPackageBtnTop')) return;
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;
    buildButton = document.createElement('button');
    buildButton.id = 'buildPackageBtnTop';
    buildButton.type = 'button';
    buildButton.textContent = 'Build Package';
    buildButton.className = 'secondary-btn';
    toolbar.insertBefore(buildButton, $('downloadBtn'));
    buildButton.addEventListener('click', open);
    ensureModal();
    modal.addEventListener('click', e => { if (e.target === modal) return; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
