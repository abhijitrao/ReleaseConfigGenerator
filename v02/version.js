window.RELEASE_CONFIG_TOOL_VERSION = '1.2';

(() => {
  const style = document.createElement('style');
  style.textContent = `
    .preview-actions .icon-only-btn{width:52px;height:42px;padding:0;display:inline-flex;align-items:center;justify-content:center}
    .preview-actions .icon-only-btn svg{width:20px;height:20px;display:block}
    .preview-actions .icon-only-btn:hover{transform:translateY(-1px)}
  `;
  document.head.appendChild(style);

  const fullScreenIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const copyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const makeIconButton = (button, icon, label) => {
    if (!button) return;
    button.innerHTML = icon;
    button.classList.add('icon-only-btn');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.title = label;
  };

  const initPreviewIcons = () => {
    makeIconButton(document.getElementById('fullScreenBtn'), fullScreenIcon, 'Full Screen');
    makeIconButton(document.getElementById('copyBtn'), copyIcon, 'Copy JSON');
    makeIconButton(document.getElementById('fullScreenCopyBtn'), copyIcon, 'Copy JSON');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreviewIcons);
  } else {
    initPreviewIcons();
  }
})();