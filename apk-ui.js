(() => {
  let selectedApkFile = null;
  let originalApkFile = null;

  const $ = id => document.getElementById(id);
  const showStatus = (message, type = 'info') => {
    const el = $('apkFileStatus');
    if (!el) return;
    el.textContent = message;
    el.className = `apk-file-status ${type}`;
    el.classList.remove('hidden');
  };

  function chooseApk() {
    const input = $('apkFileInput');
    if (input) input.click();
  }

  async function onApkSelected(file) {
    if (!file) return;
    selectedApkFile = null;
    showStatus('Reading APK locally…', 'info');
    try {
      const metadata = await window.readApkMetadata(file);
      selectedApkFile = file;
      $('appName').value = metadata.zipFileName;
      $('packageName').value = metadata.packageName;
      $('appVersion').value = metadata.versionName || metadata.versionCode || '';
      showStatus(`✓ ${metadata.fileName} · ${metadata.packageName} · v${metadata.versionName || metadata.versionCode || 'unknown'}`, 'success');
    } catch (error) {
      selectedApkFile = null;
      $('apkFileInput').value = '';
      showStatus(error.message || 'Unable to read APK.', 'error');
    }
  }

  function captureBeforeOpen() {
    const index = Number($('editIndex')?.value ?? -1);
    originalApkFile = index >= 0 ? state.appsConfig[index]?.sourceApkFile || null : null;
    selectedApkFile = null;
    $('apkFileInput').value = '';
    const status = $('apkFileStatus');
    if (status) status.classList.add('hidden');
  }

  function attachOpenHook() {
    const addButton = $('addAppBtn');
    if (addButton) addButton.addEventListener('click', captureBeforeOpen, true);
  }

  function attachAppListHook() {
    const container = $('appsContainer');
    if (!container) return;
    container.addEventListener('click', e => {
      const button = e.target.closest('button[data-action="edit"]');
      if (!button) return;
      const index = Number(button.dataset.index);
      originalApkFile = state.appsConfig[index]?.sourceApkFile || null;
      selectedApkFile = null;
      setTimeout(() => {
        const status = $('apkFileStatus');
        if (status) {
          if (originalApkFile) showStatus(`Selected APK: ${originalApkFile.name}`, 'success');
          else status.classList.add('hidden');
        }
      }, 0);
    }, true);
  }

  function attachSaveHook() {
    const save = $('saveAppBtn');
    if (!save) return;
    save.addEventListener('click', () => {
      const beforeIndex = Number($('editIndex')?.value ?? -1);
      const isEdit = beforeIndex >= 0;
      setTimeout(() => {
        let index = beforeIndex;
        if (!isEdit) index = state.appsConfig.length - 1;
        if (index >= 0 && state.appsConfig[index]) {
          if (selectedApkFile) state.appsConfig[index].sourceApkFile = selectedApkFile;
          else if (originalApkFile) state.appsConfig[index].sourceApkFile = originalApkFile;
        }
        selectedApkFile = null;
        originalApkFile = null;
      }, 0);
    });
  }

  function loadPackageBuilder() {
    if (document.querySelector('script[data-phase2-package-builder]')) return;
    const script = document.createElement('script');
    script.src = `package-builder.js?v=${Date.now()}`;
    script.dataset.phase2PackageBuilder = 'true';
    document.body.appendChild(script);
  }

  function init() {
    const choose = $('chooseApkBtn');
    const input = $('apkFileInput');
    if (!choose || !input || typeof window.readApkMetadata !== 'function') return;
    choose.addEventListener('click', chooseApk);
    input.addEventListener('change', e => onApkSelected(e.target.files?.[0]));
    attachOpenHook();
    attachAppListHook();
    attachSaveHook();
    loadPackageBuilder();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
