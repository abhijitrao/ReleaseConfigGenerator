(() => {
  const $ = id => document.getElementById(id);
  const TYPES = ['image', 'support'];

  // Timestamp rules:
  // 1. Fresh/new configuration starts at 1 and never auto-increments.
  // 2. Import arms exactly one automatic increment per configuration.
  // 3. After the first actual add/edit/delete change, that imported timestamp
  //    increments once and automatic increment is permanently disarmed.
  // 4. Manual timestamp edit is final and permanently disarms auto-increment
  //    until the next JSON import.
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

  function setFreshTimestamp() {
    TYPES.forEach(type => {
      const value = getTimestamp(type);
      if (value === '' || value == null) setTimestamp(type, 1);
      status[type].imported = false;
      status[type].autoIncrementPending = false;
      status[type].manuallyEdited = false;
    });
    updateHeaders();
  }

  function markImported() {
    TYPES.forEach(type => {
      status[type].imported = true;
      status[type].autoIncrementPending = true;
      status[type].manuallyEdited = false;
    });
    updateHeaders();
  }

  function markFresh() {
    // New/fresh configuration always starts at 1. No automatic increment.
    TYPES.forEach(type => setTimestamp(type, 1));
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
        // Critical: this import has now consumed its single automatic bump.
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
    const value = window.prompt(`Edit ${type === 'image' ? 'Image' : 'Support'} Time Stamp`, String(current ?? 1));
    if (value === null) return;
    if (!/^\d+$/.test(value.trim())) {
      if (typeof toast === 'function') toast('Time Stamp must be a non-negative number');
      return;
    }

    setTimestamp(type, value.trim());

    // Manual timestamp is final. No future automatic increment until another
    // JSON import explicitly arms the automation again.
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

  // Capture the imported configuration state BEFORE save/delete mutates state.
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

  // Import is the ONLY event that arms automatic timestamp increment.
  document.addEventListener('change', event => {
    if (event.target?.id === 'fileInput' && event.target.files?.length) {
      markImported();
    }
  }, true);

  // New/fresh configuration: reset timestamps to 1 and disable automation.
  document.addEventListener('click', event => {
    if (event.target.closest('#newBtn')) markFresh();
  }, true);

  document.addEventListener('click', event => {
    const edit = event.target.closest('[data-timestamp-edit]');
    if (edit) editTimestamp(edit.dataset.timestampEdit);
  });

  const boot = () => {
    setFreshTimestamp();
    addEditButtons();
    updateHeaders();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();