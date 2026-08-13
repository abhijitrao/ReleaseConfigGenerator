(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  let lastJson = '';
  const badge = (text, tone = '') => `<span class="badge ${tone}">${esc(text)}</span>`;
  const actions = (type, index) => `<div class="app-actions"><button type="button" data-edit-config="${type}" data-index="${index}">Edit</button><button type="button" class="danger-btn" data-delete-config="${type}" data-index="${index}">Delete</button></div>`;
  const shell = (title, meta, badges, type, index, extra = '') => `<div class="config-app-row"><div class="config-app-main"><div class="config-app-title">${esc(title)}</div><div class="config-app-meta">${meta}</div>${extra}<div class="badges">${badges.filter(Boolean).join('')}</div></div>${actions(type, index)}</div>`;
  function render(data) {
    const image = data.imageConfig || { config: [], timeStamp: '' };
    const pfx = data.pfxConfig || { pfxFileName: '', timeStamp: '' };
    const banners = Array.isArray(data.bannerConfig) ? data.bannerConfig : [];
    const support = data.supportConfig || { timeStamp: '', helpLine: '', preAuth: {} };
    support.preAuth ||= {};
    const timestamp = $('imageTimestampBadge');
    if (timestamp) { timestamp.textContent = image.timeStamp ? `Time Stamp: ${image.timeStamp}` : ''; timestamp.classList.toggle('hidden', !image.timeStamp); }
    const imageList = $('imageConfigList');
    const images = Array.isArray(image.config) ? image.config : [];
    imageList.innerHTML = images.length ? images.map((item, i) => shell(item.imageFileName || 'Unnamed Image', `<span>${esc(item.txnType || 'all')}</span><span class="meta-separator">·</span><span>${esc(item.startDate || '-')} → ${esc(item.endDate || '-')}</span>`, [badge('Image','blue-soft'),badge(item.txnType || 'all')], 'image', i)).join('') : '<div class="empty">No image configuration added yet.</div>';
    const pfxList = $('pfxConfigList');
    pfxList.innerHTML = pfx.pfxFileName ? shell(pfx.pfxFileName || 'PFX Configuration','<span>Client certificate</span>',[badge('PFX','blue-soft')],'pfx',0) : '<div class="empty">No PFX configuration added yet.</div>';
    if ($('addPfxBtn')) $('addPfxBtn').textContent = pfx.pfxFileName ? 'Edit PFX' : '+ Add PFX';
    const bannerList = $('bannerConfigList');
    bannerList.innerHTML = banners.length ? banners.map((item,i) => { const tidCount=Array.isArray(item.tids)?item.tids.length:0; const tidBased=Number(item.availabilityType)===1; return shell(item.bannerName || 'Unnamed Banner',`<span>Banner ID: ${esc(item.bannerId || '-')}</span><span class="meta-separator">·</span><span>${tidBased ? `TID Based · ${tidCount} TID(s)` : 'All TIDs'}</span>`,[badge('Banner','blue-soft'),badge(tidBased?'TID Based':'All TIDs'),item.bannerId?badge(`ID ${item.bannerId}`):''],'banner',i); }).join('') : '<div class="empty">No banner configuration added yet.</div>';
    const supportList = $('supportConfigList');
    const messages=[['Date Exceeded',support.preAuth.dateExceededMessage],['Amount Limit',support.preAuth.amountLimitMessage],['Completion Reminder',support.preAuth.completionReminderMessage]];
    const messageCount=messages.filter(([,v])=>v).length;
    const details=messages.filter(([,v])=>v).map(([label,value])=>`<div class="support-message"><span class="config-preview-label">${esc(label)}</span><span>${esc(value)}</span></div>`).join('');
    const hasSupport=!!(support.timeStamp||support.helpLine||messageCount);
    supportList.innerHTML=hasSupport? shell('Support & Pre-Auth',`<span>Help Line: ${esc(support.helpLine || '-')}</span><span class="meta-separator">·</span><span>Time Stamp: ${esc(support.timeStamp || '-')}</span>`,[badge('Support','blue-soft'),support.helpLine?badge(`Help Line ${support.helpLine}`):'',badge(`${messageCount} Pre-Auth Message${messageCount===1?'':'s'}`)],'support',0,details?`<div class="config-preview-line support-preview"><span class="config-preview-label">Pre-Auth</span><div class="support-message-list">${details}</div></div>`:''):'<div class="empty">No support configuration added yet.</div>';
  }
  function sync(){const preview=$('jsonPreview');if(!preview||!preview.value||preview.value===lastJson)return;try{const data=JSON.parse(preview.value);render(data);lastJson=preview.value;}catch(_){} }
  setInterval(sync,150); sync();
  if(!document.querySelector('script[data-timestamp-manager]')){const script=document.createElement('script');script.src='timestamp-manager.js?v=202608131400';script.dataset.timestampManager='true';document.body.appendChild(script);}
})();