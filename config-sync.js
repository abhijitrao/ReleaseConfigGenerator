(() => {
  const $ = id => document.getElementById(id);
  let lastJson = '';

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
        preAuth: {
          dateExceededMessage: '',
          amountLimitMessage: '',
          completionReminderMessage: ''
        }
      };

      // Keep the dashboard state in sync with the generated JSON. This also
      // handles Import JSON because script.js refreshes jsonPreview after import.
      state.imageConfig = imageConfig;
      state.pfxConfig = pfxConfig;
      state.bannerConfig = bannerConfig;
      state.supportConfig = supportConfig;

      lastJson = preview.value;
      window.dispatchEvent(new CustomEvent('release-config-sync'));
    } catch {
      // Ignore while the preview is temporarily empty or incomplete.
    }
  }

  window.addEventListener('release-config-sync', () => {
    // config-ui.js owns the dashboard render functions. Trigger its existing
    // render path through the configuration buttons' normal state refresh.
    const lists = ['imageConfigList', 'pfxConfigList', 'bannerConfigList', 'supportConfigList'];
    if (!lists.every(id => $(id))) return;

    // The config-ui module listens for this event below via its public hook.
    if (typeof window.renderReleaseConfigSections === 'function') {
      window.renderReleaseConfigSections();
    }
  });

  // Polling is intentional here: script.js currently owns JSON import and its
  // importJson function is local to that file. The preview is the canonical
  // generated output, so this keeps both modules synchronized without changing
  // the application workflow.
  setInterval(syncFromPreview, 250);
  syncFromPreview();
})();
