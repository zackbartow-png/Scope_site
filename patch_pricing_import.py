from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one {label}, found {count}.")
    return text.replace(old, new)

app_path = Path('app.js')
js = app_path.read_text(encoding='utf-8')

old_block = '''function renderPriceItems(p) {
  const wrap=$("#priceItems"); wrap.innerHTML="";
  const alternateById=new Map((p.alternateScopes||[]).map(a=>[a.id,a]));
  const hasAlternates=p.priceItems.some(i=>!i.isBaseBid);
  p.priceItems.forEach((item,index)=>{
    const isBase=Boolean(item.isBaseBid);
    const linkedAlternate=!isBase&&item.alternateScopeId?alternateById.get(item.alternateScopeId):null;
    const displayName=linkedAlternate?.title||item.name||'';
    const row=document.createElement("div"); row.className=`price-item-row ${isBase?'base-bid-row':''} ${isBase&&hasAlternates?'has-alternates':''} ${linkedAlternate?'linked-alternate-row':''}`.trim(); row.dataset.priceId=item.id; row.dataset.baseBid=isBase?'true':'false'; row.dataset.alternateScopeId=linkedAlternate?.id||'';
    row.innerHTML=isBase
      ? `<input class="price-item-input price-name" value="Base Bid" readonly><input class="price-item-input price-value" value="${esc(item.price||'')}" placeholder="$0.00"><span class="base-bid-lock" title="Base Bid is always included in Proposed Pricing">Base</span>`
      : `<div class="row-check-preview" title="Printed alternate/add-on selection box"></div><input class="price-item-input price-name" value="${esc(displayName)}" ${linkedAlternate?'readonly title="Linked to Alternate Scope"':'placeholder="Custom alternate / add-on pricing line"'}><input class="price-item-input price-value" value="${esc(item.price||'')}" placeholder="$0.00"><button class="remove-price-item" type="button" title="Remove line">×</button>`;
    wrap.appendChild(row);
  });
  renderPricingAlternatePicker(p);
  $("#emptyPriceItems").classList.add("hidden");
}
function renderPricingAlternatePicker(p){
  const select=$("#existingAlternatePriceSelect"),btn=$("#addExistingAlternatePriceBtn");
  if(!select||!btn)return;
  const linkedIds=new Set((p.priceItems||[]).map(i=>i.alternateScopeId).filter(Boolean));
  const available=(p.alternateScopes||[]).filter(a=>a.enabled!==false&&!linkedIds.has(a.id));
  select.innerHTML='';
  const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=available.length?'Select existing alternate…':'No unused alternates available';select.appendChild(placeholder);
  available.forEach(a=>{const option=document.createElement('option');option.value=a.id;option.textContent=a.title||'Untitled Alternate';select.appendChild(option);});
  btn.disabled=!available.length;
}
function addExistingAlternatePriceItem(){
  const p=collectEditorProject();if(!p)return;
  const id=$("#existingAlternatePriceSelect")?.value||'';if(!id)return toast('Select an alternate to add.');
  const alt=(p.alternateScopes||[]).find(a=>a.id===id);if(!alt)return toast('That alternate could not be found.');
  if((p.priceItems||[]).some(i=>i.alternateScopeId===id))return toast('That alternate is already in Proposed Pricing.');
  p.priceItems.push({id:uid(),name:alt.title||'Alternate',description:'',price:'',isBaseBid:false,alternateScopeId:id});
  putProject(p);renderPriceItems(p);updatePreview();
  const row=$(`.price-item-row[data-alternate-scope-id="${id}"]`);$('.price-value',row)?.focus();
}
'''

new_block = '''function renderPriceItems(p) {
  const wrap=$("#priceItems"); wrap.innerHTML="";
  const hasAlternates=p.priceItems.some(i=>!i.isBaseBid);
  p.priceItems.forEach((item,index)=>{
    const isBase=Boolean(item.isBaseBid);
    const importedAlternate=!isBase&&Boolean(item.alternateScopeId);
    const row=document.createElement("div"); row.className=`price-item-row ${isBase?'base-bid-row':''} ${isBase&&hasAlternates?'has-alternates':''} ${importedAlternate?'imported-alternate-row':''}`.trim(); row.dataset.priceId=item.id; row.dataset.baseBid=isBase?'true':'false'; row.dataset.alternateScopeId=item.alternateScopeId||'';
    row.innerHTML=isBase
      ? `<input class="price-item-input price-name" value="Base Bid" readonly><input class="price-item-input price-value" value="${esc(item.price||'')}" placeholder="$0.00"><span class="base-bid-lock" title="Base Bid is always included in Proposed Pricing">Base</span>`
      : `<div class="row-check-preview" title="Printed alternate/add-on selection box"></div><input class="price-item-input price-name" value="${esc(item.name||'')}" placeholder="Custom alternate / add-on pricing line"><input class="price-item-input price-value" value="${esc(item.price||'')}" placeholder="$0.00"><button class="remove-price-item" type="button" title="Remove line">×</button>`;
    wrap.appendChild(row);
  });
  $("#emptyPriceItems").classList.add("hidden");
}
function importAlternatePriceItems(){
  const p=collectEditorProject();if(!p)return;
  const alternates=Array.isArray(p.alternateScopes)?p.alternateScopes:[];
  if(!alternates.length)return toast('No alternates have been created yet.');
  const importedIds=new Set((p.priceItems||[]).map(i=>i.alternateScopeId).filter(Boolean));
  const toImport=alternates.filter(a=>a.id&&!importedIds.has(a.id));
  if(!toImport.length)return toast('All current alternates are already in Proposed Pricing.');
  toImport.forEach(alt=>p.priceItems.push({id:uid(),name:alt.title||'Alternate',description:'',price:'',isBaseBid:false,alternateScopeId:alt.id}));
  putProject(p);renderPriceItems(p);updatePreview();
  const firstNew=$(`.price-item-row[data-alternate-scope-id="${toImport[0].id}"] .price-value`);firstNew?.focus();
  toast(`${toImport.length} alternate${toImport.length===1?'':'s'} imported to Proposed Pricing.`);
}
'''
js = replace_once(js, old_block, new_block, 'alternate pricing link block')

old_wire = '$("#projectTitleInline").addEventListener("input",()=>{scheduleSave();updatePreview();});$("#addPriceItemBtn").addEventListener("click",addPriceItem);$("#addExistingAlternatePriceBtn")?.addEventListener("click",addExistingAlternatePriceItem);'
new_wire = '$("#projectTitleInline").addEventListener("input",()=>{scheduleSave();updatePreview();});$("#addPriceItemBtn").addEventListener("click",addPriceItem);$("#importAlternatePricesBtn")?.addEventListener("click",importAlternatePriceItems);'
js = replace_once(js, old_wire, new_wire, 'pricing button wiring')

old_input = '''document.addEventListener("input",e=>{
  if(e.target.matches('[data-field],[data-company],[data-office-setting],[data-map-setting],.price-item-input,#basicSummaryNote,.basic-summary-label,.basic-summary-amount,#basicOverheadLabel,#basicOverheadAmount,.summary-division-amount,.summary-sub-label,.summary-sub-amount,.summary-custom-label,.summary-custom-amount,.summary-extra-label,.summary-extra-amount')){
    if(e.target.matches('.basic-summary-amount,#basicOverheadAmount'))updateBasicSummaryTotal();
    if(e.target.matches('.summary-division-amount,.summary-sub-amount,.summary-custom-amount,.summary-extra-amount'))updateAdvancedSummaryTotals();
    if(e.target.matches('[data-office-setting],[data-map-setting]'))collectAndSaveOfficeSettings();
    scheduleSave();updatePreview();
  }
});'''
new_input = '''document.addEventListener("input",e=>{
  if(e.target.matches('[data-field],[data-company],[data-office-setting],[data-map-setting],.price-item-input,#basicSummaryNote,.basic-summary-label,.basic-summary-amount,#basicOverheadLabel,#basicOverheadAmount,.summary-division-amount,.summary-sub-label,.summary-sub-amount,.summary-custom-label,.summary-custom-amount,.summary-extra-label,.summary-extra-amount')){
    if(e.target.matches('.price-value,.basic-summary-amount,#basicOverheadAmount,.summary-division-amount,.summary-sub-amount,.summary-custom-amount,.summary-extra-amount'))normalizeProposalCurrencyInput(e.target);
    if(e.target.matches('.basic-summary-amount,#basicOverheadAmount'))updateBasicSummaryTotal();
    if(e.target.matches('.summary-division-amount,.summary-sub-amount,.summary-custom-amount,.summary-extra-amount'))updateAdvancedSummaryTotals();
    if(e.target.matches('[data-office-setting],[data-map-setting]'))collectAndSaveOfficeSettings();
    scheduleSave();updatePreview();
  }
});'''
js = replace_once(js, old_input, new_input, 'live currency input handler')
app_path.write_text(js, encoding='utf-8')

index_path = Path('index.html')
html = index_path.read_text(encoding='utf-8')
old_html = '''                <h3>Proposed Pricing</h3>
                <p>Base Bid is always included first. Add an existing Alternate Scope by name, or create a custom pricing line.</p>
              </div>
              <div class="pricing-add-controls">
                <select id="existingAlternatePriceSelect" class="select-control pricing-alternate-select" aria-label="Existing alternate scope"><option value="">Select existing alternate…</option></select>
                <button id="addExistingAlternatePriceBtn" class="btn btn-secondary" type="button">+ Add Existing Alternate</button>
                <button id="addPriceItemBtn" class="btn btn-secondary" type="button">+ Custom Alternate / Add-On</button>
              </div>'''
new_html = '''                <h3>Proposed Pricing</h3>
                <p>Base Bid is always included first. Import all current Alternate Scope names when ready, or create a custom pricing line.</p>
              </div>
              <div class="pricing-add-controls">
                <button id="importAlternatePricesBtn" class="btn btn-secondary" type="button">Import Alternates</button>
                <button id="addPriceItemBtn" class="btn btn-secondary" type="button">+ Custom Alternate / Add-On</button>
              </div>'''
html = replace_once(html, old_html, new_html, 'pricing import controls')
index_path.write_text(html, encoding='utf-8')
