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
  phone: "620.378.3002", fax: "620.378.2283", email: "", website: "koehncs.com",
  orange: "#f36f21", charcoal: "#55575a"
};

const DEFAULT_OFFICES = {
  fredonia: { id:"fredonia", name:"Fredonia", address:"PO Box 420\n1111 N 2nd\nFredonia, Kansas 66736", phone:"620.378.3002" },
  tulsa: { id:"tulsa", name:"Tulsa", address:"", phone:"" }
};
function normalizeOfficeSettings(raw={}) {
  const result={};
  Object.entries(DEFAULT_OFFICES).forEach(([key,def])=>{
    result[key]={...def,...(raw?.[key]||{}),id:key,name:def.name};
  });
  return result;
}

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

const state = { user: null, currentProjectId: null, currentProjectOwner: null, currentKickoffProjectId: null, currentKickoffOwner: null, authMode: "login", saveTimer: null, previewOpen: true, previewRenderTimer: null, previewRenderToken: 0, adminDisclaimerId: null, dashboardMode: "active", adminUserFilter: "all" };
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function nowIso() { return new Date().toISOString(); }
function fmtDate(iso) { if (!iso) return "—"; const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : "")); return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}); }
function fmtTime(iso) { if (!iso) return ""; return new Date(iso).toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}); }
function esc(s="") { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function plainTextToRichHtml(text="") {
  const value=String(text||"").replace(/\r/g,"");
  if(!value)return "";
  return value.split("\n").map(line=>`<div>${esc(line)||"<br>"}</div>`).join("");
}
function sanitizeScopeHtml(html="") {
  const source=document.createElement("div"); source.innerHTML=String(html||"");
  const out=document.createElement("div");
  const copy=(node,parent)=>{
    if(node.nodeType===Node.TEXT_NODE){ parent.appendChild(document.createTextNode(node.nodeValue||"")); return; }
    if(node.nodeType!==Node.ELEMENT_NODE)return;
    const tag=node.tagName.toLowerCase();
    if(tag==="br"){ parent.appendChild(document.createElement("br")); return; }
    if(tag==="div"||tag==="p"){
      const block=document.createElement("div"); [...node.childNodes].forEach(ch=>copy(ch,block)); parent.appendChild(block); return;
    }
    let target=parent;
    const wrappers=[];
    if(tag==="b"||tag==="strong")wrappers.push("b");
    if(tag==="i"||tag==="em")wrappers.push("i");
    if(tag==="u")wrappers.push("u");
    if(tag==="span"){
      const st=(node.getAttribute("style")||"").toLowerCase();
      if(/font-weight\s*:\s*(bold|[6-9]00)/.test(st))wrappers.push("b");
      if(/font-style\s*:\s*italic/.test(st))wrappers.push("i");
      if(/text-decoration[^;]*underline/.test(st))wrappers.push("u");
    }
    wrappers.forEach(w=>{const el=document.createElement(w);target.appendChild(el);target=el;});
    [...node.childNodes].forEach(ch=>copy(ch,target));
  };
  [...source.childNodes].forEach(n=>copy(n,out));
  return out.innerHTML;
}
function richEditorPlainText(el){
  if(!el)return "";
  return String(el.innerText||"").replace(/\r/g,"").replace(/\n+$/g,"");
}
function normalizedDivisionRichHtml(d){
  const rich=String(d?.richText||"").trim();
  return sanitizeScopeHtml(rich||plainTextToRichHtml(d?.text||""));
}
function currencyText(v="") { return String(v).trim(); }
function moneyNumber(v="") {
  const raw=String(v??"").trim(); if(!raw)return 0;
  const neg=/^\(.*\)$/.test(raw);
  const n=parseFloat(raw.replace(/[^0-9.-]/g,""));
  return Number.isFinite(n)?(neg?-Math.abs(n):n):0;
}
function formatMoneyNumber(n){ return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(n)||0); }

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

const STORAGE_KEY = "koehncs.scopeBuilder.data.v1";
const SESSION_KEY = "koehncs.scopeBuilder.session";
const BACKUP_VERSION = 1;

function blankDataStore() {
  return { schemaVersion: 1, updatedAt: nowIso(), users: {}, projects: {}, disclaimers: DEFAULT_DISCLAIMERS.map(x=>({...x})), officeSettings: normalizeOfficeSettings() };
}
function readDataStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      data.users = data.users || {};
      data.projects = data.projects || {};
      data.disclaimers = Array.isArray(data.disclaimers) && data.disclaimers.length ? data.disclaimers : DEFAULT_DISCLAIMERS.map(x=>({...x}));
      data.officeSettings = normalizeOfficeSettings(data.officeSettings);
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
function getOfficeSettings() { return normalizeOfficeSettings(readDataStore().officeSettings); }
function saveOfficeSettings(settings) { const data=readDataStore(); data.officeSettings=normalizeOfficeSettings(settings); writeDataStore(data); }
function getOfficeContact(key="fredonia") { const offices=getOfficeSettings(); return {...(offices[key]||offices.fredonia)}; }

function normalizeProject(p, ownerUsername="") {
  // Backward-compatible project normalization. Existing projects become the
  // original/base version of a revision family automatically.
  if (!p.documentTitle || p.documentTitle.trim().toLowerCase() === "scope of work") p.documentTitle = "Proposal";
  if (!p.familyId) p.familyId = p.id;
  if (!Number.isInteger(p.version)) p.version = 0;
  p.parentRevisionId = p.parentRevisionId || null;
  p.archived = Boolean(p.archived);
  p.locked = Boolean(p.locked);
  p.deletedByUser = Boolean(p.deletedByUser);
  p.deletedAt = p.deletedAt || null;
  p.deletedBy = p.deletedBy || null;
  p.deletedScope = p.deletedScope || null;
  p.accepted = Boolean(p.accepted);
  p.acceptedAt = p.acceptedAt || null;
  p.ownerUsername = p.ownerUsername || ownerUsername || "";
  p.divisions = p.divisions || Object.fromEntries(CSI_DIVISIONS.map(([n,t]) => [n,{number:n,title:t,enabled:false,text:""}]));
  CSI_DIVISIONS.forEach(([n,t]) => {
    if (!p.divisions[n]) p.divisions[n] = {number:n,title:t,enabled:false,text:"",richText:""};
    if (!String(p.divisions[n].title||"").trim()) p.divisions[n].title=t;
    p.divisions[n].number=n;
    if(!Object.prototype.hasOwnProperty.call(p.divisions[n],"richText") || !String(p.divisions[n].richText||"").trim()){
      p.divisions[n].richText=plainTextToRichHtml(p.divisions[n].text||"");
    }else{
      p.divisions[n].richText=sanitizeScopeHtml(p.divisions[n].richText);
    }
  });
  p.company = {...DEFAULT_COMPANY, ...(p.company||{})};
  if(!["standard","civil","concrete"].includes(p.proposalType)) p.proposalType="standard";
  if(!["fredonia","tulsa"].includes(p.estimatingOffice)) p.estimatingOffice="fredonia";
  const officeDefaults=getOfficeContact(p.estimatingOffice);
  p.officeContact={...officeDefaults,...(p.officeContact||{}),id:p.estimatingOffice,name:officeDefaults.name};
  p.sectionEnabled = { clarifications:true, exclusions:true, alternates:true, clientSelections:true, ...(p.sectionEnabled||{}) };
  ["clarifications","exclusions","alternates"].forEach(field=>{
    const richKey=`${field}RichText`;
    if(!Object.prototype.hasOwnProperty.call(p,richKey) || !String(p[richKey]||"").trim()) p[richKey]=plainTextToRichHtml(p[field]||"");
    else p[richKey]=sanitizeScopeHtml(p[richKey]);
  });
  p.priceItems = Array.isArray(p.priceItems) ? p.priceItems.map(i=>({...i})) : [];
  let baseBid=p.priceItems.find(i=>i?.isBaseBid || String(i?.name||"").trim().toLowerCase()==="base bid");
  if(!baseBid){ baseBid={id:`base-bid-${p.familyId||p.id||uid()}`,name:"Base Bid",description:"",price:"",isBaseBid:true}; p.priceItems.unshift(baseBid); }
  baseBid.isBaseBid=true; baseBid.name="Base Bid";
  p.priceItems=[baseBid,...p.priceItems.filter(i=>i!==baseBid).map(i=>({...i,isBaseBid:false}))];
  p.summary = p.summary || {};
  if(!["none","basic","advanced"].includes(p.summary.mode)) p.summary.mode="none";
  p.summary.basicNote = p.summary.basicNote || "";
  p.summary.basicDivisions = p.summary.basicDivisions || {};
  CSI_DIVISIONS.forEach(([n,t])=>{
    const existing=p.summary.basicDivisions[n]||{};
    const fallbackLabel=`${n} - ${p.divisions[n]?.title||t}`;
    p.summary.basicDivisions[n]={
      label:Object.prototype.hasOwnProperty.call(existing,"label")?existing.label:fallbackLabel,
      amount:Object.prototype.hasOwnProperty.call(existing,"amount")?existing.amount:(p.summary.divisionCosts?.[n]?.amount||"")
    };
  });
  p.summary.basicOverhead={enabled:false,label:"Overhead",amount:"",...(p.summary.basicOverhead||{})};
  p.summary.divisionCosts = p.summary.divisionCosts || {};
  CSI_DIVISIONS.forEach(([n])=>{
    const saved=p.summary.divisionCosts[n]||{};
    p.summary.divisionCosts[n]={
      amount:saved.amount||"",
      hidden:Boolean(saved.hidden),
      subRows:Array.isArray(saved.subRows)?saved.subRows.map(r=>({id:r.id||uid(),label:r.label||"",amount:r.amount||""})):[]
    };
  });
  p.summary.extraRows = Array.isArray(p.summary.extraRows) ? p.summary.extraRows.map(r=>({id:r.id||uid(),label:r.label||"",amount:r.amount||"",type:r.type==="subtotal"?"subtotal":"cost"})) : [];
  p.summary.customDivisions = Array.isArray(p.summary.customDivisions) ? p.summary.customDivisions.map(r=>({id:r.id||uid(),label:r.label||"",amount:r.amount||"",afterDivision:String(r.afterDivision||"__start__")})) : [];
  p.disclaimerId = p.disclaimerId || getDisclaimers()[0]?.id || "";
  return p;
}
function ownerKey(username) { return String(username || "").toLowerCase(); }
function getProjectsForUser(username, {includeDeleted=true}={}) {
  if (!username) return [];
  const key=ownerKey(username), data=readDataStore();
  const projects=(data.projects[key] || []).map(p=>normalizeProject(p, username));
  return includeDeleted ? projects : projects.filter(p=>!p.deletedByUser);
}
function saveProjectsForUser(username, projects) {
  if (!username) return;
  const key=ownerKey(username), data=readDataStore();
  data.projects[key] = projects.map(p=>normalizeProject(p, username));
  writeDataStore(data);
}
function getProjects() {
  if (!state.user) return [];
  return getProjectsForUser(state.user.username, {includeDeleted:false});
}
function saveProjects(projects) {
  if (!state.user) return;
  saveProjectsForUser(state.user.username, projects);
}
function getCurrentProject() {
  if (!state.currentProjectId) return null;
  const owner=state.currentProjectOwner || state.user?.username;
  return getProjectsForUser(owner, {includeDeleted:true}).find(p=>p.id===state.currentProjectId) || null;
}
function putProject(project, ownerUsername=state.currentProjectOwner || state.user?.username) {
  if (!project || !ownerUsername) return;
  project = normalizeProject(project, ownerUsername);
  project.ownerUsername = ownerUsername;
  const projects = getProjectsForUser(ownerUsername, {includeDeleted:true});
  const idx = projects.findIndex(p=>p.id===project.id);
  project.updatedAt = nowIso();
  if (idx >= 0) projects[idx] = project; else projects.unshift(project);
  saveProjectsForUser(ownerUsername, projects);
}
function versionLabel(p) { return Number(p?.version||0) > 0 ? `V${p.version}` : "Original"; }
function familyProjects(ownerUsername, familyId, {includeDeleted=true}={}) {
  return getProjectsForUser(ownerUsername,{includeDeleted}).filter(p=>p.familyId===familyId).sort((a,b)=>(a.version||0)-(b.version||0));
}
function latestFamilyProject(ownerUsername, familyId, {includeDeleted=false}={}) {
  const versions=familyProjects(ownerUsername,familyId,{includeDeleted});
  return versions.sort((a,b)=>(b.version||0)-(a.version||0))[0] || null;
}
function projectFamilies(projects) {
  const map=new Map();
  projects.forEach(p=>{ const id=p.familyId||p.id; if(!map.has(id))map.set(id,[]); map.get(id).push(p); });
  return [...map.entries()].map(([familyId,versions])=>({
    familyId,
    versions:versions.sort((a,b)=>(a.version||0)-(b.version||0)),
    latest:[...versions].sort((a,b)=>(b.version||0)-(a.version||0))[0]
  }));
}

function makeProject(name="Untitled Project", client="", projectNumber="", estimatingOffice="fredonia", proposalType="standard") {
  const date = new Date();
  const dateValue = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const divisions = Object.fromEntries(CSI_DIVISIONS.map(([n,t]) => [n,{number:n,title:t,enabled:false,text:""}]));
  const id=uid();
  const officeContact=getOfficeContact(estimatingOffice);
  return normalizeProject({
    id, familyId:id, version:0, parentRevisionId:null, archived:false, locked:false, deletedByUser:false, accepted:false, acceptedAt:null, estimatingOffice, officeContact, proposalType,
    createdAt: nowIso(), updatedAt: nowIso(), projectName: name, projectNumber, clientName: client,
    attention: "", projectAddress: "", proposalDate: dateValue, preparedBy: "", documentTitle: "Proposal", introNote: "",
    clarifications: "", clarificationsRichText:"", exclusions: "", exclusionsRichText:"", alternates: "", alternatesRichText:"", priceItems: [{id:`base-bid-${id}`,name:"Base Bid",description:"",price:"",isBaseBid:true}], disclaimerId: getDisclaimers()[0]?.id || "",
    summary: {mode:"none",basicNote:"",basicDivisions:{},basicOverhead:{enabled:false,label:"Overhead",amount:""},divisionCosts:{},extraRows:[],customDivisions:[]},
    sectionEnabled: { clarifications:true, exclusions:true, alternates:true, clientSelections:true }, divisions, company: {...DEFAULT_COMPANY}
  }, state.user?.username || "");
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

  // Company information is controlled by Admin users. Employees still carry
  // the saved company data into previews/PDFs, but do not see or edit the tab.
  const companyTabButton = $('.tab-btn[data-tab="company"]');
  if (companyTabButton) companyTabButton.classList.toggle("hidden", !admin);
  const companyPanel = $("#companyTab");
  if (companyPanel) companyPanel.classList.toggle("role-hidden", !admin);
  $$(`[data-company],[data-office-setting]`).forEach(el => el.disabled = !admin);
  if (!admin && companyTabButton?.classList.contains("active")) activateTab("info");
}
function enterDashboard() {
  showApp(); requestPersistentBrowserStorage(); state.currentProjectId=null; state.currentProjectOwner=null; state.currentKickoffProjectId=null; state.currentKickoffOwner=null;
  $("#dashboardView").classList.remove("hidden"); $("#editorView").classList.add("hidden"); $("#kickoffView").classList.add("hidden");
  $("#backToDashboard").classList.add("hidden"); $("#exportPdfBtn").classList.add("hidden");
  refreshRoleUi(); refreshDashboardNav(); renderProjects();
}
function setDashboardMode(mode){
  if((mode==="admin"||mode==="deleted")&&!isAdmin())mode="active";
  state.dashboardMode=mode;
  $$('.project-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.projectView===mode));
  const title=mode==="archived"?"Archived Proposals":mode==="admin"?"All User Proposals":mode==="deleted"?"Deleted Items":"Active Proposals";
  $("#dashboardSectionTitle").textContent=title;
  $("#adminUserFilter").classList.toggle("hidden",!(mode==="admin"||mode==="deleted")||!isAdmin());
  renderProjects();
}
function refreshDashboardNav(){
  const own=getProjectsForUser(state.user.username,{includeDeleted:false});
  const families=projectFamilies(own);
  $("#activeProjectCount").textContent=families.filter(f=>!f.versions.every(v=>v.archived)).length;
  $("#archivedProjectCount").textContent=families.filter(f=>f.versions.every(v=>v.archived)).length;
  $("#adminAllProjectsBtn").classList.toggle("hidden",!isAdmin());
  $("#adminDeletedProjectsBtn").classList.toggle("hidden",!isAdmin());
  if(isAdmin()){
    const deletedCount=getAllUsers().reduce((n,u)=>n+getProjectsForUser(u.username,{includeDeleted:true}).filter(p=>p.deletedByUser).length,0);
    $("#adminDeletedProjectCount").textContent=deletedCount;
  }
  if(!isAdmin()&&(state.dashboardMode==="admin"||state.dashboardMode==="deleted"))state.dashboardMode="active";
  $$('.project-nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.projectView===state.dashboardMode));
  const title=state.dashboardMode==="archived"?"Archived Proposals":state.dashboardMode==="admin"?"All User Proposals":state.dashboardMode==="deleted"?"Deleted Items":"Active Proposals";
  $("#dashboardSectionTitle").textContent=title;
  $("#adminUserFilter").classList.toggle("hidden",!(state.dashboardMode==="admin"||state.dashboardMode==="deleted")||!isAdmin());
  if(isAdmin()){
    const sel=$("#adminUserFilter"), current=sel.value||state.adminUserFilter||"all";
    sel.innerHTML='<option value="all">All users</option>'+getAllUsers().map(u=>`<option value="${esc(u.username)}">${esc(u.username)}</option>`).join('');
    sel.value=[...sel.options].some(o=>o.value===current)?current:"all"; state.adminUserFilter=sel.value;
  }
}

function renderProjects() {
  const q=$("#projectSearch").value.trim().toLowerCase(), sort=$("#projectSort").value;
  let entries=[];
  if((state.dashboardMode==="admin"||state.dashboardMode==="deleted")&&isAdmin()){
    const filter=$("#adminUserFilter").value||"all"; state.adminUserFilter=filter;
    const users=filter==="all"?getAllUsers():getAllUsers().filter(u=>u.username===filter);
    users.forEach(u=>getProjectsForUser(u.username,{includeDeleted:true}).forEach(p=>entries.push({owner:u.username,p})));
    if(state.dashboardMode==="deleted")entries=entries.filter(({p})=>p.deletedByUser);
  }else{
    getProjectsForUser(state.user.username,{includeDeleted:false}).forEach(p=>entries.push({owner:state.user.username,p}));
  }
  entries=entries.filter(({p})=>[p.projectName,p.clientName,p.projectNumber].join(" ").toLowerCase().includes(q));
  const grouped=new Map();
  entries.forEach(({owner,p})=>{const key=`${ownerKey(owner)}::${p.familyId||p.id}`;if(!grouped.has(key))grouped.set(key,{owner,familyId:p.familyId||p.id,versions:[]});grouped.get(key).versions.push(p);});
  let families=[...grouped.values()].map(f=>{f.versions.sort((a,b)=>(a.version||0)-(b.version||0));f.latest=[...f.versions].sort((a,b)=>(b.version||0)-(a.version||0))[0];return f;});
  if(state.dashboardMode==="active")families=families.filter(f=>!f.versions.every(v=>v.archived));
  if(state.dashboardMode==="archived")families=families.filter(f=>f.versions.every(v=>v.archived));
  families.sort((a,b)=> sort==="name"?(a.latest.projectName||"").localeCompare(b.latest.projectName||""):sort==="client"?(a.latest.clientName||"").localeCompare(b.latest.clientName||""):new Date(b.latest.updatedAt)-new Date(a.latest.updatedAt));
  const grid=$("#projectsGrid"); grid.innerHTML="";
  const noProjects=!families.length;
  $("#emptyProjects").classList.toggle("hidden",!noProjects||q.length>0||state.dashboardMode==="admin"||state.dashboardMode==="deleted");
  if(noProjects){
    const msg=q?"No matching projects":state.dashboardMode==="archived"?"No archived proposals":state.dashboardMode==="admin"?"No user proposals found":state.dashboardMode==="deleted"?"Recycle bin is empty":"";
    if(msg)grid.innerHTML=`<div class="empty-state compact-empty" style="grid-column:1/-1"><h3>${msg}</h3><p>${q?'Try a different project, client, or project number.':state.dashboardMode==='archived'?'Archived project families will appear here.':state.dashboardMode==='deleted'?'Deleted projects and revisions are retained here for Admin recovery.':'User proposals will appear here as they are created.'}</p></div>`;
  }
  families.forEach(f=>{
    const p=f.latest, used=Object.values(p.divisions||{}).filter(d=>d.enabled&&d.text.trim()).length;
    const familyArchived=f.versions.every(v=>v.archived);
    const familyDeleted=f.versions.every(v=>v.deletedByUser);
    const visibleVersions=(state.dashboardMode==="admin"||state.dashboardMode==="deleted")?f.versions:f.versions.filter(v=>!v.deletedByUser);
    const status=[]; if(familyArchived)status.push('Archived'); if(p.locked)status.push('Locked'); if(f.versions.some(v=>v.accepted))status.push('Accepted'); if(familyDeleted)status.push(f.versions.every(v=>v.deletedScope==='project')?'Deleted project':'All versions deleted'); else if(f.versions.some(v=>v.deletedByUser))status.push('Deleted revision retained');
    if(p.deletedByUser){status.push(`Deleted by ${p.deletedBy||'Unknown'}`);status.push(`Deleted ${fmtTime(p.deletedAt)}`);}
    const card=document.createElement("article"); card.className=`project-card ${familyArchived?'archived-card':''} ${familyDeleted?'deleted-card':''}`;
    const adminRecovery=(state.dashboardMode==="deleted"&&isAdmin());
    card.innerHTML=`
      <div class="project-card-head">
        <div>
          <div class="project-card-kicker">${(state.dashboardMode==='admin'||state.dashboardMode==='deleted')?`<span class="owner-pill">${esc(f.owner)}</span>`:''}<span class="project-number">${esc(p.projectNumber||"No project number")}</span></div>
          <h3>${esc(p.projectName||"Untitled Project")}</h3>
          <div class="project-client">${esc(p.clientName||"No client entered")}</div>
        </div>
        <div class="project-card-actions">
          <button class="project-open" data-open-project="${p.id}" data-owner="${esc(f.owner)}">Open →</button>
          <button class="project-menu-btn" data-project-menu="${p.id}" data-owner="${esc(f.owner)}" aria-label="Project options">⋮</button>
          <div class="project-menu hidden" data-menu-panel="${p.id}">
            ${adminRecovery?`<button type="button" data-restore-family="${f.familyId}" data-owner="${esc(f.owner)}">Restore Project</button>`:`
              <button type="button" data-revise-project="${p.id}" data-owner="${esc(f.owner)}">Revise</button>
              <button type="button" data-kickoff-project="${p.id}" data-owner="${esc(f.owner)}">Kickoff</button>
              <button type="button" data-archive-family="${f.familyId}" data-owner="${esc(f.owner)}">${familyArchived?'Unarchive':'Archive'}</button>
              <button type="button" data-lock-project="${p.id}" data-owner="${esc(f.owner)}">${p.locked?'Unlock':'Lock'}</button>
              <button type="button" class="menu-danger" data-delete-family="${f.familyId}" data-owner="${esc(f.owner)}">Delete Project</button>`}
          </div>
        </div>
      </div>
      <div class="project-version-row">${visibleVersions.map(v=>`<span class="version-chip-wrap"><button class="version-chip ${v.id===p.id?'current':''} ${v.locked?'locked':''} ${v.deletedByUser?'removed':''}" data-open-project="${v.id}" data-owner="${esc(f.owner)}">${versionLabel(v)}${v.locked?' · Locked':''}${v.deletedByUser?' · Deleted':''}</button>${adminRecovery&&v.deletedByUser?`<button class="version-restore-btn" type="button" data-restore-version="${v.id}" data-owner="${esc(f.owner)}" title="Restore ${versionLabel(v)}">↺</button>`:''}</span>`).join('')}</div>
      ${status.length?`<div class="project-status-row">${status.map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:''}
      <div class="project-meta"><span>${used} divisions used · ${p.priceItems.filter(i=>i.isBaseBid?(i.price||'').trim():((i.name||'').trim()||(i.price||'').trim()||(i.description||'').trim())).length} pricing lines entered</span><span>Updated ${esc(fmtTime(p.updatedAt))}</span></div>`;
    grid.appendChild(card);
  });
  $$('[data-open-project]').forEach(b=>b.addEventListener('click',()=>openProject(b.dataset.openProject,b.dataset.owner)));
  $$('[data-project-menu]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const panel=$(`[data-menu-panel="${CSS.escape(b.dataset.projectMenu)}"]`);$$('.project-menu').forEach(x=>{if(x!==panel)x.classList.add('hidden')});panel?.classList.toggle('hidden');}));
  $$('[data-revise-project]').forEach(b=>b.addEventListener('click',()=>reviseProject(b.dataset.reviseProject,b.dataset.owner)));
  $$('[data-kickoff-project]').forEach(b=>b.addEventListener('click',()=>openKickoff(b.dataset.kickoffProject,b.dataset.owner)));
  $$('[data-archive-family]').forEach(b=>b.addEventListener('click',()=>toggleFamilyArchive(b.dataset.archiveFamily,b.dataset.owner)));
  $$('[data-lock-project]').forEach(b=>b.addEventListener('click',()=>toggleProjectLock(b.dataset.lockProject,b.dataset.owner)));
  $$('[data-delete-family]').forEach(b=>b.addEventListener('click',()=>softDeleteFamily(b.dataset.deleteFamily,b.dataset.owner)));
  $$('[data-restore-family]').forEach(b=>b.addEventListener('click',()=>restoreFamily(b.dataset.restoreFamily,b.dataset.owner)));
  $$('[data-restore-version]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();restoreVersion(b.dataset.restoreVersion,b.dataset.owner);}));
}
function openKickoff(projectId, ownerUsername){
  const owner=ownerUsername||state.user?.username;
  const projects=getProjectsForUser(owner,{includeDeleted:true});
  const source=projects.find(p=>p.id===projectId);
  if(!source)return toast("Project not found.");
  if(ownerKey(owner)!==ownerKey(state.user.username)&&!isAdmin())return toast("You can only create a kickoff for your own projects.");
  const familyId=source.familyId||source.id;
  const acceptedAt=source.acceptedAt||nowIso();
  const updated=projects.map(p=>p.familyId===familyId?{...p,accepted:true,acceptedAt:p.acceptedAt||acceptedAt,updatedAt:nowIso()}:p);
  saveProjectsForUser(owner,updated);
  state.currentProjectId=null; state.currentProjectOwner=null; state.currentKickoffProjectId=source.id; state.currentKickoffOwner=owner;
  const current=updated.find(p=>p.id===source.id)||source;
  $("#dashboardView").classList.add("hidden"); $("#editorView").classList.add("hidden"); $("#kickoffView").classList.remove("hidden");
  $("#backToDashboard").classList.add("hidden"); $("#exportPdfBtn").classList.add("hidden");
  $("#kickoffProjectName").textContent=current.projectName||"Untitled Project";
  $("#kickoffClientName").textContent=current.clientName||"No client entered";
  $("#kickoffProjectNumber").textContent=current.projectNumber||"No project number";
  $("#kickoffVersion").textContent=versionLabel(current);
  $("#kickoffAcceptedDate").textContent=fmtDate((current.acceptedAt||acceptedAt).slice(0,10));
  refreshDashboardNav();
  toast("Project marked Accepted. Kickoff opened.");
}

function reviseProject(projectId, ownerUsername){
  const source=getProjectsForUser(ownerUsername,{includeDeleted:true}).find(p=>p.id===projectId); if(!source)return;
  if(ownerKey(ownerUsername)!==ownerKey(state.user.username)&&!isAdmin())return toast("You can only revise your own proposals.");
  const family=familyProjects(ownerUsername,source.familyId,{includeDeleted:true});
  const sourceLatest=source;
  const nextVersion=Math.max(0,...family.map(v=>Number(v.version||0)))+1;
  const revised=JSON.parse(JSON.stringify(sourceLatest));
  revised.id=uid(); revised.familyId=sourceLatest.familyId||sourceLatest.id; revised.version=nextVersion; revised.parentRevisionId=sourceLatest.id;
  revised.createdAt=nowIso(); revised.updatedAt=nowIso(); revised.locked=false; revised.archived=false; revised.deletedByUser=false; revised.deletedAt=null; revised.deletedBy=null; revised.deletedScope=null;
  revised.ownerUsername=ownerUsername;
  // Creating a revision brings the family back to Active.
  const all=getProjectsForUser(ownerUsername,{includeDeleted:true}).map(p=>p.familyId===revised.familyId?{...p,archived:false}:p);
  all.unshift(revised); saveProjectsForUser(ownerUsername,all);
  refreshDashboardNav(); toast(`${versionLabel(revised)} created from ${versionLabel(sourceLatest)}.`); openProject(revised.id,ownerUsername);
}
function toggleFamilyArchive(familyId,ownerUsername){
  if(ownerKey(ownerUsername)!==ownerKey(state.user.username)&&!isAdmin())return;
  const all=getProjectsForUser(ownerUsername,{includeDeleted:true}); const family=all.filter(p=>p.familyId===familyId); if(!family.length)return;
  const archive=!family.every(p=>p.archived);
  const next=all.map(p=>p.familyId===familyId?{...p,archived:archive,updatedAt:nowIso()}:p); saveProjectsForUser(ownerUsername,next);
  refreshDashboardNav(); renderProjects(); toast(archive?"Proposal archived.":"Proposal restored to Active.");
}
function toggleProjectLock(projectId,ownerUsername){
  if(ownerKey(ownerUsername)!==ownerKey(state.user.username)&&!isAdmin())return;
  const all=getProjectsForUser(ownerUsername,{includeDeleted:true}); const idx=all.findIndex(p=>p.id===projectId); if(idx<0)return;
  all[idx].locked=!all[idx].locked; all[idx].updatedAt=nowIso(); saveProjectsForUser(ownerUsername,all);
  renderProjects(); toast(all[idx].locked?`${versionLabel(all[idx])} locked.`:`${versionLabel(all[idx])} unlocked.`);
}

function markDeleted(p,scope="version"){
  return {...p,deletedByUser:true,deletedAt:nowIso(),deletedBy:state.user?.username||"Unknown",deletedScope:scope,updatedAt:nowIso()};
}
function clearDeleted(p){
  return {...p,deletedByUser:false,deletedAt:null,deletedBy:null,deletedScope:null,updatedAt:nowIso()};
}
function softDeleteFamily(familyId,ownerUsername){
  if(ownerKey(ownerUsername)!==ownerKey(state.user?.username)&&!isAdmin())return toast("You can only delete your own projects.");
  const all=getProjectsForUser(ownerUsername,{includeDeleted:true}), family=all.filter(p=>p.familyId===familyId&&!p.deletedByUser);
  if(!family.length)return toast("This project is already deleted.");
  const name=family[0]?.projectName||"this project";
  if(!confirm(`Delete the entire project “${name}” and all of its revisions from the user workspace?

Nothing will be permanently erased. Admin will retain every version in Deleted Items.`))return;
  const next=all.map(p=>p.familyId===familyId?markDeleted(p,"project"):p); saveProjectsForUser(ownerUsername,next);
  refreshDashboardNav(); renderProjects(); toast("Project deleted from user workspace. Admin recovery copy retained.");
}
function softDeleteVersion(projectId,ownerUsername){
  if(ownerKey(ownerUsername)!==ownerKey(state.user?.username)&&!isAdmin())return toast("You can only delete your own proposal versions.");
  const all=getProjectsForUser(ownerUsername,{includeDeleted:true}), idx=all.findIndex(p=>p.id===projectId); if(idx<0)return;
  const p=all[idx]; if(p.deletedByUser)return toast("This version is already deleted.");
  if(!confirm(`Delete ${versionLabel(p)} of “${p.projectName}” from the user workspace?

Nothing will be permanently erased. Admin will retain this version in Deleted Items.`))return;
  all[idx]=markDeleted(p,"version"); saveProjectsForUser(ownerUsername,all); refreshDashboardNav();
  if(state.currentProjectId===projectId)enterDashboard(); else renderProjects();
  toast(`${versionLabel(p)} deleted. Admin recovery copy retained.`);
}
function restoreFamily(familyId,ownerUsername){
  if(!isAdmin())return toast("Admin access required.");
  const all=getProjectsForUser(ownerUsername,{includeDeleted:true}); let changed=false;
  const next=all.map(p=>{if(p.familyId===familyId&&p.deletedByUser){changed=true;return clearDeleted(p);}return p;});
  if(!changed)return toast("No deleted versions found for this project.");
  saveProjectsForUser(ownerUsername,next); refreshDashboardNav(); renderProjects(); toast("Project restored to the user workspace.");
}
function restoreVersion(projectId,ownerUsername){
  if(!isAdmin())return toast("Admin access required.");
  const all=getProjectsForUser(ownerUsername,{includeDeleted:true}), idx=all.findIndex(p=>p.id===projectId); if(idx<0)return;
  if(!all[idx].deletedByUser)return toast("This version is not deleted.");
  const label=versionLabel(all[idx]); all[idx]=clearDeleted(all[idx]); saveProjectsForUser(ownerUsername,all); refreshDashboardNav(); renderProjects(); toast(`${label} restored to the user workspace.`);
}
function openNewProjectDialog() {
  $("#newProjectName").value=""; $("#newClientName").value=""; $("#newProjectNumber").value=""; $("#newProjectOffice").value="fredonia"; $("#newProjectType").value="standard";
  const offices=getOfficeSettings();
  const tulsaConfigured=Boolean((offices.tulsa.address||"").trim()&&(offices.tulsa.phone||"").trim());
  const note=$("#newProjectOfficeNote"); if(note)note.textContent=tulsaConfigured?"Office contact information will be used on the proposal cover.":"Tulsa office contact information can be configured by an Admin under Company Info.";
  $("#newProjectDialog").showModal(); setTimeout(()=>$("#newProjectName").focus(),100);
}
function handleNewProject(e) {
  e.preventDefault(); if (e.submitter&&e.submitter.value==="cancel") { $("#newProjectDialog").close(); return; }
  const name=$("#newProjectName").value.trim(); if (!name) return;
  const p=makeProject(name,$("#newClientName").value.trim(),$("#newProjectNumber").value.trim(),$("#newProjectOffice").value||"fredonia",$("#newProjectType").value||"standard"); state.currentProjectOwner=state.user.username; putProject(p,state.user.username); $("#newProjectDialog").close(); openProject(p.id,state.user.username);
}
function openProject(id, ownerUsername=state.user?.username) {
  state.currentProjectId=id; state.currentProjectOwner=ownerUsername||state.user?.username; const p=getCurrentProject(); if (!p) return enterDashboard();
  $("#dashboardView").classList.add("hidden"); $("#kickoffView").classList.add("hidden"); $("#editorView").classList.remove("hidden"); $("#backToDashboard").classList.remove("hidden"); $("#exportPdfBtn").classList.remove("hidden");
  $("#projectTitleInline").value=p.projectName; $("#sidebarProjectName").textContent=p.projectName;
  $("#projectVersionBadge").textContent=versionLabel(p); $("#projectVersionBadge").classList.toggle("base",(p.version||0)===0);
  $("#projectOwnerBadge").textContent=ownerKey(state.currentProjectOwner)===ownerKey(state.user.username)?"":`Owner: ${state.currentProjectOwner}`;
  $("#projectOwnerBadge").classList.toggle("hidden",ownerKey(state.currentProjectOwner)===ownerKey(state.user.username));
  renderDivisionUI(p); renderPriceItems(p); renderDisclaimerSelect(p); populateEditor(p); renderSummaryEditor(p); applyProjectLockUi(p); updateSelectedDisclaimerPreview(); updatePreview(); activateTab("info");
}

function applyProjectLockUi(p){
  const deleted=Boolean(p.deletedByUser), locked=Boolean(p.locked)||deleted, otherOwner=ownerKey(state.currentProjectOwner)!==ownerKey(state.user?.username);
  $("#projectLockBadge").classList.toggle("hidden",!locked);
  $("#projectLockBadge").textContent=deleted?"Deleted · Admin Recovery Copy":"Locked · Read Only";
  $("#editorView").classList.toggle("project-locked",locked);
  $$('#editorView .editor-workspace input, #editorView .editor-workspace textarea, #editorView .editor-workspace select').forEach(el=>{
    const companyEmployee=el.hasAttribute('data-company')&&!isAdmin();
    el.disabled=locked||companyEmployee;
  });
  $$('#editorView .rich-division-editor, #editorView .rich-closeout-editor').forEach(el=>el.setAttribute('contenteditable',locked?'false':'true'));
  $$('#editorView .scope-format-btn').forEach(el=>el.disabled=locked);
  $("#addPriceItemBtn").disabled=locked;
  $$('.remove-price-item').forEach(b=>b.disabled=locked);
  const deleteBtn=$("#deleteProjectBtn");
  if(deleted&&isAdmin()){
    deleteBtn.classList.remove("hidden"); deleteBtn.textContent="Restore This Version"; deleteBtn.dataset.action="restore";
  }else{
    deleteBtn.classList.toggle("hidden",otherOwner&&!isAdmin()); deleteBtn.textContent="Delete This Version"; deleteBtn.dataset.action="delete";
  }
}

function renderDivisionUI(p) {
  const cards=$("#divisionCards"), nav=$("#divisionNav"); cards.innerHTML=""; nav.innerHTML="";
  CSI_DIVISIONS.forEach(([n,t])=>{
    const d=p.divisions[n]||{number:n,title:t,enabled:false,text:"",richText:""};
    const title=String(d.title||t).trim()||t;
    const plain=String(d.text||"").trim();
    const rich=normalizedDivisionRichHtml(d);
    const lineCount=plain?plain.split(/\n/).length:0;
    const card=document.createElement("article"); card.className=`division-card ${d.enabled?'enabled':''}`; card.dataset.division=n;
    card.innerHTML=`<div class="division-card-header"><div class="div-badge">${n}</div><div class="division-title-wrap"><div class="div-title-row"><span class="div-title-prefix">Division ${n} –</span><input class="division-title-input" value="${esc(title)}" aria-label="Division ${n} name" title="Edit division name only"></div><div class="div-sub">${lineCount?`${lineCount} scope line${lineCount===1?'':'s'} entered`:'No scope entered'}</div></div><label class="switch-label"><input type="checkbox" class="division-enabled" ${d.enabled?'checked':''}><span class="switch"></span>Include</label><button class="division-expand" aria-label="Expand division">⌄</button></div><div class="division-body"><div class="division-format-toolbar" role="toolbar" aria-label="Division ${n} text formatting"><button type="button" class="scope-format-btn" data-format="bold" title="Bold (Ctrl+B)" aria-label="Bold"><strong>B</strong></button><button type="button" class="scope-format-btn" data-format="italic" title="Italic (Ctrl+I)" aria-label="Italic"><em>I</em></button><button type="button" class="scope-format-btn" data-format="underline" title="Underline (Ctrl+U)" aria-label="Underline"><span class="format-u">U</span></button></div><div class="division-text rich-division-editor" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" data-placeholder="Paste or type Division ${n} scope here…">${rich}</div><div class="paste-helper"><span>Tip: each manual new line becomes a separate PDF bullet. Select text to use Bold, Italic, or Underline.</span><span>Auto-saved</span></div></div>`;
    cards.appendChild(card);
    const navBtn=document.createElement("button"); navBtn.className="division-nav-item"; navBtn.dataset.navDivision=n; navBtn.innerHTML=`<span class="division-nav-number">${n}</span><span class="division-nav-title">${esc(title)}</span><span class="division-nav-dot ${plain?'used':''}"></span>`; nav.appendChild(navBtn);
  });
  $$(".division-card-header",cards).forEach(h=>h.addEventListener("click",e=>{ if(e.target.closest(".switch-label")||e.target.closest(".division-title-input")||e.target.closest(".division-format-toolbar"))return; h.closest(".division-card").classList.toggle("open"); }));
  $$(".division-enabled",cards).forEach(cb=>cb.addEventListener("change",e=>{ const card=e.target.closest(".division-card"); card.classList.toggle("enabled",e.target.checked); if(e.target.checked)card.classList.add("open"); scheduleSave();updatePreview(); }));
  $$(".division-title-input",cards).forEach(input=>input.addEventListener("input",e=>{ const card=e.target.closest(".division-card"),n=card.dataset.division,def=CSI_DIVISIONS.find(x=>x[0]===n)?.[1]||""; const title=e.target.value||def; const navTitle=$(`[data-nav-division="${n}"] .division-nav-title`); if(navTitle)navTitle.textContent=title; scheduleSave();updatePreview(); }));
  $$(".rich-division-editor",cards).forEach(editor=>{
    editor.addEventListener("input",e=>{
      const card=e.target.closest(".division-card"),plainText=richEditorPlainText(e.target),lines=plainText.trim()?plainText.trim().split(/\n/).length:0;
      $(".div-sub",card).textContent=lines?`${lines} scope line${lines===1?'':'s'} entered`:"No scope entered";
      $(`[data-nav-division="${card.dataset.division}"] .division-nav-dot`).classList.toggle("used",!!plainText.trim());
      scheduleSave();updatePreview();
    });
    editor.addEventListener("paste",e=>{
      e.preventDefault();
      const text=e.clipboardData?.getData("text/plain")||"";
      document.execCommand("insertText",false,text);
    });
  });
  $$(".scope-format-btn",cards).forEach(btn=>{
    btn.addEventListener("mousedown",e=>e.preventDefault());
    btn.addEventListener("click",()=>{
      const card=btn.closest(".division-card"),editor=$(".rich-division-editor",card);
      if(!editor||editor.getAttribute("contenteditable")==="false")return;
      editor.focus();
      try{document.execCommand("styleWithCSS",false,false);}catch{}
      document.execCommand(btn.dataset.format,false,null);
      editor.dispatchEvent(new Event("input",{bubbles:true}));
    });
  });
  $$('[data-nav-division]').forEach(btn=>btn.addEventListener('click',()=>{ activateTab("scope"); const card=$(`[data-division="${btn.dataset.navDivision}"]`);card.classList.add('open');card.scrollIntoView({behavior:'smooth',block:'center'}); }));
  filterDivisionNav();
}

function renderPriceItems(p) {
  const wrap=$("#priceItems"); wrap.innerHTML="";
  const hasAlternates=p.priceItems.some(i=>!i.isBaseBid);
  p.priceItems.forEach((item,index)=>{
    const isBase=Boolean(item.isBaseBid);
    const row=document.createElement("div"); row.className=`price-item-row ${isBase?'base-bid-row':''} ${isBase&&hasAlternates?'has-alternates':''}`.trim(); row.dataset.priceId=item.id; row.dataset.baseBid=isBase?'true':'false';
    row.innerHTML=isBase
      ? `<input class="price-item-input price-name" value="Base Bid" readonly><input class="price-item-input price-value" value="${esc(item.price||'')}" placeholder="$0.00"><span class="base-bid-lock" title="Base Bid is always included in Proposed Pricing">Base</span>`
      : `<div class="row-check-preview" title="Printed alternate/add-on selection box"></div><input class="price-item-input price-name" value="${esc(item.name||'')}" placeholder="Alternate / add-on pricing line"><input class="price-item-input price-value" value="${esc(item.price||'')}" placeholder="$0.00"><button class="remove-price-item" type="button" title="Remove line">×</button>`;
    wrap.appendChild(row);
  });
  $("#emptyPriceItems").classList.add("hidden");
}
function addPriceItem() {
  const p=collectEditorProject(); if(!p)return;
  p.priceItems.push({id:uid(),name:"",description:"",price:"",isBaseBid:false}); putProject(p); renderPriceItems(p); updatePreview();
  const last=$$('.price-item-row:not(.base-bid-row) .price-name').at(-1); if(last)last.focus();
}
function collectPriceItems() {
  return $$('.price-item-row').map(row=>({id:row.dataset.priceId,name:row.dataset.baseBid==='true'?"Base Bid":$('.price-name',row).value,description:"",price:$('.price-value',row).value,isBaseBid:row.dataset.baseBid==='true'}));
}

function renderDisclaimerSelect(p) {
  const select=$("#projectDisclaimerSelect"), items=getDisclaimers(); select.innerHTML="";
  items.forEach(d=>{ const o=document.createElement("option");o.value=d.id;o.textContent=d.name;select.appendChild(o); });
  if (!items.length) { const o=document.createElement("option");o.value="";o.textContent="No Terms & Conditions available — contact an Admin";select.appendChild(o); }
  select.value=items.some(d=>d.id===p.disclaimerId)?p.disclaimerId:(items[0]?.id||"");
}
function updateSelectedDisclaimerPreview() {
  const d=getDisclaimer($("#projectDisclaimerSelect").value);
  $("#selectedDisclaimerPreview").textContent=d?.text||"No approved Terms & Conditions are currently available.";
}

function activeSummaryDivisions(p){
  return CSI_DIVISIONS.map(([n,t])=>p.divisions[n]||{number:n,title:t,enabled:false}).filter(d=>d.enabled);
}
function renderSummaryEditor(p){
  const summary=p.summary||{mode:"none",basicNote:"",basicDivisions:{},basicOverhead:{enabled:false,label:"Overhead",amount:""},divisionCosts:{},extraRows:[]};
  const mode=summary.mode||"none";
  $("#summaryMode").value=mode;
  $("#basicSummaryNote").value=summary.basicNote||"";
  $("#summaryNoneState").classList.toggle("hidden",mode!=="none");
  $("#basicSummaryEditor").classList.toggle("hidden",mode!=="basic");
  $("#advancedSummaryEditor").classList.toggle("hidden",mode!=="advanced");
  renderBasicSummaryRows(p);
  renderAdvancedDivisionRows(p);
  renderAdvancedExtraRows(p);
  updateBasicSummaryTotal();
  updateAdvancedSummaryTotals();
}
function renderBasicSummaryRows(p){
  const wrap=$("#basicSummaryDivisionRows"); if(!wrap)return; wrap.innerHTML="";
  const active=activeSummaryDivisions(p);
  if(!active.length){wrap.innerHTML='<div class="inline-empty">Enable scope divisions to add them to the Basic Summary.</div>';}
  active.forEach(d=>{
    const saved=p.summary?.basicDivisions?.[d.number]||{};
    const row=document.createElement("div");row.className="basic-summary-division-row";row.dataset.basicSummaryDivision=d.number;
    const defaultLabel=`${d.number} - ${d.title}`;
    row.innerHTML=`<input class="basic-summary-label" value="${esc(Object.prototype.hasOwnProperty.call(saved,'label')?saved.label:defaultLabel)}" placeholder="${esc(defaultLabel)}"><input class="basic-summary-amount" value="${esc(saved.amount||'')}" placeholder="$0.00">`;
    wrap.appendChild(row);
  });
  const overhead=p.summary?.basicOverhead||{enabled:false,label:"Overhead",amount:""};
  const enabled=$("#basicOverheadEnabled"),label=$("#basicOverheadLabel"),amount=$("#basicOverheadAmount");
  if(enabled)enabled.checked=Boolean(overhead.enabled);
  if(label){label.value=overhead.label||"Overhead";label.disabled=!overhead.enabled;}
  if(amount){amount.value=overhead.amount||"";amount.disabled=!overhead.enabled;}
}
function updateBasicSummaryTotal(){
  let total=0; $$('.basic-summary-amount').forEach(el=>total+=moneyNumber(el.value));
  if($("#basicOverheadEnabled")?.checked)total+=moneyNumber($("#basicOverheadAmount")?.value||"");
  if($("#basicSummaryTotal"))$("#basicSummaryTotal").textContent=formatMoneyNumber(total);
}
function renderAdvancedDivisionRows(p){
  const wrap=$("#advancedDivisionRows"); if(!wrap)return; wrap.innerHTML="";
  const active=activeSummaryDivisions(p);
  const custom=Array.isArray(p.summary?.customDivisions)?p.summary.customDivisions:[];
  const renderCustom=(item)=>{
    const row=document.createElement("div");row.className="summary-custom-division-row";row.dataset.customSummaryDivisionId=item.id;row.dataset.afterDivision=item.afterDivision||"__start__";
    row.innerHTML=`<span class="custom-division-badge">CUSTOM</span><input class="summary-custom-label" value="${esc(item.label||'')}" placeholder="Custom division / description"><input class="summary-custom-amount" value="${esc(item.amount||'')}" placeholder="$0.00"><button class="remove-custom-summary-division" type="button" title="Remove custom division">×</button>`;
    wrap.appendChild(row);
  };
  custom.filter(r=>(r.afterDivision||"__start__")==="__start__").forEach(renderCustom);
  if(!active.length && !custom.length){wrap.innerHTML='<div class="inline-empty">Enable scope divisions to add them to the Advanced Summary.</div>';return;}
  active.forEach(d=>{
    const saved=p.summary?.divisionCosts?.[d.number]||{amount:"",hidden:false,subRows:[]};
    const group=document.createElement("div");group.className="summary-division-group";group.dataset.summaryDivision=d.number;
    group.innerHTML=`
      <div class="summary-division-row">
        <label class="summary-division-show"><input type="checkbox" class="summary-division-visible" ${saved.hidden?'':'checked'}><span>Show</span></label>
        <div class="summary-division-description"><strong>${esc(d.number)} - ${esc(d.title)}</strong><span>Leave Division Amount blank to show only subsection costs; subsection amounts still roll into the Direct Cost Total.</span></div>
        <input class="summary-division-amount" value="${esc(saved.amount||'')}" placeholder="$0.00" title="Division amount (optional)">
        <strong class="summary-division-total"></strong>
        <button class="add-summary-subrow btn btn-secondary btn-small" type="button">+ Subsection</button>
      </div>
      <div class="summary-subrows"></div>
      <div class="summary-insert-custom"><button class="insert-custom-summary-division btn btn-ghost btn-small" data-after-division="${esc(d.number)}" type="button">+ Custom Division Below</button></div>`;
    const subWrap=$('.summary-subrows',group);
    (saved.subRows||[]).forEach(item=>{
      const row=document.createElement('div');row.className='summary-subrow';row.dataset.summarySubrowId=item.id;
      row.innerHTML=`<span class="summary-sub-indent">↳</span><input class="summary-sub-label" value="${esc(item.label||'')}" placeholder="Subsection description"><input class="summary-sub-amount" value="${esc(item.amount||'')}" placeholder="$0.00"><button class="remove-summary-subrow" type="button" title="Remove subsection">×</button>`;
      subWrap.appendChild(row);
    });
    wrap.appendChild(group);
    custom.filter(r=>String(r.afterDivision||"")===String(d.number)).forEach(renderCustom);
  });
  const activeNums=new Set(active.map(d=>String(d.number)));
  custom.filter(r=>r.afterDivision!=="__start__"&&!activeNums.has(String(r.afterDivision))).forEach(renderCustom);
}
function renderAdvancedExtraRows(p){
  const wrap=$("#advancedExtraRows"); if(!wrap)return; wrap.innerHTML="";
  (p.summary?.extraRows||[]).forEach(item=>{
    const row=document.createElement("div");row.className="summary-extra-row";row.dataset.summaryRowId=item.id;
    row.innerHTML=`<input class="summary-extra-label" value="${esc(item.label||'')}" placeholder="Fee / allowance / contingency"><input class="summary-extra-amount" value="${esc(item.amount||'')}" placeholder="$0.00" ${item.type==='subtotal'?'disabled':''}><select class="summary-extra-type"><option value="cost" ${item.type!=='subtotal'?'selected':''}>Cost Line</option><option value="subtotal" ${item.type==='subtotal'?'selected':''}>Section Subtotal</option></select><button class="remove-summary-row" type="button" title="Remove line">×</button>`;
    wrap.appendChild(row);
  });
}
function collectSummaryEditor(p){
  p.summary=p.summary||{mode:"none",basicNote:"",basicDivisions:{},basicOverhead:{enabled:false,label:"Overhead",amount:""},divisionCosts:{},extraRows:[]};
  p.summary.mode=$("#summaryMode")?.value||p.summary.mode||"none";
  p.summary.basicNote=$("#basicSummaryNote")?.value||"";
  p.summary.basicDivisions=p.summary.basicDivisions||{};
  $$('.basic-summary-division-row').forEach(row=>{
    const n=row.dataset.basicSummaryDivision;
    p.summary.basicDivisions[n]={label:$('.basic-summary-label',row)?.value||"",amount:$('.basic-summary-amount',row)?.value||""};
  });
  p.summary.basicOverhead={
    enabled:Boolean($("#basicOverheadEnabled")?.checked),
    label:$("#basicOverheadLabel")?.value||"Overhead",
    amount:$("#basicOverheadAmount")?.value||""
  };
  p.summary.divisionCosts=p.summary.divisionCosts||{};
  $$('.summary-division-group').forEach(group=>{
    const n=group.dataset.summaryDivision;
    p.summary.divisionCosts[n]={
      amount:$('.summary-division-amount',group)?.value||"",
      hidden:!Boolean($('.summary-division-visible',group)?.checked),
      subRows:$$('.summary-subrow',group).map(row=>({id:row.dataset.summarySubrowId||uid(),label:$('.summary-sub-label',row)?.value||"",amount:$('.summary-sub-amount',row)?.value||""}))
    };
  });
  p.summary.extraRows=$$('.summary-extra-row').map(row=>({id:row.dataset.summaryRowId||uid(),label:$('.summary-extra-label',row)?.value||"",amount:$('.summary-extra-amount',row)?.value||"",type:$('.summary-extra-type',row)?.value==='subtotal'?"subtotal":"cost"}));
  p.summary.customDivisions=$$('.summary-custom-division-row').map(row=>({id:row.dataset.customSummaryDivisionId||uid(),label:$('.summary-custom-label',row)?.value||"",amount:$('.summary-custom-amount',row)?.value||"",afterDivision:row.dataset.afterDivision||"__start__"}));
  return p.summary;
}
function addAdvancedDivisionSubRow(divisionNumber){
  const p=collectEditorProject();if(!p)return;
  p.summary=p.summary||{mode:"advanced",divisionCosts:{},extraRows:[]};
  p.summary.divisionCosts=p.summary.divisionCosts||{};
  const saved=p.summary.divisionCosts[divisionNumber]||{amount:"",hidden:false,subRows:[]};
  saved.subRows=Array.isArray(saved.subRows)?saved.subRows:[];
  saved.subRows.push({id:uid(),label:"",amount:""});
  p.summary.divisionCosts[divisionNumber]=saved;putProject(p);renderAdvancedDivisionRows(p);updateAdvancedSummaryTotals();updatePreview();
  const group=$(`.summary-division-group[data-summary-division="${divisionNumber}"]`);
  $$('.summary-sub-label',group).at(-1)?.focus();
}
function addCustomAdvancedDivision(afterDivision="__start__"){
  const p=collectEditorProject();if(!p)return;
  p.summary=p.summary||{mode:"advanced",divisionCosts:{},extraRows:[],customDivisions:[]};
  p.summary.customDivisions=Array.isArray(p.summary.customDivisions)?p.summary.customDivisions:[];
  const item={id:uid(),label:"",amount:"",afterDivision:String(afterDivision||"__start__")};
  p.summary.customDivisions.push(item);putProject(p);renderAdvancedDivisionRows(p);updateAdvancedSummaryTotals();updatePreview();
  const row=$(`.summary-custom-division-row[data-custom-summary-division-id="${item.id}"]`);$('.summary-custom-label',row)?.focus();
}
function addAdvancedSummaryRow(){
  const p=collectEditorProject();if(!p)return;p.summary=p.summary||{mode:"advanced",basicNote:"",divisionCosts:{},extraRows:[]};
  p.summary.extraRows.push({id:uid(),label:"",amount:"",type:"cost"}); putProject(p); renderAdvancedExtraRows(p); updateAdvancedSummaryTotals(); updatePreview();
  $$('.summary-extra-row .summary-extra-label').at(-1)?.focus();
}
function updateAdvancedSummaryTotals(){
  let direct=0;
  $$('.summary-division-group').forEach(group=>{
    const divisionAmountRaw=$('.summary-division-amount',group)?.value||"";
    let subsectionTotal=0;$$('.summary-sub-amount',group).forEach(el=>subsectionTotal+=moneyNumber(el.value));
    const hasDivisionAmount=Boolean(String(divisionAmountRaw).trim());
    const divisionTotal=hasDivisionAmount?moneyNumber(divisionAmountRaw):subsectionTotal;
    const totalEl=$('.summary-division-total',group);if(totalEl)totalEl.textContent=hasDivisionAmount?formatMoneyNumber(divisionTotal):"";
    if($('.summary-division-visible',group)?.checked)direct+=divisionTotal;
  });
  $$('.summary-custom-division-row').forEach(row=>{direct+=moneyNumber($('.summary-custom-amount',row)?.value||"");});
  let sectionTotal=0,additionalTotal=0;
  $$('.summary-extra-row').forEach(row=>{
    const type=$('.summary-extra-type',row)?.value||'cost',amt=$('.summary-extra-amount',row);
    if(type==='subtotal'){
      if(amt)amt.value=formatMoneyNumber(sectionTotal);
      additionalTotal+=sectionTotal;sectionTotal=0;
    }else sectionTotal+=moneyNumber(amt?.value||"");
  });
  additionalTotal+=sectionTotal;
  if($("#advancedDirectTotal"))$("#advancedDirectTotal").textContent=formatMoneyNumber(direct);
  if($("#advancedGrandTotal"))$("#advancedGrandTotal").textContent=formatMoneyNumber(direct+additionalTotal);
}
function refreshSummaryForDivisionChanges(){
  const p=collectEditorProject(); if(!p)return; renderBasicSummaryRows(p);renderAdvancedDivisionRows(p);updateBasicSummaryTotal();updateAdvancedSummaryTotals();
}

function populateOfficeSettings(){
  const offices=getOfficeSettings();
  $$('[data-office-setting]').forEach(el=>{ const [key,field]=el.dataset.officeSetting.split('.'); el.value=offices[key]?.[field]??""; });
}
function collectAndSaveOfficeSettings(){
  if(!isAdmin())return;
  const offices=getOfficeSettings();
  $$('[data-office-setting]').forEach(el=>{ const [key,field]=el.dataset.officeSetting.split('.'); if(offices[key])offices[key][field]=el.value; });
  saveOfficeSettings(offices);
  const current=getCurrentProject();
  if(current && !current.locked && !current.deletedByUser){
    const key=current.estimatingOffice||"fredonia";
    current.officeContact={...(offices[key]||DEFAULT_OFFICES.fredonia)};
    putProject(current,state.currentProjectOwner);
  }
}
function populateEditor(p) {
  $$('[data-field]').forEach(el=>{ const k=el.dataset.field; el.value=p[k]??""; });
  $$('.rich-closeout-editor').forEach(el=>{ const field=el.dataset.closeoutField; el.innerHTML=sanitizeScopeHtml(p[`${field}RichText`]||plainTextToRichHtml(p[field]||"")); });
  $$('[data-company]').forEach(el=>{ const k=el.dataset.company;el.value=p.company?.[k]??DEFAULT_COMPANY[k]??""; });
  $$('[data-section-enabled]').forEach(el=>el.checked=p.sectionEnabled?.[el.dataset.sectionEnabled]!==false);
  populateOfficeSettings();
}
function collectEditorProject() {
  const p=getCurrentProject(); if(!p)return null;
  const previousOffice=p.estimatingOffice||"fredonia";
  $$('[data-field]').forEach(el=>p[el.dataset.field]=el.value);
  if(!["fredonia","tulsa"].includes(p.estimatingOffice))p.estimatingOffice="fredonia";
  if(p.estimatingOffice!==previousOffice || !p.officeContact) p.officeContact=getOfficeContact(p.estimatingOffice);
  p.projectName=$("#projectTitleInline").value.trim()||"Untitled Project";
  p.company=p.company||{...DEFAULT_COMPANY}; $$('[data-company]').forEach(el=>p.company[el.dataset.company]=el.value);
  p.sectionEnabled=p.sectionEnabled||{}; $$('[data-section-enabled]').forEach(el=>p.sectionEnabled[el.dataset.sectionEnabled]=el.checked);
  $$('.rich-closeout-editor').forEach(el=>{ const field=el.dataset.closeoutField; p[field]=richEditorPlainText(el); p[`${field}RichText`]=sanitizeScopeHtml(el.innerHTML||plainTextToRichHtml(p[field])); });
  p.priceItems=collectPriceItems();
  $$('.division-card').forEach(card=>{ const n=card.dataset.division,def=CSI_DIVISIONS.find(x=>x[0]===n)[1],editor=$('.rich-division-editor',card); p.divisions[n]=p.divisions[n]||{number:n,title:def,text:"",richText:""}; p.divisions[n].number=n; p.divisions[n].title=$('.division-title-input',card).value.trim()||def; p.divisions[n].enabled=$('.division-enabled',card).checked; p.divisions[n].text=richEditorPlainText(editor); p.divisions[n].richText=sanitizeScopeHtml(editor?.innerHTML||plainTextToRichHtml(p.divisions[n].text)); });
  collectSummaryEditor(p);
  return p;
}
function saveEditorProject() { const current=getCurrentProject();if(!current)return;if(current.locked||current.deletedByUser){setSaveStatus(current.deletedByUser?"Deleted · recovery copy":"Locked · read only");return;}const p=collectEditorProject();if(!p)return;putProject(p,state.currentProjectOwner);$("#sidebarProjectName").textContent=p.projectName; }
function activateTab(name) {
  if (name === "company" && !isAdmin()) name = "info";
  $$('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));
  $$('.tab-panel').forEach(p=>p.classList.remove('active'));
  const panel = $(`#${name}Tab`);
  if (panel) panel.classList.add('active');
  if(name==="summary" && state.currentProjectId){ const p=collectEditorProject(); if(p)renderSummaryEditor(p); }
}
function filterDivisionNav() { const q=$("#divisionSearch").value.trim().toLowerCase(); $$('[data-nav-division]').forEach(btn=>btn.classList.toggle('hidden',!btn.textContent.toLowerCase().includes(q))); }

function updatePreview() {
  const p=collectEditorProject();if(!p)return;
  document.documentElement.style.setProperty('--orange',p.company.orange||DEFAULT_COMPANY.orange);
  document.documentElement.style.setProperty('--charcoal',p.company.charcoal||DEFAULT_COMPANY.charcoal);
  schedulePdfPreview();
}
function togglePreview(open) {
  state.previewOpen=open??!state.previewOpen;
  $("#previewPane").classList.toggle("closed",!state.previewOpen);
  if(window.innerWidth>1180)$("#previewPane").classList.toggle("hidden",!state.previewOpen);
  $("#previewToggle").textContent=state.previewOpen?"Hide Preview":"PDF Preview";
  if(state.previewOpen)schedulePdfPreview(40);
}
function schedulePdfPreview(delay=500){
  clearTimeout(state.previewRenderTimer);
  if(!state.previewOpen||!state.currentProjectId)return;
  state.previewRenderTimer=setTimeout(renderLivePdfPreview,delay);
}
async function renderLivePdfPreview(){
  if(!state.previewOpen||!state.currentProjectId)return;
  const scroller=$("#pdfPreviewScroll"), pagesWrap=$("#pdfPreviewPages"), status=$("#pdfPreviewStatus");
  if(!scroller||!pagesWrap)return;
  const token=++state.previewRenderToken;
  const maxScroll=Math.max(1,scroller.scrollHeight-scroller.clientHeight);
  const scrollRatio=scroller.scrollTop/maxScroll;
  if(status){status.textContent="Updating live PDF…";status.classList.remove("hidden");}
  try{
    const doc=await exportPdf({preview:true});
    if(!doc||token!==state.previewRenderToken)return;
    const buffer=doc.output('arraybuffer');
    if(!window.pdfjsLib)throw new Error('PDF preview renderer did not load.');
    if(window.pdfjsLib.GlobalWorkerOptions)window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf=await window.pdfjsLib.getDocument({data:buffer}).promise;
    if(token!==state.previewRenderToken)return;
    const available=Math.max(260,Math.min(520,scroller.clientWidth-28));
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const fragment=document.createDocumentFragment();
    for(let i=1;i<=pdf.numPages;i++){
      if(token!==state.previewRenderToken)return;
      const page=await pdf.getPage(i);
      const base=page.getViewport({scale:1});
      const cssScale=available/base.width;
      const renderViewport=page.getViewport({scale:cssScale*dpr});
      const canvas=document.createElement('canvas');
      canvas.className='pdf-preview-canvas';
      canvas.width=Math.ceil(renderViewport.width);canvas.height=Math.ceil(renderViewport.height);
      canvas.style.width=`${Math.round(base.width*cssScale)}px`;
      canvas.style.height=`${Math.round(base.height*cssScale)}px`;
      canvas.setAttribute('aria-label',`Proposal preview page ${i} of ${pdf.numPages}`);
      const sheet=document.createElement('div');sheet.className='pdf-preview-sheet';
      const pageTag=document.createElement('div');pageTag.className='pdf-preview-page-tag';pageTag.textContent=`Page ${i} of ${pdf.numPages}`;
      sheet.append(canvas,pageTag);fragment.appendChild(sheet);
      await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport:renderViewport}).promise;
    }
    if(token!==state.previewRenderToken)return;
    pagesWrap.replaceChildren(fragment);
    if(status)status.classList.add('hidden');
    requestAnimationFrame(()=>{
      const newMax=Math.max(0,scroller.scrollHeight-scroller.clientHeight);
      scroller.scrollTop=Math.min(newMax,newMax*scrollRatio);
    });
  }catch(err){
    console.error(err);
    if(token!==state.previewRenderToken)return;
    if(status){status.textContent="Live preview unavailable. Export PDF still uses the locked template.";status.classList.remove("hidden");}
  }
}
async function imageToDataUrl(src) { const img=new Image();img.crossOrigin="anonymous";return new Promise((resolve,reject)=>{img.onload=()=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);resolve(c.toDataURL('image/png'));};img.onerror=reject;img.src=src;}); }
function parseScopeLines(text) { return String(text||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>{const cleaned=s.replace(/^[-•▪◦*]\s*/,"");return{bullet:cleaned!==s||/^\d+[.)]\s/.test(s),text:cleaned};}); }
function scopeItemsFromRichHtml(html="",fallbackText="") {
  const safe=sanitizeScopeHtml(String(html||"").trim()||plainTextToRichHtml(fallbackText||""));
  const root=document.createElement("div"); root.innerHTML=safe;
  let lines=[[]];
  const newLine=()=>{ if(lines[lines.length-1].length)lines.push([]); };
  const addText=(value,style)=>{
    String(value||"").split(/\n/).forEach((part,index)=>{
      if(index)newLine();
      if(part)lines[lines.length-1].push({text:part,bold:Boolean(style.bold),italic:Boolean(style.italic),underline:Boolean(style.underline)});
    });
  };
  const walk=(node,style={bold:false,italic:false,underline:false})=>{
    if(node.nodeType===Node.TEXT_NODE){addText(node.nodeValue,style);return;}
    if(node.nodeType!==Node.ELEMENT_NODE)return;
    const tag=node.tagName.toLowerCase();
    if(tag==="br"){newLine();return;}
    const next={...style};
    if(tag==="b"||tag==="strong")next.bold=true;
    if(tag==="i"||tag==="em")next.italic=true;
    if(tag==="u")next.underline=true;
    if(tag==="div"||tag==="p"){
      if(lines[lines.length-1].length)newLine();
      [...node.childNodes].forEach(ch=>walk(ch,next));
      newLine();
      return;
    }
    [...node.childNodes].forEach(ch=>walk(ch,next));
  };
  [...root.childNodes].forEach(ch=>walk(ch));
  const normalizeRuns=runs=>{
    const out=[];
    runs.forEach(run=>{
      if(!run.text)return;
      const prev=out[out.length-1];
      if(prev&&prev.bold===run.bold&&prev.italic===run.italic&&prev.underline===run.underline)prev.text+=run.text;
      else out.push({...run});
    });
    if(out.length)out[0].text=out[0].text.replace(/^\s+/,"");
    if(out.length)out[out.length-1].text=out[out.length-1].text.replace(/\s+$/g,"");
    return out.filter(r=>r.text);
  };
  lines=lines.map(normalizeRuns).filter(runs=>runs.some(r=>r.text.trim()));
  const multipleManualLines=lines.length>1;
  const stripPrefix=(runs,count)=>{
    let remaining=count;
    return runs.map(run=>{
      if(remaining<=0)return run;
      const cut=Math.min(remaining,run.text.length);remaining-=cut;
      return {...run,text:run.text.slice(cut)};
    }).filter(r=>r.text);
  };
  return lines.map(runs=>{
    const text=runs.map(r=>r.text).join("");
    const match=text.match(/^[-•▪◦*]\s+/);
    const explicit=Boolean(match);
    const cleanRuns=explicit?stripPrefix(runs,match[0].length):runs;
    return {text:cleanRuns.map(r=>r.text).join(""),runs:cleanRuns,bullet:multipleManualLines||explicit};
  });
}
function hexToRgb(hex) { const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);return[(n>>16)&255,(n>>8)&255,n&255]; }

async function exportPdf(options={}) {
  const previewOnly=Boolean(options&&options.preview===true);
  if(!previewOnly)saveEditorProject();
  const p=previewOnly?collectEditorProject():getCurrentProject();
  if(!p)return;
  if(!window.jspdf)return toast("PDF library did not load. Check your internet connection and try again.");

  if(!previewOnly)setSaveStatus("Building PDF…");
  const {jsPDF}=window.jspdf;
  const pageW=8.5,pageH=11;
  const proposalType=["civil","concrete"].includes(p.proposalType)?p.proposalType:"standard";
  // Marketing's standard cover master is 8.5 x 11.333 in; Civil and Concrete
  // division covers are US Letter. Each is rendered at its exact supplied size.
  const coverPageH=proposalType==="standard"?11.333333:11;
  const doc=new jsPDF({unit:"in",format:[pageW,coverPageH],orientation:"portrait",compress:true});
  const orange=hexToRgb(p.company.orange||DEFAULT_COMPANY.orange);
  const charcoal=[36,43,49], text=[17,17,17], muted=[107,111,114], bg=[250,250,249], pale=[244,244,243], shadow=[228,228,226];
  const contentX=1.12, right=.48, contentW=pageW-contentX-right;
  const topY=1.20, bottomLimit=.72, cardGap=.14;
  const bodyFont=12.0, bodyLeading=.215, minPdfFont=12.0;
  let standardCoverRevision=null, standardCoverOriginal=null, civilCoverRevision=null, civilCoverOriginal=null, concreteCoverRevision=null, concreteCoverOriginal=null, interiorData=null;
  try {
    [standardCoverRevision,standardCoverOriginal,civilCoverRevision,civilCoverOriginal,concreteCoverRevision,concreteCoverOriginal,interiorData]=await Promise.all([
      imageToDataUrl('assets/marketing/marketing-cover-revision.png'),
      imageToDataUrl('assets/marketing/marketing-cover-original.png'),
      imageToDataUrl('assets/marketing/civil/cover-revision.png'),
      imageToDataUrl('assets/marketing/civil/cover-original.png'),
      imageToDataUrl('assets/marketing/concrete/cover-revision.png'),
      imageToDataUrl('assets/marketing/concrete/cover-original.png'),
      imageToDataUrl('assets/marketing/marketing-blank.png')
    ]);
  } catch {}

  const rgb=(arr)=>arr;
  const fmtProjectNo=()=>String(p.projectNumber||"PROJECT").toUpperCase();
  const rev=(p.version||0)>0?versionLabel(p):"";

  function setFill(c){doc.setFillColor(...c);}
  function setText(c){doc.setTextColor(...c);}
  function coverMask(x,y,w,h,color=[255,255,255]){doc.setFillColor(...color);doc.rect(x,y,w,h,'F');}

  function drawCover(){
    // Marketing-approved cover artwork is used as an immutable background master.
    // The app only overlays live values in the designated form locations.
    // Original proposals use the master with the Revision icon/label suppressed.
    const coverSet=proposalType==="civil"
      ? {revision:civilCoverRevision,original:civilCoverOriginal}
      : proposalType==="concrete"
        ? {revision:concreteCoverRevision,original:concreteCoverOriginal}
        : {revision:standardCoverRevision,original:standardCoverOriginal};
    const coverData=rev?coverSet.revision:coverSet.original;
    if(coverData) doc.addImage(coverData,'PNG',0,0,pageW,coverPageH,undefined,'FAST');
    else { setFill([255,255,255]);doc.rect(0,0,pageW,pageH,'F'); }

    const coverOffice={...getOfficeContact(p.estimatingOffice||"fredonia"),...(p.officeContact||{})};
    const livePhone=coverOffice.phone||"";
    const website=p.company.website||DEFAULT_COMPANY.website||"";

    // Exact fill locations from each Marketing master. The Standard cover is
    // 8.5 x 11.333 in, while Civil and Concrete are true 8.5 x 11 in covers.
    // Civil/Concrete therefore use their own field-row coordinates rather than
    // a proportional scale of the Standard cover.
    const standardFields={
      project:{x1:1.10,x2:3.42,cy:5.88},
      date:{x1:4.02,x2:5.82,cy:5.88},
      client:{x1:1.10,x2:3.42,cy:7.03},
      prepared:{x1:4.02,x2:5.82,cy:7.03},
      attn:{x1:1.10,x2:3.42,cy:8.17},
      revision:{x1:4.02,x2:5.82,cy:8.17},
      // Keep the office address close to Marketing's address icon/label instead
      // of centering it across the full-width address rule.
      address:{x1:1.02,x2:3.58,cy:9.18},
      phone:{x1:1.10,x2:3.42,cy:10.12},
      website:{x1:4.02,x2:5.82,cy:10.12}
    };
    const divisionFields={
      project:{x1:.96,x2:3.35,cy:5.48},
      date:{x1:3.84,x2:5.72,cy:5.48},
      client:{x1:.96,x2:3.35,cy:6.67},
      prepared:{x1:3.84,x2:5.72,cy:6.67},
      attn:{x1:.96,x2:3.35,cy:7.95},
      revision:{x1:3.84,x2:5.72,cy:7.95},
      address:{x1:.92,x2:3.55,cy:8.99},
      phone:{x1:.96,x2:3.35,cy:9.79},
      website:{x1:3.84,x2:5.72,cy:9.79}
    };
    const fields=proposalType==='standard'?standardFields:divisionFields;
    const drawCentered=(value,box,{bold=true,fontSize=12.0,maxLines=2,align='center'}={})=>{
      const textValue=String(value||"").trim();if(!textValue)return;
      doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(Math.max(minPdfFont,fontSize));setText(text);
      const width=Math.max(.25,box.x2-box.x1-.08);
      let lines=doc.splitTextToSize(textValue,width);
      if(lines.length>maxLines)lines=lines.slice(0,maxLines);
      const leading=.185;
      const startY=box.cy-((lines.length-1)*leading)/2+.055;
      const x=align==='left'?box.x1:(box.x1+box.x2)/2;
      doc.text(lines,x,startY,{align,lineHeightFactor:leading/(Math.max(minPdfFont,fontSize)/72)});
    };
    const coverAlign=proposalType==='standard'?'center':'left';

    drawCentered(p.projectName||'Untitled Project',fields.project,{fontSize:12.5,maxLines:2,align:coverAlign});
    drawCentered(fmtDate(p.proposalDate),fields.date,{fontSize:12.0,maxLines:1,align:coverAlign});
    drawCentered(p.clientName||'—',fields.client,{fontSize:12.0,maxLines:2,align:coverAlign});
    drawCentered(p.preparedBy||'—',fields.prepared,{fontSize:12.0,maxLines:2,align:coverAlign});
    drawCentered((p.attention||'').trim(),fields.attn,{fontSize:12.0,maxLines:2,align:coverAlign});
    if(rev)drawCentered(rev,fields.revision,{fontSize:12.0,maxLines:1,align:coverAlign});
    drawCentered((coverOffice.address||'').replace(/\n/g,', '),fields.address,{bold:false,fontSize:12.0,maxLines:3,align:coverAlign});
    drawCentered(livePhone,fields.phone,{bold:false,fontSize:12.0,maxLines:1,align:coverAlign});
    drawCentered(website,fields.website,{bold:false,fontSize:12.0,maxLines:1,align:coverAlign});
  }

  function drawBackground(){
    // Pages 2+ use Marketing's blank proposal sheet exactly as supplied.
    if(interiorData)doc.addImage(interiorData,'PNG',0,0,pageW,pageH,undefined,'FAST');
    else {setFill([255,255,255]);doc.rect(0,0,pageW,pageH,'F');}
  }

  function drawInteriorHeader(pageNum,totalPages){
    drawBackground();
    // Keep the compact proposal identifier used in prior exports while leaving
    // Marketing's fixed logo/artwork untouched.
    doc.setFont('helvetica','bold');doc.setFontSize(12.5);setText(text);doc.text('PROPOSAL',pageW-right,.34,{align:'right'});
    doc.setFont('helvetica','normal');doc.setFontSize(minPdfFont);setText(text);
    doc.text(`${fmtProjectNo()}${rev?`  •  ${rev}`:''}`,pageW-right,.56,{align:'right'});
    doc.setDrawColor(125,129,132);doc.setLineWidth(.007);doc.line(contentX,.82,pageW-right,.82);

    // Preserve the original Scope Builder page-numbering scheme.
    doc.setFont('helvetica','normal');doc.setFontSize(minPdfFont);setText(text);
    doc.text(`PAGE ${pageNum} OF ${totalPages}`,pageW-right,10.66,{align:'right'});
    doc.setDrawColor(...orange);doc.setLineWidth(.022);doc.line(pageW-right-.45,10.73,pageW-right,10.73);
  }

  function itemsFromText(value){
    const source=String(value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const multipleManualLines=source.length>1;
    return source.map(raw=>{
      const explicitBullet=/^[-•▪◦*]\s+/.test(raw);
      return {text:raw.replace(/^[-•▪◦*]\s*/,''),bullet:multipleManualLines||explicitBullet};
    });
  }
  function itemText(value){return typeof value==='string'?value:(value?.text||'');}
  function runFontStyle(run={}){return run.bold&&run.italic?'bolditalic':run.bold?'bold':run.italic?'italic':'normal';}
  function measureRunText(value,run,fontSize){doc.setFont('helvetica',runFontStyle(run));doc.setFontSize(fontSize);return doc.getTextWidth(String(value||''));}
  function wrapStyledRuns(runs,fontSize=bodyFont,maxW=contentW-.90){
    const tokens=[];
    (runs||[]).forEach(run=>{
      String(run.text||'').split(/(\s+)/).filter(Boolean).forEach(text=>tokens.push({...run,text}));
    });
    const lines=[];let line=[],width=0;
    const pushLine=()=>{if(line.length){while(line.length&&/^\s+$/.test(line[line.length-1].text))line.pop();if(line.length)lines.push(line);line=[];width=0;}};
    const addToken=token=>{
      const isSpace=/^\s+$/.test(token.text);
      if(isSpace&&line.length===0)return;
      const w=measureRunText(token.text,token,fontSize);
      if(!isSpace&&w>maxW){
        let chunk='';
        for(const ch of token.text){
          const trial=chunk+ch;
          if(chunk&&measureRunText(trial,token,fontSize)>maxW){addToken({...token,text:chunk});pushLine();chunk=ch;}else chunk=trial;
        }
        if(chunk)addToken({...token,text:chunk});
        return;
      }
      if(line.length&&width+w>maxW){pushLine();if(isSpace)return;}
      line.push(token);width+=w;
    };
    tokens.forEach(addToken);pushLine();
    return lines.length?lines:[[]];
  }
  function wrapItem(value,fontSize=bodyFont,maxW=contentW-.90){
    if(value&&Array.isArray(value.runs)&&value.runs.length)return wrapStyledRuns(value.runs,fontSize,maxW);
    doc.setFont('helvetica','normal');doc.setFontSize(fontSize);return doc.splitTextToSize(itemText(value),maxW);
  }
  function drawStyledLines(lines,x,y,fontSize,leading){
    lines.forEach((line,lineIndex)=>{
      let cx=x,baseline=y+lineIndex*leading;
      line.forEach(run=>{
        doc.setFont('helvetica',runFontStyle(run));doc.setFontSize(fontSize);setText(text);
        doc.text(run.text,cx,baseline);
        const w=doc.getTextWidth(run.text);
        if(run.underline&&run.text.trim()){
          doc.setDrawColor(...text);doc.setLineWidth(.008);doc.line(cx,baseline+.025,cx+w,baseline+.025);
        }
        cx+=w;
      });
    });
  }
  function cardHeight(items,{fontSize=bodyFont,leading=bodyLeading,division=true}={}){
    let lineCount=0;items.forEach(i=>lineCount+=Math.max(1,wrapItem(i,fontSize).length));
    const heading=.43, bottom=.20, itemGaps=Math.max(0,items.length-1)*.055;
    return Math.max(.76,heading+lineCount*leading+itemGaps+bottom);
  }
  function fitItems(items,available,opts){
    const fit=[];
    for(const item of items){const trial=[...fit,item];if(cardHeight(trial,opts)<=available)fit.push(item);else break;}
    return [fit,items.slice(fit.length)];
  }
  function selectionItemHeight(item){
    doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);
    const maxW=item.isBaseBid?contentW-1.30:contentW-1.55;
    const nameLines=doc.splitTextToSize(item.name||'Selection item',maxW).length;
    return Math.max(.30,nameLines*.215+.09);
  }
  function selectionMetrics(items){
    doc.setFont('helvetica','normal');doc.setFontSize(minPdfFont);
    const note='Base Bid is shown first. Mark any alternates or add-ons you would like included in the contract request.';
    const noteLines=doc.splitTextToSize(note,contentW-.84);
    const noteLeading=.205;
    const noteY=.56;
    const itemsY=noteY+(noteLines.length*noteLeading)+.20;
    const hasAlternates=items.some(item=>!item.isBaseBid);
    const h=itemsY+items.reduce((sum,item)=>sum+selectionItemHeight(item),0)+(hasAlternates?.10:0)+.18;
    return {h:Math.max(1.15,h),noteLines,itemsY,noteLeading,hasAlternates};
  }
  function selectionHeight(items){ return selectionMetrics(items).h; }

  function buildLayout(){
    const pages=[];let current=[],y=topY;
    const active=CSI_DIVISIONS.map(([n])=>p.divisions[n]).filter(d=>d?.enabled&&d.text.trim());
    const addSplittable=(entryBase,items,opts={})=>{
      let remaining=[...items],cont=false;
      while(remaining.length){
        let available=pageH-bottomLimit-y;
        const fullH=cardHeight(remaining,opts);
        if(fullH<=available){current.push({...entryBase,items:[...remaining],cont});y+=fullH+cardGap;remaining=[];break;}
        const [fit,rest]=fitItems(remaining,available,opts);
        if(fit.length){current.push({...entryBase,items:fit,cont});pages.push(current);current=[];y=topY;remaining=rest;cont=true;continue;}
        if(current.length){pages.push(current);current=[];y=topY;continue;}
        // One unusually long bullet: give it the full page rather than dropping content.
        current.push({...entryBase,items:[remaining[0]],cont});pages.push(current);current=[];y=topY;remaining=remaining.slice(1);cont=true;
      }
    };
    active.forEach(d=>addSplittable({type:'division',number:d.number,title:d.title},scopeItemsFromRichHtml(d.richText,d.text),{fontSize:bodyFont,leading:bodyLeading}));
    const extras=[
      {title:'CLARIFICATIONS',value:p.clarifications,rich:p.clarificationsRichText,on:p.sectionEnabled?.clarifications},
      {title:'EXCLUSIONS',value:p.exclusions,rich:p.exclusionsRichText,on:p.sectionEnabled?.exclusions},
      {title:'ALTERNATES',value:p.alternates,rich:p.alternatesRichText,on:p.sectionEnabled?.alternates}
    ].filter(item=>item.on&&String(item.value||'').trim());
    extras.forEach(item=>addSplittable({type:'simple',title:item.title},scopeItemsFromRichHtml(item.rich,item.value),{fontSize:minPdfFont,leading:bodyLeading}));

    if(p.sectionEnabled?.clientSelections&&p.priceItems.some(i=>(i.name||'').trim()||(i.price||'').trim())){
      const h=selectionHeight(p.priceItems.filter(i=>(i.name||'').trim()||(i.price||'').trim()));
      if(pageH-bottomLimit-y<h){if(current.length)pages.push(current);current=[];y=topY;}
      current.push({type:'selections',height:h});y+=h+cardGap;
    }
    if(current.length){pages.push(current);current=[];}
    pages.push([{type:'closing'}]);
    return pages;
  }

  function drawCardBase(y,h){
    setFill(shadow);doc.roundedRect(contentX+.025,y+.025,contentW,h,.10,.10,'F');
    setFill([255,255,255]);doc.roundedRect(contentX,y,contentW,h,.10,.10,'F');
    setFill(orange);doc.triangle(contentX+.10,y+.10,contentX+.29,y+.10,contentX+.10,y+.29,'F');
  }
  function drawDivisionCard(entry,y){
    const h=cardHeight(entry.items,{fontSize:bodyFont,leading:bodyLeading});drawCardBase(y,h);
    const hy=y+.28;
    doc.setFont('helvetica','bold');doc.setFontSize(12.0);setText(text);
    doc.text(`DIVISION ${entry.number} - ${String(entry.title).toUpperCase()}${entry.cont?' (CONT.)':''}`,contentX+.42,hy,{maxWidth:contentW-.68});
    let cy=y+.58;doc.setFont('helvetica','normal');doc.setFontSize(bodyFont);
    for(const item of entry.items){
      const lines=wrapItem(item),bullet=typeof item==='string'?true:item.bullet!==false,x=bullet?contentX+.58:contentX+.42;
      setText(text);
      if(bullet){setFill(orange);doc.circle(contentX+.39,cy-.025,.022,'F');}
      if(item&&Array.isArray(item.runs)&&item.runs.length)drawStyledLines(lines,x,cy,bodyFont,bodyLeading);
      else{doc.setFont('helvetica','normal');doc.setFontSize(bodyFont);setText(text);doc.text(lines,x,cy,{lineHeightFactor:bodyLeading/bodyFont*72});}
      cy+=lines.length*bodyLeading+.055;
    }
    return y+h+cardGap;
  }
  function drawSimpleCard(entry,y){
    const opts={fontSize:minPdfFont,leading:bodyLeading};const h=cardHeight(entry.items,opts);drawCardBase(y,h);
    doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);setText(text);doc.text(`${entry.title}${entry.cont?' (CONT.)':''}`,contentX+.42,y+.28);
    let cy=y+.50;doc.setFont('helvetica','normal');doc.setFontSize(opts.fontSize);
    for(const item of entry.items){
      const lines=wrapItem(item,opts.fontSize),bullet=typeof item==='string'?true:item.bullet!==false,x=bullet?contentX+.58:contentX+.42;
      setText(text);if(bullet){setFill(orange);doc.circle(contentX+.39,cy-.025,.018,'F');}
      if(item&&Array.isArray(item.runs)&&item.runs.length)drawStyledLines(lines,x,cy,opts.fontSize,opts.leading);
      else{doc.setFont('helvetica','normal');doc.setFontSize(opts.fontSize);setText(text);doc.text(lines,x,cy,{lineHeightFactor:opts.leading/opts.fontSize*72});}
      cy+=lines.length*opts.leading+.045;
    }
    return y+h+cardGap;
  }
  function drawSelections(y){
    const items=p.priceItems.filter(i=>(i.name||'').trim()||(i.price||'').trim());
    const metrics=selectionMetrics(items),h=metrics.h;drawCardBase(y,h);
    doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);setText(text);doc.text('PROPOSED PRICING',contentX+.42,y+.28);
    doc.setFont('helvetica','normal');doc.setFontSize(minPdfFont);setText(muted);
    doc.text(metrics.noteLines,contentX+.42,y+.56,{lineHeightFactor:metrics.noteLeading/minPdfFont*72});
    let cy=y+metrics.itemsY;
    items.forEach((item,index)=>{
      const isBase=Boolean(item.isBaseBid),x=isBase?contentX+.42:contentX+.67;
      if(!isBase){doc.setDrawColor(70,73,76);doc.setLineWidth(.01);doc.rect(contentX+.43,cy-.12,.14,.14);}
      doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);setText(text);
      const maxW=isBase?contentW-1.30:contentW-1.55;
      const nameLines=doc.splitTextToSize(item.name||'Selection item',maxW);
      doc.text(nameLines,x,cy,{lineHeightFactor:1.2});
      doc.text(currencyText(item.price),pageW-right-.16,cy,{align:'right'});
      cy+=Math.max(.30,nameLines.length*.215+.09);
      if(isBase&&metrics.hasAlternates){
        doc.setDrawColor(185,189,192);doc.setLineWidth(.012);doc.line(contentX+.42,cy-.16,pageW-right-.12,cy-.16);cy+=.10;
      }
    });
    return y+h+cardGap;
  }
  function drawClosing(y){
    const disclaimer=getDisclaimer(p.disclaimerId);
    if(disclaimer){
      const lines=(()=>{doc.setFont('helvetica','normal');doc.setFontSize(minPdfFont);return doc.splitTextToSize(disclaimer.text,contentW-.84);})();
      const h=Math.max(1.18,.58+lines.length*bodyLeading+.18);
      drawCardBase(y,h);
      doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);setText(text);
      doc.text(`TERMS AND CONDITIONS - ${String(disclaimer.name).toUpperCase()}`,contentX+.42,y+.28,{maxWidth:contentW-.60});
      doc.setFont('helvetica','normal');doc.setFontSize(minPdfFont);setText(text);
      doc.text(lines,contentX+.42,y+.55,{lineHeightFactor:bodyLeading/minPdfFont*72});
      y+=h+cardGap;
    }
    doc.setFont('helvetica','normal');doc.setFontSize(minPdfFont);
    const ackLines=doc.splitTextToSize(ACKNOWLEDGMENT_TEXT,contentW-.84);
    const h=Math.max(1.45,.66+ackLines.length*bodyLeading+.18);
    drawCardBase(y,h);
    doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);setText(text);doc.text('REQUEST TO PROCEED TO CONTRACT',contentX+.42,y+.28);
    doc.setFont('helvetica','normal');doc.setFontSize(minPdfFont);doc.text(ackLines,contentX+.42,y+.55,{lineHeightFactor:bodyLeading/minPdfFont*72});
    y+=h+.42;
    const lineY=Math.min(10.05,y+.25);
    doc.setDrawColor(112,116,119);doc.setLineWidth(.01);
    const fields=[[contentX,2.10,'CLIENT / AUTHORIZED REPRESENTATIVE'],[contentX+2.35,2.25,'SIGNATURE'],[contentX+4.90,1.50,'DATE']];
    fields.forEach(([x,w,label])=>{doc.line(x,lineY,x+w,lineY);doc.setFont('helvetica','normal');doc.setFontSize(minPdfFont);setText(muted);doc.text(label,x,lineY+.20,{maxWidth:w});});
  }

  function basicSummaryRows(){
    const rows=[];
    activeSummaryDivisions(p).forEach(d=>{
      const saved=p.summary?.basicDivisions?.[d.number]||{};
      const defaultLabel=`${d.number} - ${d.title}`;
      rows.push({kind:'cost',label:Object.prototype.hasOwnProperty.call(saved,'label')?saved.label:defaultLabel,amount:saved.amount||''});
    });
    const overhead=p.summary?.basicOverhead||{};
    if(overhead.enabled)rows.push({kind:'overhead',label:overhead.label||'Overhead',amount:overhead.amount||''});
    const total=rows.reduce((sum,r)=>sum+moneyNumber(r.amount),0);
    rows.push({kind:'grand-total',label:'BASIC SUMMARY TOTAL',amount:formatMoneyNumber(total)});
    return rows;
  }
  function advancedSummaryRows(){
    const rows=[];let directTotal=0;
    const custom=Array.isArray(p.summary?.customDivisions)?p.summary.customDivisions:[];
    const addCustomRows=(afterDivision)=>{
      custom.filter(r=>String(r.afterDivision||"__start__")===String(afterDivision)).forEach(r=>{
        const amt=moneyNumber(r.amount);directTotal+=amt;
        rows.push({kind:'custom-division',label:r.label||'',amount:r.amount||''});
      });
    };
    addCustomRows('__start__');
    const active=activeSummaryDivisions(p);
    active.forEach(d=>{
      const saved=p.summary?.divisionCosts?.[d.number]||{amount:'',hidden:false,subRows:[]};
      if(!saved.hidden){
        const subs=(saved.subRows||[]).filter(r=>(r.label||'').trim()||(r.amount||'').trim());
        const subsectionTotal=subs.reduce((sum,r)=>sum+moneyNumber(r.amount),0);
        const hasDivisionAmount=Boolean(String(saved.amount||'').trim());
        const divisionTotal=hasDivisionAmount?moneyNumber(saved.amount):subsectionTotal;
        directTotal+=divisionTotal;
        rows.push({kind:'division',label:`${d.number} - ${String(d.title||'').toUpperCase()}`,amount:hasDivisionAmount?(saved.amount||''):''});
        subs.forEach(r=>rows.push({kind:'subcost',label:r.label||'Subsection',amount:r.amount||''}));
      }
      addCustomRows(d.number);
    });
    const activeNums=new Set(active.map(d=>String(d.number)));
    custom.filter(r=>r.afterDivision!=="__start__"&&!activeNums.has(String(r.afterDivision))).forEach(r=>{
      const amt=moneyNumber(r.amount);directTotal+=amt;rows.push({kind:'custom-division',label:r.label||'',amount:r.amount||''});
    });
    rows.push({kind:'direct-total',label:'DIRECT COST TOTAL',amount:formatMoneyNumber(directTotal)});

    let sectionTotal=0,additionalTotal=0;
    (p.summary?.extraRows||[]).forEach(r=>{
      if(r.type==='subtotal'){
        rows.push({kind:'subtotal',label:(r.label||'SECTION SUBTOTAL').toUpperCase(),amount:formatMoneyNumber(sectionTotal)});
        additionalTotal+=sectionTotal;sectionTotal=0;
      }else{
        sectionTotal+=moneyNumber(r.amount);
        rows.push({kind:'cost',label:r.label||'',amount:r.amount||''});
      }
    });
    additionalTotal+=sectionTotal;
    rows.push({kind:'grand-total',label:'PROPOSAL SUMMARY TOTAL',amount:formatMoneyNumber(directTotal+additionalTotal)});
    return rows;
  }
  function summaryRowHeight(row){
    const isBold=['division','custom-division','direct-total','subtotal','grand-total'].includes(row.kind);
    doc.setFont('helvetica',isBold?'bold':'normal');doc.setFontSize(minPdfFont);
    const maxDesc=row.kind==='subcost'?contentW-1.72:contentW-1.48;
    const desc=Math.max(1,doc.splitTextToSize(row.label||'',maxDesc).length);
    return Math.max(.32,desc*.205+.12);
  }
  function splitSummaryRows(mode,rows,firstPageReduction=0){
    const pages=[];let current=[],used=0,pageIndex=0;
    rows.forEach(row=>{
      const h=summaryRowHeight(row);
      const maxH=8.00-(pageIndex===0?firstPageReduction:0);
      if(current.length&&used+h>maxH){pages.push({mode,rows:current,cont:pageIndex>0});current=[];used=0;pageIndex++;}
      current.push(row);used+=h;
    });
    if(current.length)pages.push({mode,rows:current,cont:pageIndex>0});
    return pages;
  }
  function buildSummaryPages(){
    const mode=p.summary?.mode||'none'; if(mode==='none')return [];
    if(mode==='basic'){
      let noteReduction=0;const note=(p.summary?.basicNote||'').trim();
      if(note){doc.setFont('helvetica','normal');doc.setFontSize(minPdfFont);noteReduction=doc.splitTextToSize(note,contentW).length*.21+.16;}
      return splitSummaryRows('basic',basicSummaryRows(),noteReduction);
    }
    return splitSummaryRows('advanced',advancedSummaryRows(),0);
  }
  function drawSummaryTitle(mode,cont=false){
    doc.setFont('helvetica','bold');doc.setFontSize(16);setText(text);
    const title=mode==='advanced'?'ADVANCED PROPOSAL SUMMARY':'BASIC PROPOSAL SUMMARY';
    doc.text(`${title}${cont?' (CONT.)':''}`,contentX,1.42,{maxWidth:contentW});
    doc.setFont('helvetica','normal');doc.setFontSize(minPdfFont);setText(muted);
    doc.text(p.projectName||'Untitled Project',contentX,1.66,{maxWidth:4.3});
    doc.text(fmtDate(p.proposalDate),pageW-right,1.66,{align:'right'});
  }
  function drawSummaryTableHeader(y){
    setFill(orange);doc.rect(contentX,y,contentW,.30,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);setText([255,255,255]);
    doc.text('DESCRIPTION',contentX+.08,y+.21);
    doc.text('TOTAL',pageW-right-.10,y+.21,{align:'right'});
    return y+.30;
  }
  function drawSummaryDataRow(row,y){
    const h=summaryRowHeight(row);
    if(row.kind==='direct-total'){setFill([122,125,127]);doc.rect(contentX,y,contentW,h,'F');setText([255,255,255]);}
    else if(row.kind==='subtotal'){setFill(orange);doc.rect(contentX,y,contentW,h,'F');setText([255,255,255]);}
    else if(row.kind==='grand-total'){setFill(charcoal);doc.rect(contentX,y,contentW,h,'F');setText([255,255,255]);}
    else if(row.kind==='division'||row.kind==='custom-division'){setFill([238,239,240]);doc.rect(contentX,y,contentW,h,'F');setText(text);}
    else {setText(text);doc.setDrawColor(226,228,230);doc.setLineWidth(.006);doc.line(contentX,y+h,contentX+contentW,y+h);}
    const bold=['division','custom-division','direct-total','subtotal','grand-total'].includes(row.kind);
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(minPdfFont);
    const indent=row.kind==='subcost'?.28:.08;
    const maxDesc=row.kind==='subcost'?contentW-1.72:contentW-1.48;
    const desc=doc.splitTextToSize(row.label||'',maxDesc);
    doc.text(desc,contentX+indent,y+.22,{lineHeightFactor:1.2});
    const shownAmount=row.amount||(['division','custom-division'].includes(row.kind)?'':'—');
    doc.text(shownAmount,pageW-right-.10,y+.22,{align:'right',maxWidth:1.15});
    return y+h;
  }
  function drawBasicSummaryPage(pageData,pageNum,totalPages){
    drawInteriorHeader(pageNum,totalPages);drawSummaryTitle('basic',pageData.cont);let y=1.95;
    const note=(p.summary?.basicNote||'').trim();
    if(note&&!pageData.cont){doc.setFont('helvetica','normal');doc.setFontSize(minPdfFont);setText(text);const lines=doc.splitTextToSize(note,contentW);doc.text(lines,contentX,y,{lineHeightFactor:1.25});y+=lines.length*.21+.16;}
    y=drawSummaryTableHeader(y);
    (pageData.rows||[]).forEach(row=>{y=drawSummaryDataRow(row,y);});
  }
  function drawAdvancedSummaryPage(pageData,pageNum,totalPages){
    drawInteriorHeader(pageNum,totalPages);drawSummaryTitle('advanced',pageData.cont);let y=1.95;y=drawSummaryTableHeader(y);
    (pageData.rows||[]).forEach(row=>{y=drawSummaryDataRow(row,y);});
  }

  const layout=buildLayout();
  const summaryPages=buildSummaryPages();
  const totalPages=1+layout.length+summaryPages.length;
  drawCover();
  layout.forEach((entries,idx)=>{
    doc.addPage('letter','portrait');const pageNum=idx+2;drawInteriorHeader(pageNum,totalPages);let y=topY;
    entries.forEach(entry=>{if(entry.type==='division')y=drawDivisionCard(entry,y);else if(entry.type==='simple')y=drawSimpleCard(entry,y);else if(entry.type==='selections')y=drawSelections(y);else if(entry.type==='closing')drawClosing(y);});
  });
  summaryPages.forEach((pageData,idx)=>{
    doc.addPage('letter','portrait');const pageNum=2+layout.length+idx;
    if(pageData.mode==='advanced')drawAdvancedSummaryPage(pageData,pageNum,totalPages);else drawBasicSummaryPage(pageData,pageNum,totalPages);
  });

  if(previewOnly)return doc;
  const safe=(p.projectName||'Scope').replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'');
  const versionSuffix=rev?`_${rev}`:'';
  doc.save(`${safe||'Scope'}_Proposal${versionSuffix}.pdf`);
  setSaveStatus("All changes saved");toast("PDF exported.");
}

function handleVersionDeleteRestore(){
  const p=getCurrentProject(); if(!p)return;
  const owner=state.currentProjectOwner||state.user.username;
  if(p.deletedByUser){ if(isAdmin())restoreVersion(p.id,owner); return; }
  softDeleteVersion(p.id,owner);
}

// Admin disclaimer library
function openAdminDialog(){if(!isAdmin())return toast("Admin access required.");if(state.currentProjectId)saveEditorProject();renderAdminDisclaimers();renderAdminUsers();populateOfficeSettings();$("#adminDialog").showModal();}
function closeAdminDialog(){$("#adminDialog").close();}
function activateAdminTab(name){$$('.admin-tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===name));$$('.admin-tab-panel').forEach(p=>p.classList.remove('active'));$(`#admin${name[0].toUpperCase()+name.slice(1)}Tab`).classList.add('active');}
function renderAdminDisclaimers(){const items=getDisclaimers(),list=$("#disclaimerList");list.innerHTML="";if(!state.adminDisclaimerId||!items.some(d=>d.id===state.adminDisclaimerId))state.adminDisclaimerId=items[0]?.id||null;items.forEach(d=>{const b=document.createElement('button');b.type='button';b.className=`disclaimer-list-item ${d.id===state.adminDisclaimerId?'active':''}`;b.dataset.disclaimerAdminId=d.id;b.innerHTML=`<strong>${esc(d.name)}</strong><span>${esc(d.text)}</span>`;list.appendChild(b);});$$('[data-disclaimer-admin-id]').forEach(b=>b.addEventListener('click',()=>{state.adminDisclaimerId=b.dataset.disclaimerAdminId;renderAdminDisclaimers();}));const d=items.find(x=>x.id===state.adminDisclaimerId);$("#disclaimerEditId").value=d?.id||"";$("#disclaimerEditName").value=d?.name||"";$("#disclaimerEditText").value=d?.text||"";$("#deleteDisclaimerBtn").disabled=items.length<=1||!d;}
function newDisclaimer(){state.adminDisclaimerId=null;$("#disclaimerEditId").value="";$("#disclaimerEditName").value="";$("#disclaimerEditText").value="";$$('.disclaimer-list-item').forEach(x=>x.classList.remove('active'));$("#deleteDisclaimerBtn").disabled=true;$("#disclaimerEditName").focus();}
function saveDisclaimerFromAdmin(){if(!isAdmin())return;const name=$("#disclaimerEditName").value.trim(),textValue=$("#disclaimerEditText").value.trim();if(!name||!textValue)return toast("Enter both a Terms & Conditions name and text.");let items=getDisclaimers(),id=$("#disclaimerEditId").value||uid(),idx=items.findIndex(d=>d.id===id);const item={id,name,text:textValue};if(idx>=0)items[idx]=item;else items.push(item);saveDisclaimers(items);state.adminDisclaimerId=id;renderAdminDisclaimers();refreshProjectDisclaimerAfterAdmin();toast("Terms & Conditions saved.");}
function deleteDisclaimerFromAdmin(){if(!isAdmin())return;let items=getDisclaimers();if(items.length<=1)return toast("Keep at least one Terms & Conditions version in the library.");const id=$("#disclaimerEditId").value;if(!id)return;const d=items.find(x=>x.id===id);if(!confirm(`Delete Terms & Conditions “${d?.name||'this disclaimer'}”?`))return;items=items.filter(x=>x.id!==id);saveDisclaimers(items);state.adminDisclaimerId=items[0]?.id||null;renderAdminDisclaimers();refreshProjectDisclaimerAfterAdmin();toast("Terms & Conditions deleted.");}
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
        disclaimers:Array.isArray(incoming.disclaimers)&&incoming.disclaimers.length?incoming.disclaimers:DEFAULT_DISCLAIMERS.map(x=>({...x})),
        officeSettings:normalizeOfficeSettings(incoming.officeSettings)
      };
    } else {
      merged=JSON.parse(JSON.stringify(current));
      Object.entries(incoming.users||{}).forEach(([key,u])=>{ if (!merged.users[key]) merged.users[key]=u; });
      Object.entries(incoming.projects||{}).forEach(([key,projects])=>{ merged.projects[key]=mergeProjectArrays(merged.projects[key]||[],Array.isArray(projects)?projects:[]); });
      merged.disclaimers=mergeDisclaimers(merged.disclaimers||[],incoming.disclaimers||[]);
      if(incoming.officeSettings){
        const currentOffices=normalizeOfficeSettings(merged.officeSettings), incomingOffices=normalizeOfficeSettings(incoming.officeSettings);
        Object.keys(currentOffices).forEach(k=>{
          ["address","phone"].forEach(field=>{ if((incomingOffices[k]?.[field]||"").trim()) currentOffices[k][field]=incomingOffices[k][field]; });
        });
        merged.officeSettings=currentOffices;
      }
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
$("#newProjectBtn").addEventListener("click",openNewProjectDialog);$("#emptyNewProjectBtn").addEventListener("click",openNewProjectDialog);$("#newProjectForm").addEventListener("submit",handleNewProject);$("#closeNewProjectDialog")?.addEventListener("click",()=>$("#newProjectDialog").close());$("#cancelNewProjectDialog")?.addEventListener("click",()=>$("#newProjectDialog").close());$("#newProjectDialog")?.addEventListener("click",e=>{if(e.target===$("#newProjectDialog"))$("#newProjectDialog").close();});$("#projectSearch").addEventListener("input",renderProjects);$("#projectSort").addEventListener("change",renderProjects);$$('.project-nav-btn').forEach(b=>b.addEventListener('click',()=>setDashboardMode(b.dataset.projectView)));$("#adminUserFilter").addEventListener("change",()=>{state.adminUserFilter=$("#adminUserFilter").value;renderProjects();});
$("#backToDashboard").addEventListener("click",()=>{saveEditorProject();enterDashboard();});$("#sidebarBack").addEventListener("click",()=>{saveEditorProject();enterDashboard();});$("#kickoffBackBtn").addEventListener("click",()=>enterDashboard());$("#exportPdfBtn").addEventListener("click",exportPdf);$("#deleteProjectBtn").addEventListener("click",handleVersionDeleteRestore);
$("#divisionSearch").addEventListener("input",filterDivisionNav);$("#expandAllBtn").addEventListener("click",()=>$$('.division-card').forEach(c=>c.classList.add('open')));$("#collapseAllBtn").addEventListener("click",()=>$$('.division-card').forEach(c=>c.classList.remove('open')));
$("#previewToggle").addEventListener("click",()=>togglePreview());$("#closePreviewBtn").addEventListener("click",()=>togglePreview(false));$$('.tab-btn').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
$("#projectTitleInline").addEventListener("input",()=>{scheduleSave();updatePreview();});$("#addPriceItemBtn").addEventListener("click",addPriceItem);
$("#summaryMode").addEventListener("change",()=>{const p=collectEditorProject();if(p)renderSummaryEditor(p);scheduleSave();updatePreview();});
$("#addTopCustomDivisionBtn")?.addEventListener("click",()=>addCustomAdvancedDivision("__start__"));
$("#addSummaryRowBtn").addEventListener("click",addAdvancedSummaryRow);
$("#advancedDivisionRows").addEventListener("click",e=>{
  const add=e.target.closest('.add-summary-subrow');
  if(add){const group=add.closest('.summary-division-group');if(group)addAdvancedDivisionSubRow(group.dataset.summaryDivision);return;}
  const insertCustom=e.target.closest('.insert-custom-summary-division');
  if(insertCustom){addCustomAdvancedDivision(insertCustom.dataset.afterDivision||'__start__');return;}
  const removeCustom=e.target.closest('.remove-custom-summary-division');
  if(removeCustom){removeCustom.closest('.summary-custom-division-row')?.remove();updateAdvancedSummaryTotals();scheduleSave();updatePreview();return;}
  const remove=e.target.closest('.remove-summary-subrow');
  if(remove){remove.closest('.summary-subrow')?.remove();updateAdvancedSummaryTotals();scheduleSave();updatePreview();}
});
$("#advancedDivisionRows").addEventListener("change",e=>{if(e.target.matches('.summary-division-visible')){updateAdvancedSummaryTotals();scheduleSave();updatePreview();}});
$("#advancedExtraRows").addEventListener("click",e=>{const b=e.target.closest('.remove-summary-row');if(!b)return;b.closest('.summary-extra-row')?.remove();updateAdvancedSummaryTotals();scheduleSave();updatePreview();});
$("#advancedExtraRows").addEventListener("change",e=>{if(e.target.matches('.summary-extra-type')){const row=e.target.closest('.summary-extra-row'),amt=$('.summary-extra-amount',row);amt.disabled=e.target.value==='subtotal';if(!amt.disabled)amt.value='';updateAdvancedSummaryTotals();scheduleSave();updatePreview();}});
$("#basicOverheadEnabled").addEventListener("change",e=>{const on=e.target.checked;$("#basicOverheadLabel").disabled=!on;$("#basicOverheadAmount").disabled=!on;updateBasicSummaryTotal();scheduleSave();updatePreview();});
const closeoutTab=$("#closeoutTab");
closeoutTab.addEventListener("input",e=>{if(e.target.matches('.rich-closeout-editor')){scheduleSave();updatePreview();}});
closeoutTab.addEventListener("paste",e=>{if(!e.target.matches('.rich-closeout-editor'))return;e.preventDefault();const text=e.clipboardData?.getData("text/plain")||"";document.execCommand("insertText",false,text);});
closeoutTab.addEventListener("mousedown",e=>{const btn=e.target.closest('.scope-format-btn');if(btn)e.preventDefault();});
closeoutTab.addEventListener("click",e=>{
  const btn=e.target.closest('.scope-format-btn');if(!btn)return;
  const card=btn.closest('.text-section-card'),editor=$('.rich-closeout-editor',card);
  if(!editor||editor.getAttribute('contenteditable')==='false')return;
  editor.focus();try{document.execCommand("styleWithCSS",false,false);}catch{}
  document.execCommand(btn.dataset.format,false,null);editor.dispatchEvent(new Event("input",{bubbles:true}));
});
$("#priceItems").addEventListener("click",e=>{const b=e.target.closest('.remove-price-item');if(!b)return;const row=b.closest('.price-item-row');row.remove();const base=$('.base-bid-row');if(base)base.classList.toggle('has-alternates',$$('.price-item-row:not(.base-bid-row)').length>0);$("#emptyPriceItems").classList.toggle("hidden",$$('.price-item-row').length>0);scheduleSave();updatePreview();});
$("#projectDisclaimerSelect").addEventListener("change",()=>{updateSelectedDisclaimerPreview();scheduleSave();updatePreview();});
document.addEventListener("input",e=>{
  if(e.target.matches('[data-field],[data-company],[data-office-setting],.price-item-input,#basicSummaryNote,.basic-summary-label,.basic-summary-amount,#basicOverheadLabel,#basicOverheadAmount,.summary-division-amount,.summary-sub-label,.summary-sub-amount,.summary-custom-label,.summary-custom-amount,.summary-extra-label,.summary-extra-amount')){
    if(e.target.matches('.basic-summary-amount,#basicOverheadAmount'))updateBasicSummaryTotal();
    if(e.target.matches('.summary-division-amount,.summary-sub-amount,.summary-custom-amount,.summary-extra-amount'))updateAdvancedSummaryTotals();
    if(e.target.matches('[data-office-setting]'))collectAndSaveOfficeSettings();
    scheduleSave();updatePreview();
  }
});
document.addEventListener("change",e=>{if(e.target.matches('[data-section-enabled],[data-company],[data-field],[data-office-setting]')){if(e.target.matches('[data-office-setting]'))collectAndSaveOfficeSettings();scheduleSave();updatePreview();}});
document.addEventListener('click',e=>{if(!e.target.closest('.project-card-actions'))$$('.project-menu').forEach(x=>x.classList.add('hidden'));});
window.addEventListener('beforeunload',()=>{if(state.currentProjectId)saveEditorProject();});

updateAuthMode();readDataStore();restoreSession();
