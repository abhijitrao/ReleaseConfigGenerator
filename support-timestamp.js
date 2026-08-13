(() => {
  const $ = id => document.getElementById(id);
  let beforeSnapshot = null;

  const normalize = value => JSON.stringify(value ?? {});

  function getSupportSnapshot() {
    if (!window.state || !state.supportConfig) return null;
    return normalize({
      helpLine: state.supportConfig.helpLine || '',
      preAuth: {
        dateExceededMessage: state.supportConfig.preAuth?.dateExceededMessage || '',
        amountLimitMessage: state.supportConfig.preAuth?.amountLimitMessage || '',
        completionReminderMessage: state.supportConfig.preAuth?.completionReminderMessage || ''
      }
    });
  }

  function updateSupportTimestampBadge() {
    const badge = $('supportTimestampBadge');
    if (!badge || !window.state?.supportConfig) return;
    const value = state.supportConfig.timeStamp;
    badge.textContent = value ? `Time Stamp: ${value}` : '';
    badge.classList.toggle('hidden', !value);
  }

  function hideSupportTimestamp() {
    const input = $('cfgSupportTimestamp');
    if (!input) return;
    const field = input.closest('.field');
    if (field) field.style.display = 'none';
    input.setAttribute('aria-hidden', 'true');
    input.tabIndex = -1;
  }

  function captureSupportState() {
    setTimeout(() => {
      if ($('configModal') && !$('configModal').classList.contains('hidden') && $('cfgSupportTimestamp')) {
        hideSupportTimestamp();
        beforeSnapshot = getSupportSnapshot();
      }
    }, 0);
  }

  function incrementSupportTimestampIfChanged() {
    if (!beforeSnapshot || !window.state?.supportConfig) return;

    const afterSnapshot = getSupportSnapshot();
    if (beforeSnapshot === afterSnapshot) return;

    const current = Number.parseInt(state.supportConfig.timeStamp, 10);
    state.supportConfig.timeStamp = String(Number.isFinite(current) ? current + 1 : 1);

    if (typeof renderAll === 'function') renderAll();
    if (typeof refreshPreview === 'function') refreshPreview();
    updateSupportTimestampBadge();
  }

  document.addEventListener('click', event => {
    const target = event.target.closest?.('[data-edit-config], #addSupportBtn');
    if (!target) return;
    const type = target.dataset?.editConfig || (target.id === 'addSupportBtn' ? 'support' : '');
    if (type === 'support') captureSupportState();
  }, true);

  const saveButton = $('saveConfigBtn');
  if (saveButton) {
    saveButton.addEventListener('click', () => {
      setTimeout(() => {
        incrementSupportTimestampIfChanged();
        beforeSnapshot = null;
        updateSupportTimestampBadge();
      }, 0);
    });
  }

  const list = $('supportConfigList');
  if (list) {
    list.addEventListener('click', event => {
      const button = event.target.closest('[data-delete-config="support"]');
      if (!button) return;
      const oldTimestamp = state.supportConfig?.timeStamp;
      setTimeout(() => {
        if (window.state?.supportConfig && String(state.supportConfig.timeStamp ?? '') === String(oldTimestamp ?? '')) {
          const current = Number.parseInt(state.supportConfig.timeStamp, 10);
          state.supportConfig.timeStamp = String(Number.isFinite(current) ? current + 1 : 1);
          if (typeof renderAll === 'function') renderAll();
          if (typeof refreshPreview === 'function') refreshPreview();
        }
        updateSupportTimestampBadge();
      }, 0);
    });
  }

  setInterval(updateSupportTimestampBadge, 200);
})();
