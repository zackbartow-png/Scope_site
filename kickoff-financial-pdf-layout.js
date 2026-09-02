(() => {
  // Kickoff-only cleanup: remove the redundant Contract Value field from the screen,
  // keep the Project Financials heading, and compact the kickoff PDF financial layout.
  const removeContractValueField = () => {
    const input = document.querySelector('[data-kickoff-info="contractValue"]');
    const label = input?.closest('label');
    if (label) label.remove();
  };

  const retitleFinancialBlock = () => {
    const title = document.querySelector('.kickoff-financial-title');
    if (title) title.textContent = 'Project Financials';
  };

  const syncKickoffFinancialUi = () => {
    removeContractValueField();
    retitleFinancialBlock();
  };

  syncKickoffFinancialUi();
  const uiObserver = new MutationObserver(syncKickoffFinancialUi);
  uiObserver.observe(document.documentElement, { childList: true, subtree: true });

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

  let attempts = 0;
  const maxAttempts = 60;

  function patchKickoffPdfLayout() {
    attempts += 1;
    if (typeof buildKickoffPdf !== 'function') {
      if (attempts < maxAttempts) setTimeout(patchKickoffPdfLayout, 100);
      return;
    }

    let source = buildKickoffPdf.toString();
    if (source.includes('kickoff-financial-pdf-one-line')) return;

    // Wait until the existing Project Financials patch has added Revenue / Project Cost / Gross Profit.
    if (!source.includes("['Revenue'") || !source.includes("['Project Cost'") || !source.includes("['Gross Profit'")) {
      if (attempts < maxAttempts) setTimeout(patchKickoffPdfLayout, 100);
      return;
    }

    const pageStartAnchor = "  let y=newPage('PROJECT KICKOFF'";
    const anchorIndex = source.indexOf(pageStartAnchor);
    if (anchorIndex < 0) {
      console.warn('Kickoff financial PDF layout patch could not find the kickoff page start.');
      return;
    }

    const threeColumnHelper = `  /* kickoff-financial-pdf-one-line */\n  function drawThreeColumnKickoffRow(y,row,title=''){\n    const gap=.10;\n    const cellW=(contentW-gap*2)/3;\n    const prepared=row.map(item=>{\n      const value=String(item?.[1]||'—');\n      doc.setFont('helvetica','normal');doc.setFontSize(12);\n      return {item,lines:doc.splitTextToSize(value,cellW-.26)};\n    });\n    const h=Math.max(.68,.34+Math.max(...prepared.map(entry=>entry.lines.length))* .20);\n    const titleH=title?.30:0;\n    y=ensureSpace(y,h+titleH+.12);\n    if(title){\n      doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...orange);\n      doc.text(String(title).toUpperCase(),contentX,y+.20);\n      y+=titleH;\n    }\n    prepared.forEach((entry,idx)=>{\n      const x=contentX+idx*(cellW+gap);\n      doc.setFillColor(...light);doc.setDrawColor(...border);doc.roundedRect(x,y,cellW,h,.08,.08,'FD');\n      doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...orange);doc.text(String(entry.item?.[0]||'').toUpperCase(),x+.14,y+.23);\n      doc.setFont('helvetica','normal');doc.setFontSize(12);doc.setTextColor(...text);doc.text(entry.lines,x+.14,y+.46,{lineHeightFactor:1.16});\n    });\n    return y+h+.11;\n  }\n`;

    source = source.slice(0, anchorIndex) + threeColumnHelper + source.slice(anchorIndex);

    const summaryPattern = /  y=drawTwoColumnRows\(y,\[\[\['Owner \/ Client',info\.owner\|\|p\.clientName\],[\s\S]*?\]\]\);\n/;
    if (!summaryPattern.test(source)) {
      console.warn('Kickoff financial PDF layout patch could not find the project summary rows.');
      return;
    }

    const contingencyValue = "String(info.contingencyPercent||'').trim()?sanitizeContingencyPercent(info.contingencyPercent).replace(/\\.$/,'')+'%':''";
    const grossProfitValue = "String(info.projectCost||'').trim()?formatMoneyNumber(moneyNumber(info.revenue||info.contractValue||'')-moneyNumber(info.projectCost||'')):(info.grossProfit||'')";
    const summaryReplacement =
      "  y=drawTwoColumnRows(y,[[['Owner / Client',info.owner||p.clientName],['Contract Type',info.contractType]],[['Tax Status',info.taxStatus],['Contingency %'," + contingencyValue + "]]]);\n" +
      "  y=drawThreeColumnKickoffRow(y,[['Revenue',info.revenue||info.contractValue||''],['Project Cost',info.projectCost||''],['Gross Profit'," + grossProfitValue + "]],'Project Financials');\n" +
      "  y=drawTwoColumnRows(y,[[['Start Date',info.startDate?fmtDate(info.startDate):'—'],['End Date',info.endDate?fmtDate(info.endDate):'—']]]);\n";

    source = source.replace(summaryPattern, summaryReplacement);

    try {
      const patchedBuildKickoffPdf = eval(`(${source})`);
      buildKickoffPdf = patchedBuildKickoffPdf;
      window.buildKickoffPdf = patchedBuildKickoffPdf;
      if (typeof scheduleKickoffPdfPreview === 'function' && typeof state !== 'undefined' && state.currentKickoffProjectId) {
        scheduleKickoffPdfPreview(80);
      }
    } catch (error) {
      console.error('Kickoff financial PDF layout patch failed.', error);
    }
  }

  patchKickoffPdfLayout();
})();
