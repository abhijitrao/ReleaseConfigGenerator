(() => {
  const $ = id => document.getElementById(id);
  const TYPES = ['image', 'support'];

  // Auto increment is only armed by JSON import. A fresh configuration starts
  // with timestamp 1 and never auto-increments. Each imported configuration
  // increments at most once, on the first actual change. Manual timestamp edits
  // permanently disarm auto-increment for that configuration.
  const status = Object.fromEntries(TYPES.map(type => [type, {
    imported: false,
    autoIncrementPending: false,
    manuallyEdited: false
  }]));

  const numberTimestamp = value => {
    const n = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const contentSnapshot = type => {
    if (type === 'image') return JSON.stringify(state.imageConfig?.config || []);
    if (type === 'support') {
      const s = state.supportConfig || {};
      return JSON.stringify({ helpLine: s.helpLine || '', preAuth: s.preAuth || {} });
    }
    return '';
  };

  const getTimestamp = type => type === 'image'
    ? state.imageConfig?.timeStamp
    : state.supportConfig?.timeStamp;

  const setTimestamp = (type, value) => {
    const normalized = String(numberTimestamp(value));
    if (type === 'image') state.imageConfig.timeStamp = normalized;
    if (type === 'support') state.supportConfig.timeStamp = normalized;
  };

  function markImported() {
    TYPES.forEach(type => {
      status[type].imported = true;
      status[type].autoIncrementPending = true;
      status[type].manuallyEdited = false;
    });
    updateHeaders();
  }

  function markFresh() {
    TYPES.forEach(type => {
      status[type].imported = false;
      status[type].autoIncrementPending = false;
      status[type].manuallyEdited = false;
    });
    updateHeaders();
  }

  function processChanges(before) {
    TYPES.forEach(type => {
      const current = status[type];
      if (!current.imported || !current.autoIncrementPending || current.manuallyEdited) return;

      const afterContent = contentSnapshot(type);
      if (before[type].content !== afterContent) {
        setTimestamp(type, numberTimestamp(before[type].timestamp) + 1);
        current.autoIncrementPending = false;
      }
    });

    if (typeof renderAll === 'function') renderAll();
    if (typeof refreshPreview === 'function') refreshPreview();
    updateHeaders();
  }

  function updateHeaders() {
    const imageBadge = $('imageTimestampBadge');
    if (imageBadge) {
      const value = getTimestamp('image');
      imageBadge.textContent = value === '' || value == null ? '' : `Time Stamp: ${value}`;
      imageBadge.classList.toggle('hidden', value === '' || value == null);
    }

    const supportBadge = $('supportTimestampBadge');
    if (supportBadge) {
      const value = getTimestamp('support');
      supportBadge.textContent = value === '' || value == null ? '' : `Time Stamp: ${value}`;
      supportBadge.classList.toggle('hidden', value === '' || value == null);
    }
  }

  function editTimestamp(type) {
    const current = getTimestamp(type);
    const value = window.prompt(`Edit ${type === 'image' ? 'Image' : 'Support'} Time Stamp`, String(current ?? 0));
    if (value === null) return;
    if (!/^\d+$/.test(value.trim())) {
      if (typeof toast === 'function') toast('Time Stamp must be a non-negative number');
      return;
    }

    setTimestamp(type, value.trim());

    // Manual timestamp is final. No future automatic increment for this config
    // until the next JSON import.
    status[type].manuallyEdited = true;
    status[type].autoIncrementPending = false;
    status[type].imported = false;

    updateHeaders();
    if (typeof renderAll === 'function') renderAll();
    if (typeof refreshPreview === 'function') refreshPreview();
    if (typeof toast === 'function') toast('Time Stamp updated');
  }

  function addEditButtons() {
    [
      { type: 'image', buttonId: 'addImageBtn' },
      { type: 'support', buttonId: 'addSupportBtn' }
    ].forEach(({ type, buttonId }) => {
      const button = $(buttonId);
      if (!button) return;
      const holder = button.parentElement;
      if (holder?.querySelector(`[data-timestamp-edit="${type}"]`)) return;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'timestamp-edit-btn';
      edit.dataset.timestampEdit = type;
      edit.title = 'Edit Time Stamp';
      edit.textContent = '✎';
      holder.insertBefore(edit, button);
    });
    updateHeaders();
  }

  // Capture before the configuration save/delete handler changes state.
  document.addEventListener('click', event => {
    const save = event.target.closest('#saveConfigBtn');
    const deleteButton = event.target.closest('[data-delete-config]');
    if (!save && !deleteButton) return;

    const before = Object.fromEntries(TYPES.map(type => [type, {
      content: contentSnapshot(type),
      timestamp: String(getTimestamp(type) ?? '')
    }]));

    setTimeout(() => processChanges(before), 0);
  }, true);

  // Import JSON is the only event that arms automatic timestamp increment.
  document.addEventListener('change', event => {
    if (event.target?.id === 'fileInput' && event.target.files?.length) {
      // The actual import handler runs after this capture listener and replaces
      // state with the imported values. Arm the one-time increment now.
      markImported();
    }
  }, true);

  // New configuration is a fresh state: timestamp remains at its initial value
  // and no automatic increment is enabled.
  document.addEventListener('click', event => {
    if (event.target.closest('#newBtn')) markFresh();
  }, true);

  document.addEventListener('click', event => {
    const edit = event.target.closest('[data-timestamp-edit]');
    if (edit) editTimestamp(edit.dataset.timestampEdit);
  });

  const boot = () => {
    addEditButtons();
    updateHeaders();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();