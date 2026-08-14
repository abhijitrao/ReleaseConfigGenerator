(() => {
  const modalIds = ['appModal', 'configModal', 'jsonFullScreenModal'];

  document.addEventListener('click', event => {
    const target = event.target;
    if (target instanceof HTMLElement && modalIds.includes(target.id)) {
      event.stopPropagation();
    }
  }, true);
})();
