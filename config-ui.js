(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  const defaultState = () => ({
    imageConfig: { config: [], timeStamp: '' },
    pfxConfig: { pfxFileName: '', timeStamp: '' },
    bannerConfig: [],
    supportConfig: {
      timeStamp: '',
      helpLine: '',
      preAuth: { dateExceededMessage: '', amountLimitMessage: '', completionReminderMessage: '' }
    }
  });

  function ensureState() {
    state.imageConfig ||= defaultState().imageConfig;
    state.pfxConfig ||= defaultState().pfxConfig;
    state.bannerConfig ||= [];
    state.supportConfig ||= defaultState().supportConfig;
    state.supportConfig.preAuth ||= defaultState().supportConfig.preAuth;
  }

  function syncFieldsFromState() {
    ensureState();
    $('imageTimestamp').value = state.imageConfig.timeStamp || '';
    $('pfxFileName').value = state.pfxConfig.pfxFileName || '';
    $('pfxTimestamp').value = state.pfxConfig.timeStamp || '';
    $('supportTimestamp').value = state.supportConfig.timeStamp || '';
    $('helpLine').value = state.supportConfig.helpLine || '';
    $('dateExceededMessage').value = state.supportConfig.preAuth.dateExceededMessage || '';
    $('amountLimitMessage').value = state.supportConfig.preAuth.amountLimitMessage || '';
    $('completionReminderMessage').value = state.supportConfig.preAuth.completionReminderMessage || '';
    renderImages();
    renderBanners();
  }

  function syncStateFromFields() {
    ensureState();
    state.imageConfig.timeStamp = $('imageTimestamp').value.trim();
    state.pfxConfig.pfxFileName = $('pfxFileName').value.trim();
    state.pfxConfig.timeStamp = $('pfxTimestamp').value.trim();
    state.supportConfig.timeStamp = $('supportTimestamp').value.trim();
    state.supportConfig.helpLine = $('helpLine').value.trim();
    state.supportConfig.preAuth.dateExceededMessage = $('dateExceededMessage').value;
    state.supportConfig.preAuth.amountLimitMessage = $('amountLimitMessage').value;
    state.supportConfig.preAuth.completionReminderMessage = $('completionReminderMessage').value;
  }

  function notifyPreview() {
    syncStateFromFields();
    refreshPreview();
  }

  function renderImages() {
    const list = $('imageConfigList');
    const items = state.imageConfig.config || [];
    if (!items.length) {
      list.innerHTML = '<div class="empty">No image configuration added yet.</div>';
      return;
    }
    list.innerHTML = items.map((item, index) => `
      <div class="config-item">
        <div class="config-item-grid">
          <div class="field"><label>Start Date</label><input type="date" data-image-field="startDate" data-index="${index}" value="${esc(item.startDate)}"></div>
          <div class="field"><label>End Date</label><input type="date" data-image-field="endDate" data-index="${index}" value="${esc(item.endDate)}"></div>
          <div class="field"><label>Image File Name</label><input data-image-field="imageFileName" data-index="${index}" value="${esc(item.imageFileName)}"></div>
          <div class="field"><label>Transaction Type</label><input data-image-field="txnType" data-index="${index}" value="${esc(item.txnType)}" placeholder="all"></div>
        </div>
        <button type="button" class="danger-btn" data-remove-image="${index}">Remove</button>
      </div>`).join('');
  }

  function addImage() {
    ensureState();
    state.imageConfig.config.push({ startDate: '', endDate: '', imageFileName: '', txnType: 'all' });
    renderImages();
  }

  function renderBanners() {
    const list = $('bannerConfigList');
    const items = state.bannerConfig || [];
    if (!items.length) {
      list.innerHTML = '<div class="empty">No banner configuration added yet.</div>';
      return;
    }
    list.innerHTML = items.map((item, index) => `
      <div class="config-item">
        <div class="config-item-grid">
          <div class="field"><label>Banner Name</label><input data-banner-field="bannerName" data-index="${index}" value="${esc(item.bannerName)}"></div>
          <div class="field"><label>Banner ID</label><input data-banner-field="bannerId" data-index="${index}" value="${esc(item.bannerId)}"></div>
          <div class="field"><label>Availability Type</label><select data-banner-field="availabilityType" data-index="${index}"><option value="0" ${Number(item.availabilityType) === 0 ? 'selected' : ''}>All</option><option value="1" ${Number(item.availabilityType) === 1 ? 'selected' : ''}>TID Based</option></select></div>
          <div class="field"><label>TIDs</label><textarea rows="2" data-banner-field="tids" data-index="${index}" placeholder="One TID per line">${esc((item.tids || []).join('\n'))}</textarea></div>
        </div>
        <button type="button" class="danger-btn" data-remove-banner="${index}">Remove</button>
      </div>`).join('');
  }

  function addBanner() {
    ensureState();
    state.bannerConfig.push({ bannerName: '', bannerId: '', availabilityType: 0, tids: [] });
    renderBanners();
  }

  function bindFieldEvents() {
    ['imageTimestamp','pfxFileName','pfxTimestamp','supportTimestamp','helpLine','dateExceededMessage','amountLimitMessage','completionReminderMessage'].forEach(id => $(id).addEventListener('input', notifyPreview));

    $('imageConfigList').addEventListener('input', e => {
      const field = e.target.dataset.imageField;
      if (!field) return;
      const index = Number(e.target.dataset.index);
      state.imageConfig.config[index][field] = e.target.value;
      refreshPreview();
    });
    $('imageConfigList').addEventListener('click', e => {
      const button = e.target.closest('[data-remove-image]');
      if (!button) return;
      state.imageConfig.config.splice(Number(button.dataset.removeImage), 1);
      renderImages();
      refreshPreview();
    });

    $('bannerConfigList').addEventListener('input', e => updateBannerField(e));
    $('bannerConfigList').addEventListener('change', e => updateBannerField(e));
    $('bannerConfigList').addEventListener('click', e => {
      const button = e.target.closest('[data-remove-banner]');
      if (!button) return;
      state.bannerConfig.splice(Number(button.dataset.removeBanner), 1);
      renderBanners();
      refreshPreview();
    });

    $('addImageBtn').addEventListener('click', () => { addImage(); refreshPreview(); });
    $('addBannerBtn').addEventListener('click', () => { addBanner(); refreshPreview(); });
  }

  function updateBannerField(event) {
    const field = event.target.dataset.bannerField;
    if (!field) return;
    const index = Number(event.target.dataset.index);
    if (field === 'availabilityType') state.bannerConfig[index][field] = Number(event.target.value);
    else if (field === 'tids') state.bannerConfig[index][field] = event.target.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    else state.bannerConfig[index][field] = event.target.value;
    refreshPreview();
  }

  const originalBuildOutput = window.buildOutput;
  window.buildOutput = function () {
    syncStateFromFields();
    const output = originalBuildOutput();
    output.imageConfig = state.imageConfig;
    output.pfxConfig = state.pfxConfig;
    output.bannerConfig = state.bannerConfig;
    output.supportConfig = state.supportConfig;
    return output;
  };

  const originalImportJson = window.importJson;
  window.importJson = function (file) {
    originalImportJson(file);
    setTimeout(syncFieldsFromState, 0);
  };

  const originalNewHandler = $('newBtn').onclick;
  $('newBtn').addEventListener('click', () => {
    Object.assign(state, defaultState());
    syncFieldsFromState();
    refreshPreview();
  });

  ensureState();
  bindFieldEvents();
  syncFieldsFromState();
})();
