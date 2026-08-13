(() => {
  const $ = id => document.getElementById(id);
  const TYPES = ['image', 'support'];

  const numberTimestamp = value => {
    const n = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const contentSnapshot = type => {
    if (type === 'image') return JSON.stringify(state.imageConfig?.config || []);
    if (type === 'support') {
      const s = state.supportConfig || {};
      return JSON.stringify({
        helpLine: s.helpLine || '',
        preAuth: s.preAuth || {}
      });
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

  const capture = () => Object.fromEntries(TYPES.map(type => [type, {
    content: contentSnapshot(type),
    timestamp: String(getTimestamp(type) ?? '')
  }]));

  function processChanges(before) {
    TYPES.forEach(type => {
      const afterContent = contentSnapshot(type);
      const old = before[type];
      if (old.content !== afterContent && String(getTimestamp(type) ?? '') === old.timestamp) {
        setTimestamp(type, numberTimestamp(old.timestamp) + 1);
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

  // Capture BEFORE the configuration save runs. This must be synchronous because
  // the save handler changes state during the same click event.
  document.addEventListener('click', event => {
    const save = event.target.closest('#saveConfigBtn');
    const deleteButton = event.target.closest('[data-delete-config]');
    if (!save && !deleteButton) return;

    const before = capture();
    setTimeout(() => processChanges(before), 0);
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