(() => {
  // Kickoff-only project information additions. These fields do not touch Proposal data.
  if (typeof buildKickoffPdf !== 'function') {
    console.warn('Kickoff project info fields skipped: buildKickoffPdf is unavailable.');
    return;
  }

  const targetGpInput = document.querySelector('[data-kickoff-info="targetGP"]');
  const targetGpLabel = targetGpInput?.closest('label');

  if (targetGpLabel && !document.querySelector('[data-kickoff-info="contingencyPercent"]')) {
    const contingencyLabel = document.createElement('label');
    contingencyLabel.className = 'kickoff-contingency-field';
    contingencyLabel.innerHTML = 'Contingency %<input data-kickoff-info="contingencyPercent" inputmode="decimal" maxlength="5" placeholder="0" aria-label="Contingency percent" />';
    targetGpLabel.insertAdjacentElement('afterend', contingencyLabel);

    const permitLabel = document.createElement('label');
    permitLabel.className = 'full kickoff-permitting-field';
    permitLabel.innerHTML = 'Permitting, Inspections &amp; Testing<textarea data-kickoff-info="permittingInspectionsTesting" rows="4" placeholder="Enter permitting requirements, inspections, testing, fees, responsibilities, or other related notes."></textarea>';
    contingencyLabel.insertAdjacentElement('afterend', permitLabel);
  }

  const style = document.createElement('style');
  style.textContent = `
    .kickoff-contingency-field input{max-width:76px;justify-self:start;text-align:right}
    .kickoff-permitting-field textarea{min-height:104px}
  `;
  document.head.appendChild(style);

  const contingencyInput = document.querySelector('[data-kickoff-info="contingencyPercent"]');
  const permittingInput = document.querySelector('[data-kickoff-info="permittingInspectionsTesting"]');

  function sanitizeContingencyPercent(value) {
    let raw = String(value ?? '').replace(/[^0-9.]/g, '');
    if (!raw) return '';
    const dot = raw.indexOf('.');
    if (dot < 0) return raw.slice(0, 2);
    let whole = raw.slice(0, dot).slice(0, 2);
    const decimals = raw.slice(dot + 1).replace(/\./g, '').slice(0, 2);
    if (!whole) whole = '0';
    return `${whole}.${decimals}`;
  }

  if (contingencyInput && contingencyInput.dataset.kickoffExtraWired !== 'true') {
    contingencyInput.dataset.kickoffExtraWired = 'true';
    contingencyInput.addEventListener('input', () => {
      const cleaned = sanitizeContingencyPercent(contingencyInput.value);
      if (contingencyInput.value !== cleaned) contingencyInput.value = cleaned;
      if (typeof scheduleKickoffSave === 'function') scheduleKickoffSave();
    });
    contingencyInput.addEventListener('change', () => {
      const cleaned = sanitizeContingencyPercent(contingencyInput.value).replace(/\.$/, '');
      if (contingencyInput.value !== cleaned) contingencyInput.value = cleaned;
      if (typeof saveKickoffInfoFromForm === 'function') saveKickoffInfoFromForm();
      if (typeof scheduleKickoffPdfPreview === 'function') scheduleKickoffPdfPreview(120);
    });
  }

  if (permittingInput && permittingInput.dataset.kickoffExtraWired !== 'true') {
    permittingInput.dataset.kickoffExtraWired = 'true';
    permittingInput.addEventListener('input', () => {
      if (typeof scheduleKickoffSave === 'function') scheduleKickoffSave();
    });
    permittingInput.addEventListener('change', () => {
      if (typeof saveKickoffInfoFromForm === 'function') saveKickoffInfoFromForm();
      if (typeof scheduleKickoffPdfPreview === 'function') scheduleKickoffPdfPreview(120);
    });
  }

  // If a kickoff is already open when this patch loads, populate the two new fields.
  try {
    const info = typeof getCurrentKickoffProject === 'function'
      ? (getCurrentKickoffProject()?.kickoff?.projectInfo || {})
      : {};
    if (contingencyInput) contingencyInput.value = sanitizeContingencyPercent(info.contingencyPercent).replace(/\.$/, '');
    if (permittingInput) permittingInput.value = info.permittingInspectionsTesting || '';
  } catch {}

  // Carry the fields into the Kickoff PDF only.
  let source = buildKickoffPdf.toString();
  let replacements = 0;

  const replaceOnce = (find, replacement, label) => {
    if (!source.includes(find)) {
      console.warn(`Kickoff project info PDF patch could not find: ${label}`);
      return;
    }
    source = source.replace(find, replacement);
    replacements += 1;
  };

  const oldSummaryRow = "[['Target GP',info.targetGP],['Preliminary Schedule',`${info.startDate?fmtDate(info.startDate):'—'} – ${info.endDate?fmtDate(info.endDate):'—'}`]]";
  const newSummaryRows = "[['Target GP',info.targetGP],['Contingency %',String(info.contingencyPercent||'').trim()?sanitizeContingencyPercent(info.contingencyPercent).replace(/\\.$/,'')+'%':'']],[['Start Date',info.startDate?fmtDate(info.startDate):'—'],['End Date',info.endDate?fmtDate(info.endDate):'—']]";
  replaceOnce(oldSummaryRow, newSummaryRows, 'target GP / schedule row');

  replaceOnce(
    "  y=drawSection(y,'Owner Contacts',info.ownerContacts||'');",
    "  if(String(info.permittingInspectionsTesting||'').trim())y=drawSection(y,'Permitting, Inspections & Testing',info.permittingInspectionsTesting||'');\n  y=drawSection(y,'Owner Contacts',info.ownerContacts||'');",
    'permitting section placement'
  );

  if (replacements === 2) {
    try {
      const patchedBuildKickoffPdf = eval(`(${source})`);
      buildKickoffPdf = patchedBuildKickoffPdf;
      window.buildKickoffPdf = patchedBuildKickoffPdf;
      if (typeof scheduleKickoffPdfPreview === 'function' && typeof state !== 'undefined' && state.currentKickoffProjectId) {
        scheduleKickoffPdfPreview(80);
      }
    } catch (error) {
      console.error('Kickoff project info PDF patch failed.', error);
    }
  } else {
    console.warn(`Kickoff project info PDF patch not applied. Expected 2 replacements; found ${replacements}.`);
  }
})();
