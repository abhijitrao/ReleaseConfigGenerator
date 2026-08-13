(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  let lastSignature = '';

  const badge = (text, tone = '') => `<span class="badge ${tone}">${esc(text)}</span>`;
  const actions = (type, index) => `<div class="app-actions"><button type="button" data-edit-config="${type}" data-index="${index}">Edit</button><button type="button" class="danger-btn" data-delete-config="${type}" data-index="${index}">Delete</button></div>`;
  const shell = (title, meta, badges, type, index, extra = '') => `<div class="config-app-row"><div class="config-app-main"><div class="config-app-title">${esc(title)}</div><div class="config-app-meta">${meta}</div>${extra}<div class="badges">${badges.filter(Boolean).join('')}</div></div>${actions(type, index)}</div>`;

  function renderImages(items, timeStamp = '') {
    const list = $('imageConfigList');
    const timestamp = $('imageTimestampBadge');
    if (timestamp) {
      timestamp.textContent = timeStamp ? `Time Stamp: ${timeStamp}` : '';
      timestamp.classList.toggle('hidden', !timeStamp);
    }
    if (!items.length) {
      list.innerHTML = '<div class="empty">No image configuration added yet.</div>';
      return;
    }
    list.innerHTML = items.map((item, index) => shell(
      item.imageFileName || 'Unnamed Image',
      `<span>${esc(item.txnType || 'all')}</span><span class="meta-separator">·</span><span>${esc(item.startDate || '-')} → ${esc(item.endDate || '-')}</span>`,
      [badge('Image', 'blue-soft'), badge(item.txnType || 'all'), item.startDate ? badge(`${item.startDate} → ${item.endDate || '-'}`) : ''],
      'image', index
    )).join('');
  }

  function renderPfx(pfx) {
    const list = $('pfxConfigList');
    if (!pfx.pfxFileName && !pfx.timeStamp) {
      list.innerHTML = '<div class="empty">No PFX configuration added yet.</div>';
      return;
    }
    list.innerHTML = shell(
      pfx.pfxFileName || 'PFX Configuration',
      `<span>Client certificate</span><span class="meta-separator">·</span><span>Time Stamp: ${esc(pfx.timeStamp || '-')}</span>`,
      [badge('PFX', 'blue-soft'), pfx.timeStamp ? badge(`Time Stamp ${pfx.timeStamp}`) : ''],
      'pfx', 0
    );
  }

  function renderBanners(items) {
    const list = $('bannerConfigList');
    if (!items.length) {
      list.innerHTML = '<div class="empty">No banner configuration added yet.</div>';
      return;
    }
    list.innerHTML = items.map((item, index) => {
      const tidCount = Array.isArray(item.tids) ? item.tids.length : 0;
      return shell(
        item.bannerName || 'Unnamed Banner',
        `<span>Banner ID: ${esc(item.bannerId || '-')}</span><span class="meta-separator">·</span><span>${Number(item.availabilityType) === 1 ? `TID Based · ${tidCount} TID(s)` : 'All TIDs'}</span>`,
        [badge('Banner', 'blue-soft'), badge(Number(item.availabilityType) === 1 ? 'TID Based' : 'All TIDs'), item.bannerId ? badge(`ID ${item.bannerId}`) : ''],
        'banner', index
      );
    }).join('');
  }

  function renderSupport(s) {
    const list = $('supportConfigList');
    const hasData = !!(s.timeStamp || s.helpLine || s.preAuth?.dateExceededMessage || s.preAuth?.amountLimitMessage || s.preAuth?.completionReminderMessage);
    if (!hasData) {
      list.innerHTML = '<div class="empty">No support configuration added yet.</div>';
      return;
    }
    const messages = [
      ['Date Exceeded', s.preAuth?.dateExceededMessage],
      ['Amount Limit', s.preAuth?.amountLimitMessage],
      ['Completion Reminder', s.preAuth?.completionReminderMessage]
    ];
    const messageCount = messages.filter(([, value]) => value).length;
    const preAuthDetails = messages.map(([label, value]) => value ? `<div class="support-message"><span class="config-preview-label">${esc(label)}</span><span>${esc(value)}</span></div>` : '').filter(Boolean).join('');

    list.innerHTML = shell(
      'Support & Pre-Auth',
      `<span>Help Line: ${esc(s.helpLine || '-')}</span><span class="meta-separator">·</span><span>Time Stamp: ${esc(s.timeStamp || '-')}</span>`,
      [badge('Support', 'blue-soft'), s.helpLine ? badge(`Help Line ${s.helpLine}`) : '', badge(`${messageCount} Pre-Auth Message${messageCount === 1 ? '' : 's'}`)],
      'support', 0,
      preAuthDetails ? `<div class="config-preview-line support-preview"><span class="config-preview-label">Pre-Auth</span><div class="support-message-list">${preAuthDetails}</div></div>` : ''
    );
  }

  function render() {
    if (!window.state) return;
    const image = state.imageConfig?.config || [];
    const imageTimestamp = state.imageConfig?.timeStamp || '';
    const pfx = state.pfxConfig || {};
    const banner = state.bannerConfig || [];
    const support = state.supportConfig || {};
    const signature = JSON.stringify({ image, imageTimestamp, pfx, banner, support });
    if (signature === lastSignature) return;
    lastSignature = signature;

    renderImages(image, imageTimestamp);
    renderPfx(pfx);
    renderBanners(banner);
    renderSupport(support);
  }

  setInterval(render, 250);
  render();
})();
