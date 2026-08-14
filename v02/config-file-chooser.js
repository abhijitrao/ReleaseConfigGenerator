(() => {
  const selected = { image: new Map(), pfx: new Map(), banner: new Map() };
  window.phase2ConfigFiles = selected;
  const $ = id => document.getElementById(id);

  function addChooser(inputId, fileType, key, accept) {
    const input = $(inputId); if (!input || input.dataset.fileChooserAdded) return;
    input.dataset.fileChooserAdded = 'true';
    const wrapper = document.createElement('div'); wrapper.className='config-file-chooser-row'; input.parentNode.insertBefore(wrapper,input); wrapper.appendChild(input);
    const button=document.createElement('button');button.type='button';button.className='secondary-btn config-file-choose-btn';button.textContent='Choose File';
    const hidden=document.createElement('input');hidden.type='file';hidden.hidden=true;hidden.accept=accept;
    const status=document.createElement('span');status.className='config-file-chooser-status hidden';
    const refresh=()=>{const file=selected[fileType].get(String(key));status.textContent=file?`✓ ${file.name}`:'';status.classList.toggle('hidden',!file);};
    button.addEventListener('click',()=>hidden.click());
    hidden.addEventListener('change',()=>{const file=hidden.files?.[0];if(!file)return;selected[fileType].set(String(key),file);if(window.phase2PackageFiles?.[fileType])window.phase2PackageFiles[fileType].set(String(key),file);input.value=file.name;refresh();});
    wrapper.appendChild(button);wrapper.appendChild(hidden);wrapper.appendChild(status);refresh();
  }

  function watchModal(){
    const body=$('configModalBody');if(!body||body.dataset.fileChooserObserver)return;body.dataset.fileChooserObserver='true';
    const observer=new MutationObserver(()=>{
      const title=$('configModalTitle')?.textContent||'';let index=Number.isInteger(window.__editingConfigIndex)?window.__editingConfigIndex:0;
      if(title.includes('Image Configuration'))addChooser('cfgImageFileName','image',Math.max(0,index),'.png,.bmp,.jpg,.jpeg,.json');
      else if(title.includes('PFX Configuration'))addChooser('cfgPfxFileName','pfx',0,'.p12,.pfx');
      else if(title.includes('Banner Configuration'))addChooser('cfgBannerName','banner',Math.max(0,index),'.zip');
    });observer.observe(body,{childList:true,subtree:true});
  }

  function init(){
    watchModal();
    $('addImageBtn')?.addEventListener('click',()=>{window.__editingConfigIndex=state.imageConfig?.config?.length||0;});
    $('addBannerBtn')?.addEventListener('click',()=>{window.__editingConfigIndex=state.bannerConfig?.length||0;});
    $('addPfxBtn')?.addEventListener('click',()=>{window.__editingConfigIndex=0;});
    document.addEventListener('click',e=>{const edit=e.target.closest('[data-edit-config]');if(edit)window.__editingConfigIndex=Number(edit.dataset.index);},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();