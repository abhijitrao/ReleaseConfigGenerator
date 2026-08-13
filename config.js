const configState = { images: [], banners: [] };

const configEl = id => document.getElementById(id);
const configEscape = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

function configRefreshJson() {
  if (typeof refreshPreview === 'function') refreshPreview();
}

function renderImageConfig() {
  const container = configEl('imageConfigList');
  if (!configState.images.length) {
    container.innerHTML = '<div class="empty config-empty">No image configuration added.</div>';
    return;
  }
  container.innerHTML = configState.images.map((item, index) => `
    <div class="config-row">
      <div class="config-row-grid image-row-grid">
        <div class="field"><label>Start Date</label><input data-image="startDate" data-index="${index}" type="date" value="${configEscape(item.startDate)}"></div>
        <div class="field"><label>End Date</label><input data-image="endDate" data-index="${index}" type="date" value="${configEscape(item.endDate)}"></div>
        <div class="field"><label>Image File Name</label><input data-image="imageFileName" data-index="${index}" value="${configEscape(item.imageFileName)}"></div>
        <div class="field"><label>Transaction Type</label><input data-image="txnType" data-index="${index}" value="${configEscape(item.txnType)}" placeholder="all"></div>
      </div>
      <button class="danger-btn" data-remove-image="${index}" type="button">Remove</button>
    </div>`).join('');
}

function renderBannerConfig() {
  const container = configEl('bannerConfigList');
  if (!configState.banners.length) {
    container.innerHTML = '<div class="empty config-empty">No banner configuration added.</div>';
    return;
  }
  container.innerHTML = configState.banners.map((item, index) => `
    <div class="config-row">
      <div class="config-row-grid banner-row-grid">
        <div class="field"><label>Banner Name</label><input data-banner="bannerName" data-index="${index}" value="${configEscape(item.bannerName)}"></div>
        <div class="field"><label>Banner ID</label><input data-banner="bannerId" data-index="${index}" value="${configEscape(item.bannerId)}"></div>
        <div class="field"><label>Availability Type</label><select data-banner="availabilityType" data-index="${index}"><option value="0" ${Number(item.availabilityType) === 0 ? 'selected' : ''}>All</option><option value="1" ${Number(item.availabilityType) === 1 ? 'selected' : ''}>TID Based</option></select></div>
        <div class="field"><label>TIDs</label><textarea data-banner="tids" data-index="${index}" rows="2" placeholder="One TID per line">${configEscape((item.tids || []).join('\n'))}</textarea></div>
      </div>
      <button class="danger-btn" data-remove-banner="${index}" type="button">Remove</button>
    </div>`).join('');
}

function syncConfigStateFromInputs() {
  configState.images.forEach((item, index) => {
    document.querySelectorAll(`[data-image][data-index="${index}"]`).forEach(input => item[input.dataset.image] = input.value);
  });
  configState.banners.forEach((item, index) => {
    document.querySelectorAll(`[data-banner][data-index="${index}"]`).forEach(input => {
      const key = input.dataset.banner;
      item[key] = key === 'availabilityType' ? Number(input.value) : key === 'tids' ? input.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean) : input.value;
    });
  });
  if (typeof state !== 'undefined') {
    state.imageConfig = { config: configState.images, timeStamp: configEl('imageTimeStamp').value.trim() };
    state.pfxConfig = { pfxFileName: configEl('pfxFileName').value.trim(), timeStamp: configEl('pfxTimeStamp').value.trim() };
    state.bannerConfig = configState.banners;
    state.supportConfig = {
      timeStamp: configEl('supportTimeStamp').value.trim(),
      helpLine: configEl('helpLine').value.trim(),
      preAuth: {
        dateExceededMessage: configEl('dateExceededMessage').value,
        amountLimitMessage: configEl('amountLimitMessage').value,
        completionReminderMessage: configEl('completionReminderMessage').value
      }
    };
  }
}

function loadConfigStateFromJson() {
  if (typeof state === 'undefined') return;
  configState.images = Array.isArray(state.imageConfig?.config) ? structuredClone(state.imageConfig.config) : [];
  configState.banners = Array.isArray(state.bannerConfig) ? structuredClone(state.bannerConfig) : [];
  configEl('imageTimeStamp').value = state.imageConfig?.timeStamp || '';
  configEl('pfxFileName').value = state.pfxConfig?.pfxFileName || '';
  configEl('pfxTimeStamp').value = state.pfxConfig?.timeStamp || '';
  configEl('supportTimeStamp').value = state.supportConfig?.timeStamp || '';
  configEl('helpLine').value = state.supportConfig?.helpLine || '';
  configEl('dateExceededMessage').value = state.supportConfig?.preAuth?.dateExceededMessage || '';
  configEl('amountLimitMessage').value = state.supportConfig?.preAuth?.amountLimitMessage || '';
  configEl('completionReminderMessage').value = state.supportConfig?.preAuth?.completionReminderMessage || '';
  renderImageConfig();
  renderBannerConfig();
}

configEl('addImageBtn').addEventListener('click', () => {
  syncConfigStateFromInputs();
  configState.images.push({ startDate: '', endDate: '', imageFileName: '', txnType: 'all' });
  renderImageConfig();
  configRefreshJson();
});

configEl('addBannerBtn').addEventListener('click', () => {
  syncConfigStateFromInputs();
  configState.banners.push({ bannerName: '', bannerId: '', availabilityType: 0, tids: [] });
  renderBannerConfig();
  configRefreshJson();
});

document.addEventListener('input', event => {
  if (event.target.matches('[data-image], [data-banner], #imageTimeStamp, #pfxFileName, #pfxTimeStamp, #supportTimeStamp, #helpLine, #dateExceededMessage, #amountLimitMessage, #completionReminderMessage')) {
    syncConfigStateFromInputs();
    configRefreshJson();
  }
});

document.addEventListener('change', event => {
  if (event.target.matches('[data-image], [data-banner]')) {
    syncConfigStateFromInputs();
    configRefreshJson();
  }
});

document.addEventListener('click', event => {
  const imageButton = event.target.closest('[data-remove-image]');
  if (imageButton) {
    syncConfigStateFromInputs();
    configState.images.splice(Number(imageButton.dataset.removeImage), 1);
    renderImageConfig();
    configRefreshJson();
    return;
  }
  const bannerButton = event.target.closest('[data-remove-banner]');
  if (bannerButton) {
    syncConfigStateFromInputs();
    configState.banners.splice(Number(bannerButton.dataset.removeBanner), 1);
    renderBannerConfig();
    configRefreshJson();
  }
});

// Import/new are handled by script.js. Re-read the state after those actions complete.
configEl('fileInput').addEventListener('change', () => setTimeout(() => { loadConfigStateFromJson(); configRefreshJson(); }, 100));
configEl('newBtn').addEventListener('click', () => setTimeout(() => { loadConfigStateFromJson(); configRefreshJson(); }, 50));

loadConfigStateFromJson();
