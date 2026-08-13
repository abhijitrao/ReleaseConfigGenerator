(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const defaults = {
    imageConfig: { config: [], timeStamp: '' },
    pfxConfig: { pfxFileName: '', timeStamp: '' },
    bannerConfig: [],
    supportConfig: { timeStamp: '', helpLine: '', preAuth: { dateExceededMessage: '', amountLimitMessage: '', completionReminderMessage: '' } }
  };
  const cloneDefaults = () => structuredClone(defaults);
  let editingType = '';
  let editingIndex = -1;

  const style = document.createElement('style');
  style.textContent = `.config-summary{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 14px;border:1px solid #e1e6ed;border-radius:9px;background:#fbfcfe}.config-summary-main{min-width:0}.config-summary-title{font-weight:650;font-size:14px;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.config-summary-meta{color:#667085;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.config-summary-actions{display:flex;gap:6px;flex-shrink:0}.config-modal-dialog{width:min(760px,100%)}@media(max-width:900px){.config-summary{align-items:flex-start;flex-direction:column}.config-summary-actions{width:100%}.config-summary-actions button{flex:1}}`;
  document.head.appendChild(style);

  function ensureState() {
    state.imageConfig ||= { config: [], timeStamp: '' };
    state.imageConfig.config ||= [];
    state.pfxConfig ||= { pfxFileName: '', timeStamp: '' };
    state.bannerConfig ||= [];
    state.supportConfig ||= structuredClone(defaults.supportConfig);
    state.supportConfig.preAuth ||= structuredClone(defaults.supportConfig.preAuth);
  }

  function renderAll() { ensureState(); renderImages(); renderPfx(); renderBanners(); renderSupport(); }

  function renderImages() {
    const list = $('imageConfigList');
    const items = state.imageConfig.config || [];
    if (!items.length) { list.innerHTML = '<div class="empty">No image configuration added yet.</div>'; return; }
    list.innerHTML = items.map((item, index) => `<div class="config-summary"><div class="config-summary-main"><div class="config-summary-title">${esc(item.imageFileName || 'Unnamed Image')}</div><div class="config-summary-meta">${esc(item.txnType || 'all')} · ${esc(item.startDate || 'No start date')} → ${esc(item.endDate || 'No end date')}</div></div><div class="config-summary-actions"><button type="button" data-edit-config="image" data-index="${index}">Edit</button><button type="button" class="danger-btn" data-delete-config="image" data-index="${index}">Delete</button></div></div>`).join('');
  }

  function renderPfx() {
    const list = $('pfxConfigList');
    const pfx = state.pfxConfig;
    if (!pfx.pfxFileName && !pfx.timeStamp) { list.innerHTML = '<div class="empty">No PFX configuration added yet.</div>'; $('addPfxBtn').textContent = '+ Add PFX'; return; }
    list.innerHTML = `<div class="config-summary"><div class="config-summary-main"><div class="config-summary-title">${esc(pfx.pfxFileName || 'PFX Configuration')}</div><div class="config-summary-meta">Time Stamp: ${esc(pfx.timeStamp || '-')}</div></div><div class="config-summary-actions"><button type="button" data-edit-config="pfx" data-index="0">Edit</button><button type="button" class="danger-btn" data-delete-config="pfx" data-index="0">Delete</button></div></div>`;
    $('addPfxBtn').textContent = 'Edit PFX';
  }

  function renderBanners() {
    const list = $('bannerConfigList');
    const items = state.bannerConfig || [];
    if (!items.length) { list.innerHTML = '<div class="empty">No banner configuration added yet.</div>'; return; }
    list.innerHTML = items.map((item, index) => `<div class="config-summary"><div class="config-summary-main"><div class="config-summary-title">${esc(item.bannerName || 'Unnamed Banner')}</div><div class="config-summary-meta">ID: ${esc(item.bannerId || '-')} · ${Number(item.availabilityType) === 1 ? `TID Based · ${(item.tids || []).length} TID(s)` : 'All TIDs'}</div></div><div class="config-summary-actions"><button type="button" data-edit-config="banner" data-index="${index}">Edit</button><button type="button" class="danger-btn" data-delete-config="banner" data-index="${index}">Delete</button></div></div>`).join('');
  }

  function renderSupport() {
    const list = $('supportConfigList');
    const s = state.supportConfig;
    const hasData = !!(s.timeStamp || s.helpLine || s.preAuth.dateExceededMessage || s.preAuth.amountLimitMessage || s.preAuth.completionReminderMessage);
    if (!hasData) { list.innerHTML = '<div class="empty">No support configuration added yet.</div>'; $('addSupportBtn').textContent = '+ Add Support'; return; }
    list.innerHTML = `<div class="config-summary"><div class="config-summary-main"><div class="config-summary-title">Support & Pre-Auth</div><div class="config-summary-meta">Help Line: ${esc(s.helpLine || '-')} · Time Stamp: ${esc(s.timeStamp || '-')}</div></div><div class="config-summary-actions"><button type="button" data-edit-config="support" data-index="0">Edit</button><button type="button" class="danger-btn" data-delete-config="support" data-index="0">Delete</button></div></div>`;
    $('addSupportBtn').textContent = 'Edit Support';
  }

  function showModal(type, index = -1) {
    ensureState(); editingType = type; editingIndex = index;
    const body = $('configModalBody'); let title = 'Add Configuration'; let subtitle = 'Enter configuration details.'; let html = '';
    if (type === 'image') {
      title = index >= 0 ? 'Edit Image Configuration' : 'Add Image Configuration'; subtitle = 'Configure image file, date range and transaction type.';
      const item = index >= 0 ? state.imageConfig.config[index] : { startDate: '', endDate: '', imageFileName: '', txnType: 'all' };
      html = `<div class="form-grid"><div class="field"><label for="cfgStartDate">Start Date *</label><input id="cfgStartDate" type="date" value="${esc(item.startDate)}"></div><div class="field"><label for="cfgEndDate">End Date *</label><input id="cfgEndDate" type="date" value="${esc(item.endDate)}"></div></div><div class="form-grid single-row form-row"><div class="field"><label for="cfgImageFileName">Image File Name *</label><input id="cfgImageFileName" value="${esc(item.imageFileName)}"></div></div><div class="form-grid single-row"><div class="field"><label for="cfgTxnType">Transaction Type</label><input id="cfgTxnType" value="${esc(item.txnType || 'all')}" placeholder="all"></div></div>`;
    } else if (type === 'pfx') {
      title = state.pfxConfig.pfxFileName ? 'Edit PFX Configuration' : 'Add PFX Configuration'; subtitle = 'Configure the client certificate file.';
      html = `<div class="form-grid"><div class="field"><label for="cfgPfxFileName">PFX File Name *</label><input id="cfgPfxFileName" value="${esc(state.pfxConfig.pfxFileName)}" placeholder="BHClient.p12"></div><div class="field"><label for="cfgPfxTimestamp">Time Stamp</label><input id="cfgPfxTimestamp" value="${esc(state.pfxConfig.timeStamp)}" placeholder="1"></div></div>`;
    } else if (type === 'banner') {
      title = index >= 0 ? 'Edit Banner Configuration' : 'Add Banner Configuration'; subtitle = 'Configure banner file and TID availability.';
      const item = index >= 0 ? state.bannerConfig[index] : { bannerName: '', bannerId: '', availabilityType: 0, tids: [] };
      html = `<div class="form-grid"><div class="field"><label for="cfgBannerName">Banner Name *</label><input id="cfgBannerName" value="${esc(item.bannerName)}"></div><div class="field"><label for="cfgBannerId">Banner ID</label><input id="cfgBannerId" value="${esc(item.bannerId)}"></div></div><div class="form-grid single-row form-row"><div class="field"><label for="cfgBannerAvailability">Availability Type</label><select id="cfgBannerAvailability"><option value="0" ${Number(item.availabilityType) === 0 ? 'selected' : ''}>All</option><option value="1" ${Number(item.availabilityType) === 1 ? 'selected' : ''}>TID Based</option></select></div></div><div id="cfgBannerTidWrap" class="section-block ${Number(item.availabilityType) === 1 ? '' : 'hidden'}"><h3>TIDs</h3><textarea id="cfgBannerTids" rows="5" placeholder="One TID per line">${esc((item.tids || []).join('\n'))}</textarea></div>`;
    } else if (type === 'support') {
      title = state.supportConfig.helpLine || state.supportConfig.timeStamp ? 'Edit Support Configuration' : 'Add Support Configuration'; subtitle = 'Configure help line and pre-auth messages.';
      const s = state.supportConfig;
      html = `<div class="form-grid"><div class="field"><label for="cfgSupportTimestamp">Time Stamp</label><input id="cfgSupportTimestamp" value="${esc(s.timeStamp)}"></div><div class="field"><label for="cfgHelpLine">Help Line</label><input id="cfgHelpLine" value="${esc(s.helpLine)}"></div></div><div class="section-block"><h3>Pre-Auth Messages</h3><div class="config-message-grid"><div class="field"><label for="cfgDateExceeded">Date Exceeded Message</label><textarea id="cfgDateExceeded" rows="3">${esc(s.preAuth.dateExceededMessage)}</textarea></div><div class="field"><label for="cfgAmountLimit">Amount Limit Message</label><textarea id="cfgAmountLimit" rows="3">${esc(s.preAuth.amountLimitMessage)}</textarea></div><div class="field"><label for="cfgCompletionReminder">Completion Reminder Message</label><textarea id="cfgCompletionReminder" rows="3">${esc(s.preAuth.completionReminderMessage)}</textarea></div></div></div>`;
    }
    $('configModalTitle').textContent = title; $('configModalSubtitle').textContent = subtitle; body.innerHTML = html; $('configModal').classList.remove('hidden');
    const first = body.querySelector('input, select, textarea'); if (first) first.focus();
    if (type === 'banner') $('cfgBannerAvailability').addEventListener('change', () => $('cfgBannerTidWrap').classList.toggle('hidden', $('cfgBannerAvailability').value !== '1'));
  }

  function closeModal() { $('configModal').classList.add('hidden'); editingType = ''; editingIndex = -1; }

  function saveConfig() {
    if (editingType === 'image') {
      const item = { startDate: $('cfgStartDate').value, endDate: $('cfgEndDate').value, imageFileName: $('cfgImageFileName').value.trim(), txnType: $('cfgTxnType').value.trim() || 'all' };
      if (!item.startDate || !item.endDate || !item.imageFileName) return toast('Start Date, End Date and Image File Name are required');
      if (editingIndex >= 0) state.imageConfig.config[editingIndex] = item; else state.imageConfig.config.push(item);
    } else if (editingType === 'pfx') {
      const fileName = $('cfgPfxFileName').value.trim(); if (!fileName) return toast('PFX File Name is required');
      state.pfxConfig = { pfxFileName: fileName, timeStamp: $('cfgPfxTimestamp').value.trim() };
    } else if (editingType === 'banner') {
      const item = { bannerName: $('cfgBannerName').value.trim(), bannerId: $('cfgBannerId').value.trim(), availabilityType: Number($('cfgBannerAvailability').value), tids: $('cfgBannerAvailability').value === '1' ? $('cfgBannerTids').value.split(/\r?\n/).map(v => v.trim()).filter(Boolean) : [] };
      if (!item.bannerName) return toast('Banner Name is required');
      if (editingIndex >= 0) state.bannerConfig[editingIndex] = item; else state.bannerConfig.push(item);
    } else if (editingType === 'support') {
      state.supportConfig = { timeStamp: $('cfgSupportTimestamp').value.trim(), helpLine: $('cfgHelpLine').value.trim(), preAuth: { dateExceededMessage: $('cfgDateExceeded').value, amountLimitMessage: $('cfgAmountLimit').value, completionReminderMessage: $('cfgCompletionReminder').value } };
    }
    renderAll(); refreshPreview(); closeModal(); toast('Configuration saved');
  }

  function deleteConfig(type, index) {
    if (!confirm('Delete this configuration?')) return;
    if (type === 'image') state.imageConfig.config.splice(index, 1);
    if (type === 'banner') state.bannerConfig.splice(index, 1);
    if (type === 'pfx') state.pfxConfig = { pfxFileName: '', timeStamp: '' };
    if (type === 'support') state.supportConfig = structuredClone(defaults.supportConfig);
    renderAll(); refreshPreview(); toast('Configuration deleted');
  }

  function bindEvents() {
    $('addImageBtn').addEventListener('click', () => showModal('image'));
    $('addPfxBtn').addEventListener('click', () => showModal('pfx'));
    $('addBannerBtn').addEventListener('click', () => showModal('banner'));
    $('addSupportBtn').addEventListener('click', () => showModal('support'));
    $('closeConfigModalBtn').addEventListener('click', closeModal);
    $('cancelConfigBtn').addEventListener('click', closeModal);
    $('saveConfigBtn').addEventListener('click', saveConfig);
    $('configModal').addEventListener('click', e => { if (e.target === $('configModal')) closeModal(); });
    ['imageConfigList', 'pfxConfigList', 'bannerConfigList', 'supportConfigList'].forEach(id => $(id).addEventListener('click', e => {
      const edit = e.target.closest('[data-edit-config]'); const del = e.target.closest('[data-delete-config]');
      if (edit) showModal(edit.dataset.editConfig, Number(edit.dataset.index));
      if (del) deleteConfig(del.dataset.deleteConfig, Number(del.dataset.index));
    }));
  }

  const originalImportJson = window.importJson;
  window.importJson = function(file) { originalImportJson(file); setTimeout(() => { ensureState(); renderAll(); }, 0); };
  $('newBtn').addEventListener('click', () => { Object.assign(state, cloneDefaults()); renderAll(); refreshPreview(); });
  ensureState(); bindEvents(); renderAll();
})();
