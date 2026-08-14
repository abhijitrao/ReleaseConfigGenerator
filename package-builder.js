(() => {
  let modal;
  let buildButton;
  const selectedFiles = { image: new Map(), pfx: new Map(), banner: new Map() };
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  function crc32(bytes) { let crc = 0xffffffff; for (let i = 0; i < bytes.length; i++) { crc ^= bytes[i]; for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
  function u16(value) { return [value & 255, (value >>> 8) & 255]; }
  function u32(value) { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }
  function dosDateTime(date = new Date()) { const year = Math.max(1980, date.getFullYear()); return { date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(), time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2) }; }
  function makeZip(entries) {
    const encoder = new TextEncoder(), localParts = [], centralParts = []; let offset = 0; const dt = dosDateTime();
    entries.forEach(entry => { const name = encoder.encode(entry.name), data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data), crc = crc32(data); const localHeader = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dt.time), ...u16(dt.date), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name]); localParts.push(localHeader, data); const centralHeader = new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(dt.time), ...u16(dt.date), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]); centralParts.push(centralHeader); offset += localHeader.length + data.length; });
    const centralSize = centralParts.reduce((n, p) => n + p.length, 0), centralOffset = offset; const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(centralSize), ...u32(centralOffset), ...u16(0)]); return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
  }
  function ensureModal() {
    if (modal) return;
    modal = document.createElement('div'); modal.id = 'packageBuilderModal'; modal.className = 'modal hidden';
    modal.innerHTML = `<div class="modal-dialog package-builder-dialog" role="dialog" aria-modal="true" aria-labelledby="packageBuilderTitle"><div class="modal-header"><div><h2 id="packageBuilderTitle">Build AppStore Package</h2><p>Prepare the AppStore folder structure locally.</p></div><button type="button" id="closePackageBuilder" class="icon-btn" aria-label="Close">×</button></div><div class="modal-body"><div id="packageBuilderSummary" class="package-builder-summary"></div><div id="packageBuilderList" class="package-builder-list"></div><div id="packageBuilderFiles" class="package-builder-files"></div><div id="packageBuilderError" class="form-error hidden"></div></div><div class="modal-footer"><button type="button" id="cancelPackageBuilder">Cancel</button><button type="button" id="buildPackageBtn" class="primary">Build & Download ZIP</button></div></div>`;
    document.body.appendChild(modal); $('closePackageBuilder').addEventListener('click', close); $('cancelPackageBuilder').addEventListener('click', close); $('buildPackageBtn').addEventListener('click', buildPackage);
  }
  function getApplications() { return (state.appsConfig || []).map((app, index) => ({ app, index, file: app.sourceApkFile || null })).filter(x => x.app && x.app.packageName); }
  function getConfigFiles() { const image = state.imageConfig?.config || [], banners = Array.isArray(state.bannerConfig) ? state.bannerConfig : [], pfx = state.pfxConfig?.pfxFileName ? [state.pfxConfig] : []; return { image, banners, pfx }; }
  function renderFileRows() {
    const { image, banners, pfx } = getConfigFiles(), sections = [];
    const row = (type, key, label, folder) => { const file = selectedFiles[type].get(key); return `<div class="package-config-file-row"><div class="package-config-file-main"><b>${esc(label)}</b><span>${esc(folder)}/</span></div><div class="package-config-file-action"><span class="package-file-status ${file ? 'ready' : 'missing'}">${file ? `✓ ${esc(file.name)}` : 'Not selected'}</span><button type="button" class="secondary-btn" data-choose-package-file="${type}" data-key="${encodeURIComponent(key)}">Choose File</button><input type="file" hidden data-package-file-input="${type}" data-key="${encodeURIComponent(key)}"></div></div>`; };
    if (image.length) sections.push(`<div class="package-config-section"><h3>Image Configuration Files</h3>${image.map((item,i)=>row('image',String(i),item.imageFileName || `Image ${i+1}`,'imageConfig')).join('')}</div>`);
    if (pfx.length) sections.push(`<div class="package-config-section"><h3>PFX Configuration File</h3>${row('pfx','0',pfx[0].pfxFileName,'pfxConfig')}</div>`);
    if (banners.length) sections.push(`<div class="package-config-section"><h3>Banner Configuration Files</h3>${banners.map((item,i)=>row('banner',String(i),item.bannerName || `Banner ${i+1}`,'bannerConfig')).join('')}</div>`);
    $('packageBuilderFiles').innerHTML = sections.length ? sections.join('') : '<div class="package-builder-no-files">No additional configuration files are configured.</div>';
    document.querySelectorAll('[data-choose-package-file]').forEach(button => button.addEventListener('click', () => { const input = button.parentElement.querySelector('input[data-package-file-input]'); if (input) input.click(); }));
    document.querySelectorAll('[data-package-file-input]').forEach(input => input.addEventListener('change', e => { const file = e.target.files?.[0]; if (!file) return; const type = input.dataset.packageFileInput, key = decodeURIComponent(input.dataset.key); selectedFiles[type].set(key, file); renderFileRows(); }));
  }
  function open() { ensureModal(); const apps = getApplications(), missing = apps.filter(x => !x.file); $('packageBuilderSummary').innerHTML = `<b>${apps.length}</b> application(s) configured · <b>${missing.length}</b> APK file(s) missing`; $('packageBuilderList').innerHTML = apps.length ? apps.map(({ app, file }) => `<div class="package-builder-row"><div><b>${esc(app.title || app.appName)}</b><div>${esc(app.packageName)} · v${esc(app.appVersion)}</div></div><span class="package-file-status ${file ? 'ready' : 'missing'}">${file ? `✓ ${esc(file.name)}` : '⚠ APK not selected'}</span></div>`).join('') : '<div class="empty">No applications added yet.</div>'; $('packageBuilderError').classList.add('hidden'); renderFileRows(); modal.classList.remove('hidden'); }
  function getConfigFileErrors() { return []; }
  function addEmptyFolder(entries, folder) { entries.push({ name: `${folder}/.keep`, data: new Uint8Array(0) }); }
  async function buildPackage() {
    const apps = getApplications(), missing = apps.filter(x => !x.file), error = $('packageBuilderError');
    if (!apps.length) { error.textContent = 'Add at least one application before building the package.'; error.classList.remove('hidden'); return; }
    if (missing.length) { error.textContent = `APK file is missing for: ${missing.map(x => x.app.title || x.app.appName || x.app.packageName).join(', ')}.`; error.classList.remove('hidden'); return; }
    const button = $('buildPackageBtn'); button.disabled = true; button.textContent = 'Building…';
    try {
      const entries = [];
      for (const { app, file } of apps) { const bytes = new Uint8Array(await file.arrayBuffer()); const zipName = (app.appName || file.name.replace(/\.apk$/i, '.zip')).replace(/\.apk$/i, '.zip'); entries.push({ name: `${app.packageName}/${zipName}`, data: bytes }); }
      const { image, banners, pfx } = getConfigFiles();
      let hasImage = false, hasPfx = false, hasBanner = false;
      for (let i=0;i<image.length;i++) { const file=selectedFiles.image.get(String(i)); if(file){entries.push({name:`imageConfig/${image[i].imageFileName}`,data:new Uint8Array(await file.arrayBuffer())});hasImage=true;} }
      if (pfx.length) { const file=selectedFiles.pfx.get('0'); if(file){entries.push({name:`pfxConfig/${pfx[0].pfxFileName}`,data:new Uint8Array(await file.arrayBuffer())});hasPfx=true;} }
      for (let i=0;i<banners.length;i++) { const file=selectedFiles.banner.get(String(i)); if(file){entries.push({name:`bannerConfig/${banners[i].bannerName}`,data:new Uint8Array(await file.arrayBuffer())});hasBanner=true;} }
      if (image.length || hasImage) addEmptyFolder(entries,'imageConfig');
      if (pfx.length || hasPfx) addEmptyFolder(entries,'pfxConfig');
      if (banners.length || hasBanner) addEmptyFolder(entries,'bannerConfig');
      entries.push({ name: 'config.json', data: new TextEncoder().encode(JSON.stringify(buildOutput(), null, 4)) });
      const blob=makeZip(entries),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`AppStore_Package_${new Date().toISOString().slice(0,10)}.zip`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);close();if(typeof toast==='function')toast('AppStore package downloaded');
    } catch(e) { error.textContent=e.message||'Unable to build AppStore package.';error.classList.remove('hidden'); } finally { button.disabled=false;button.textContent='Build & Download ZIP'; }
  }
  function close() { if (modal) modal.classList.add('hidden'); }
  function init() { if ($('buildPackageBtnTop')) return; const toolbar=document.querySelector('.toolbar');if(!toolbar)return;buildButton=document.createElement('button');buildButton.id='buildPackageBtnTop';buildButton.type='button';buildButton.textContent='Build Package';buildButton.className='secondary-btn';toolbar.insertBefore(buildButton,$('downloadBtn'));buildButton.addEventListener('click',open);ensureModal(); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();