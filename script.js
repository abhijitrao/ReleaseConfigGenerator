const MODEL_OPTIONS = ['PAX-A910', 'PAX-A910S', 'PAX-A99', 'PAX-A920', 'PAX-A9205', 'PAX-A9207', 'PAX-A930', 'Verifone-X990', 'Verifone-X990-Pro'];
const ANDROID_OPTIONS = ['Android 7', 'Android 10', 'Android 12', 'Android 14'];

const state = {
  version: 1,
  apps: []
};

const $ = (id) => document.getElementById(id);

function createChecks(container, values, prefix) {
  container.innerHTML = values.map((value, index) => `
    <label class="check-item">
      <input type="checkbox" data-prefix="${prefix}" value="${escapeHtml(value)}" id="${prefix}-${index}">
      <span>${escapeHtml(value)}</span>
    </label>`).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function getGlobalConfig() {
  return {
    isRunOnBackground: $('runBackground').checked,
    isConfirmationRequired: $('confirmation').checked,
    isShowErrorMessage: $('showError').checked,
    isDownloadOverWifiOnly: $('wifiOnly').checked
  };
}

function buildOutput() {
  return {
    ...getGlobalConfig(),
    apps: state.apps
  };
}

function refreshPreview() {
  $('jsonPreview').value = JSON.stringify(buildOutput(), null, 2);
}

function renderApps() {
  const container = $('appsContainer');
  if (!state.apps.length) {
    container.innerHTML = '<div class="empty">No applications added yet. Click <b>+ Add Application</b> to create one.</div>';
    return;
  }

  container.innerHTML = state.apps.map((app, index) => {
    const badges = [
      app.appVersion ? `v${app.appVersion}` : '',
      app.mandatory ? 'Mandatory' : 'Optional',
      app.autoInstall ? 'Auto Install' : ''
    ].filter(Boolean);
    return `<div class="app-row">
      <div class="app-main">
        <div class="app-title">${escapeHtml(app.title || app.appName)}</div>
        <div class="app-meta">${escapeHtml(app.packageName)}${app.revisionId ? ` · Revision ${escapeHtml(app.revisionId)}` : ''}</div>
        <div class="badges">${badges.map((b, i) => `<span class="badge ${i === 1 && app.mandatory ? 'green' : ''}">${escapeHtml(b)}</span>`).join('')}</div>
      </div>
      <div class="app-actions">
        <button data-action="edit" data-index="${index}">Edit</button>
        <button data-action="delete" data-index="${index}">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function resetForm() {
  $('appForm').reset();
  $('editIndex').value = '-1';
  $('modalTitle').textContent = 'Add Application';
  $('saveAppBtn').textContent = 'Save Application';
  $('formError').classList.add('hidden');
  document.querySelectorAll('#modelOptions input, #androidOptions input, #dependencyOptions input').forEach(i => i.checked = false);
  $('tids').value = '';
  $('tidSection').classList.add('hidden');
}

function openModal(index = -1) {
  resetForm();
  if (index >= 0) {
    const app = state.apps[index];
    $('editIndex').value = String(index);
    $('modalTitle').textContent = 'Edit Application';
    $('saveAppBtn').textContent = 'Update Application';
    $('title').value = app.title || '';
    $('appName').value = app.appName || '';
    $('packageName').value = app.packageName || '';
    $('appVersion').value = app.appVersion || '';
    $('revisionId').value = app.revisionId || '';
    $('availabilityType').value = String(app.availabilityType ?? 0);
    $('mandatory').checked = !!app.mandatory;
    $('autoInstall').checked = !!app.autoInstall;
    $('isDelete').checked = !!app.isDelete;
    $('tids').value = Array.isArray(app.tids) ? app.tids.join('\n') : '';
    setChecked('modelOptions', app.models || []);
    setChecked('androidOptions', app.androidVersions || []);
    setChecked('dependencyOptions', app.dependencies || []);
    updateTidVisibility();
  }
  $('appModal').classList.remove('hidden');
  $('title').focus();
}

function setChecked(containerId, values) {
  const set = new Set(values);
  document.querySelectorAll(`#${containerId} input`).forEach(input => input.checked = set.has(input.value));
}

function checkedValues(containerId) {
  return [...document.querySelectorAll(`#${containerId} input:checked`)].map(i => i.value);
}

function updateTidVisibility() {
  $('tidSection').classList.toggle('hidden', $('availabilityType').value !== '1');
}

function saveApp() {
  const title = $('title').value.trim();
  const appName = $('appName').value.trim();
  const packageName = $('packageName').value.trim();
  const appVersion = $('appVersion').value.trim();
  const error = $('formError');
  if (!title || !appName || !packageName || !appVersion) {
    error.textContent = 'Title, App Name, Package Name and App Version are required.';
    error.classList.remove('hidden');
    return;
  }

  const availabilityType = Number($('availabilityType').value);
  const app = {
    title,
    appName,
    packageName,
    appVersion,
    revisionId: $('revisionId').value.trim(),
    availabilityType,
    models: checkedValues('modelOptions'),
    androidVersions: checkedValues('androidOptions'),
    mandatory: $('mandatory').checked,
    autoInstall: $('autoInstall').checked,
    isDelete: $('isDelete').checked,
    tids: availabilityType === 1 ? $('tids').value.split(/\r?\n/).map(v => v.trim()).filter(Boolean) : [],
    dependencies: checkedValues('dependencyOptions')
  };

  const editIndex = Number($('editIndex').value);
  if (editIndex >= 0) state.apps[editIndex] = app;
  else state.apps.push(app);

  renderApps();
  refreshPreview();
  closeModal();
  toast(editIndex >= 0 ? 'Application updated' : 'Application added');
}

function renderDependencies() {
  const container = $('dependencyOptions');
  container.innerHTML = '<div class="empty">Add applications first to select dependencies.</div>';
}

function closeModal() {
  $('appModal').classList.add('hidden');
}

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1800);
}

function updateDependencies() {
  const container = $('dependencyOptions');
  const current = checkedValues('dependencyOptions');
  if (!state.apps.length) {
    renderDependencies();
    return;
  }
  container.innerHTML = state.apps.map((app, index) => `
    <label class="dependency-row">
      <input type="checkbox" value="${index}" ${current.includes(String(index)) ? 'checked' : ''}>
      <span>${escapeHtml(app.title || app.appName)} — ${escapeHtml(app.appVersion || '')}</span>
    </label>`).join('');
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      $('runBackground').checked = !!data.isRunOnBackground;
      $('confirmation').checked = !!data.isConfirmationRequired;
      $('showError').checked = !!data.isShowErrorMessage;
      $('wifiOnly').checked = !!data.isDownloadOverWifiOnly;
      state.apps = Array.isArray(data.apps) ? data.apps : [];
      renderApps();
      refreshPreview();
      toast('JSON imported');
    } catch (e) {
      toast('Invalid JSON file');
    }
  };
  reader.readAsText(file);
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(buildOutput(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'release-config.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('JSON downloaded');
}

$('modelOptions').innerHTML = '';
createChecks($('modelOptions'), MODEL_OPTIONS, 'model');
createChecks($('androidOptions'), ANDROID_OPTIONS, 'android');
renderDependencies();
renderApps();
refreshPreview();

['runBackground', 'confirmation', 'showError', 'wifiOnly'].forEach(id => $(id).addEventListener('change', refreshPreview));
$('addAppBtn').addEventListener('click', openModal);
$('newBtn').addEventListener('click', () => {
  state.apps = [];
  $('runBackground').checked = false;
  $('confirmation').checked = false;
  $('showError').checked = false;
  $('wifiOnly').checked = false;
  renderApps();
  refreshPreview();
  toast('New configuration created');
});
$('downloadBtn').addEventListener('click', downloadJson);
$('importBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });
$('copyBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('jsonPreview').value); toast('JSON copied'); }
  catch { toast('Copy failed'); }
});
$('closeModalBtn').addEventListener('click', closeModal);
$('cancelBtn').addEventListener('click', closeModal);
$('saveAppBtn').addEventListener('click', saveApp);
$('availabilityType').addEventListener('change', updateTidVisibility);
$('appsContainer').addEventListener('click', e => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const index = Number(button.dataset.index);
  if (button.dataset.action === 'edit') {
    updateDependencies();
    openModal(index);
  } else if (button.dataset.action === 'delete') {
    if (confirm(`Delete ${state.apps[index].title || state.apps[index].appName}?`)) {
      state.apps.splice(index, 1);
      renderApps();
      refreshPreview();
      toast('Application deleted');
    }
  }
});

$('appModal').addEventListener('click', e => { if (e.target === $('appModal')) closeModal(); });
