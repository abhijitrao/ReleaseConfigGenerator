(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let lastJson = '';

  function renderImages(items) {
    const list = $('imageConfigList');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="empty">No image configuration added yet.</div>';
      return;
    }
    list.innerHTML = items.map((item, index) => `
      <div class="config-summary">
        <div class="config-summary-main">
          <div class="config-summary-title">${esc(item.imageFileName || 'Unnamed Image')}</div>
          <div class="config-summary-meta">${esc(item.txnType || 'all')} · ${esc(item.startDate || 'No start date')} → ${esc(item.endDate || 'No end date')}</div>
        </div>
        <div class="config-summary-actions">
          <button type="button" data-edit-config="image" data-index="${index}">Edit</button>
          <button type="button" class="danger-btn" data-delete-config="image" data-index="${index}">Delete</button>
        </div>
      </div>`).join('');
  }

  function renderPfx(pfx) {
    const list = $('pfxConfigList');
    if (!list) return;
    if (!pfx.pfxFileName && !pfx.timeStamp) {
      list.innerHTML = '<div class="empty">No PFX configuration added yet.</div>';
      return;
    }
    list.innerHTML = `<div class="config-summary">
      <div class="config-summary-main">
        <div class="config-summary-title">${esc(pfx.pfxFileName || 'PFX Configuration')}</div>
        <div class="config-summary-meta">Time Stamp: ${esc(pfx.timeStamp || '-')}</div>
      </div>
      <div class="config-summary-actions">
        <button type="button" data-edit-config="pfx" data-index="0">Edit</button>
        <button type="button" class="danger-btn" data-delete-config="pfx" data-index="0">Delete</button>
      </div>
    </div>`;
  }

  function renderBanners(items) {
    const list = $('bannerConfigList');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="empty">No banner configuration added yet.</div>';
      return;
    }
    list.innerHTML = items.map((item, index) => `
      <div class="config-summary">
        <div class="config-summary-main">
          <div class="config-summary-title">${esc(item.bannerName || 'Unnamed Banner')}</div>
          <div class="config-summary-meta">ID: ${esc(item.bannerId || '-')} · ${Number(item.availabilityType) === 1 ? `TID Based · ${(item.tids || []).length} TID(s)` : 'All TIDs'}</div>
        </div>
        <div class="config-summary-actions">
          <button type="button" data-edit-config="banner" data-index="${index}">Edit</button>
          <button type="button" class="danger-btn" data-delete-config="banner" data-index="${index}">Delete</button>
        </div>
      </div>`).join('');
  }

  function renderSupport(s) {
    const list = $('supportConfigList');
    if (!list) return;
    const preAuth = s.preAuth || {};
    const hasData = !!(s.timeStamp || s.helpLine || preAuth.dateExceededMessage || preAuth.amountLimitMessage || preAuth.completionReminderMessage);
    if (!hasData) {
      list.innerHTML = '<div class="empty">No support configuration added yet.</div>';
      return;
    }
    list.innerHTML = `<div class="config-summary">
      <div class="config-summary-main">
        <div class="config-summary-title">Support & Pre-Auth</div>
        <div class="config-summary-meta">Help Line: ${esc(s.helpLine || '-')} · Time Stamp: ${esc(s.timeStamp || '-')}</div>
      </div>
      <div class="config-summary-actions">
        <button type="button" data-edit-config="support" data-index="0">Edit</button>
        <button type="button" class="danger-btn" data-delete-config="support" data-index="0">Delete</button>
      </div>
    </div>`;
  }

  function syncFromPreview() {
    const preview = $('jsonPreview');
    if (!preview || !preview.value || preview.value === lastJson) return;

    try {
      const data = JSON.parse(preview.value);
      if (!data || typeof data !== 'object') return;

      const imageConfig = data.imageConfig || { config: [], timeStamp: '' };
      const pfxConfig = data.pfxConfig || { pfxFileName: '', timeStamp: '' };
      const bannerConfig = Array.isArray(data.bannerConfig) ? data.bannerConfig : [];
      const supportConfig = data.supportConfig || {
        timeStamp: '',
        helpLine: '',
        preAuth: { dateExceededMessage: '', amountLimitMessage: '', completionReminderMessage: '' }
      };

      state.imageConfig = imageConfig;
      state.pfxConfig = pfxConfig;
      state.bannerConfig = bannerConfig;
      state.supportConfig = supportConfig;

      renderImages(imageConfig.config || []);
      renderPfx(pfxConfig);
      renderBanners(bannerConfig);
      renderSupport(supportConfig);
      lastJson = preview.value;
    } catch {
      // Wait until the preview contains valid JSON.
    }
  }

  // The JSON preview is the canonical output produced by script.js. Watching it
  // makes Import JSON and all later edits immediately reflect on the dashboard.
  setInterval(syncFromPreview, 250);
  syncFromPreview();
})();
