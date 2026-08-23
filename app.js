const CSI_DIVISIONS = [
  ["00", "Procurement and Contracting Requirements"], ["01", "General Requirements"], ["02", "Existing Conditions"],
  ["03", "Concrete"], ["04", "Masonry"], ["05", "Metals"], ["06", "Wood, Plastics, and Composites"],
  ["07", "Thermal and Moisture Protection"], ["08", "Openings"], ["09", "Finishes"], ["10", "Specialties"],
  ["11", "Equipment"], ["12", "Furnishings"], ["13", "Special Construction"], ["14", "Conveying Equipment"],
  ["21", "Fire Suppression"], ["22", "Plumbing"], ["23", "Heating, Ventilating, and Air Conditioning (HVAC)"],
  ["25", "Integrated Automation"], ["26", "Electrical"], ["27", "Communications"], ["28", "Electronic Safety and Security"],
  ["31", "Earthwork"], ["32", "Exterior Improvements"], ["33", "Utilities"], ["34", "Transportation"],
  ["35", "Waterway and Marine Construction"], ["40", "Process Integration"], ["41", "Material Processing and Handling Equipment"],
  ["42", "Process Heating, Cooling, and Drying Equipment"], ["43", "Process Gas and Liquid Handling, Purification, and Storage Equipment"],
  ["44", "Pollution and Waste Control Equipment"], ["45", "Industry-Specific Manufacturing Equipment"],
  ["46", "Water and Wastewater Equipment"], ["48", "Electrical Power Generation"]
];

const DEFAULT_COMPANY = {
  companyName: "Koehn Construction Services",
  address: "PO Box 420 · 1111 N 2nd\nFredonia, Kansas 66736",
  phone: "866.943.7751", fax: "620.378.2283", email: "", website: "koehncs.com",
  orange: "#f36f21", charcoal: "#55575a"
};

const ACKNOWLEDGMENT_TEXT = "By signing below, the client acknowledges the selections marked above and requests that Koehn Construction Services prepare and issue a formal contract reflecting those selections. This acknowledgment is not a contract, does not authorize construction work, and does not modify any existing agreement. Work will proceed only after execution of the applicable contract or other written authorization acceptable to Koehn Construction Services.";

const DEFAULT_DISCLAIMERS = [
  {
    id: "standard-proposal",
    name: "Standard Proposal",
    text: "This proposal and accompanying scope are provided for review and selection purposes and are subject to final contract terms and conditions. Scope, pricing, schedule, availability, and authorization to perform work will be established only in a separately executed written agreement."
  },
  {
    id: "budget-conceptual",
    name: "Budget / Conceptual Proposal",
    text: "This budget is preliminary and is provided for planning purposes only. Scope and pricing are subject to change based on final drawings, specifications, engineering, selections, site conditions, subcontractor/vendor pricing, and other project requirements. Final obligations will be established only in a separately executed written agreement."
  }
];

const state = { user: null, currentProjectId: null, authMode: "login", saveTimer: null, previewOpen: true, adminDisclaimerId: null };
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function nowIso() { return new Date().toISOString(); }
function fmtDate(iso) { if (!iso) return "—"; const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : "")); return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}); }
function fmtTime(iso) { if (!iso) return ""; return new Date(iso).toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}); }
function esc(s="") { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function currencyText(v="") { return String(v).trim(); }

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

const STORAGE_KEY = "koehncs.scopeBuilder.data.v1";
const SESSION_KEY = "koehncs.scopeBuilder.session";
const BACKUP_VERSION = 1;

function blankDataStore() {
  return { schemaVersion: 1, updatedAt: nowIso(), users: {}, projects: {}, disclaimers: DEFAULT_DISCLAIMERS.map(x=>({...x})) };
}
function readDataStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      data.users = data.users || {};
      data.projects = data.projects || {};
      data.disclaimers = Array.isArray(data.disclaimers) && data.disclaimers.length ? data.disclaimers : DEFAULT_DISCLAIMERS.map(x=>({...x}));
      return data;
    }
  } catch {}
  return migrateLegacyStorage();
}
function writeDataStore(data) {
  data.schemaVersion = 1;
  data.updatedAt = nowIso();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}
function migrateLegacyStorage() {
  const data = blankDataStore();
  let found = false;
  for (let i=0;i<localStorage.length;i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith("ksb:user:")) {
      try {
        const u = JSON.parse(localStorage.getItem(key));
        if (u?.username) { data.users[u.username.toLowerCase()] = u; found = true; }
      } catch {}
    }
    if (key.startsWith("ksb:projects:")) {
      try {
        const username = key.slice("ksb:projects:".length).toLowerCase();
        const projects = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(projects)) { data.projects[username] = projects; found = true; }
      } catch {}
    }
  }
  try {
    const oldDisclaimers = JSON.parse(localStorage.getItem("ksb:disclaimers") || "null");
    if (Array.isArray(oldDisclaimers) && oldDisclaimers.length) { data.disclaimers = oldDisclaimers; found = true; }
  } catch {}
  const oldSession = localStorage.getItem("ksb:session");
  if (oldSession && !localStorage.getItem(SESSION_KEY)) localStorage.setItem(SESSION_KEY, oldSession);
  writeDataStore(data);
  if (found) setTimeout(()=>toast("Previous Scope Builder data migrated."), 400);
  return data;
}
function sessionKey() { return SESSION_KEY; }
function getUserRecord(username) {
  if (!username) return null;
  return readDataStore().users[username.toLowerCase()] || null;
}
function saveUserRecord(record) {
  if (!record?.username) return;
  const data = readDataStore();
  data.users[record.username.toLowerCase()] = record;
  writeDataStore(data);
}
function getAllUsers() {
  return Object.values(readDataStore().users || {}).filter(Boolean).sort((a,b)=>(a.username||"").localeCompare(b.username||""));
}
function normalizeUser(record) {
  if (!record) return null;
  if (!record.role) {
    const otherAdmins = getAllUsers().filter(u=>u.username?.toLowerCase() !== record.username?.toLowerCase() && u.role === "admin");
    record.role = otherAdmins.length ? "employee" : "admin";
    saveUserRecord(record);
  }
  return record;
}
function isAdmin() { return state.user?.role === "admin"; }
function getDisclaimers() { return readDataStore().disclaimers.map(x=>({...x})); }
function saveDisclaimers(items) { const data=readDataStore(); data.disclaimers=items.map(x=>({...x})); writeDataStore(data); }
function getDisclaimer(id) { const all=getDisclaimers(); return all.find(d=>d.id===id) || all[0] || null; }

function normalizeProject(p) {
  p.divisions = p.divisions || Object.fromEntries(CSI_DIVISIONS.map(([n,t]) => [n,{number:n,title:t,enabled:false,text:""}]));
  CSI_DIVISIONS.forEach(([n,t]) => { if (!p.divisions[n]) p.divisions[n] = {number:n,title:t,enabled:false,text:""}; });
  p.company = {...DEFAULT_COMPANY, ...(p.company||{})};
  p.sectionEnabled = { clarifications:true, exclusions:true, alternates:true, clientSelections:true, ...(p.sectionEnabled||{}) };
  p.priceItems = Array.isArray(p.priceItems) ? p.priceItems : [];
  p.disclaimerId = p.disclaimerId || getDisclaimers()[0]?.id || "";
  return p;
}
function getProjects() {
  if (!state.user) return [];
  const data = readDataStore();
  const projects = data.projects[state.user.username.toLowerCase()] || [];
  return projects.map(normalizeProject);
}
function saveProjects(projects) {
  if (!state.user) return;
  const data = readDataStore();
  data.projects[state.user.username.toLowerCase()] = projects;
  writeDataStore(data);
}
function getCurrentProject() { return getProjects().find(p => p.id === state.currentProjectId) || null; }
function putProject(project) {
  project = normalizeProject(project);
  const projects = getProjects();
  const idx = projects.findIndex(p=>p.id===project.id);
  project.updatedAt = nowIso();
  if (idx >= 0) projects[idx] = project; else projects.unshift(project);
  saveProjects(projects);
}

function makeProject(name="Untitled Project", client="", projectNumber="") {
  const date = new Date();
  const dateValue = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const divisions = Object.fromEntries(CSI_DIVISIONS.map(([n,t]) => [n,{number:n,title:t,enabled:false,text:""}]));
  return normalizeProject({
    id: uid(), createdAt: nowIso(), updatedAt: nowIso(), projectName: name, projectNumber, clientName: client,
    attention: "", projectAddress: "", proposalDate: dateValue, revision: "Original", preparedBy: "", documentTitle: "Scope of Work", introNote: "",
    clarifications: "", exclusions: "", alternates: "", priceItems: [], disclaimerId: getDisclaimers()[0]?.id || "",
    sectionEnabled: { clarifications:true, exclusions:true, alternates:true, clientSelections:true }, divisions, company: {...DEFAULT_COMPANY}
  });
}

function toast(msg) { const el=$("#toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove("show"),2200); }
function setSaveStatus(text) { $("#saveStatus").textContent = text; }
function scheduleSave() { setSaveStatus("Saving…"); clearTimeout(state.saveTimer); state.saveTimer=setTimeout(()=>{ saveEditorProject(); setSaveStatus("All changes saved"); },450); }
function showAuth() { $("#authView").classList.remove("hidden"); $("#appView").classList.add("hidden"); }
function showApp() { $("#authView").classList.add("hidden"); $("#appView").classList.remove("hidden"); }

function updateAuthMode() {
  const register = state.authMode === "register";
  $("#authTitle").textContent = register ? "Create account" : "Sign in";
  $("#authSubtitle").textContent = register ? "Create an account in this Scope Builder workspace." : "Continue working on saved scope packages.";
  $("#authSubmit").textContent = register ? "Create account" : "Sign in";
  $("#toggleAuthMode").textContent = register ? "Already have an account? Sign in" : "Create an account";
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const username=$("#authUsername").value.trim(), password=$("#authPassword").value;
  if (!username || !password) return;
  const hash=await hashPassword(password);
  if (state.authMode === "register") {
    if (getUserRecord(username)) return toast("That username already exists in this workspace.");
    const role = getAllUsers().length === 0 ? "admin" : "employee";
    const record={username,passwordHash:hash,role,createdAt:nowIso()};
    saveUserRecord(record); localStorage.setItem(sessionKey(),username); state.user=record;
    toast(role === "admin" ? "First account created as Admin." : "Employee account created."); enterDashboard();
  } else {
    const stored=getUserRecord(username); if (!stored) return toast("Username not found in this workspace.");
    const record=normalizeUser(stored); if (record.passwordHash !== hash) return toast("Incorrect password.");
    localStorage.setItem(sessionKey(),record.username); state.user=record; enterDashboard();
  }
}
function restoreSession() {
  const username=localStorage.getItem(sessionKey()); if (!username) return showAuth();
  const record=getUserRecord(username); if (!record) return showAuth();
  state.user=normalizeUser(record); enterDashboard();
}
function refreshRoleUi() {
  const admin=isAdmin();
  $("#avatarInitial").textContent=state.user.username.slice(0,1).toUpperCase();
  $("#userDisplayName").textContent=state.user.username;
  $("#userRoleBadge").textContent=admin?"Admin":"Employee";
  $("#userRoleBadge").classList.toggle("admin",admin);
  $("#adminPanelBtn").classList.toggle("hidden",!admin);
  $("#adminPopoverBtn").classList.toggle("hidden",!admin);
}
function enterDashboard() {
  showApp(); requestPersistentBrowserStorage(); state.currentProjectId=null;
  $("#dashboardView").classList.remove("hidden"); $("#editorView").classList.add("hidden");
  $("#backToDashboard").classList.add("hidden"); $("#exportPdfBtn").classList.add("hidden");
  refreshRoleUi(); renderProjects();
}

function renderProjects() {
  const q=$("#projectSearch").value.trim().toLowerCase(), sort=$("#projectSort").value;
  let projects=getProjects().filter(p=>[p.projectName,p.clientName,p.projectNumber].join(" ").toLowerCase().includes(q));
  projects.sort((a,b)=> sort==="name"?a.projectName.localeCompare(b.projectName):sort==="client"?(a.clientName||"").localeCompare(b.clientName||""):new Date(b.updatedAt)-new Date(a.updatedAt));
  const grid=$("#projectsGrid"); grid.innerHTML=""; $("#emptyProjects").classList.toggle("hidden",projects.length>0||q.length>0);
  if (!projects.length&&q) grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><h3>No matching projects</h3><p>Try a different project, client, or project number.</p></div>`;
  projects.forEach(p=>{
    const used=Object.values(p.divisions||{}).filter(d=>d.enabled&&d.text.trim()).length;
    const card=document.createElement("article"); card.className="project-card";
    card.innerHTML=`<div class="project-card-head"><div><div class="project-number">${esc(p.projectNumber||"No project number")}</div><h3>${esc(p.projectName||"Untitled Project")}</h3><div class="project-client">${esc(p.clientName||"No client entered")}</div></div><button class="project-open" data-open-project="${p.id}">Open →</button></div><div class="project-meta"><span>${used} divisions used · ${p.priceItems.length} priced items</span><span>Updated ${esc(fmtTime(p.updatedAt))}</span></div>`;
    grid.appendChild(card);
  });
  $$('[data-open-project]').forEach(b=>b.addEventListener('click',()=>openProject(b.dataset.openProject)));
}
function openNewProjectDialog() { $("#newProjectName").value=""; $("#newClientName").value=""; $("#newProjectNumber").value=""; $("#newProjectDialog").showModal(); setTimeout(()=>$("#newProjectName").focus(),100); }
function handleNewProject(e) {
  e.preventDefault(); if (e.submitter&&e.submitter.value==="cancel") { $("#newProjectDialog").close(); return; }
  const name=$("#newProjectName").value.trim(); if (!name) return;
  const p=makeProject(name,$("#newClientName").value.trim(),$("#newProjectNumber").value.trim()); putProject(p); $("#newProjectDialog").close(); openProject(p.id);
}
function openProject(id) {
  state.currentProjectId=id; const p=getCurrentProject(); if (!p) return enterDashboard();
  $("#dashboardView").classList.add("hidden"); $("#editorView").classList.remove("hidden"); $("#backToDashboard").classList.remove("hidden"); $("#exportPdfBtn").classList.remove("hidden");
  $("#projectTitleInline").value=p.projectName; $("#sidebarProjectName").textContent=p.projectName;
  renderDivisionUI(p); renderPriceItems(p); renderDisclaimerSelect(p); populateEditor(p); updateSelectedDisclaimerPreview(); updatePreview(); activateTab("info");
}

function renderDivisionUI(p) {
  const cards=$("#divisionCards"), nav=$("#divisionNav"); cards.innerHTML=""; nav.innerHTML="";
  CSI_DIVISIONS.forEach(([n,t])=>{
    const d=p.divisions[n]||{number:n,title:t,enabled:false,text:""};
    const card=document.createElement("article"); card.className=`division-card ${d.enabled?'enabled':''}`; card.dataset.division=n;
    card.innerHTML=`<div class="division-card-header"><div class="div-badge">${n}</div><div><div class="div-title">Division ${n} – ${esc(t)}</div><div class="div-sub">${d.text.trim()?`${d.text.trim().split(/\n/).length} scope lines entered`:'No scope entered'}</div></div><label class="switch-label"><input type="checkbox" class="division-enabled" ${d.enabled?'checked':''}><span class="switch"></span>Include</label><button class="division-expand" aria-label="Expand division">⌄</button></div><div class="division-body"><textarea class="division-text" placeholder="Paste or type Division ${n} scope here…">${esc(d.text)}</textarea><div class="paste-helper"><span>Tip: one line per scope item works best in PDF output.</span><span>Auto-saved</span></div></div>`;
    cards.appendChild(card);
    const navBtn=document.createElement("button"); navBtn.className="division-nav-item"; navBtn.dataset.navDivision=n; navBtn.innerHTML=`<span class="division-nav-number">${n}</span><span>${esc(t)}</span><span class="division-nav-dot ${d.text.trim()?'used':''}"></span>`; nav.appendChild(navBtn);
  });
  $$(".division-card-header",cards).forEach(h=>h.addEventListener("click",e=>{ if(e.target.closest(".switch-label"))return; h.closest(".division-card").classList.toggle("open"); }));
  $$(".division-enabled",cards).forEach(cb=>cb.addEventListener("change",e=>{ const card=e.target.closest(".division-card"); card.classList.toggle("enabled",e.target.checked); if(e.target.checked)card.classList.add("open"); scheduleSave();updatePreview(); }));
  $$(".division-text",cards).forEach(ta=>ta.addEventListener("input",e=>{ const card=e.target.closest(".division-card"); $(".div-sub",card).textContent=e.target.value.trim()?`${e.target.value.trim().split(/\n/).length} scope lines entered`:"No scope entered"; $(`[data-nav-division="${card.dataset.division}"] .division-nav-dot`).classList.toggle("used",!!e.target.value.trim()); scheduleSave();updatePreview(); }));
  $$('[data-nav-division]').forEach(btn=>btn.addEventListener('click',()=>{ activateTab("scope"); const card=$(`[data-division="${btn.dataset.navDivision}"]`);card.classList.add('open');card.scrollIntoView({behavior:'smooth',block:'center'}); }));
  filterDivisionNav();
}

function renderPriceItems(p) {
  const wrap=$("#priceItems"); wrap.innerHTML="";
  p.priceItems.forEach((item,index)=>{
    const row=document.createElement("div"); row.className="price-item-row"; row.dataset.priceId=item.id;
    row.innerHTML=`<div class="row-check-preview" title="Printed client selection box"></div><input class="price-item-input price-name" value="${esc(item.name||'')}" placeholder="Item / option name"><input class="price-item-input price-description" value="${esc(item.description||'')}" placeholder="Short description (optional)"><input class="price-item-input price-value" value="${esc(item.price||'')}" placeholder="$0.00"><button class="remove-price-item" type="button" title="Remove item">×</button>`;
    wrap.appendChild(row);
  });
  $("#emptyPriceItems").classList.toggle("hidden",p.priceItems.length>0);
}
function addPriceItem() {
  const p=collectEditorProject(); if(!p)return;
  p.priceItems.push({id:uid(),name:"",description:"",price:""}); putProject(p); renderPriceItems(p); updatePreview();
  const last=$$('.price-name').at(-1); if(last)last.focus();
}
function collectPriceItems() {
  return $$('.price-item-row').map(row=>({id:row.dataset.priceId,name:$('.price-name',row).value,description:$('.price-description',row).value,price:$('.price-value',row).value}));
}

function renderDisclaimerSelect(p) {
  const select=$("#projectDisclaimerSelect"), items=getDisclaimers(); select.innerHTML="";
  items.forEach(d=>{ const o=document.createElement("option");o.value=d.id;o.textContent=d.name;select.appendChild(o); });
  if (!items.length) { const o=document.createElement("option");o.value="";o.textContent="No disclaimer available — contact an Admin";select.appendChild(o); }
  select.value=items.some(d=>d.id===p.disclaimerId)?p.disclaimerId:(items[0]?.id||"");
}
function updateSelectedDisclaimerPreview() {
  const d=getDisclaimer($("#projectDisclaimerSelect").value);
  $("#selectedDisclaimerPreview").textContent=d?.text||"No approved disclaimer is currently available.";
}

function populateEditor(p) {
  $$('[data-field]').forEach(el=>{ const k=el.dataset.field; el.value=p[k]??""; });
  $$('[data-company]').forEach(el=>{ const k=el.dataset.company;el.value=p.company?.[k]??DEFAULT_COMPANY[k]??""; });
  $$('[data-section-enabled]').forEach(el=>el.checked=p.sectionEnabled?.[el.dataset.sectionEnabled]!==false);
}
function collectEditorProject() {
  const p=getCurrentProject(); if(!p)return null;
  $$('[data-field]').forEach(el=>p[el.dataset.field]=el.value);
  p.projectName=$("#projectTitleInline").value.trim()||"Untitled Project";
  p.company=p.company||{...DEFAULT_COMPANY}; $$('[data-company]').forEach(el=>p.company[el.dataset.company]=el.value);
  p.sectionEnabled=p.sectionEnabled||{}; $$('[data-section-enabled]').forEach(el=>p.sectionEnabled[el.dataset.sectionEnabled]=el.checked);
  p.priceItems=collectPriceItems();
  $$('.division-card').forEach(card=>{ const n=card.dataset.division; p.divisions[n]=p.divisions[n]||{number:n,title:CSI_DIVISIONS.find(x=>x[0]===n)[1]};p.divisions[n].enabled=$('.division-enabled',card).checked;p.divisions[n].text=$('.division-text',card).value; });
  return p;
}
function saveEditorProject() { const p=collectEditorProject();if(!p)return;putProject(p);$("#sidebarProjectName").textContent=p.projectName; }
function activateTab(name) { $$('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name)); $$('.tab-panel').forEach(p=>p.classList.remove('active')); $(`#${name}Tab`).classList.add('active'); }
function filterDivisionNav() { const q=$("#divisionSearch").value.trim().toLowerCase(); $$('[data-nav-division]').forEach(btn=>btn.classList.toggle('hidden',!btn.textContent.toLowerCase().includes(q))); }

function updatePreview() {
  const p=collectEditorProject();if(!p)return;
  document.documentElement.style.setProperty('--orange',p.company.orange||DEFAULT_COMPANY.orange);document.documentElement.style.setProperty('--charcoal',p.company.charcoal||DEFAULT_COMPANY.charcoal);
  $("#previewDocTitle").textContent=p.documentTitle||"Scope of Work";$("#previewProjectNo").textContent=p.projectNumber||"PROJECT";$("#previewProjectName").textContent=p.projectName||"Untitled Project";$("#previewDate").textContent=fmtDate(p.proposalDate);$("#previewClient").textContent=p.clientName||"—";$("#previewPrepared").textContent=p.preparedBy||"—";
  const body=$("#previewBody");body.innerHTML="";if(p.introNote.trim())body.insertAdjacentHTML('beforeend',`<div class="preview-intro">${esc(p.introNote)}</div>`);
  const active=CSI_DIVISIONS.map(([n])=>p.divisions[n]).filter(d=>d?.enabled&&d.text.trim());active.slice(0,5).forEach(d=>body.insertAdjacentHTML('beforeend',`<section class="preview-section"><div class="preview-section-title">Division ${d.number} · ${esc(d.title)}</div><p>${esc(d.text)}</p></section>`));
  if(active.length>5)body.insertAdjacentHTML('beforeend',`<div style="margin-top:7px;color:#999">+ ${active.length-5} more divisions on following pages</div>`);
  const extra=[["Clarifications",p.clarifications,p.sectionEnabled.clarifications],["Exclusions",p.exclusions,p.sectionEnabled.exclusions],["Alternates",p.alternates,p.sectionEnabled.alternates]].filter(x=>x[2]&&x[1].trim());
  extra.slice(0,1).forEach(([t,text])=>body.insertAdjacentHTML('beforeend',`<section class="preview-section"><div class="preview-section-title">${t}</div><p>${esc(text)}</p></section>`));
  if(p.sectionEnabled.clientSelections&&p.priceItems.length){body.insertAdjacentHTML('beforeend',`<section class="preview-section"><div class="preview-section-title">Client Selections</div>${p.priceItems.slice(0,2).map(i=>`<div class="preview-selection-row"><span class="preview-selection-box"></span><span>${esc(i.name||'Selection item')}</span><strong>${esc(i.price||'')}</strong></div>`).join('')}</section>`);}
  const d=getDisclaimer(p.disclaimerId); if(d)body.insertAdjacentHTML('beforeend',`<div class="preview-disclaimer"><strong>${esc(d.name)}</strong> · ${esc(d.text.slice(0,135))}${d.text.length>135?'…':''}</div>`);
  $("#previewFooterContact").innerHTML=`${esc(p.company.address||'').replace(/\n/g,'<br>')}<br><strong>P</strong> ${esc(p.company.phone||'')} ${p.company.fax?` · <strong>F</strong> ${esc(p.company.fax)}`:''}<br><strong>${esc(p.company.website||'')}</strong>`;
}
function togglePreview(open) { state.previewOpen=open??!state.previewOpen;$("#previewPane").classList.toggle("closed",!state.previewOpen);if(window.innerWidth>1180)$("#previewPane").classList.toggle("hidden",!state.previewOpen);$("#previewToggle").textContent=state.previewOpen?"Hide Preview":"PDF Preview"; }
async function imageToDataUrl(src) { const img=new Image();img.crossOrigin="anonymous";return new Promise((resolve,reject)=>{img.onload=()=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);resolve(c.toDataURL('image/png'));};img.onerror=reject;img.src=src;}); }
function parseScopeLines(text) { return String(text||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>{const cleaned=s.replace(/^[-•▪◦*]\s*/,"");return{bullet:cleaned!==s||/^\d+[.)]\s/.test(s),text:cleaned};}); }
function hexToRgb(hex) { const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);return[(n>>16)&255,(n>>8)&255,n&255]; }

async function exportPdf() {
  saveEditorProject();const p=getCurrentProject();if(!p)return;if(!window.jspdf)return toast("PDF library did not load. Check your internet connection and try again.");
  setSaveStatus("Building PDF…");const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:"in",format:"letter",orientation:"portrait",compress:true});
  const orange=hexToRgb(p.company.orange||DEFAULT_COMPANY.orange),charcoal=hexToRgb(p.company.charcoal||DEFAULT_COMPANY.charcoal),lightGray=[244,244,244],text=[52,54,57],muted=[120,123,127];
  const pageW=8.5,pageH=11,left=.72,right=.72,contentW=pageW-left-right;let y=1.62,page=1;let logoData=null,bandData=null;
  try{[logoData,bandData]=await Promise.all([imageToDataUrl('assets/koehn-logo.png'),imageToDataUrl('assets/triangle-band.png')]);}catch{}
  function addHeader(first=false){if(logoData)doc.addImage(logoData,'PNG',left,.48,2.16,.48,undefined,'FAST');doc.setTextColor(...charcoal);doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.text((p.documentTitle||'Scope of Work').toUpperCase(),pageW-right,.62,{align:'right'});doc.setFont('helvetica','normal');doc.setFontSize(6.6);doc.setTextColor(...muted);doc.text((p.projectNumber||'PROJECT').toUpperCase(),pageW-right,.78,{align:'right'});doc.setDrawColor(...orange);doc.setLineWidth(.025);doc.line(left,1.03,left+1.72,1.03);doc.setDrawColor(...charcoal);doc.line(left+1.72,1.03,pageW-right,1.03);if(first){doc.setTextColor(...muted);doc.setFontSize(6.5);doc.setFont('helvetica','bold');doc.text('PROJECT',left,1.25);doc.text('DATE',5.75,1.25);doc.text('CLIENT',left,1.48);doc.text('PREPARED BY',5.75,1.48);doc.setTextColor(...text);doc.setFontSize(8.5);doc.text(p.projectName||'Untitled Project',left,1.36,{maxWidth:4.65});doc.text(fmtDate(p.proposalDate),5.75,1.36);doc.text(p.clientName||'—',left,1.59,{maxWidth:4.65});doc.text(p.preparedBy||'—',5.75,1.59,{maxWidth:2.0});}}
  function addFooter(){const footerY=10.48;doc.setFont('helvetica','normal');doc.setFontSize(6.4);doc.setTextColor(...muted);const addr=(p.company.address||'').split(/\n/).join(' · ');const footer=`${addr}   P ${p.company.phone||''}${p.company.fax?`   F ${p.company.fax}`:''}   ${p.company.website||''}`;doc.text(footer,left,footerY,{maxWidth:6.4});doc.setFont('helvetica','bold');doc.setTextColor(...orange);doc.text(`PAGE ${page}`,pageW-right,footerY,{align:'right'});if(bandData)doc.addImage(bandData,'PNG',0,10.67,8.5,.33,undefined,'FAST');}
  function newPage(){addFooter();doc.addPage('letter','portrait');page++;y=1.28;addHeader(false);}
  function ensure(h){if(y+h>10.22)newPage();}
  function drawSectionHeading(title,number=null){ensure(.36);doc.setFillColor(...lightGray);doc.rect(left,y,contentW,.27,'F');doc.setFillColor(...orange);doc.rect(left,y,.045,.27,'F');doc.setTextColor(...charcoal);doc.setFont('helvetica','bold');doc.setFontSize(8.4);doc.text(number?`DIVISION ${number}  ·  ${title.toUpperCase()}`:title.toUpperCase(),left+.12,y+.18);y+=.36;}
  function drawLines(textValue){const lines=parseScopeLines(textValue);doc.setFont('helvetica','normal');doc.setTextColor(...text);doc.setFontSize(8.1);for(const item of lines){const prefixX=left+.08,textX=left+.22,wrapped=doc.splitTextToSize(item.text,contentW-.28),lineH=.155,h=wrapped.length*lineH+.045;ensure(h);if(item.bullet){doc.setFillColor(...orange);doc.circle(prefixX,y+.055,.018,'F');}doc.text(wrapped,item.bullet?textX:left+.08,y+.07,{baseline:'top'});y+=h;}y+=.05;}
  function drawParagraph(value,fontSize=7.4,lineH=.145){const wrapped=doc.splitTextToSize(value,contentW-.16);ensure(wrapped.length*lineH+.08);doc.setFont('helvetica','normal');doc.setFontSize(fontSize);doc.setTextColor(...text);doc.text(wrapped,left+.08,y);y+=wrapped.length*lineH+.08;}
  function drawSelections(){if(!p.sectionEnabled.clientSelections||!p.priceItems.length)return;drawSectionHeading('Client Selections');doc.setFontSize(6.6);doc.setFont('helvetica','normal');doc.setTextColor(...muted);doc.text('Mark the box for each item you would like included in the contract request.',left+.08,y);y+=.18;for(const item of p.priceItems){if(!item.name.trim()&&!item.price.trim())continue;const desc=item.description.trim();const nameLines=doc.splitTextToSize(item.name.trim()||'Selection item',4.45),descLines=desc?doc.splitTextToSize(desc,4.45):[];const h=Math.max(.34,(nameLines.length+descLines.length)*.13+.14);ensure(h);doc.setDrawColor(105,108,112);doc.setLineWidth(.012);doc.rect(left+.08,y+.03,.16,.16);doc.setFont('helvetica','bold');doc.setFontSize(7.6);doc.setTextColor(...text);doc.text(nameLines,left+.34,y+.04,{baseline:'top'});let ty=y+.04+nameLines.length*.13;if(descLines.length){doc.setFont('helvetica','normal');doc.setFontSize(6.7);doc.setTextColor(...muted);doc.text(descLines,left+.34,ty,{baseline:'top'});}doc.setFont('helvetica','bold');doc.setFontSize(7.8);doc.setTextColor(...charcoal);doc.text(currencyText(item.price),pageW-right-.04,y+.08,{align:'right'});doc.setDrawColor(225,226,228);doc.line(left+.34,y+h-.05,pageW-right,y+h-.05);y+=h;}y+=.08;}
  function drawFinalApproval(){const disclaimer=getDisclaimer(p.disclaimerId);if(disclaimer){drawSectionHeading(`Legal Disclaimer · ${disclaimer.name}`);drawParagraph(disclaimer.text,6.7,.132);y+=.06;}const ackWrap=doc.splitTextToSize(ACKNOWLEDGMENT_TEXT,contentW-.16);const needed=.36+ackWrap.length*.135+.86;if(y+needed>10.18)newPage();drawSectionHeading('Request to Proceed to Contract');doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(...text);doc.text(ackWrap,left+.08,y);y+=ackWrap.length*.135+.34;const sigY=y+.26;doc.setDrawColor(105,108,112);doc.setLineWidth(.012);doc.line(left,sigY,left+2.25,sigY);doc.line(left+2.5,sigY,left+5.05,sigY);doc.line(left+5.3,sigY,pageW-right,sigY);doc.setFont('helvetica','normal');doc.setFontSize(6);doc.setTextColor(...muted);doc.text('CLIENT / AUTHORIZED REPRESENTATIVE',left,sigY+.12);doc.text('SIGNATURE',left+2.5,sigY+.12);doc.text('DATE',left+5.3,sigY+.12);y=sigY+.28;}

  addHeader(true);y=1.83;
  if(p.projectAddress.trim()||p.attention.trim()||p.revision.trim()){doc.setFont('helvetica','normal');doc.setFontSize(7.2);doc.setTextColor(...muted);let meta=[];if(p.attention.trim())meta.push(`ATTN: ${p.attention.trim()}`);if(p.projectAddress.trim())meta.push(p.projectAddress.trim().replace(/\n/g,', '));if(p.revision.trim())meta.push(`REVISION: ${p.revision.trim()}`);doc.text(meta.join('   •   '),left,y,{maxWidth:contentW});y+=.22;}
  if(p.introNote.trim()){const wrapped=doc.splitTextToSize(p.introNote.trim(),contentW);ensure(wrapped.length*.16+.15);doc.setFont('helvetica','normal');doc.setFontSize(8.2);doc.setTextColor(...text);doc.text(wrapped,left,y);y+=wrapped.length*.16+.18;}
  const active=CSI_DIVISIONS.map(([n])=>p.divisions[n]).filter(d=>d?.enabled&&d.text.trim());active.forEach(d=>{drawSectionHeading(d.title,d.number);drawLines(d.text);});
  const extras=[["Clarifications",p.clarifications,p.sectionEnabled?.clarifications],["Exclusions",p.exclusions,p.sectionEnabled?.exclusions],["Alternates",p.alternates,p.sectionEnabled?.alternates]].filter(([,txt,on])=>on&&txt.trim());extras.forEach(([title,txt])=>{drawSectionHeading(title);drawLines(txt);});
  drawSelections();drawFinalApproval();
  if(!active.length&&!extras.length&&!p.introNote.trim()&&!p.priceItems.length){doc.setFont('helvetica','italic');doc.setTextColor(...muted);doc.setFontSize(9);doc.text('No scope content has been entered yet.',left,y);}
  addFooter();const safe=(p.projectName||'Scope').replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'');doc.save(`${safe||'Scope'}_${(p.documentTitle||'Scope_of_Work').replace(/[^a-z0-9]+/gi,'_')}.pdf`);setSaveStatus("All changes saved");toast("PDF exported.");
}

function deleteCurrentProject(){const p=getCurrentProject();if(!p)return;if(!confirm(`Delete “${p.projectName}”? This cannot be undone in this prototype.`))return;saveProjects(getProjects().filter(x=>x.id!==p.id));enterDashboard();toast("Project deleted.");}

// Admin disclaimer library
function openAdminDialog(){if(!isAdmin())return toast("Admin access required.");if(state.currentProjectId)saveEditorProject();renderAdminDisclaimers();renderAdminUsers();$("#adminDialog").showModal();}
function closeAdminDialog(){$("#adminDialog").close();}
function activateAdminTab(name){$$('.admin-tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===name));$$('.admin-tab-panel').forEach(p=>p.classList.remove('active'));$(`#admin${name[0].toUpperCase()+name.slice(1)}Tab`).classList.add('active');}
function renderAdminDisclaimers(){const items=getDisclaimers(),list=$("#disclaimerList");list.innerHTML="";if(!state.adminDisclaimerId||!items.some(d=>d.id===state.adminDisclaimerId))state.adminDisclaimerId=items[0]?.id||null;items.forEach(d=>{const b=document.createElement('button');b.type='button';b.className=`disclaimer-list-item ${d.id===state.adminDisclaimerId?'active':''}`;b.dataset.disclaimerAdminId=d.id;b.innerHTML=`<strong>${esc(d.name)}</strong><span>${esc(d.text)}</span>`;list.appendChild(b);});$$('[data-disclaimer-admin-id]').forEach(b=>b.addEventListener('click',()=>{state.adminDisclaimerId=b.dataset.disclaimerAdminId;renderAdminDisclaimers();}));const d=items.find(x=>x.id===state.adminDisclaimerId);$("#disclaimerEditId").value=d?.id||"";$("#disclaimerEditName").value=d?.name||"";$("#disclaimerEditText").value=d?.text||"";$("#deleteDisclaimerBtn").disabled=items.length<=1||!d;}
function newDisclaimer(){state.adminDisclaimerId=null;$("#disclaimerEditId").value="";$("#disclaimerEditName").value="";$("#disclaimerEditText").value="";$$('.disclaimer-list-item').forEach(x=>x.classList.remove('active'));$("#deleteDisclaimerBtn").disabled=true;$("#disclaimerEditName").focus();}
function saveDisclaimerFromAdmin(){if(!isAdmin())return;const name=$("#disclaimerEditName").value.trim(),textValue=$("#disclaimerEditText").value.trim();if(!name||!textValue)return toast("Enter both a disclaimer name and disclaimer text.");let items=getDisclaimers(),id=$("#disclaimerEditId").value||uid(),idx=items.findIndex(d=>d.id===id);const item={id,name,text:textValue};if(idx>=0)items[idx]=item;else items.push(item);saveDisclaimers(items);state.adminDisclaimerId=id;renderAdminDisclaimers();refreshProjectDisclaimerAfterAdmin();toast("Disclaimer saved.");}
function deleteDisclaimerFromAdmin(){if(!isAdmin())return;let items=getDisclaimers();if(items.length<=1)return toast("Keep at least one disclaimer in the library.");const id=$("#disclaimerEditId").value;if(!id)return;const d=items.find(x=>x.id===id);if(!confirm(`Delete disclaimer “${d?.name||'this disclaimer'}”?`))return;items=items.filter(x=>x.id!==id);saveDisclaimers(items);state.adminDisclaimerId=items[0]?.id||null;renderAdminDisclaimers();refreshProjectDisclaimerAfterAdmin();toast("Disclaimer deleted.");}
function refreshProjectDisclaimerAfterAdmin(){if(!state.currentProjectId)return;const p=getCurrentProject();if(!p)return;const all=getDisclaimers();if(!all.some(d=>d.id===p.disclaimerId))p.disclaimerId=all[0]?.id||"";putProject(p);renderDisclaimerSelect(p);$("#projectDisclaimerSelect").value=p.disclaimerId;updateSelectedDisclaimerPreview();updatePreview();}
function renderAdminUsers(){const wrap=$("#adminUsersList");wrap.innerHTML="";getAllUsers().forEach(u=>{u=normalizeUser(u);const row=document.createElement('div');row.className='admin-user-row';row.innerHTML=`<div><strong>${esc(u.username)}${u.username.toLowerCase()===state.user.username.toLowerCase()?' · You':''}</strong><span>Created ${esc(fmtTime(u.createdAt))}</span></div><select class="admin-role-select" data-role-user="${esc(u.username)}"><option value="employee" ${u.role==='employee'?'selected':''}>Employee</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select>`;wrap.appendChild(row);});$$('.admin-role-select').forEach(sel=>sel.addEventListener('change',()=>changeUserRole(sel.dataset.roleUser,sel.value,sel)));}
function changeUserRole(username,role,selectEl){if(!isAdmin())return;const stored=getUserRecord(username);if(!stored)return;const record=normalizeUser(stored);const admins=getAllUsers().filter(u=>normalizeUser(u).role==='admin');if(record.role==='admin'&&role==='employee'&&admins.length<=1){selectEl.value='admin';return toast("At least one Admin account is required.");}record.role=role;saveUserRecord(record);if(username.toLowerCase()===state.user.username.toLowerCase()){state.user=record;refreshRoleUi();if(!isAdmin()){closeAdminDialog();toast("Your role is now Employee.");return;}}renderAdminUsers();toast(`${username} is now ${role === 'admin' ? 'an Admin' : 'an Employee'}.`);}

// Portable data backup / restore for moving between prototype builds
function buildBackupPayload() {
  if (state.currentProjectId) saveEditorProject();
  const data = readDataStore();
  let backupData;
  if (isAdmin()) {
    backupData = JSON.parse(JSON.stringify(data));
  } else if (state.user) {
    const key = state.user.username.toLowerCase();
    backupData = blankDataStore();
    backupData.users = { [key]: data.users[key] };
    backupData.projects = { [key]: data.projects[key] || [] };
    backupData.disclaimers = data.disclaimers;
  } else {
    backupData = JSON.parse(JSON.stringify(data));
  }
  return {
    type: "Koehn Scope Builder Backup",
    backupVersion: BACKUP_VERSION,
    exportedAt: nowIso(),
    scope: isAdmin() ? "full-workspace" : "user-workspace",
    data: backupData
  };
}
function downloadDataBackup() {
  const payload = buildBackupPayload();
  const stamp = new Date().toISOString().slice(0,10);
  const suffix = isAdmin() ? "FULL" : (state.user?.username || "USER").replace(/[^a-z0-9_-]+/gi,"_");
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Koehn_Scope_Builder_Backup_${suffix}_${stamp}.ksb`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  $("#userMenuPopover")?.classList.add("hidden");
  toast("Scope Builder backup downloaded.");
}
function triggerRestoreBackup() {
  if (state.currentProjectId) saveEditorProject();
  $("#userMenuPopover")?.classList.add("hidden");
  const input=$("#backupFileInput");
  input.value="";
  input.click();
}
function mergeProjectArrays(existing=[], incoming=[]) {
  const byId = new Map();
  [...existing, ...incoming].forEach(p=>{
    if (!p?.id) return;
    const prior = byId.get(p.id);
    if (!prior) { byId.set(p.id,p); return; }
    const priorTime = new Date(prior.updatedAt || prior.createdAt || 0).getTime();
    const nextTime = new Date(p.updatedAt || p.createdAt || 0).getTime();
    if (nextTime >= priorTime) byId.set(p.id,p);
  });
  return [...byId.values()].sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0));
}
function mergeDisclaimers(existing=[], incoming=[]) {
  const result = existing.map(x=>({...x}));
  incoming.forEach(d=>{
    if (!d?.id || !d?.name || !d?.text) return;
    const idx=result.findIndex(x=>x.id===d.id);
    if (idx<0) { result.push({...d}); return; }
    if (result[idx].name===d.name && result[idx].text===d.text) return;
    // Preserve both when the same ID has different wording so a restore never silently destroys an approved disclaimer.
    result.push({...d,id:`${d.id}-restored-${Date.now()}-${Math.random().toString(16).slice(2,6)}`,name:`${d.name} (Restored)`});
  });
  return result.length ? result : DEFAULT_DISCLAIMERS.map(x=>({...x}));
}
async function restoreDataBackup(file) {
  if (!file) return;
  try {
    const text=await file.text();
    const payload=JSON.parse(text);
    if (payload?.type!=="Koehn Scope Builder Backup" || !payload?.data) throw new Error("Not a Koehn Scope Builder backup file.");
    const incoming=payload.data;
    if (!incoming.users || !incoming.projects) throw new Error("Backup data is incomplete.");
    const current=readDataStore();
    const currentUserCount=Object.keys(current.users||{}).length;
    const currentProjectCount=Object.values(current.projects||{}).reduce((n,arr)=>n+(Array.isArray(arr)?arr.length:0),0);
    const freshWorkspace=currentUserCount===0 && currentProjectCount===0;
    let merged;
    if (freshWorkspace) {
      merged={
        schemaVersion:1, updatedAt:nowIso(),
        users:{...(incoming.users||{})},
        projects:{...(incoming.projects||{})},
        disclaimers:Array.isArray(incoming.disclaimers)&&incoming.disclaimers.length?incoming.disclaimers:DEFAULT_DISCLAIMERS.map(x=>({...x}))
      };
    } else {
      merged=JSON.parse(JSON.stringify(current));
      Object.entries(incoming.users||{}).forEach(([key,u])=>{ if (!merged.users[key]) merged.users[key]=u; });
      Object.entries(incoming.projects||{}).forEach(([key,projects])=>{ merged.projects[key]=mergeProjectArrays(merged.projects[key]||[],Array.isArray(projects)?projects:[]); });
      merged.disclaimers=mergeDisclaimers(merged.disclaimers||[],incoming.disclaimers||[]);
    }
    const users=Object.values(merged.users||{}).filter(Boolean);
    if (users.length && !users.some(u=>u.role==="admin")) {
      users[0].role="admin";
      merged.users[users[0].username.toLowerCase()]=users[0];
    }
    writeDataStore(merged);
    const importedCount=Object.values(incoming.projects||{}).reduce((n,arr)=>n+(Array.isArray(arr)?arr.length:0),0);
    if (state.user) {
      const refreshed=getUserRecord(state.user.username);
      if (refreshed) state.user=normalizeUser(refreshed);
      refreshRoleUi();
      enterDashboard();
    } else {
      const firstUser=Object.values(incoming.users||{})[0];
      if (firstUser?.username) $("#authUsername").value=firstUser.username;
      showAuth();
    }
    toast(`Backup restored · ${importedCount} project${importedCount===1?"":"s"} imported.`);
  } catch (err) {
    console.error(err);
    alert(`Could not restore this backup. ${err.message || "The file may be invalid."}`);
  } finally {
    $("#backupFileInput").value="";
  }
}
async function requestPersistentBrowserStorage() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {}
}

// Event wiring
$("#authForm").addEventListener("submit",handleAuthSubmit);
$("#toggleAuthMode").addEventListener("click",()=>{state.authMode=state.authMode==='login'?'register':'login';updateAuthMode();});
$("#restoreBackupAuthBtn").addEventListener("click",triggerRestoreBackup);
$("#downloadBackupBtn").addEventListener("click",downloadDataBackup);
$("#restoreBackupBtn").addEventListener("click",triggerRestoreBackup);
$("#backupFileInput").addEventListener("change",e=>restoreDataBackup(e.target.files?.[0]));
$("#logoutBtn").addEventListener("click",()=>{localStorage.removeItem(sessionKey());state.user=null;$("#userMenuPopover").classList.add('hidden');showAuth();});
$("#userMenuBtn").addEventListener("click",()=>$("#userMenuPopover").classList.toggle('hidden'));
$("#adminPanelBtn").addEventListener("click",openAdminDialog);$("#adminPopoverBtn").addEventListener("click",()=>{$("#userMenuPopover").classList.add('hidden');openAdminDialog();});
$("#closeAdminDialog").addEventListener("click",closeAdminDialog);$("#newDisclaimerBtn").addEventListener("click",newDisclaimer);$("#saveDisclaimerBtn").addEventListener("click",saveDisclaimerFromAdmin);$("#deleteDisclaimerBtn").addEventListener("click",deleteDisclaimerFromAdmin);$$('.admin-tab-btn').forEach(b=>b.addEventListener('click',()=>activateAdminTab(b.dataset.adminTab)));
$("#adminDownloadBackupBtn").addEventListener("click",downloadDataBackup);$("#adminRestoreBackupBtn").addEventListener("click",triggerRestoreBackup);
$("#newProjectBtn").addEventListener("click",openNewProjectDialog);$("#emptyNewProjectBtn").addEventListener("click",openNewProjectDialog);$("#newProjectForm").addEventListener("submit",handleNewProject);$("#projectSearch").addEventListener("input",renderProjects);$("#projectSort").addEventListener("change",renderProjects);
$("#backToDashboard").addEventListener("click",()=>{saveEditorProject();enterDashboard();});$("#sidebarBack").addEventListener("click",()=>{saveEditorProject();enterDashboard();});$("#exportPdfBtn").addEventListener("click",exportPdf);$("#deleteProjectBtn").addEventListener("click",deleteCurrentProject);
$("#divisionSearch").addEventListener("input",filterDivisionNav);$("#expandAllBtn").addEventListener("click",()=>$$('.division-card').forEach(c=>c.classList.add('open')));$("#collapseAllBtn").addEventListener("click",()=>$$('.division-card').forEach(c=>c.classList.remove('open')));
$("#previewToggle").addEventListener("click",()=>togglePreview());$("#closePreviewBtn").addEventListener("click",()=>togglePreview(false));$$('.tab-btn').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
$("#projectTitleInline").addEventListener("input",()=>{scheduleSave();updatePreview();});$("#addPriceItemBtn").addEventListener("click",addPriceItem);
$("#priceItems").addEventListener("click",e=>{const b=e.target.closest('.remove-price-item');if(!b)return;const row=b.closest('.price-item-row');row.remove();$("#emptyPriceItems").classList.toggle("hidden",$$('.price-item-row').length>0);scheduleSave();updatePreview();});
$("#projectDisclaimerSelect").addEventListener("change",()=>{updateSelectedDisclaimerPreview();scheduleSave();updatePreview();});
document.addEventListener("input",e=>{if(e.target.matches('[data-field],[data-company],.price-item-input')){scheduleSave();updatePreview();}});
document.addEventListener("change",e=>{if(e.target.matches('[data-section-enabled],[data-company]')){scheduleSave();updatePreview();}});
window.addEventListener('beforeunload',()=>{if(state.currentProjectId)saveEditorProject();});

updateAuthMode();readDataStore();restoreSession();
