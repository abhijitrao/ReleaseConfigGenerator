(() => {
  const $ = id => document.getElementById(id);
  const TYPES = ['image', 'pfx', 'banner', 'support'];

  const clone = value => structuredClone(value);
  const numberTimestamp = value => {
    const n = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const contentSnapshot = type => {
    if (type === 'image') return JSON.stringify((state.imageConfig?.config || []));
    if (type === 'pfx') return JSON.stringify({ pfxFileName: state.pfxConfig?.pfxFileName || '' });
    if (type === 'banner') return JSON.stringify(state.bannerConfig || []);
    if (type === 'support') {
      const s = state.supportConfig || {};
      return JSON.stringify({
        helpLine: s.helpLine || '',
        preAuth: s.preAuth || {}
      });
    }
    return '';
  };

  const getTimestamp = type => {
    if (type === 'image') return state.imageConfig?.timeStamp;
    if (type === 'pfx') return state.pfxConfig?.timeStamp;
    if (type === 'banner') return state.bannerConfigTimeStamp;
    if (type === 'support') return state.supportConfig?.timeStamp;
    return '';
  };

  const setTimestamp = (type, value) => {
    const normalized = String(numberTimestamp(value));
    if (type === 'image') state.imageConfig.timeStamp = normalized;
    if (type === 'pfx') state.pfxConfig.timeStamp = normalized;
    if (type === 'banner') state.bannerConfigTimeStamp = normalized;
    if (type === 'support') state.supportConfig.timeStamp = normalized;
  };

  // Banner timestamp is not currently present in the JSON schema used by this project.
  // Keep the manager schema-safe: only increment bannerConfig if a timestamp property is
  // already present in the imported JSON. Otherwise banner changes are not given a new field.
  const hasBannerTimestamp = () => Object.prototype.hasOwnProperty.call(state, 'bannerConfigTimeStamp');

  function capture() {
    return Object.fromEntries(TYPES.map(type => [type, {
      content: contentSnapshot(type),
      timestamp: String(getTimestamp(type) ?? '')
    }]));
  }

  function processChanges(before) {
    TYPES.forEach(type => {
      if (type === 'banner' && !hasBannerTimestamp()) return;
      const afterContent = contentSnapshot(type);
      const old = before[type];
      if (old.content !== afterContent && String(getTimestamp(type) ?? '') === old.timestamp) {
        setTimestamp(type, numberTimestamp(old.timestamp) + 1);
      }
    });
    if (typeof renderAll === 'function') renderAll();
    if (typeof refreshPreview === 'function') refreshPreview();
  }

  function addHeaderControls() {
    const configs = [
      { type: 'image', card: '.config-card:nth-of-type(3)', buttonId: 'addImageBtn', badgeId: 'imageTimestampBadge', title: 'Image Configuration' },
      { type: 'pfx', card: '.config-card:nth-of-type(4)', buttonId: 'addPfxBtn', title: 'PFX Configuration' },
      { type: 'banner', card: '.config-card:nth-of-type(5)', buttonId: 'addBannerBtn', title: 'Banner Configuration' },
      { type: 'support', card: '.config-card:nth-of-type(6)', buttonId: 'addSupportBtn', title: 'Support Configuration' }
    ];

    configs.forEach(({ type, buttonId, badgeId }) => {
      const button = $(buttonId);
      if (!button || button.parentElement?.querySelector(`[data-timestamp-type="${type}"]`)) return;
      const holder = button.parentElement;
      const badge = badgeId ? $(badgeId) : document.createElement('span');
      if (!badgeId) {
        badge.className = 'header-timestamp';
        holder.insertBefore(badge, button);
      }
      badge.dataset.timestampType = type;
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'timestamp-edit-btn';
      edit.dataset.timestampType = type;
      edit.title = 'Edit Time Stamp';
      edit.textContent = '✎';
      holder.insertBefore(edit, button);
    });
    updateHeaderTimestamps();
  }

  function updateHeaderTimestamps() {
    document.querySelectorAll('[data-timestamp-type]').forEach(el => {
      const type = el.dataset.timestampType;
      if (!TYPES.includes(type)) return;
      const value = getTimestamp(type);
      if (el.classList.contains('timestamp-edit-btn')) return;
      el.textContent = value === '' || value == null ? 'Time Stamp: 0' : `Time Stamp: ${value}`;
      el.classList.remove('hidden');
    });
  }

  function editTimestamp(type) {
    const current = getTimestamp(type);
    const value = window.prompt(`Edit ${type.charAt(0).toUpperCase() + type.slice(1)} Time Stamp`, String(current ?? 0));
    if (value === null) return;
    if (!/^\d+$/.test(value.trim())) {
      if (typeof toast === 'function') toast('Time Stamp must be a non-negative number');
      return;
    }
    setTimestamp(type, value.trim());
    updateHeaderTimestamps();
    if (typeof renderAll === 'function') renderAll();
    if (typeof refreshPreview === 'function') refreshPreview();
    if (typeof toast === 'function') toast('Time Stamp updated');
  }

  // Capture configuration state before Save/Delete, then apply one timestamp increment
  // only when the configuration content actually changed.
  document.addEventListener('click', event => {
    const save = event.target.closest('#saveConfigBtn');
    const deleteButton = event.target.closest('[data-delete-config]');
    if (!save && !deleteButton) return;

    const before = capture();
    setTimeout(() => processChanges(before), 0);
  }, true);

  document.addEventListener('click', event => {
    const edit = event.target.closest('.timestamp-edit-btn');
    if (edit) editTimestamp(edit.dataset.timestampType);
  });

  const boot = () => {
    // Banner currently has no timestamp field in the JSON schema. Add support only when
    // an imported/edited object explicitly contains one.
    if (state.bannerConfig && Object.prototype.hasOwnProperty.call(state.bannerConfig, 'timeStamp')) {
      state.bannerConfigTimeStamp = state.bannerConfig.timeStamp;
      delete state.bannerConfig.timeStamp;
    }
    addHeaderControls();
    updateHeaderTimestamps();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
