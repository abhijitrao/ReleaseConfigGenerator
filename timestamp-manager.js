(() => {
  const $ = id => document.getElementById(id);
  const TYPES = ['image', 'support'];
  const status = Object.fromEntries(TYPES.map(type => [type, { imported:false, autoIncrementPending:true, manuallyEdited:false }]));
  const numberTimestamp = value => { const n=Number.parseInt(String(value??'').trim(),10); return Number.isFinite(n)&&n>=0?n:0; };
  const contentSnapshot = type => {
    if(type==='image') return JSON.stringify(state.imageConfig?.config||[]);
    if(type==='support'){
      const s=state.supportConfig||{};
      const chargeSlipUploadSnapshot = s.__chargeSlipUploadWasPresent === false ? '__MISSING__' : s.chargeSlipUpload !== false;
      return JSON.stringify({chargeSlipUpload:chargeSlipUploadSnapshot,helpLine:s.helpLine||'',preAuth:s.preAuth||{}});
    }
    return '';
  };
  const getTimestamp=type=>type==='image'?state.imageConfig?.timeStamp:state.supportConfig?.timeStamp;
  const setTimestamp=(type,value)=>{const normalized=String(numberTimestamp(value));if(type==='image')state.imageConfig.timeStamp=normalized;if(type==='support')state.supportConfig.timeStamp=normalized;};
  function ensureInitialTimestamps(){if(state.imageConfig&&(state.imageConfig.timeStamp===''||state.imageConfig.timeStamp==null))state.imageConfig.timeStamp='0';if(state.supportConfig&&(state.supportConfig.timeStamp===''||state.supportConfig.timeStamp==null))state.supportConfig.timeStamp='0';}
  function markImported(rawJson){
    TYPES.forEach(type=>{status[type].imported=true;status[type].autoIncrementPending=true;status[type].manuallyEdited=false;});
    const supportKeyPresent=!!(rawJson&&Object.prototype.hasOwnProperty.call(rawJson.supportConfig||{},'chargeSlipUpload'));
    // The imported JSON is allowed to omit chargeSlipUpload for backward compatibility.
    // When we migrate that old JSON, the default true value is added and the support timestamp
    // is incremented immediately because the exported SupportConfig has changed.
    setTimeout(()=>{
      ensureInitialTimestamps();
      if(state.supportConfig){
        state.supportConfig.__chargeSlipUploadWasPresent=supportKeyPresent;
        if(!supportKeyPresent){
          setTimestamp('support',numberTimestamp(state.supportConfig.timeStamp)+1);
          state.supportConfig.__chargeSlipUploadWasPresent=true;
          status.support.autoIncrementPending=false;
        }
      }
      updateHeaders();cleanupEmptySupport();if(typeof renderAll==='function')renderAll();if(typeof refreshPreview==='function')refreshPreview();updateHeaders();
    },50);
  }
  function markFresh(){TYPES.forEach(type=>{status[type].imported=false;status[type].autoIncrementPending=true;status[type].manuallyEdited=false;});if(state.supportConfig)delete state.supportConfig.__chargeSlipUploadWasPresent;setTimeout(()=>{ensureInitialTimestamps();updateHeaders();cleanupEmptySupport();},0);}
  function processChanges(before){TYPES.forEach(type=>{const current=status[type];if(!current.autoIncrementPending||current.manuallyEdited)return;const afterContent=contentSnapshot(type);if(before[type].content!==afterContent){setTimestamp(type,numberTimestamp(before[type].timestamp)+1);current.autoIncrementPending=false;if(type==='support'&&state.supportConfig)state.supportConfig.__chargeSlipUploadWasPresent=true;}});if(typeof renderAll==='function')renderAll();cleanupEmptySupport();if(typeof refreshPreview==='function')refreshPreview();cleanupEmptySupport();updateHeaders();}
  function cleanupEmptySupport(){const list=$('supportConfigList'),button=$('addSupportBtn');if(!list||!state.supportConfig)return;const hasSupportData=!!(state.supportConfig.helpLine||state.supportConfig.preAuth?.dateExceededMessage||state.supportConfig.preAuth?.amountLimitMessage||state.supportConfig.preAuth?.completionReminderMessage);if(!hasSupportData){list.innerHTML='<div class="empty">No support configuration added yet.</div>';if(button)button.textContent='+ Add Support';}}
  function updateHeaders(){const imageBadge=$('imageTimestampBadge');if(imageBadge){const value=getTimestamp('image');imageBadge.textContent=value===''||value==null?'':`Time Stamp: ${value}`;imageBadge.classList.toggle('hidden',value===''||value==null);}const supportBadge=$('supportTimestampBadge');if(supportBadge){const value=getTimestamp('support');supportBadge.textContent=value===''||value==null?'':`Time Stamp: ${value}`;supportBadge.classList.toggle('hidden',value===''||value==null);}}
  function editTimestamp(type){const current=getTimestamp(type),value=window.prompt(`Edit ${type==='image'?'Image':'Support'} Time Stamp`,String(current??0));if(value===null)return;if(!/^\d+$/.test(value.trim())){if(typeof toast==='function')toast('Time Stamp must be a non-negative number');return;}setTimestamp(type,value.trim());status[type].manuallyEdited=true;status[type].autoIncrementPending=false;status[type].imported=false;updateHeaders();if(typeof renderAll==='function')renderAll();cleanupEmptySupport();if(typeof refreshPreview==='function')refreshPreview();cleanupEmptySupport();if(typeof toast==='function')toast('Time Stamp updated');}
  function addEditButtons(){[{type:'image',buttonId:'addImageBtn'},{type:'support',buttonId:'addSupportBtn'}].forEach(({type,buttonId})=>{const button=$(buttonId);if(!button)return;const holder=button.parentElement;if(holder?.querySelector(`[data-timestamp-edit="${type}"]`))return;const edit=document.createElement('button');edit.type='button';edit.className='timestamp-edit-btn';edit.dataset.timestampEdit=type;edit.title='Edit Time Stamp';edit.textContent='✎';holder.insertBefore(edit,button);});ensureInitialTimestamps();cleanupEmptySupport();updateHeaders();}
  document.addEventListener('click',event=>{const save=event.target.closest('#saveConfigBtn'),deleteButton=event.target.closest('[data-delete-config]');if(!save&&!deleteButton)return;const before=Object.fromEntries(TYPES.map(type=>[type,{content:contentSnapshot(type),timestamp:String(getTimestamp(type)??'')}]));setTimeout(()=>processChanges(before),0);},true);
  document.addEventListener('change',event=>{if(event.target?.id==='fileInput'&&event.target.files?.length){const file=event.target.files[0],reader=new FileReader();reader.onload=()=>{try{markImported(JSON.parse(reader.result));}catch{markImported(null);}};reader.readAsText(file);}},true);
  document.addEventListener('click',event=>{if(event.target.closest('#newBtn'))markFresh();});
  document.addEventListener('click',event=>{const edit=event.target.closest('[data-timestamp-edit]');if(edit)editTimestamp(edit.dataset.timestampEdit);});
  const boot=()=>{addEditButtons();updateHeaders();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();