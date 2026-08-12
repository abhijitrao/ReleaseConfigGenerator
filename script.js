const MODEL_OPTIONS = ['X990', 'A910', 'A910S', 'A99', 'A920', 'A9205', 'A9207', 'A930'];
const ANDROID_OPTIONS = ['7', '10', '12', '14'];

const state = {
  appsConfig: [],
  whiteListPackageName: '',
  imageConfig: { config: [], timeStamp: '' },
  pfxConfig: { pfxFileName: '', timeStamp: '' },
  bannerConfig: [],
  supportConfig: { timeStamp: '', helpLine: '', preAuth: { dateExceededMessage: '', amountLimitMessage: '', completionReminderMessage: '' } }
};

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

function createChecks(container, values, prefix) {
  container.innerHTML = values.map((value, index) => `<label class="check-item"><input type="checkbox" id="${prefix}-${index}" value="${escapeHtml(value)}"><span>${escapeHtml(value)}</span></label>`).join('');
}
function checkedValues(containerId) { return [...document.querySelectorAll(`#${containerId} input:checked`)].map(i => i.value); }
function setChecked(containerId, values) { const set = new Set(values || []); document.querySelectorAll(`#${containerId} input`).forEach(i => i.checked = set.has(i.value)); }

function normalizeApp(app = {}) {
  return {
    title: app.title || '', appName: app.appName || '', packageName: app.packageName || '', appVersion: app.appVersion || '', revisionId: app.revisionId || '',
    isMandatoy: app.isMandatoy ?? app.mandatory ?? true,
    availabilityType: Number(app.availabilityType ?? 0),
    tids: Array.isArray(app.tids) ? app.tids : [],
    isDelete: app.isDelete ?? false,
    deleteType: Number(app.deleteType ?? 0),
    deleteTids: Array.isArray(app.deleteTids) ? app.deleteTids : [],
    modelName: Array.isArray(app.modelName) ? app.modelName : (app.models || []),
    androidVersion: Array.isArray(app.androidVersion) ? app.androidVersion : (app.androidVersions || []),
    autoInstall: app.autoInstall ?? false,
    dependency: Array.isArray(app.dependency) ? app.dependency.map(d => ({ appName: d.appName || '', packageName: d.packageName || '', appVersion: d.appVersion || '' })) : []
  };
}

const appKey = app => `${app.packageName}|${app.appVersion}`;
function isDependencyOfAnotherApp(index) {
  const target = state.appsConfig[index]; if (!target) return false;
  const key = appKey(target);
  return state.appsConfig.some((app, i) => i !== index && (app.dependency || []).some(d => `${d.packageName}|${d.appVersion}` === key));
}
function enforceDependencyAutoInstall() {
  const keys = new Set();
  state.appsConfig.forEach(app => (app.dependency || []).forEach(d => keys.add(`${d.packageName}|${d.appVersion}`)));
  state.appsConfig.forEach(app => { if (keys.has(appKey(app))) app.autoInstall = false; });
}

function buildOutput() {
  enforceDependencyAutoInstall();
  return {
    isRunOnBackground: $('runBackground').checked,
    isConfirmationRequired: $('confirmation').checked,
    isShowErrorMsg: $('showError').checked,
    isDownloadOverWifiOnly: $('wifiOnly').checked,
    appsConfig: state.appsConfig.map(normalizeApp),
    whiteListPackageName: state.whiteListPackageName,
    imageConfig: state.imageConfig,
    pfxConfig: state.pfxConfig,
    bannerConfig: state.bannerConfig,
    supportConfig: state.supportConfig
  };
}
function refreshPreview() { $('jsonPreview').value = JSON.stringify(buildOutput(), null, 4); }

function renderApps() {
  enforceDependencyAutoInstall();
  const container = $('appsContainer');
  if (!state.appsConfig.length) { container.innerHTML = '<div class="empty">No applications added yet. Click <b>+ Add Application</b>.</div>'; return; }
  container.innerHTML = state.appsConfig.map((app, index) => `
    <div class="app-row"><div class="app-main">
      <div class="app-title">${escapeHtml(app.title || app.appName)}</div>
      <div class="app-meta">${escapeHtml(app.packageName)} · v${escapeHtml(app.appVersion)}${app.revisionId ? ` · Revision ${escapeHtml(app.revisionId)}` : ''}</div>
      <div class="badges">
        <span class="badge ${app.isMandatoy ? 'green' : ''}">${app.isMandatoy ? 'Mandatory' : 'Optional'}</span>
        ${app.autoInstall ? '<span class="badge">Auto Install</span>' : '<span class="badge">Manual Install</span>'}
        ${isDependencyOfAnotherApp(index) ? '<span class="badge green">Dependency</span>' : ''}
        ${app.isDelete ? `<span class="badge">Delete${app.deleteType === 1 ? ` · ${app.deleteTids.length} TID(s)` : ''}</span>` : ''}
        ${app.modelName.map(m => `<span class="badge">${escapeHtml(m)}</span>`).join('')}
        ${app.androidVersion.map(v => `<span class="badge">Android ${escapeHtml(v)}</span>`).join('')}
      </div>
    </div><div class="app-actions">
      <button data-action="edit" data-index="${index}">Edit</button><button data-action="clone" data-index="${index}">Clone</button><button data-action="delete" data-index="${index}">Delete</button>
    </div></div>`).join('');
}

function updateTidVisibility() { $('tidSection').classList.toggle('hidden', $('availabilityType').value !== '1'); }
function updateDeleteTidVisibility() { $('deleteTidSection').classList.toggle('hidden', !$('isDelete').checked); }

function updateDependencyOptions(selectedDependencies = []) {
  const container = $('dependencyOptions');
  const selected = new Set(selectedDependencies.map(d => `${d.packageName}|${d.appVersion}`));
  const currentEdit = Number($('editIndex').value);
  const candidates = state.appsConfig.filter((_, i) => i !== currentEdit);
  if (!candidates.length) { container.innerHTML = '<div class="empty">Add other applications first to configure dependencies.</div>'; return; }
  container.innerHTML = candidates.map(app => {
    const key = appKey(app);
    return `<label class="dependency-row"><input type="checkbox" value="${escapeHtml(key)}" data-app-name="${escapeHtml(app.appName)}" data-package="${escapeHtml(app.packageName)}" data-version="${escapeHtml(app.appVersion)}" ${selected.has(key) ? 'checked' : ''}><span>${escapeHtml(app.title || app.appName)} — ${escapeHtml(app.packageName)} — ${escapeHtml(app.appVersion)}</span></label>`;
  }).join('');
}
function getDependencies() { return [...document.querySelectorAll('#dependencyOptions input:checked')].map(i => ({ appName: i.dataset.appName, packageName: i.dataset.package, appVersion: i.dataset.version })); }

function resetForm() {
  $('appForm').reset(); $('editIndex').value = '-1'; $('modalTitle').textContent = 'Add Application'; $('saveAppBtn').textContent = 'Save Application'; $('formError').classList.add('hidden');
  setChecked('modelOptions', []); setChecked('androidOptions', []); $('tids').value = ''; $('deleteTids').value = '';
  $('tidSection').classList.add('hidden'); $('deleteTidSection').classList.add('hidden'); $('autoInstall').disabled = false; updateDependencyOptions();
}

function updateAutoInstallControl(index) {
  const disabled = isDependencyOfAnotherApp(index); $('autoInstall').disabled = disabled; if (disabled) $('autoInstall').checked = false;
}

function openModal(index = -1) {
  resetForm();
  if (index >= 0) {
    const app = state.appsConfig[index];
    $('editIndex').value = String(index); $('modalTitle').textContent = 'Edit Application'; $('saveAppBtn').textContent = 'Update Application';
    $('title').value = app.title; $('appName').value = app.appName; $('packageName').value = app.packageName; $('appVersion').value = app.appVersion; $('revisionId').value = app.revisionId;
    $('availabilityType').value = String(app.availabilityType); $('mandatory').checked = !!app.isMandatoy; $('autoInstall').checked = !!app.autoInstall; $('isDelete').checked = !!app.isDelete;
    $('tids').value = app.tids.join('\n'); $('deleteTids').value = app.deleteTids.join('\n');
    setChecked('modelOptions', app.modelName); setChecked('androidOptions', app.androidVersion); updateDependencyOptions(app.dependency); updateTidVisibility(); updateDeleteTidVisibility(); updateAutoInstallControl(index);
  }
  $('appModal').classList.remove('hidden'); $('title').focus();
}

function saveApp() {
  const title = $('title').value.trim(), appName = $('appName').value.trim(), packageName = $('packageName').value.trim(), appVersion = $('appVersion').value.trim();
  if (!title || !appName || !packageName || !appVersion) { $('formError').textContent = 'Title, App Name, Package Name and App Version are required.'; $('formError').classList.remove('hidden'); return; }

  const availabilityType = Number($('availabilityType').value);
  const isDelete = $('isDelete').checked;
  const deleteTids = isDelete ? $('deleteTids').value.split(/\r?\n/).map(v => v.trim()).filter(Boolean) : [];
  const app = normalizeApp({
    title, appName, packageName, appVersion, revisionId: $('revisionId').value.trim(), isMandatoy: $('mandatory').checked, availabilityType,
    tids: availabilityType === 1 ? $('tids').value.split(/\r?\n/).map(v => v.trim()).filter(Boolean) : [],
    isDelete,
    deleteType: isDelete && deleteTids.length ? 1 : 0,
    deleteTids,
    modelName: checkedValues('modelOptions'), androidVersion: checkedValues('androidOptions'),
    autoInstall: $('autoInstall').disabled ? false : $('autoInstall').checked,
    dependency: getDependencies()
  });

  const index = Number($('editIndex').value); if (index >= 0) state.appsConfig[index] = app; else state.appsConfig.push(app);
  enforceDependencyAutoInstall(); renderApps(); refreshPreview(); closeModal(); toast(index >= 0 ? 'Application updated' : 'Application added');
}

function closeModal() { $('appModal').classList.add('hidden'); }
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 1800); }

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      $('runBackground').checked = !!data.isRunOnBackground; $('confirmation').checked = !!data.isConfirmationRequired; $('showError').checked = !!data.isShowErrorMsg; $('wifiOnly').checked = !!data.isDownloadOverWifiOnly;
      state.appsConfig = Array.isArray(data.appsConfig) ? data.appsConfig.map(normalizeApp) : [];
      state.whiteListPackageName = data.whiteListPackageName || ''; state.imageConfig = data.imageConfig || { config: [], timeStamp: '' }; state.pfxConfig = data.pfxConfig || { pfxFileName: '', timeStamp: '' }; state.bannerConfig = Array.isArray(data.bannerConfig) ? data.bannerConfig : [];
      state.supportConfig = data.supportConfig || { timeStamp: '', helpLine: '', preAuth: { dateExceededMessage: '', amountLimitMessage: '', completionReminderMessage: '' } };
      enforceDependencyAutoInstall(); renderApps(); refreshPreview(); toast(`Imported ${state.appsConfig.length} application(s)`);
    } catch { toast('Invalid JSON file'); }
  }; reader.readAsText(file);
}
function downloadJson() {
  const blob = new Blob([JSON.stringify(buildOutput(), null, 4)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'appstore-config.json'; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); toast('JSON downloaded');
}

createChecks($('modelOptions'), MODEL_OPTIONS, 'model'); createChecks($('androidOptions'), ANDROID_OPTIONS, 'android'); renderApps(); refreshPreview();
['runBackground','confirmation','showError','wifiOnly'].forEach(id => $(id).addEventListener('change', refreshPreview));
$('addAppBtn').addEventListener('click', () => openModal()); $('closeModalBtn').addEventListener('click', closeModal); $('cancelBtn').addEventListener('click', closeModal); $('saveAppBtn').addEventListener('click', saveApp);
$('availabilityType').addEventListener('change', updateTidVisibility); $('isDelete').addEventListener('change', updateDeleteTidVisibility);
$('importBtn').addEventListener('click', () => $('fileInput').click()); $('fileInput').addEventListener('change', e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; }); $('downloadBtn').addEventListener('click', downloadJson);
$('copyBtn').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('jsonPreview').value); toast('JSON copied'); } catch { toast('Copy failed'); } });
$('newBtn').addEventListener('click', () => { state.appsConfig=[]; state.whiteListPackageName=''; state.imageConfig={config:[],timeStamp:''}; state.pfxConfig={pfxFileName:'',timeStamp:''}; state.bannerConfig=[]; state.supportConfig={timeStamp:'',helpLine:'',preAuth:{dateExceededMessage:'',amountLimitMessage:'',completionReminderMessage:''}}; $('runBackground').checked=false; $('confirmation').checked=false; $('showError').checked=false; $('wifiOnly').checked=false; renderApps(); refreshPreview(); toast('New configuration created'); });
$('appsContainer').addEventListener('click', e => { const button=e.target.closest('button[data-action]'); if(!button)return; const index=Number(button.dataset.index); const action=button.dataset.action; if(action==='edit')openModal(index); if(action==='clone'){const clone=structuredClone(state.appsConfig[index]); clone.title=`${clone.title} Copy`; state.appsConfig.splice(index+1,0,clone); enforceDependencyAutoInstall(); renderApps(); refreshPreview(); toast('Application cloned');} if(action==='delete' && confirm(`Delete ${state.appsConfig[index].title || state.appsConfig[index].appName}?`)){state.appsConfig.splice(index,1); enforceDependencyAutoInstall(); renderApps(); refreshPreview(); toast('Application deleted');} });
$('appModal').addEventListener('click', e => { if(e.target === $('appModal')) closeModal(); });
