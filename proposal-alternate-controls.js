(() => {
  // Proposal-only controls for alternate section naming, wrapped alternate titles,
  // and optional Base Bid display for unit-price proposals.
  const DEFAULT_ALTERNATE_SECTION_TITLE = 'Alternates';

  const style = document.createElement('style');
  style.textContent = `
    .alternate-section-title-control{
      display:flex;align-items:center;gap:9px;margin-top:10px;max-width:520px;
      color:#62676b;font-size:11px;font-weight:600;
    }
    .alternate-section-title-control span{white-space:nowrap}
    .alternate-section-title-input{
      width:min(340px,100%);min-width:180px;padding:8px 10px;border:1px solid #d7dadd;
      border-radius:8px;background:#fff;color:#24292d;font:600 12px/1.2 Inter,sans-serif;
    }
    .alternate-scope-card-head>div:nth-child(2){min-width:0}
    textarea.alternate-title-input{
      width:100%!important;box-sizing:border-box!important;min-height:37px!important;height:auto!important;
      max-height:118px;overflow-y:auto;resize:none;white-space:pre-wrap;overflow-wrap:anywhere;
      line-height:1.25!important;padding-top:8px!important;padding-bottom:8px!important;
    }
    .proposal-base-bid-toggle{margin-left:auto;flex:0 0 auto}
    .proposal-base-bid-toggle .proposal-toggle-copy{display:flex;flex-direction:column;gap:1px}
    .proposal-base-bid-toggle .proposal-toggle-copy strong{font-size:11px;color:#3f4549}
    .proposal-base-bid-toggle .proposal-toggle-copy span{font-size:9px;color:#858a8e;font-weight:500}
    @media (max-width:760px){
      .alternate-section-title-control{align-items:flex-start;flex-direction:column}
      .alternate-section-title-input{width:100%;min-width:0}
      .proposal-base-bid-toggle{margin-left:0}
    }
  `;
  document.head.appendChild(style);

  function applyProposalOptionDefaults(project) {
    if (!project) return project;
    const title = String(project.alternateSectionTitle || '').trim();
    project.alternateSectionTitle = title || DEFAULT_ALTERNATE_SECTION_TITLE;
    if (!Object.prototype.hasOwnProperty.call(project, 'showBaseBid')) project.showBaseBid = true;
    return project;
  }

  if (typeof normalizeProject === 'function' && !normalizeProject.__proposalAlternateOptionsWrapped) {
    const originalNormalizeProject = normalizeProject;
    const wrappedNormalizeProject = function(project, ownerUsername = '') {
      return applyProposalOptionDefaults(originalNormalizeProject.apply(this, arguments));
    };
    wrappedNormalizeProject.__proposalAlternateOptionsWrapped = true;
    normalizeProject = wrappedNormalizeProject;
    window.normalizeProject = wrappedNormalizeProject;
  }

  function currentProposal() {
    try {
      const p = typeof getCurrentProject === 'function' ? getCurrentProject() : null;
      return applyProposalOptionDefaults(p);
    } catch {
      return null;
    }
  }

  function autoGrowAlternateTitle(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(118, Math.max(37, textarea.scrollHeight))}px`;
  }

  function upgradeAlternateTitleEditors() {
    document.querySelectorAll('input.alternate-title-input').forEach(input => {
      const textarea = document.createElement('textarea');
      [...input.attributes].forEach(attr => textarea.setAttribute(attr.name, attr.value));
      textarea.value = input.value;
      textarea.rows = 1;
      textarea.className = input.className;
      input.replaceWith(textarea);
      autoGrowAlternateTitle(textarea);
      textarea.addEventListener('click', event => event.stopPropagation());
      textarea.addEventListener('input', () => {
        autoGrowAlternateTitle(textarea);
        if (typeof scheduleSave === 'function') scheduleSave();
        if (typeof updatePreview === 'function') updatePreview();
      });
    });
    document.querySelectorAll('textarea.alternate-title-input').forEach(autoGrowAlternateTitle);
  }

  function ensureAlternateSectionTitleControl(project = currentProposal()) {
    const section = document.querySelector('.alternate-scope-section');
    const head = section?.querySelector('.alternate-scope-section-head');
    const headingWrap = head?.querySelector('.section-number')?.nextElementSibling;
    if (!head || !headingWrap) return null;

    let control = document.getElementById('alternateSectionTitleControl');
    let input = document.getElementById('alternateSectionTitleInput');
    if (!control) {
      control = document.createElement('label');
      control.id = 'alternateSectionTitleControl';
      control.className = 'alternate-section-title-control';
      control.innerHTML = `<span>Section Header</span><input id="alternateSectionTitleInput" class="alternate-section-title-input" type="text" value="Alternates" maxlength="80" aria-label="Alternate section header">`;
      headingWrap.appendChild(control);
      input = control.querySelector('input');
      input.addEventListener('input', () => {
        const value = String(input.value || '').trim() || DEFAULT_ALTERNATE_SECTION_TITLE;
        const h3 = headingWrap.querySelector('h3');
        if (h3) h3.textContent = value;
        if (typeof scheduleSave === 'function') scheduleSave();
        if (typeof updatePreview === 'function') updatePreview();
      });
      input.addEventListener('blur', () => {
        if (!String(input.value || '').trim()) input.value = DEFAULT_ALTERNATE_SECTION_TITLE;
      });
    }

    const title = String(project?.alternateSectionTitle || DEFAULT_ALTERNATE_SECTION_TITLE).trim() || DEFAULT_ALTERNATE_SECTION_TITLE;
    if (input && document.activeElement !== input) input.value = title;
    const h3 = headingWrap.querySelector('h3');
    if (h3) h3.textContent = title;
    if (input) input.disabled = Boolean(project?.locked || project?.deletedByUser);
    return input;
  }

  function syncBaseBidRow(project = currentProposal()) {
    const toggle = document.getElementById('showBaseBidToggle');
    const show = toggle ? toggle.checked : project?.showBaseBid !== false;
    const row = document.querySelector('.price-item-row.base-bid-row');
    if (row) row.classList.toggle('hidden', !show);
  }

  function ensureBaseBidToggle(project = currentProposal()) {
    const card = document.getElementById('priceItems')?.closest('.form-card');
    if (!card) return null;
    const head = card.querySelector('.approval-card-head') || card.firstElementChild;
    if (!head) return null;

    let label = document.getElementById('showBaseBidToggleControl');
    let toggle = document.getElementById('showBaseBidToggle');
    if (!label) {
      label = document.createElement('label');
      label.id = 'showBaseBidToggleControl';
      label.className = 'switch-label proposal-base-bid-toggle';
      label.innerHTML = `<input id="showBaseBidToggle" type="checkbox" checked><span class="switch"></span><span class="proposal-toggle-copy"><strong>Show Base Bid</strong><span>Turn off for unit-price bids</span></span>`;
      head.appendChild(label);
      toggle = label.querySelector('input');
      toggle.addEventListener('change', () => {
        syncBaseBidRow();
        if (typeof scheduleSave === 'function') scheduleSave();
        if (typeof updatePreview === 'function') updatePreview();
      });
    }

    if (toggle && document.activeElement !== toggle) toggle.checked = project?.showBaseBid !== false;
    if (toggle) toggle.disabled = Boolean(project?.locked || project?.deletedByUser);
    syncBaseBidRow(project);
    return toggle;
  }

  function syncProposalOptionUi(project = currentProposal()) {
    ensureAlternateSectionTitleControl(project);
    ensureBaseBidToggle(project);
    upgradeAlternateTitleEditors();
  }

  if (typeof renderAlternateScopes === 'function' && !renderAlternateScopes.__proposalAlternateOptionsWrapped) {
    const originalRenderAlternateScopes = renderAlternateScopes;
    const wrappedRenderAlternateScopes = function(project) {
      const result = originalRenderAlternateScopes.apply(this, arguments);
      ensureAlternateSectionTitleControl(applyProposalOptionDefaults(project));
      upgradeAlternateTitleEditors();
      return result;
    };
    wrappedRenderAlternateScopes.__proposalAlternateOptionsWrapped = true;
    renderAlternateScopes = wrappedRenderAlternateScopes;
    window.renderAlternateScopes = wrappedRenderAlternateScopes;
  }

  if (typeof renderPriceItems === 'function' && !renderPriceItems.__proposalBaseBidToggleWrapped) {
    const originalRenderPriceItems = renderPriceItems;
    const wrappedRenderPriceItems = function(project) {
      const result = originalRenderPriceItems.apply(this, arguments);
      ensureBaseBidToggle(applyProposalOptionDefaults(project));
      syncBaseBidRow(project);
      return result;
    };
    wrappedRenderPriceItems.__proposalBaseBidToggleWrapped = true;
    renderPriceItems = wrappedRenderPriceItems;
    window.renderPriceItems = wrappedRenderPriceItems;
  }

  if (typeof collectEditorProject === 'function' && !collectEditorProject.__proposalAlternateOptionsWrapped) {
    const originalCollectEditorProject = collectEditorProject;
    const wrappedCollectEditorProject = function() {
      const project = originalCollectEditorProject.apply(this, arguments);
      if (!project) return project;
      const sectionInput = document.getElementById('alternateSectionTitleInput');
      project.alternateSectionTitle = String(sectionInput?.value || project.alternateSectionTitle || DEFAULT_ALTERNATE_SECTION_TITLE).trim() || DEFAULT_ALTERNATE_SECTION_TITLE;
      const baseToggle = document.getElementById('showBaseBidToggle');
      project.showBaseBid = baseToggle ? baseToggle.checked : project.showBaseBid !== false;
      return applyProposalOptionDefaults(project);
    };
    wrappedCollectEditorProject.__proposalAlternateOptionsWrapped = true;
    collectEditorProject = wrappedCollectEditorProject;
    window.collectEditorProject = wrappedCollectEditorProject;
  }

  // Patch the final Proposal PDF exporter after the existing proposal theme and
  // Advanced Budget Summary patches have finished.
  function patchProposalPdf() {
    if (typeof exportPdf !== 'function') {
      setTimeout(patchProposalPdf, 80);
      return;
    }

    let source = exportPdf.toString();
    if (source.includes('proposal-custom-alternate-heading-v1')) return;

    let replacements = 0;
    const replaceOnce = (find, replacement, label) => {
      if (!source.includes(find)) {
        console.warn(`Proposal alternate controls PDF patch could not find: ${label}`);
        return false;
      }
      source = source.replace(find, replacement);
      replacements += 1;
      return true;
    };

    replaceOnce(
`      const dividerH=.42;`,
`      /* proposal-custom-alternate-heading-v1 */
      doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);
      const alternateSectionHeading=String(p.alternateSectionTitle||'Alternates').trim().toUpperCase()||'ALTERNATES';
      const alternateSectionHeadingLines=doc.splitTextToSize(alternateSectionHeading,contentW-.66);
      const dividerH=Math.max(.42,.22+alternateSectionHeadingLines.length*.19);`,
      'alternate divider layout height'
    );

    replaceOnce(
`      const firstAlternateItems=scopeItemsFromRichHtml(enabledAlternates[0].richText,enabledAlternates[0].text);
      const firstAlternateMinH=cardHeight(firstAlternateItems.slice(0,1),{fontSize:minPdfFont,leading:bodyLeading,titleGap:.12});`,
`      const firstAlternateItems=scopeItemsFromRichHtml(enabledAlternates[0].richText,enabledAlternates[0].text);
      const firstAlternateTitle=String(enabledAlternates[0].title||'Alternate 01').trim().toUpperCase();
      doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);
      const firstAlternateTitleLines=doc.splitTextToSize(`${firstAlternateTitle} (CONT.)`,contentW-.68);
      const firstAlternateTitleGap=.12+Math.max(0,firstAlternateTitleLines.length-1)*.19;
      const firstAlternateMinH=cardHeight(firstAlternateItems.slice(0,1),{fontSize:minPdfFont,leading:bodyLeading,titleGap:firstAlternateTitleGap});`,
      'first alternate wrapped title height'
    );

    replaceOnce(
`        addSplittable({type:'alternate',title},scopeItemsFromRichHtml(a.richText,a.text),{fontSize:minPdfFont,leading:bodyLeading,titleGap:.12});`,
`        doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);
        const titleWrapLines=doc.splitTextToSize(`${title} (CONT.)`,contentW-.68);
        const titleWrapGap=.12+Math.max(0,titleWrapLines.length-1)*.19;
        addSplittable({type:'alternate',title,titleWrapGap},scopeItemsFromRichHtml(a.richText,a.text),{fontSize:minPdfFont,leading:bodyLeading,titleGap:titleWrapGap});`,
      'alternate layout wrapped title height'
    );

    const dividerFunctionPattern = /  function drawAlternateDivider\(y\)\{[\s\S]*?    return y\+h\+cardGap;\n  \}/;
    if (dividerFunctionPattern.test(source)) {
      source = source.replace(dividerFunctionPattern,
`  function drawAlternateDivider(y){
    const label=String(p.alternateSectionTitle||'Alternates').trim().toUpperCase()||'ALTERNATES';
    doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);
    const lines=doc.splitTextToSize(label,contentW-.66);
    const leading=.19;
    const h=Math.max(.42,.22+lines.length*leading);
    setFill(shadow);doc.roundedRect(contentX+.018,y+.018,contentW,h,.08,.08,'F');
    setFill(charcoal);doc.roundedRect(contentX,y,contentW,h,.08,.08,'F');
    setFill(orange);doc.triangle(contentX+.10,y+.09,contentX+.29,y+.09,contentX+.10,y+.28,'F');
    doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);setText([255,255,255]);
    doc.text(lines,contentX+.42,y+.275,{lineHeightFactor:leading/minPdfFont*72});
    return y+h+cardGap;
  }`);
      replacements += 1;
    } else {
      console.warn('Proposal alternate controls PDF patch could not find: alternate divider renderer');
    }

    replaceOnce(
`    const isAlternate=entry.type==='alternate';
    const titleGap=isAlternate?.12:0;`,
`    const isAlternate=entry.type==='alternate';
    const titleText=`${entry.title}${entry.cont?' (CONT.)':''}`;
    doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);
    const titleLines=isAlternate?doc.splitTextToSize(titleText,contentW-.68):[titleText];
    const titleGap=isAlternate?(Number(entry.titleWrapGap)||(.12+Math.max(0,titleLines.length-1)*.19)):0;`,
      'alternate card title spacing'
    );

    replaceOnce(
`    doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);setText(text);doc.text(`${entry.title}${entry.cont?' (CONT.)':''}`,contentX+.42,y+.28);`,
`    doc.setFont('helvetica','bold');doc.setFontSize(minPdfFont);setText(text);doc.text(titleLines,contentX+.42,y+.28,{lineHeightFactor:.19/minPdfFont*72});`,
      'alternate card wrapped title renderer'
    );

    replaceOnce(
`    const note='Base Bid is shown first. Mark any alternates or add-ons you would like included in the contract request.';`,
`    const note=items.some(item=>item.isBaseBid)
      ?'Base Bid is shown first. Mark any alternates or add-ons you would like included in the contract request.'
      :'Mark any unit prices, alternates, or add-ons you would like included in the contract request.';`,
      'proposed pricing note'
    );

    replaceOnce(
`    if(p.sectionEnabled?.clientSelections&&p.priceItems.some(i=>(i.name||'').trim()||(i.price||'').trim())){
      const h=selectionHeight(p.priceItems.filter(i=>(i.name||'').trim()||(i.price||'').trim()));`,
`    const visiblePricingItems=(p.priceItems||[]).filter(i=>p.showBaseBid!==false||!i.isBaseBid);
    if(p.sectionEnabled?.clientSelections&&visiblePricingItems.some(i=>(i.name||'').trim()||(i.price||'').trim())){
      const h=selectionHeight(visiblePricingItems.filter(i=>(i.name||'').trim()||(i.price||'').trim()));`,
      'proposal pricing layout Base Bid filter'
    );

    replaceOnce(
`    const items=p.priceItems.filter(i=>(i.name||'').trim()||(i.price||'').trim());`,
`    const items=(p.priceItems||[]).filter(i=>p.showBaseBid!==false||!i.isBaseBid).filter(i=>(i.name||'').trim()||(i.price||'').trim());`,
      'proposal pricing renderer Base Bid filter'
    );

    if (replacements !== 9) {
      console.warn(`Proposal alternate controls PDF patch not applied. Expected 9 replacements; found ${replacements}.`);
      return;
    }

    try {
      const patchedExportPdf = eval(`(${source})`);
      exportPdf = patchedExportPdf;
      window.exportPdf = patchedExportPdf;

      const oldButton = document.getElementById('exportPdfBtn');
      if (oldButton && oldButton.dataset.proposalAlternateControlsPatched !== 'true') {
        const newButton = oldButton.cloneNode(true);
        newButton.dataset.proposalAlternateControlsPatched = 'true';
        oldButton.replaceWith(newButton);
        newButton.addEventListener('click', patchedExportPdf);
      }

      if (typeof schedulePdfPreview === 'function' && typeof state !== 'undefined' && state?.currentProjectId) {
        schedulePdfPreview(40);
      }
    } catch (error) {
      console.error('Proposal alternate controls PDF patch failed.', error);
    }
  }

  patchProposalPdf();
  setTimeout(() => syncProposalOptionUi(currentProposal()), 0);
})();