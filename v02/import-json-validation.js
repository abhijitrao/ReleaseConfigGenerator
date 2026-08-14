(() => {
  const style = document.createElement('style');
  style.textContent = `
    .import-json-error-modal{position:fixed;inset:0;background:rgba(15,23,42,.52);display:flex;align-items:center;justify-content:center;z-index:3100;padding:24px}
    .import-json-error-modal.hidden{display:none}
    .import-json-error-dialog{width:min(760px,96vw);max-height:84vh;background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden}
    .import-json-error-header{padding:20px 24px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-start}
    .import-json-error-header h2{margin:0;color:#991b1b;font-size:20px}.import-json-error-header p{margin:6px 0 0;color:#64748b;font-size:13px}
    .import-json-error-body{padding:20px 24px;overflow:auto}.import-json-error-file{font-size:13px;color:#475569;margin-bottom:14px;word-break:break-all}
    .import-json-error-list{margin:0;padding:0;list-style:none;border:1px solid #fecaca;border-radius:10px;overflow:hidden}
    .import-json-error-list li{padding:11px 13px;border-bottom:1px solid #fee2e2;color:#991b1b;background:#fff7f7;font-size:14px;line-height:1.45}
    .import-json-error-list li:last-child{border-bottom:0}.import-json-error-footer{padding:15px 24px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end}
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'import-json-error-modal hidden';
  modal.innerHTML = `<div class="import-json-error-dialog" role="dialog" aria-modal="true" aria-labelledby="importJsonErrorTitle"><div class="import-json-error-header"><div><h2 id="importJsonErrorTitle">Import JSON Failed</h2><p>The selected configuration was not imported.</p></div><button type="button" class="icon-btn" data-close-import-json-error aria-label="Close">×</button></div><div class="import-json-error-body"><div class="import-json-error-file" data-import-json-error-file></div><ul class="import-json-error-list" data-import-json-error-list></ul></div><div class="import-json-error-footer"><button type="button" data-close-import-json-error>Close</button></div></div>`;
  document.body.appendChild(modal);

  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const hasText = value => typeof value === 'string' && value.trim() !== '';
  const error = (errors, path, message) => errors.push(`${path}: ${message}`);

  function validateConfiguration(data) {
    const errors = [];
    if (!isObject(data)) return ['Root: JSON must contain an object.'];
    ['isRunOnBackground','isConfirmationRequired','isShowErrorMsg','isDownloadOverWifiOnly'].forEach(key => {
      if (!(key in data)) error(errors,key,'is required.');
      else if (typeof data[key] !== 'boolean') error(errors,key,'must be true or false.');
    });
    if (!Array.isArray(data.appsConfig)) error(errors,'appsConfig','must be an array.');
    else data.appsConfig.forEach((app,i) => {
      const p=`appsConfig[${i}]`;
      if (!isObject(app)) { error(errors,p,'must be an object.'); return; }
      ['title','appName','packageName','appVersion'].forEach(key=>{if(!hasText(app[key]))error(errors,`${p}.${key}`,'is required.');});
      if (hasText(app.appName) && !/\.zip$/i.test(app.appName.trim())) error(errors,`${p}.appName`,'must use the .zip extension.');
      if (!Array.isArray(app.modelName) || !app.modelName.length) error(errors,`${p}.modelName`,'at least one target model is required.');
      if (!Array.isArray(app.androidVersion) || !app.androidVersion.length) error(errors,`${p}.androidVersion`,'at least one Android version is required.');
      if ('autoInstall' in app && typeof app.autoInstall !== 'boolean') error(errors,`${p}.autoInstall`,'must be true or false.');
      if ('isDelete' in app && typeof app.isDelete !== 'boolean') error(errors,`${p}.isDelete`,'must be true or false.');
      if ('dependency' in app && !Array.isArray(app.dependency)) error(errors,`${p}.dependency`,'must be an array.');
      if (Array.isArray(app.dependency)) app.dependency.forEach((dep,j)=>{const dp=`${p}.dependency[${j}]`;if(!isObject(dep)){error(errors,dp,'must be an object.');return;}['appName','packageName','appVersion'].forEach(key=>{if(!hasText(dep[key]))error(errors,`${dp}.${key}`,'is required.');});});
    });
    if ('imageConfig' in data && !isObject(data.imageConfig)) error(errors,'imageConfig','must be an object.');
    if ('imageConfig' in data && isObject(data.imageConfig) && !Array.isArray(data.imageConfig.config)) error(errors,'imageConfig.config','must be an array.');
    if ('pfxConfig' in data && !isObject(data.pfxConfig)) error(errors,'pfxConfig','must be an object.');
    if ('bannerConfig' in data && !Array.isArray(data.bannerConfig)) error(errors,'bannerConfig','must be an array.');
    if ('supportConfig' in data && !isObject(data.supportConfig)) error(errors,'supportConfig','must be an object.');
    return errors;
  }

  function showError(fileName, errors) {
    modal.querySelector('[data-import-json-error-file]').textContent = `File: ${fileName}`;
    modal.querySelector('[data-import-json-error-list]').innerHTML = errors.map((e,i)=>`<li>${i+1}. ${esc(e)}</li>`).join('');
    modal.classList.remove('hidden');
  }
  function close(){modal.classList.add('hidden');}
  modal.addEventListener('click',e=>{if(e.target===modal)close();if(e.target.closest('[data-close-import-json-error]'))close();});

  function init(){
    const input=document.getElementById('fileInput');
    if(!input)return;
    input.addEventListener('change',event=>{
      const file=event.target.files?.[0];
      if(!file)return;
      event.stopImmediatePropagation();
      const reader=new FileReader();
      reader.onload=()=>{
        let data;
        try{data=JSON.parse(reader.result);}catch(e){showError(file.name,[`JSON Syntax: ${e.message || 'Invalid JSON syntax.'}`]);return;}
        const errors=validateConfiguration(data);
        if(errors.length){showError(file.name,errors);return;}
        if(typeof importJson==='function') importJson(file);
      };
      reader.onerror=()=>showError(file.name,['File: Unable to read the selected file.']);
      reader.readAsText(file);
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
