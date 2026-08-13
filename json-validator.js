(() => {
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));

  const style = document.createElement('style');
  style.textContent = `
    .json-validator-modal{position:fixed;inset:0;background:rgba(15,23,42,.52);display:flex;align-items:center;justify-content:center;z-index:3000;padding:24px}
    .json-validator-modal.hidden{display:none}
    .json-validator-dialog{width:min(900px,96vw);max-height:88vh;background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden}
    .json-validator-header{display:flex;align-items:flex-start;justify-content:space-between;padding:22px 26px;border-bottom:1px solid #e2e8f0}
    .json-validator-header h2{margin:0;color:#0f172a;font-size:21px}.json-validator-header p{margin:6px 0 0;color:#64748b}
    .json-validator-body{padding:22px 26px;overflow:auto}.json-validator-summary{display:flex;align-items:center;gap:10px;margin-bottom:18px}
    .json-validator-status{font-weight:700;padding:8px 12px;border-radius:999px}.json-validator-status.valid{background:#dcfce7;color:#166534}.json-validator-status.invalid{background:#fee2e2;color:#991b1b}
    .json-validator-count{color:#64748b;font-size:14px}.json-validator-section{margin-top:16px}.json-validator-section h3{font-size:15px;margin:0 0 9px;color:#334155}
    .json-validator-list{margin:0;padding:0;list-style:none;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}.json-validator-list li{padding:10px 13px;border-bottom:1px solid #e2e8f0;font-size:14px;line-height:1.45;color:#334155}.json-validator-list li:last-child{border-bottom:0}.json-validator-list li.error{color:#991b1b;background:#fff7f7}.json-validator-list li.warning{color:#92400e;background:#fffbeb}
    .json-validator-empty{padding:20px;border:1px dashed #cbd5e1;border-radius:10px;color:#64748b;text-align:center}.json-validator-footer{padding:16px 26px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end}
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'jsonValidatorModal';
  modal.className = 'json-validator-modal hidden';
  modal.innerHTML = `
    <div class="json-validator-dialog" role="dialog" aria-modal="true" aria-labelledby="jsonValidatorTitle">
      <div class="json-validator-header"><div><h2 id="jsonValidatorTitle">Validate JSON</h2><p>Configuration validation result.</p></div><button type="button" id="closeJsonValidatorBtn" class="icon-btn" aria-label="Close">×</button></div>
      <div id="jsonValidatorBody" class="json-validator-body"></div>
      <div class="json-validator-footer"><button type="button" id="closeJsonValidatorFooter">Close</button></div>
    </div>`;
  document.body.appendChild(modal);

  const $ = id => document.getElementById(id);
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isBool = value => typeof value === 'boolean';
  const isArray = value => Array.isArray(value);
  const hasText = value => typeof value === 'string' && value.trim() !== '';
  const validTimestamp = value => value === '' || value === null || value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0) || (typeof value === 'string' && /^\d+$/.test(value.trim()));

  function validate(data) {
    const errors = [], warnings = [];
    const error = (path, message) => errors.push(`${path}: ${message}`);
    const warning = (path, message) => warnings.push(`${path}: ${message}`);

    if (!isObject(data)) return { errors: ['Root: JSON must contain an object.'], warnings: [] };

    ['isRunOnBackground','isConfirmationRequired','isShowErrorMsg','isDownloadOverWifiOnly'].forEach(key => {
      if (!(key in data)) error(key, 'is required.');
      else if (!isBool(data[key])) error(key, 'must be true or false.');
    });

    if (!isArray(data.appsConfig)) error('appsConfig', 'must be an array.');
    else {
      const keys = new Map();
      data.appsConfig.forEach((app, i) => {
        const p = `appsConfig[${i}]`;
        if (!isObject(app)) { error(p, 'must be an object.'); return; }
        ['title','appName','packageName','appVersion'].forEach(key => { if (!hasText(app[key])) error(`${p}.${key}`, 'is required.'); });
        if (hasText(app.appName) && !/\.zip$/i.test(app.appName.trim())) error(`${p}.appName`, 'must use the .zip extension.');
        if (!isArray(app.modelName) || app.modelName.length === 0) error(`${p}.modelName`, 'at least one target model is required.');
        if (!isArray(app.androidVersion) || app.androidVersion.length === 0) error(`${p}.androidVersion`, 'at least one Android version is required.');
        if ('isMandatoy' in app && !isBool(app.isMandatoy)) error(`${p}.isMandatoy`, 'must be true or false.');
        if (!isBool(app.autoInstall)) error(`${p}.autoInstall`, 'must be true or false.');
        if (!isBool(app.isDelete)) error(`${p}.isDelete`, 'must be true or false.');
        const availability = Number(app.availabilityType);
        if (![0,1].includes(availability)) error(`${p}.availabilityType`, 'must be 0 (All) or 1 (TID Based).');
        if (availability === 1 && (!isArray(app.tids) || app.tids.length === 0)) error(`${p}.tids`, 'at least one TID is required for TID Based availability.');
        if (app.isDelete) {
          const deleteType = Number(app.deleteType);
          if (![0,1].includes(deleteType)) error(`${p}.deleteType`, 'must be 0 (All) or 1 (TID Based).');
          if (deleteType === 1 && (!isArray(app.deleteTids) || app.deleteTids.length === 0)) error(`${p}.deleteTids`, 'at least one TID is required for TID Based delete.');
        }
        if (!isArray(app.dependency)) error(`${p}.dependency`, 'must be an array.');
        else app.dependency.forEach((dep,j) => {
          const dp=`${p}.dependency[${j}]`;
          if (!isObject(dep)) { error(dp,'must be an object.'); return; }
          ['appName','packageName','appVersion'].forEach(key => { if (!hasText(dep[key])) error(`${dp}.${key}`, 'is required.'); });
        });
        if (hasText(app.packageName) && hasText(app.appVersion)) {
          const key=`${app.packageName}|${app.appVersion}`;
          if (keys.has(key)) error(p, `duplicates ${keys.get(key)} with the same Package Name and App Version.`); else keys.set(key,p);
        }
      });
      const dependencyKeys = new Set();
      data.appsConfig.forEach(app => (app.dependency || []).forEach(dep => dependencyKeys.add(`${dep.packageName}|${dep.appVersion}`)));
      data.appsConfig.forEach((app,i) => {
        const key=`${app.packageName}|${app.appVersion}`;
        if (dependencyKeys.has(key) && app.autoInstall !== false) error(`appsConfig[${i}].autoInstall`, 'must be false because this application is used as a dependency.');
      });
    }

    if ('whiteListPackageName' in data && typeof data.whiteListPackageName !== 'string') error('whiteListPackageName', 'must be a string.');

    const image=data.imageConfig;
    if (!isObject(image)) error('imageConfig','must be an object.');
    else {
      if (!isArray(image.config)) error('imageConfig.config','must be an array.');
      else image.config.forEach((item,i)=>{
        const p=`imageConfig.config[${i}]`;
        if(!isObject(item)) { error(p,'must be an object.'); return; }
        ['startDate','endDate','imageFileName'].forEach(key=>{if(!hasText(item[key]))error(`${p}.${key}`,'is required.');});
        if('txnType' in item && !hasText(item.txnType)) error(`${p}.txnType`,'must not be empty.');
      });
      if(!validTimestamp(image.timeStamp)) error('imageConfig.timeStamp','must be a non-negative number or numeric string.');
    }

    const pfx=data.pfxConfig;
    if (!isObject(pfx)) error('pfxConfig','must be an object.');
    else {
      if (hasText(pfx.pfxFileName) && !/\.(p12|pfx)$/i.test(pfx.pfxFileName.trim())) warning('pfxConfig.pfxFileName','usually uses .p12 or .pfx extension.');
      if(!validTimestamp(pfx.timeStamp)) error('pfxConfig.timeStamp','must be a non-negative number or numeric string.');
    }

    if (!isArray(data.bannerConfig)) error('bannerConfig','must be an array.');
    else data.bannerConfig.forEach((item,i)=>{
      const p=`bannerConfig[${i}]`;
      if(!isObject(item)){error(p,'must be an object.');return;}
      if(!hasText(item.bannerName)) error(`${p}.bannerName`,'is required.');
      const type=Number(item.availabilityType);
      if(![0,1].includes(type)) error(`${p}.availabilityType`,'must be 0 (All) or 1 (TID Based).');
      if(!isArray(item.tids)) error(`${p}.tids`,'must be an array.');
      if(type===1 && (!item.tids || !item.tids.length)) error(`${p}.tids`,'at least one TID is required for TID Based availability.');
    });

    const support=data.supportConfig;
    if(!isObject(support)) error('supportConfig','must be an object.');
    else {
      if(!validTimestamp(support.timeStamp)) error('supportConfig.timeStamp','must be a non-negative number or numeric string.');
      if('helpLine' in support && typeof support.helpLine !== 'string') error('supportConfig.helpLine','must be a string.');
      if(!isObject(support.preAuth)) error('supportConfig.preAuth','must be an object.');
      else ['dateExceededMessage','amountLimitMessage','completionReminderMessage'].forEach(key=>{if(key in support.preAuth && typeof support.preAuth[key] !== 'string') error(`supportConfig.preAuth.${key}`,'must be a string.');});
    }

    return { errors, warnings };
  }

  function renderResult(fileName, result) {
    const valid = result.errors.length === 0;
    const list = items => items.length ? `<ul class="json-validator-list">${items.map((item,i)=>`<li class="${valid && result.warnings.length ? 'warning':'error'}">${i+1}. ${esc(item)}</li>`).join('')}</ul>` : '<div class="json-validator-empty">None</div>';
    $('jsonValidatorBody').innerHTML = `
      <div class="json-validator-summary"><span class="json-validator-status ${valid?'valid':'invalid'}">${valid?'✓ Valid Configuration':'✕ Validation Failed'}</span><span class="json-validator-count">${esc(fileName)} · ${result.errors.length} error(s) · ${result.warnings.length} warning(s)</span></div>
      <div class="json-validator-section"><h3>Errors</h3>${list(result.errors)}</div>
      <div class="json-validator-section"><h3>Warnings</h3>${result.warnings.length ? `<ul class="json-validator-list">${result.warnings.map((item,i)=>`<li class="warning">${i+1}. ${esc(item)}</li>`).join('')}</ul>` : '<div class="json-validator-empty">None</div>'}</div>`;
    modal.classList.remove('hidden');
  }

  function close() { modal.classList.add('hidden'); }

  function chooseFile() {
    const input = document.createElement('input'); input.type='file'; input.accept='application/json,.json'; input.style.display='none'; document.body.appendChild(input);
    input.addEventListener('change',()=>{const file=input.files?.[0]; if(file) validateFile(file); input.remove();}); input.click();
  }

  function validateFile(file) {
    if(!/\.json$/i.test(file.name)) { renderResult(file.name,{errors:['File: Please select a .json file.'],warnings:[]}); return; }
    const reader=new FileReader();
    reader.onload=()=>{try{const data=JSON.parse(reader.result);renderResult(file.name,validate(data));}catch(e){renderResult(file.name,{errors:[`JSON Syntax: ${e.message || 'Invalid JSON syntax.'}`],warnings:[]});}};
    reader.onerror=()=>renderResult(file.name,{errors:['File: Unable to read the selected file.'],warnings:[]});
    reader.readAsText(file);
  }

  function init() {
    const button=document.getElementById('validateJsonBtn');
    if(!button) return;
    button.addEventListener('click',chooseFile);
    $('closeJsonValidatorBtn').addEventListener('click',close);
    $('closeJsonValidatorFooter').addEventListener('click',close);
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))close();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();