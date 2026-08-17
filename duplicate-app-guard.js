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
    const buildButton = event.target.closest('#buildPackageBtn, #buildPackageBtnTop');
    if (!buildButton) return;

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

  // When an application is already used as another application's dependency,
  // its dependency selector should not be editable here. Keep its existing
  // dependency values as hidden checked inputs so saving the form does not
  // accidentally clear them.
  const originalUpdateDependencyOptions = window.updateDependencyOptions;
  if (typeof originalUpdateDependencyOptions === 'function') {
    window.updateDependencyOptions = function(selected = []) {
      const current = Number($('editIndex')?.value ?? -1);
      const container = $('dependencyOptions');

      if (current >= 0 && container && typeof isDependencyOfAnotherApp === 'function' && isDependencyOfAnotherApp(current)) {
        const linked = typeof getLinkedDependencyNames === 'function'
          ? getLinkedDependencyNames(current)
          : [];
        const names = linked.length ? linked.map(escapeHtml).join(', ') : 'another application';

        const preserved = Array.isArray(selected) ? selected : [];
        const hiddenDependencies = preserved.map((dep, index) => `
          <input
            type="checkbox"
            id="preservedDependency-${index}"
            checked
            hidden
            data-app-name="${escapeHtml(dep.appName)}"
            data-package="${escapeHtml(dep.packageName)}"
            data-version="${escapeHtml(dep.appVersion)}"
          >`).join('');

        container.innerHTML = `
          <div class="dependency-link" style="margin-top:0">
            <span class="dependency-icon">↳</span>
            <span class="dependency-label">Dependency of</span>
            <span class="dependency-name">${names}</span>
          </div>
          ${hiddenDependencies}`;
        return;
      }

      originalUpdateDependencyOptions(selected);
    };
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
