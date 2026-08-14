(() => {
  const $ = id => document.getElementById(id);

  function showError(message) {
    const error = $('formError');
    if (!error) return;
    error.textContent = message;
    error.classList.remove('hidden');
  }

  function validateDuplicatePackage(event) {
    const packageName = $('packageName')?.value.trim();
    if (!packageName || !Array.isArray(state.appsConfig)) return;

    const editIndex = Number($('editIndex')?.value ?? -1);
    const duplicateIndex = state.appsConfig.findIndex((app, index) =>
      index !== editIndex && String(app.packageName || '').trim().toLowerCase() === packageName.toLowerCase()
    );

    if (duplicateIndex < 0) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    showError(`Application with Package Name "${packageName}" is already added.`);
  }

  function init() {
    const saveButton = $('saveAppBtn');
    if (!saveButton || saveButton.dataset.duplicateGuardAttached === 'true') return;
    saveButton.addEventListener('click', validateDuplicatePackage, true);
    saveButton.dataset.duplicateGuardAttached = 'true';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
