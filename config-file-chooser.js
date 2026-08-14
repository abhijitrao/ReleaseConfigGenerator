(() => {
  const selected = { image: new Map(), pfx: new Map(), banner: new Map() };
  window.phase2ConfigFiles = selected;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));

  function addChooser(inputId, fileType, key, accept) {
    const input = $(inputId);
    if (!input || input.dataset.fileChooserAdded) return;
    input.dataset.fileChooserAdded = 'true';
    const wrapper = document.createElement('div');
    wrapper.className = 'config-file-chooser-row';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-btn config-file-choose-btn';
    button.textContent = 'Choose File';
    const hidden = document.createElement('input');
    hidden.type = 'file'; hidden.hidden = true; hidden.accept = accept;
    const status = document.createElement('span');
    status.className = 'config-file-chooser-status';
    const refresh = () => {
      const file = selected[fileType].get(String(key));
      status.textContent = file ? `✓ ${file.name}` : '';
      status.classList.toggle('hidden', !file);
    };
    button.addEventListener('click', () => hidden.click());
    hidden.addEventListener('change', () => {
      const file = hidden.files?.[0];
      if (!file) return;
      selected[fileType].set(String(key), file);
      if (fileType === 'image') input.value = file.name;
      if (fileType === 'pfx') input.value = file.name;
      if (fileType === 'banner') input.value = file.name;
      refresh();
    });
    wrapper.appendChild(button); wrapper.appendChild(hidden); wrapper.appendChild(status);
    refresh();
  }

  function watchModal() {
    const body = $('configModalBody');
    if (!body || body.dataset.fileChooserObserver) return;
    body.dataset.fileChooserObserver = 'true';
    const observer = new MutationObserver(() => {
      const title = $('configModalTitle')?.textContent || '';
      if (title.includes('Image Configuration')) {
        const index = window.__editingConfigIndex ?? document.querySelector('[data-edit-config="image"]')?.dataset.index ?? 0;
        addChooser('cfgImageFileName', 'image', index, '.png,.bmp,.jpg,.jpeg,.json');
      } else if (title.includes('PFX Configuration')) {
        addChooser('cfgPfxFileName', 'pfx', 0, '.p12,.pfx');
      } else if (title.includes('Banner Configuration')) {
        const index = window.__editingConfigIndex ?? 0;
        addChooser('cfgBannerName', 'banner', index, '.zip');
      }
    });
    observer.observe(body, { childList: true, subtree: true });
  }

  function init() {
    watchModal();
    document.addEventListener('click', e => {
      const edit = e.target.closest('[data-edit-config]');
      if (edit) window.__editingConfigIndex = Number(edit.dataset.index);
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();