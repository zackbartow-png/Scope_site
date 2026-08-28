from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, found {count}")
    return text.replace(old, new, 1)

app_path = Path('app.js')
js = app_path.read_text(encoding='utf-8')

old_state = 'previewOpen: true, previewRenderTimer: null, previewRenderToken: 0, previewRendering: false, previewPending: false, previewBlobUrl: null'
new_state = 'previewOpen: true, previewLastEditAt: 0, previewIdleMs: 1500, previewRenderTimer: null, previewRenderToken: 0, previewRendering: false, previewPending: false, previewBlobUrl: null'
js = replace_once(js, old_state, new_state, 'preview state')

old_money = "function formatMoneyNumber(n){ return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(n)||0); }"
new_money = """function formatMoneyNumber(n){ return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(n)||0); }
function ensureDollarPrefix(value=\"\"){
  const raw=String(value??\"\").trim();
  if(!raw)return \"\";
  if(raw.includes('$'))return raw;
  if(raw.startsWith('-'))return `-$${raw.slice(1)}`;
  if(raw.startsWith('(')&&raw.endsWith(')'))return `($${raw.slice(1,-1)})`;
  return `$${raw}`;
}
function normalizeProposalCurrencyInput(input){
  if(!input)return;
  const next=ensureDollarPrefix(input.value);
  if(input.value!==next)input.value=next;
}"""
js = replace_once(js, old_money, new_money, 'currency helper')

old_preview = """function updatePreview() {
  const p=collectEditorProject();if(!p)return;
  document.documentElement.style.setProperty('--orange',p.company.orange||DEFAULT_COMPANY.orange);
  document.documentElement.style.setProperty('--charcoal',p.company.charcoal||DEFAULT_COMPANY.charcoal);
  schedulePdfPreview();
}
function togglePreview(open) {
  state.previewOpen=open??!state.previewOpen;
  $(\"#previewPane\").classList.toggle(\"closed\",!state.previewOpen);
  if(window.innerWidth>1180)$(\"#previewPane\").classList.toggle(\"hidden\",!state.previewOpen);
  $(\"#previewToggle\").textContent=state.previewOpen?\"Hide Preview\":\"PDF Preview\";
  if(state.previewOpen)schedulePdfPreview(40);
}
function schedulePdfPreview(delay=520){
  clearTimeout(state.previewRenderTimer);
  if(!state.previewOpen||!state.currentProjectId)return;
  state.previewRenderTimer=setTimeout(renderLivePdfPreview,delay);
}"""
new_preview = """function updatePreview() {
  state.previewLastEditAt=Date.now();
  schedulePdfPreview();
}
function togglePreview(open) {
  state.previewOpen=open??!state.previewOpen;
  $(\"#previewPane\").classList.toggle(\"closed\",!state.previewOpen);
  if(window.innerWidth>1180)$(\"#previewPane\").classList.toggle(\"hidden\",!state.previewOpen);
  $(\"#previewToggle\").textContent=state.previewOpen?\"Hide Preview\":\"PDF Preview\";
  if(state.previewOpen)schedulePdfPreview(40);
}
function schedulePdfPreview(delay=1500){
  clearTimeout(state.previewRenderTimer);
  if(!state.previewOpen||!state.currentProjectId)return;
  const elapsed=Date.now()-(state.previewLastEditAt||0);
  const wait=Math.max(delay,Math.max(0,state.previewIdleMs-elapsed));
  state.previewRenderTimer=setTimeout(renderLivePdfPreview,wait);
}"""
js = replace_once(js, old_preview, new_preview, 'preview scheduler')

old_render_start = """async function renderLivePdfPreview(){
  if(!state.previewOpen||!state.currentProjectId)return;
  if(state.previewRendering){state.previewPending=true;return;}
  const scroller=$(\"#pdfPreviewScroll\"),pagesWrap=$(\"#pdfPreviewPages\"),status=$(\"#pdfPreviewStatus\");"""
new_render_start = """async function renderLivePdfPreview(){
  if(!state.previewOpen||!state.currentProjectId)return;
  const idleFor=Date.now()-(state.previewLastEditAt||0);
  if(idleFor<state.previewIdleMs){schedulePdfPreview(state.previewIdleMs-idleFor+60);return;}
  if(state.previewRendering){state.previewPending=true;return;}
  const scroller=$(\"#pdfPreviewScroll\"),pagesWrap=$(\"#pdfPreviewPages\"),status=$(\"#pdfPreviewStatus\");"""
js = replace_once(js, old_render_start, new_render_start, 'preview render guard')

js = replace_once(js, "maxWidth:440,dprCap:2", "maxWidth:420,dprCap:1.35", 'preview render resolution')
js = replace_once(js, "schedulePdfPreview(260);", "schedulePdfPreview(state.previewIdleMs);", 'preview pending delay')

old_prices = """function renderPriceItems(p) {
  const wrap=$(\"#priceItems\"); wrap.innerHTML=\"\";
  const hasAlternates=p.priceItems.some(i=>!i.isBaseBid);
  p.priceItems.forEach((item,index)=>{
    const isBase=Boolean(item.isBaseBid);
    const row=document.createElement(\"div\"); row.className=`price-item-row ${isBase?'base-bid-row':''} ${isBase&&hasAlternates?'has-alternates':''}`.trim(); row.dataset.priceId=item.id; row.dataset.baseBid=isBase?'true':'false';
    row.innerHTML=isBase
      ? `<input class=\"price-item-input price-name\" value=\"Base Bid\" readonly><input class=\"price-item-input price-value\" value=\"${esc(item.price||'')}\" placeholder=\"$0.00\"><span class=\"base-bid-lock\" title=\"Base Bid is always included in Proposed Pricing\">Base</span>`
      : `<div class=\"row-check-preview\" title=\"Printed alternate/add-on selection box\"></div><input class=\"price-item-input price-name\" value=\"${esc(item.name||'')}\" placeholder=\"Alternate / add-on pricing line\"><input class=\"price-item-input price-value\" value=\"${esc(item.price||'')}\" placeholder=\"$0.00\"><button class=\"remove-price-item\" type=\"button\" title=\"Remove line\">×</button>`;
    wrap.appendChild(row);
  });
  $(\"#emptyPriceItems\").classList.add(\"hidden\");
}
function addPriceItem() {
  const p=collectEditorProject(); if(!p)return;
  p.priceItems.push({id:uid(),name:\"\",description:\"\",price:\"\",isBaseBid:false}); putProject(p); renderPriceItems(p); updatePreview();
  const last=$$('.price-item-row:not(.base-bid-row) .price-name').at(-1); if(last)last.focus();
}
function collectPriceItems() {
  return $$('.price-item-row').map(row=>({id:row.dataset.priceId,name:row.dataset.baseBid==='true'?\"Base Bid\":$('.price-name',row).value,description:\"\",price:$('.price-value',row).value,isBaseBid:row.dataset.baseBid==='true'}));
}"""
new_prices = """function renderPriceItems(p) {
  const wrap=$(\"#priceItems\"); wrap.innerHTML=\"\";
  const alternateById=new Map((p.alternateScopes||[]).map(a=>[a.id,a]));
  const hasAlternates=p.priceItems.some(i=>!i.isBaseBid);
  p.priceItems.forEach((item,index)=>{
    const isBase=Boolean(item.isBaseBid);
    const linkedAlternate=!isBase&&item.alternateScopeId?alternateById.get(item.alternateScopeId):null;
    const displayName=linkedAlternate?.title||item.name||'';
    const row=document.createElement(\"div\"); row.className=`price-item-row ${isBase?'base-bid-row':''} ${isBase&&hasAlternates?'has-alternates':''} ${linkedAlternate?'linked-alternate-row':''}`.trim(); row.dataset.priceId=item.id; row.dataset.baseBid=isBase?'true':'false'; row.dataset.alternateScopeId=linkedAlternate?.id||'';
    row.innerHTML=isBase
      ? `<input class=\"price-item-input price-name\" value=\"Base Bid\" readonly><input class=\"price-item-input price-value\" value=\"${esc(item.price||'')}\" placeholder=\"$0.00\"><span class=\"base-bid-lock\" title=\"Base Bid is always included in Proposed Pricing\">Base</span>`
      : `<div class=\"row-check-preview\" title=\"Printed alternate/add-on selection box\"></div><input class=\"price-item-input price-name\" value=\"${esc(displayName)}\" ${linkedAlternate?'readonly title=\"Linked to Alternate Scope\"':'placeholder=\"Custom alternate / add-on pricing line\"'}><input class=\"price-item-input price-value\" value=\"${esc(item.price||'')}\" placeholder=\"$0.00\"><button class=\"remove-price-item\" type=\"button\" title=\"Remove line\">×</button>`;
    wrap.appendChild(row);
  });
  renderPricingAlternatePicker(p);
  $(\"#emptyPriceItems\").classList.add(\"hidden\");
}
function renderPricingAlternatePicker(p){
  const select=$(\"#existingAlternatePriceSelect\"),btn=$(\"#addExistingAlternatePriceBtn\");
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
  const id=$(\"#existingAlternatePriceSelect\")?.value||'';if(!id)return toast('Select an alternate to add.');
  const alt=(p.alternateScopes||[]).find(a=>a.id===id);if(!alt)return toast('That alternate could not be found.');
  if((p.priceItems||[]).some(i=>i.alternateScopeId===id))return toast('That alternate is already in Proposed Pricing.');
  p.priceItems.push({id:uid(),name:alt.title||'Alternate',description:'',price:'',isBaseBid:false,alternateScopeId:id});
  putProject(p);renderPriceItems(p);updatePreview();
  const row=$(`.price-item-row[data-alternate-scope-id=\"${id}\"]`);$('.price-value',row)?.focus();
}
function addPriceItem() {
  const p=collectEditorProject(); if(!p)return;
  p.priceItems.push({id:uid(),name:\"\",description:\"\",price:\"\",isBaseBid:false}); putProject(p); renderPriceItems(p); updatePreview();
  const last=$$('.price-item-row:not(.base-bid-row) .price-name').at(-1); if(last)last.focus();
}
function collectPriceItems() {
  return $$('.price-item-row').map(row=>{
    const linkedId=row.dataset.alternateScopeId||'';
    return {id:row.dataset.priceId,name:row.dataset.baseBid==='true'?\"Base Bid\":$('.price-name',row).value,description:\"\",price:$('.price-value',row).value,isBaseBid:row.dataset.baseBid==='true',...(linkedId?{alternateScopeId:linkedId}:{})};
  });
}"""
js = replace_once(js, old_prices, new_prices, 'pricing functions')

old_wire = '$("#projectTitleInline").addEventListener("input",()=>{scheduleSave();updatePreview();});$("#addPriceItemBtn").addEventListener("click",addPriceItem);'
new_wire = '$("#projectTitleInline").addEventListener("input",()=>{scheduleSave();updatePreview();});$("#addPriceItemBtn").addEventListener("click",addPriceItem);$("#addExistingAlternatePriceBtn")?.addEventListener("click",addExistingAlternatePriceItem);'
js = replace_once(js, old_wire, new_wire, 'pricing event wiring')

old_change = """document.addEventListener(\"change\",e=>{if(e.target.matches('[data-section-enabled],[data-company],[data-field],[data-office-setting],[data-map-setting]')){if(e.target.matches('[data-office-setting],[data-map-setting]'))collectAndSaveOfficeSettings();scheduleSave();updatePreview();}});
document.addEventListener('click',e=>{if(!e.target.closest('.project-card-actions'))$$('.project-menu').forEach(x=>x.classList.add('hidden'));});"""
new_change = """document.addEventListener(\"change\",e=>{if(e.target.matches('[data-section-enabled],[data-company],[data-field],[data-office-setting],[data-map-setting]')){if(e.target.matches('[data-office-setting],[data-map-setting]'))collectAndSaveOfficeSettings();scheduleSave();updatePreview();}});
document.addEventListener('focusout',e=>{
  if(!e.target.matches('.price-value,.basic-summary-amount,#basicOverheadAmount,.summary-division-amount,.summary-sub-amount,.summary-custom-amount,.summary-extra-amount'))return;
  const before=e.target.value;normalizeProposalCurrencyInput(e.target);if(e.target.value===before)return;
  if(e.target.matches('.basic-summary-amount,#basicOverheadAmount'))updateBasicSummaryTotal();
  if(e.target.matches('.summary-division-amount,.summary-sub-amount,.summary-custom-amount,.summary-extra-amount'))updateAdvancedSummaryTotals();
  scheduleSave();updatePreview();
});
document.addEventListener('click',e=>{if(!e.target.closest('.project-card-actions'))$$('.project-menu').forEach(x=>x.classList.add('hidden'));});"""
js = replace_once(js, old_change, new_change, 'currency focusout wiring')

app_path.write_text(js, encoding='utf-8')

index_path = Path('index.html')
html = index_path.read_text(encoding='utf-8')
old_pricing_html = """            <div class=\"approval-card-head\">
              <div>
                <h3>Proposed Pricing</h3>
                <p>Base Bid is always included as the first line. Add blank lines below it for alternates and add-ons as needed.</p>
              </div>
              <button id=\"addPriceItemBtn\" class=\"btn btn-secondary\" type=\"button\">+ Add Alternate / Add-On</button>
            </div>"""
new_pricing_html = """            <div class=\"approval-card-head\">
              <div>
                <h3>Proposed Pricing</h3>
                <p>Base Bid is always included first. Add an existing Alternate Scope by name, or create a custom pricing line.</p>
              </div>
              <div class=\"pricing-add-controls\">
                <select id=\"existingAlternatePriceSelect\" class=\"select-control pricing-alternate-select\" aria-label=\"Existing alternate scope\"><option value=\"\">Select existing alternate…</option></select>
                <button id=\"addExistingAlternatePriceBtn\" class=\"btn btn-secondary\" type=\"button\">+ Add Existing Alternate</button>
                <button id=\"addPriceItemBtn\" class=\"btn btn-secondary\" type=\"button\">+ Custom Alternate / Add-On</button>
              </div>
            </div>"""
html = replace_once(html, old_pricing_html, new_pricing_html, 'pricing controls html')
index_path.write_text(html, encoding='utf-8')

styles_path = Path('styles.css')
css = styles_path.read_text(encoding='utf-8')
anchor = ".price-item-row .price-name { min-width: 0; }"
addition = """.price-item-row .price-name { min-width: 0; }
.pricing-add-controls { display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap; max-width:620px; }
.pricing-add-controls .pricing-alternate-select { min-width:220px; max-width:270px; }
.price-item-row.linked-alternate-row .price-name[readonly] { background:#f5f6f7; color:#565b60; font-weight:700; }
@media (max-width: 980px) { .approval-card-head { flex-direction:column; } .pricing-add-controls { width:100%; justify-content:flex-start; } .pricing-add-controls .pricing-alternate-select { max-width:none; flex:1 1 220px; } }"""
css = replace_once(css, anchor, addition, 'pricing css')
styles_path.write_text(css, encoding='utf-8')

print('Patch applied successfully.')
