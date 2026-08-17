(() => {
  const $ = id => document.getElementById(id);

  function showError(message) {
    const error = $('formError');
    if (!error) return;
    error.textContent = message;
    error.classList.remove('hidden');
  }

  function getDuplicatePackages() {
    const counts = new Map();
    (state.appsConfig || []).forEach(app => {
      const packageName = String(app?.packageName || '').trim();
      if (!packageName) return;
      const key = packageName.toLowerCase();
      const entry = counts.get(key) || { name: packageName, titles: [] };
      entry.titles.push(app?.title || app?.appName || packageName);
      counts.set(key, entry);
    });
    return [...counts.values()].filter(entry => entry.titles.length > 1);
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

  function validateBuildPackage(event) {
    // Duplicate package validation should only block the actual Build & Download
    // action. It must never block unrelated buttons after a clone creates a duplicate.
    const target = event.target?.closest?.('#buildPackageBtn');
    if (!target) return;

    const duplicates = getDuplicatePackages();
    if (!duplicates.length) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const details = duplicates
      .map(entry => `${entry.name} (${entry.titles.join(', ')})`)
      .join(' | ');

    const error = $('packageBuilderError');
    if (error) {
      error.textContent = `Duplicate Package Name found. Each application must have a unique package name: ${details}`;
      error.classList.remove('hidden');
    }
  }

  function init() {
    const saveButton = $('saveAppBtn');
    if (saveButton && saveButton.dataset.duplicateGuardAttached !== 'true') {
      saveButton.addEventListener('click', validateDuplicatePackage, true);
      saveButton.dataset.duplicateGuardAttached = 'true';
    }

    if (document.documentElement.dataset.buildDuplicateGuardAttached !== 'true') {
      document.addEventListener('click', validateBuildPackage, true);
      document.documentElement.dataset.buildDuplicateGuardAttached = 'true';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
