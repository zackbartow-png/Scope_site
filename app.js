const CSI_DIVISIONS = [
  ["00", "Procurement and Contracting Requirements"],
  ["01", "General Requirements"],
  ["02", "Existing Conditions"],
  ["03", "Concrete"],
  ["04", "Masonry"],
  ["05", "Metals"],
  ["06", "Wood, Plastics, and Composites"],
  ["07", "Thermal and Moisture Protection"],
  ["08", "Openings"],
  ["09", "Finishes"],
  ["10", "Specialties"],
  ["11", "Equipment"],
  ["12", "Furnishings"],
  ["13", "Special Construction"],
  ["14", "Conveying Equipment"],
  ["21", "Fire Suppression"],
  ["22", "Plumbing"],
  ["23", "Heating, Ventilating, and Air Conditioning (HVAC)"],
  ["25", "Integrated Automation"],
  ["26", "Electrical"],
  ["27", "Communications"],
  ["28", "Electronic Safety and Security"],
  ["31", "Earthwork"],
  ["32", "Exterior Improvements"],
  ["33", "Utilities"],
  ["34", "Transportation"],
  ["35", "Waterway and Marine Construction"],
  ["40", "Process Integration"],
  ["41", "Material Processing and Handling Equipment"],
  ["42", "Process Heating, Cooling, and Drying Equipment"],
  ["43", "Process Gas and Liquid Handling, Purification, and Storage Equipment"],
  ["44", "Pollution and Waste Control Equipment"],
  ["45", "Industry-Specific Manufacturing Equipment"],
  ["46", "Water and Wastewater Equipment"],
  ["48", "Electrical Power Generation"]
];

const DEFAULT_COMPANY = {
  companyName: "Koehn Construction Services",
  address: "PO Box 420 · 1111 N 2nd\nFredonia, Kansas 66736",
  phone: "866.943.7751",
  fax: "620.378.2283",
  email: "",
  website: "koehncs.com",
  orange: "#f36f21",
  charcoal: "#55575a"
};

const state = {
  user: null,
  currentProjectId: null,
  authMode: "login",
  saveTimer: null,
  previewOpen: true
};

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function nowIso() { return new Date().toISOString(); }
function fmtDate(iso) { if (!iso) return "—"; const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : "")); return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}); }
function fmtTime(iso) { if (!iso) return ""; return new Date(iso).toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}); }
function esc(s="") { return s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

function userKey(username) { return `ksb:user:${username.toLowerCase()}`; }
function projectsKey(username) { return `ksb:projects:${username.toLowerCase()}`; }
function sessionKey() { return "ksb:session"; }

function getProjects() {
  if (!state.user) return [];
  try { return JSON.parse(localStorage.getItem(projectsKey(state.user.username)) || "[]"); } catch { return []; }
}
function saveProjects(projects) { localStorage.setItem(projectsKey(state.user.username), JSON.stringify(projects)); }
function getCurrentProject() { return getProjects().find(p => p.id === state.currentProjectId) || null; }
function putProject(project) {
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
  return {
    id: uid(), createdAt: nowIso(), updatedAt: nowIso(),
    projectName: name, projectNumber, clientName: client, attention: "", projectAddress: "",
    proposalDate: dateValue, revision: "Original", preparedBy: "", documentTitle: "Scope of Work", introNote: "",
    clarifications: "", exclusions: "", alternates: "",
    sectionEnabled: { clarifications: true, exclusions: true, alternates: true },
    divisions, company: {...DEFAULT_COMPANY}
  };
}

function toast(msg) {
  const el = $("#toast"); el.textContent = msg; el.classList.add("show");
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove("show"), 2200);
}

function setSaveStatus(text) { $("#saveStatus").textContent = text; }
function scheduleSave() {
  setSaveStatus("Saving…");
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => { saveEditorProject(); setSaveStatus("All changes saved"); }, 450);
}

function showAuth() { $("#authView").classList.remove("hidden"); $("#appView").classList.add("hidden"); }
function showApp() { $("#authView").classList.add("hidden"); $("#appView").classList.remove("hidden"); }

function updateAuthMode() {
  const register = state.authMode === "register";
  $("#authTitle").textContent = register ? "Create account" : "Sign in";
  $("#authSubtitle").textContent = register ? "Create a local prototype account for this browser." : "Continue working on saved scope packages.";
  $("#authSubmit").textContent = register ? "Create account" : "Sign in";
  $("#toggleAuthMode").textContent = register ? "Already have an account? Sign in" : "Create an account";
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const username = $("#authUsername").value.trim();
  const password = $("#authPassword").value;
  if (!username || !password) return;
  const hash = await hashPassword(password);
  const key = userKey(username);
  if (state.authMode === "register") {
    if (localStorage.getItem(key)) return toast("That username already exists in this browser.");
    const record = { username, passwordHash: hash, createdAt: nowIso() };
    localStorage.setItem(key, JSON.stringify(record));
    localStorage.setItem(sessionKey(), username);
    state.user = record;
    enterDashboard();
  } else {
    const raw = localStorage.getItem(key);
    if (!raw) return toast("Username not found in this browser.");
    const record = JSON.parse(raw);
    if (record.passwordHash !== hash) return toast("Incorrect password.");
    localStorage.setItem(sessionKey(), username);
    state.user = record;
    enterDashboard();
  }
}

function restoreSession() {
  const username = localStorage.getItem(sessionKey());
  if (!username) return showAuth();
  const raw = localStorage.getItem(userKey(username));
  if (!raw) return showAuth();
  state.user = JSON.parse(raw);
  enterDashboard();
}

function enterDashboard() {
  showApp();
  state.currentProjectId = null;
  $("#dashboardView").classList.remove("hidden");
  $("#editorView").classList.add("hidden");
  $("#backToDashboard").classList.add("hidden");
  $("#exportPdfBtn").classList.add("hidden");
  $("#avatarInitial").textContent = state.user.username.slice(0,1).toUpperCase();
  $("#userDisplayName").textContent = state.user.username;
  renderProjects();
}

function renderProjects() {
  const q = $("#projectSearch").value.trim().toLowerCase();
  const sort = $("#projectSort").value;
  let projects = getProjects().filter(p => [p.projectName,p.clientName,p.projectNumber].join(" ").toLowerCase().includes(q));
  projects.sort((a,b)=> {
    if (sort === "name") return a.projectName.localeCompare(b.projectName);
    if (sort === "client") return (a.clientName||"").localeCompare(b.clientName||"");
    return new Date(b.updatedAt)-new Date(a.updatedAt);
  });
  const grid = $("#projectsGrid"); grid.innerHTML = "";
  $("#emptyProjects").classList.toggle("hidden", projects.length > 0 || q.length > 0);
  if (!projects.length && q) grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>No matching projects</h3><p>Try a different project, client, or project number.</p></div>`;
  projects.forEach(p => {
    const used = Object.values(p.divisions||{}).filter(d=>d.enabled && d.text.trim()).length;
    const card = document.createElement("article");
    card.className = "project-card";
    card.innerHTML = `
      <div class="project-card-head">
        <div>
          <div class="project-number">${esc(p.projectNumber || "No project number")}</div>
          <h3>${esc(p.projectName || "Untitled Project")}</h3>
          <div class="project-client">${esc(p.clientName || "No client entered")}</div>
        </div>
        <button class="project-open" data-open-project="${p.id}">Open →</button>
      </div>
      <div class="project-meta"><span>${used} divisions used</span><span>Updated ${esc(fmtTime(p.updatedAt))}</span></div>`;
    grid.appendChild(card);
  });
  $$('[data-open-project]').forEach(b=>b.addEventListener('click',()=>openProject(b.dataset.openProject)));
}

function openNewProjectDialog() {
  $("#newProjectName").value = ""; $("#newClientName").value = ""; $("#newProjectNumber").value = "";
  $("#newProjectDialog").showModal(); setTimeout(()=>$("#newProjectName").focus(),100);
}

function handleNewProject(e) {
  e.preventDefault();
  if (e.submitter && e.submitter.value === "cancel") { $("#newProjectDialog").close(); return; }
  const name = $("#newProjectName").value.trim();
  if (!name) return;
  const p = makeProject(name, $("#newClientName").value.trim(), $("#newProjectNumber").value.trim());
  putProject(p); $("#newProjectDialog").close(); openProject(p.id);
}

function openProject(id) {
  state.currentProjectId = id;
  const p = getCurrentProject(); if (!p) return enterDashboard();
  $("#dashboardView").classList.add("hidden");
  $("#editorView").classList.remove("hidden");
  $("#backToDashboard").classList.remove("hidden");
  $("#exportPdfBtn").classList.remove("hidden");
  $("#projectTitleInline").value = p.projectName;
  $("#sidebarProjectName").textContent = p.projectName;
  renderDivisionUI(p);
  populateEditor(p);
  updatePreview();
  activateTab("info");
}

function renderDivisionUI(p) {
  const cards = $("#divisionCards"), nav = $("#divisionNav");
  cards.innerHTML = ""; nav.innerHTML = "";
  CSI_DIVISIONS.forEach(([n,t]) => {
    const d = p.divisions[n] || {number:n,title:t,enabled:false,text:""};
    const card = document.createElement("article");
    card.className = `division-card ${d.enabled?'enabled':''}`;
    card.dataset.division = n;
    card.innerHTML = `
      <div class="division-card-header">
        <div class="div-badge">${n}</div>
        <div><div class="div-title">Division ${n} – ${esc(t)}</div><div class="div-sub">${d.text.trim()?`${d.text.trim().split(/\n/).length} scope lines entered`:'No scope entered'}</div></div>
        <label class="switch-label"><input type="checkbox" class="division-enabled" ${d.enabled?'checked':''}><span class="switch"></span>Include</label>
        <button class="division-expand" aria-label="Expand division">⌄</button>
      </div>
      <div class="division-body">
        <textarea class="division-text" placeholder="Paste or type Division ${n} scope here…">${esc(d.text)}</textarea>
        <div class="paste-helper"><span>Tip: one line per scope item works best in PDF output.</span><span>Auto-saved</span></div>
      </div>`;
    cards.appendChild(card);

    const navBtn = document.createElement("button");
    navBtn.className = "division-nav-item"; navBtn.dataset.navDivision = n;
    navBtn.innerHTML = `<span class="division-nav-number">${n}</span><span>${esc(t)}</span><span class="division-nav-dot ${d.text.trim()?'used':''}"></span>`;
    nav.appendChild(navBtn);
  });
  $$(".division-card-header", cards).forEach(h => h.addEventListener("click", e => {
    if (e.target.closest(".switch-label")) return;
    h.closest(".division-card").classList.toggle("open");
  }));
  $$(".division-enabled", cards).forEach(cb => cb.addEventListener("change", e => {
    const card = e.target.closest(".division-card"); card.classList.toggle("enabled", e.target.checked); if (e.target.checked) card.classList.add("open"); scheduleSave(); updatePreview();
  }));
  $$(".division-text", cards).forEach(ta => ta.addEventListener("input", e => {
    const card = e.target.closest(".division-card");
    const sub = $(".div-sub", card); sub.textContent = e.target.value.trim() ? `${e.target.value.trim().split(/\n/).length} scope lines entered` : "No scope entered";
    $(`[data-nav-division="${card.dataset.division}"] .division-nav-dot`).classList.toggle("used", !!e.target.value.trim());
    scheduleSave(); updatePreview();
  }));
  $$('[data-nav-division]').forEach(btn=>btn.addEventListener('click',()=>{
    activateTab("scope");
    const card = $(`[data-division="${btn.dataset.navDivision}"]`); card.classList.add('open'); card.scrollIntoView({behavior:'smooth',block:'center'});
  }));
  filterDivisionNav();
}

function populateEditor(p) {
  $$('[data-field]').forEach(el => { const k = el.dataset.field; el.value = p[k] ?? ""; });
  $$('[data-company]').forEach(el => { const k = el.dataset.company; el.value = p.company?.[k] ?? DEFAULT_COMPANY[k] ?? ""; });
  $$('[data-section-enabled]').forEach(el => el.checked = p.sectionEnabled?.[el.dataset.sectionEnabled] !== false);
}

function collectEditorProject() {
  const p = getCurrentProject(); if (!p) return null;
  $$('[data-field]').forEach(el => p[el.dataset.field] = el.value);
  p.projectName = $("#projectTitleInline").value.trim() || "Untitled Project";
  p.company = p.company || {...DEFAULT_COMPANY};
  $$('[data-company]').forEach(el => p.company[el.dataset.company] = el.value);
  p.sectionEnabled = p.sectionEnabled || {};
  $$('[data-section-enabled]').forEach(el => p.sectionEnabled[el.dataset.sectionEnabled] = el.checked);
  $$('.division-card').forEach(card => {
    const n = card.dataset.division;
    p.divisions[n] = p.divisions[n] || {number:n,title:CSI_DIVISIONS.find(x=>x[0]===n)[1]};
    p.divisions[n].enabled = $('.division-enabled',card).checked;
    p.divisions[n].text = $('.division-text',card).value;
  });
  return p;
}

function saveEditorProject() {
  const p = collectEditorProject(); if (!p) return;
  putProject(p);
  $("#sidebarProjectName").textContent = p.projectName;
}

function activateTab(name) {
  $$('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  $$('.tab-panel').forEach(p=>p.classList.remove('active'));
  $(`#${name}Tab`).classList.add('active');
}

function filterDivisionNav() {
  const q = $("#divisionSearch").value.trim().toLowerCase();
  $$('[data-nav-division]').forEach(btn => btn.classList.toggle('hidden', !btn.textContent.toLowerCase().includes(q)));
}

function updatePreview() {
  const p = collectEditorProject(); if (!p) return;
  document.documentElement.style.setProperty('--orange', p.company.orange || DEFAULT_COMPANY.orange);
  document.documentElement.style.setProperty('--charcoal', p.company.charcoal || DEFAULT_COMPANY.charcoal);
  $("#previewDocTitle").textContent = p.documentTitle || "Scope of Work";
  $("#previewProjectNo").textContent = p.projectNumber || "PROJECT";
  $("#previewProjectName").textContent = p.projectName || "Untitled Project";
  $("#previewDate").textContent = fmtDate(p.proposalDate);
  $("#previewClient").textContent = p.clientName || "—";
  $("#previewPrepared").textContent = p.preparedBy || "—";
  const body = $("#previewBody"); body.innerHTML = "";
  if (p.introNote.trim()) body.insertAdjacentHTML('beforeend', `<div class="preview-intro">${esc(p.introNote)}</div>`);
  const active = CSI_DIVISIONS.map(([n])=>p.divisions[n]).filter(d=>d?.enabled && d.text.trim());
  active.slice(0,6).forEach(d=> body.insertAdjacentHTML('beforeend', `<section class="preview-section"><div class="preview-section-title">Division ${d.number} · ${esc(d.title)}</div><p>${esc(d.text)}</p></section>`));
  if (active.length > 6) body.insertAdjacentHTML('beforeend', `<div style="margin-top:7px;color:#999">+ ${active.length-6} more divisions on following pages</div>`);
  const extra = [["Clarifications",p.clarifications,p.sectionEnabled.clarifications],["Exclusions",p.exclusions,p.sectionEnabled.exclusions],["Alternates",p.alternates,p.sectionEnabled.alternates]].filter(x=>x[2]&&x[1].trim());
  extra.slice(0,1).forEach(([t,text])=>body.insertAdjacentHTML('beforeend', `<section class="preview-section"><div class="preview-section-title">${t}</div><p>${esc(text)}</p></section>`));
  $("#previewFooterContact").innerHTML = `${esc(p.company.address||'').replace(/\n/g,'<br>')}<br><strong>P</strong> ${esc(p.company.phone||'')} ${p.company.fax?` · <strong>F</strong> ${esc(p.company.fax)}`:''}<br><strong>${esc(p.company.website||'')}</strong>`;
}

function togglePreview(open) {
  state.previewOpen = open ?? !state.previewOpen;
  $("#previewPane").classList.toggle("closed", !state.previewOpen);
  if (window.innerWidth > 1180) $("#previewPane").classList.toggle("hidden", !state.previewOpen);
  $("#previewToggle").textContent = state.previewOpen ? "Hide Preview" : "PDF Preview";
}

async function imageToDataUrl(src) {
  const img = new Image(); img.crossOrigin = "anonymous";
  return new Promise((resolve,reject)=>{ img.onload=()=>{ const c=document.createElement('canvas'); c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0); resolve(c.toDataURL('image/png')); }; img.onerror=reject; img.src=src; });
}

function parseScopeLines(text) {
  return text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>{
    const cleaned = s.replace(/^[-•▪◦*]\s*/, "");
    return { bullet: cleaned !== s || /^\d+[.)]\s/.test(s), text: cleaned };
  });
}

async function exportPdf() {
  saveEditorProject();
  const p = getCurrentProject(); if (!p) return;
  if (!window.jspdf) return toast("PDF library did not load. Check your internet connection and try again.");
  setSaveStatus("Building PDF…");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"in", format:"letter", orientation:"portrait", compress:true });
  const orange = hexToRgb(p.company.orange || DEFAULT_COMPANY.orange);
  const charcoal = hexToRgb(p.company.charcoal || DEFAULT_COMPANY.charcoal);
  const lightGray = [244,244,244], text = [52,54,57], muted = [120,123,127];
  const pageW = 8.5, pageH = 11, left = .72, right = .72, contentW = pageW-left-right;
  let y = 1.62, page = 1;
  let logoData = null, bandData = null;
  try { [logoData,bandData] = await Promise.all([imageToDataUrl('assets/koehn-logo.png'),imageToDataUrl('assets/triangle-band.png')]); } catch {}

  function addHeader(first=false) {
    if (logoData) doc.addImage(logoData,'PNG',left,.48,2.16,.48,undefined,'FAST');
    doc.setTextColor(...charcoal); doc.setFont('helvetica','bold'); doc.setFontSize(10.5);
    doc.text((p.documentTitle||'Scope of Work').toUpperCase(), pageW-right, .62,{align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(6.6); doc.setTextColor(...muted);
    doc.text((p.projectNumber||'PROJECT').toUpperCase(), pageW-right, .78,{align:'right'});
    doc.setDrawColor(...orange); doc.setLineWidth(.025); doc.line(left,1.03,left+1.72,1.03);
    doc.setDrawColor(...charcoal); doc.line(left+1.72,1.03,pageW-right,1.03);
    if (first) {
      doc.setTextColor(...muted); doc.setFontSize(6.5); doc.setFont('helvetica','bold');
      doc.text('PROJECT',left,1.25); doc.text('DATE',5.75,1.25); doc.text('CLIENT',left,1.48); doc.text('PREPARED BY',5.75,1.48);
      doc.setTextColor(...text); doc.setFontSize(8.5);
      doc.text(p.projectName||'Untitled Project',left,1.36,{maxWidth:4.65}); doc.text(fmtDate(p.proposalDate),5.75,1.36);
      doc.text(p.clientName||'—',left,1.59,{maxWidth:4.65}); doc.text(p.preparedBy||'—',5.75,1.59,{maxWidth:2.0});
    }
  }
  function addFooter() {
    const footerY = 10.48;
    doc.setFont('helvetica','normal'); doc.setFontSize(6.4); doc.setTextColor(...muted);
    const addr = (p.company.address||'').split(/\n/).join(' · ');
    const footer = `${addr}   P ${p.company.phone||''}${p.company.fax?`   F ${p.company.fax}`:''}   ${p.company.website||''}`;
    doc.text(footer,left,footerY,{maxWidth:6.4});
    doc.setFont('helvetica','bold'); doc.setTextColor(...orange); doc.text(`PAGE ${page}`,pageW-right,footerY,{align:'right'});
    if (bandData) doc.addImage(bandData,'PNG',0,10.67,8.5,.33,undefined,'FAST');
  }
  function newPage() { addFooter(); doc.addPage('letter','portrait'); page++; y=1.28; addHeader(false); }
  function ensure(h) { if (y + h > 10.22) newPage(); }
  function drawSectionHeading(title, number=null) {
    ensure(.36); doc.setFillColor(...lightGray); doc.rect(left,y,contentW,.27,'F'); doc.setFillColor(...orange); doc.rect(left,y,.045,.27,'F');
    doc.setTextColor(...charcoal); doc.setFont('helvetica','bold'); doc.setFontSize(8.4);
    doc.text(number ? `DIVISION ${number}  ·  ${title.toUpperCase()}` : title.toUpperCase(), left+.12, y+.18);
    y += .36;
  }
  function drawLines(textValue) {
    const lines = parseScopeLines(textValue);
    doc.setFont('helvetica','normal'); doc.setTextColor(...text); doc.setFontSize(8.1);
    for (const item of lines) {
      const prefixX = left+.08, textX = left+.22;
      const wrapped = doc.splitTextToSize(item.text, contentW-.28);
      const lineH = .155, h = wrapped.length*lineH + .045;
      ensure(h);
      if (item.bullet) { doc.setFillColor(...orange); doc.circle(prefixX,y+.055,.018,'F'); }
      doc.text(wrapped,item.bullet?textX:left+.08,y+.07,{baseline:'top'});
      y += h;
    }
    y += .05;
  }

  addHeader(true);
  y = 1.83;
  if (p.projectAddress.trim() || p.attention.trim() || p.revision.trim()) {
    doc.setFont('helvetica','normal'); doc.setFontSize(7.2); doc.setTextColor(...muted);
    let meta = [];
    if (p.attention.trim()) meta.push(`ATTN: ${p.attention.trim()}`);
    if (p.projectAddress.trim()) meta.push(p.projectAddress.trim().replace(/\n/g,', '));
    if (p.revision.trim()) meta.push(`REVISION: ${p.revision.trim()}`);
    doc.text(meta.join('   •   '),left,y,{maxWidth:contentW}); y += .22;
  }
  if (p.introNote.trim()) {
    const wrapped = doc.splitTextToSize(p.introNote.trim(),contentW);
    ensure(wrapped.length*.16+.15); doc.setFont('helvetica','normal'); doc.setFontSize(8.2); doc.setTextColor(...text);
    doc.text(wrapped,left,y); y += wrapped.length*.16+.18;
  }

  const active = CSI_DIVISIONS.map(([n])=>p.divisions[n]).filter(d=>d?.enabled && d.text.trim());
  active.forEach(d=>{ drawSectionHeading(d.title,d.number); drawLines(d.text); });

  const extras = [
    ["Clarifications",p.clarifications,p.sectionEnabled?.clarifications],
    ["Exclusions",p.exclusions,p.sectionEnabled?.exclusions],
    ["Alternates",p.alternates,p.sectionEnabled?.alternates]
  ].filter(([,txt,on])=>on && txt.trim());
  extras.forEach(([title,txt])=>{ drawSectionHeading(title); drawLines(txt); });

  if (!active.length && !extras.length && !p.introNote.trim()) {
    doc.setFont('helvetica','italic'); doc.setTextColor(...muted); doc.setFontSize(9); doc.text('No scope content has been entered yet.',left,y);
  }
  addFooter();
  const safe = (p.projectName||'Scope').replace(/[^a-z0-9]+/gi,'_').replace(/^_+|_+$/g,'');
  doc.save(`${safe || 'Scope'}_${(p.documentTitle||'Scope_of_Work').replace(/[^a-z0-9]+/gi,'_')}.pdf`);
  setSaveStatus("All changes saved"); toast("PDF exported.");
}

function hexToRgb(hex) { const h=hex.replace('#',''); const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16); return [(n>>16)&255,(n>>8)&255,n&255]; }

function deleteCurrentProject() {
  const p = getCurrentProject(); if (!p) return;
  if (!confirm(`Delete “${p.projectName}”? This cannot be undone in this prototype.`)) return;
  saveProjects(getProjects().filter(x=>x.id!==p.id)); enterDashboard(); toast("Project deleted.");
}

// Event wiring
$("#authForm").addEventListener("submit",handleAuthSubmit);
$("#toggleAuthMode").addEventListener("click",()=>{ state.authMode = state.authMode==='login'?'register':'login'; updateAuthMode(); });
$("#logoutBtn").addEventListener("click",()=>{ localStorage.removeItem(sessionKey()); state.user=null; $("#userMenuPopover").classList.add('hidden'); showAuth(); });
$("#userMenuBtn").addEventListener("click",()=>$("#userMenuPopover").classList.toggle('hidden'));
$("#newProjectBtn").addEventListener("click",openNewProjectDialog);
$("#emptyNewProjectBtn").addEventListener("click",openNewProjectDialog);
$("#newProjectForm").addEventListener("submit",handleNewProject);
$("#projectSearch").addEventListener("input",renderProjects);
$("#projectSort").addEventListener("change",renderProjects);
$("#backToDashboard").addEventListener("click",()=>{ saveEditorProject(); enterDashboard(); });
$("#sidebarBack").addEventListener("click",()=>{ saveEditorProject(); enterDashboard(); });
$("#exportPdfBtn").addEventListener("click",exportPdf);
$("#deleteProjectBtn").addEventListener("click",deleteCurrentProject);
$("#divisionSearch").addEventListener("input",filterDivisionNav);
$("#expandAllBtn").addEventListener("click",()=>$$('.division-card').forEach(c=>c.classList.add('open')));
$("#collapseAllBtn").addEventListener("click",()=>$$('.division-card').forEach(c=>c.classList.remove('open')));
$("#previewToggle").addEventListener("click",()=>togglePreview());
$("#closePreviewBtn").addEventListener("click",()=>togglePreview(false));
$$('.tab-btn').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
$("#projectTitleInline").addEventListener("input",()=>{ scheduleSave(); updatePreview(); });
document.addEventListener("input",e=>{ if (e.target.matches('[data-field],[data-company]')) { scheduleSave(); updatePreview(); } });
document.addEventListener("change",e=>{ if (e.target.matches('[data-section-enabled],[data-company]')) { scheduleSave(); updatePreview(); } });
window.addEventListener('beforeunload',()=>{ if(state.currentProjectId) saveEditorProject(); });

updateAuthMode();
restoreSession();
