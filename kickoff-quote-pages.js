(() => {
  // Nested quote-page controls for the Kickoff > Quotes & Page Order window.
  // Each uploaded quote stays together as one movable document, while its converted
  // page snapshots can be expanded and individual pages can be removed.
  if (typeof getCurrentKickoffProject !== 'function' || typeof normalizedKickoffPageOrder !== 'function') {
    console.warn('Kickoff quote page controls skipped: core kickoff functions are unavailable.');
    return;
  }

  const expandedQuotes = new Set();

  const style = document.createElement('style');
  style.textContent = `
    .kickoff-quote-page-group{display:grid;gap:6px}
    .kickoff-page-order-row.kickoff-quote-parent{border-left:3px solid var(--orange);padding-left:10px}
    .kickoff-quote-page-toggle{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
    .kickoff-quote-page-chevron{display:inline-block;font-size:10px;transition:transform .15s ease}
    .kickoff-quote-page-group.expanded .kickoff-quote-page-chevron{transform:rotate(90deg)}
    .kickoff-quote-page-children{display:none;gap:6px;margin:0 0 2px 42px;padding-left:14px;border-left:2px solid #e5e7e8}
    .kickoff-quote-page-group.expanded .kickoff-quote-page-children{display:grid}
    .kickoff-page-order-row.kickoff-quote-child{background:#fafafa;border-color:#e6e8e9;box-shadow:none}
    .kickoff-quote-child .kickoff-page-order-index{background:#fff;border:1px solid #e0e3e5}
    .kickoff-quote-child .kickoff-page-order-copy strong{font-size:10px}
    .kickoff-quote-child .kickoff-page-order-copy span{font-size:8px}
    .kickoff-quote-page-delete{white-space:nowrap}
    @media (max-width:700px){
      .kickoff-quote-page-children{margin-left:18px;padding-left:10px}
      .kickoff-page-order-row.kickoff-quote-child{grid-template-columns:32px minmax(0,1fr);align-items:start}
      .kickoff-quote-child .kickoff-page-order-actions{grid-column:2;justify-content:flex-start}
    }
  `;
  document.head.appendChild(style);

  async function removeKickoffQuotePage(quoteId, pageKey, pageNumber) {
    const p = getCurrentKickoffProject();
    if (!p) return;
    const quote = (p.kickoff?.quotes || []).find(q => q.id === quoteId);
    if (!quote) return;
    const pages = Array.isArray(quote.pages) ? quote.pages : [];
    if (!pages.includes(pageKey)) return toast('That quote page is no longer available.');

    if (pages.length === 1) {
      if (!confirm(`This is the only page in ${quote.name || 'this quote'}. Removing it will remove the entire quote. Continue?`)) return;
      return removeKickoffQuote(quoteId);
    }

    if (!confirm(`Remove page ${pageNumber} from ${quote.name || 'this quote'}?\n\nOnly this page will be removed. The rest of the uploaded quote will stay in the kickoff.`)) return;

    try {
      await deleteQuoteAssetsByKeys([pageKey]);
      mutateKickoff(k => {
        const q = (k.quotes || []).find(item => item.id === quoteId);
        if (!q) return;
        q.pages = (Array.isArray(q.pages) ? q.pages : []).filter(key => key !== pageKey);
        q.pageCount = q.pages.length;
      });
      expandedQuotes.add(quoteId);
      await renderKickoffQuotes();
      renderKickoffPageOrder();
      scheduleKickoffPdfPreview(180);
      toast(`Quote page ${pageNumber} removed.`);
    } catch (err) {
      console.error('Could not remove kickoff quote page.', err);
      toast(err?.message || 'Could not remove that quote page.');
    }
  }

  function renderKickoffPageOrderWithNestedQuotes() {
    const wrap = document.querySelector('#kickoffPageOrder');
    if (!wrap) return;
    const p = getCurrentKickoffProject();
    if (!p) return;

    const k = p.kickoff || {}, rows = [];
    let page = 1;
    rows.push({page: page++, title: 'Project Kickoff Overview', sub: 'Project information', fixed: true});

    if (k.projectInfo?.maps?.enabled) {
      const maps = k.projectInfo.maps || {};
      if (maps.wide || maps.close) {
        const names = [maps.wide ? 'Wide View' : '', maps.close ? 'Close-Up View' : ''].filter(Boolean).join(' + ');
        rows.push({page: page++, title: `Project Location – ${names}`, sub: 'Map screenshots', fixed: true});
      }
      if (maps.street) rows.push({page: page++, title: 'Project Location – Street View', sub: 'Screenshot', fixed: true});
    }

    const divisions = new Map((k.divisions || []).map(d => [d.id, d]));
    const quotes = new Map((k.quotes || []).map(q => [q.id, q]));
    const order = normalizedKickoffPageOrder(k);

    order.forEach((token, index) => {
      if (token.startsWith('division:')) {
        const d = divisions.get(token.slice(9));
        if (!d) return;
        rows.push({page: page++, title: `${d.number ? d.number + ' - ' : ''}${d.description || 'Untitled Division'}`, sub: `Division page · ${d.subcontractor || 'No subcontractor entered'}`, token, type: 'division', index});
        return;
      }

      if (token.startsWith('quote:')) {
        const q = quotes.get(token.slice(6));
        if (!q) return;
        const quotePages = Array.isArray(q.pages) ? q.pages : [];
        const count = Math.max(1, quotePages.length || Number(q.pageCount || 1));
        const startPage = page, endPage = page + count - 1;
        const d = divisions.get(q.divisionId);
        rows.push({
          page: startPage,
          pageLabel: count > 1 ? `${startPage}–${endPage}` : String(startPage),
          title: q.name || 'Quote',
          sub: `Quote PDF · ${count} page${count === 1 ? '' : 's'}${d ? ` · linked to ${d.number ? d.number + ' - ' : ''}${d.description || 'Division'}` : ' · unassigned'}`,
          token,
          type: 'quote',
          quoteId: q.id,
          quotePages,
          count,
          startPage,
          index
        });
        page += count;
      }
    });

    wrap.innerHTML = rows.map(r => {
      const pageLabel = r.pageLabel || String(r.page);
      if (r.fixed) {
        return `<div class="kickoff-page-order-row fixed"><span class="kickoff-page-order-index">${esc(pageLabel)}</span><div class="kickoff-page-order-copy"><strong>${esc(r.title)}</strong><span>${esc(r.sub)}</span></div><div class="kickoff-page-order-fixed">Fixed</div></div>`;
      }

      const first = r.index === 0, last = r.index === order.length - 1;
      if (r.type !== 'quote') {
        return `<div class="kickoff-page-order-row" data-kickoff-page-token="${esc(r.token)}"><span class="kickoff-page-order-index">${esc(pageLabel)}</span><div class="kickoff-page-order-copy"><strong>${esc(r.title)}</strong><span>${esc(r.sub)}</span></div><div class="kickoff-page-order-actions"><button class="btn btn-secondary btn-small" type="button" data-kickoff-page-up="${esc(r.token)}" ${first ? 'disabled' : ''} title="Move up">↑</button><button class="btn btn-secondary btn-small" type="button" data-kickoff-page-down="${esc(r.token)}" ${last ? 'disabled' : ''} title="Move down">↓</button></div></div>`;
      }

      const isExpanded = expandedQuotes.has(r.quoteId);
      const childPages = (r.quotePages.length ? r.quotePages : Array.from({length:r.count}, (_,i)=>`__missing_page_${i}`)).map((key, i) => {
        const documentPage = r.startPage + i;
        const canDelete = !String(key).startsWith('__missing_page_');
        return `<div class="kickoff-page-order-row kickoff-quote-child"><span class="kickoff-page-order-index">${esc(String(documentPage))}</span><div class="kickoff-page-order-copy"><strong>Quote Page ${i + 1}</strong><span>${esc(r.title)} · document page ${documentPage}</span></div><div class="kickoff-page-order-actions">${canDelete ? `<button class="btn btn-danger btn-small kickoff-quote-page-delete" type="button" data-remove-kickoff-quote-page="${esc(key)}" data-quote-id="${esc(r.quoteId)}" data-quote-page-number="${i + 1}">Delete Page</button>` : ''}</div></div>`;
      }).join('');

      return `<div class="kickoff-quote-page-group ${isExpanded ? 'expanded' : ''}" data-kickoff-quote-group="${esc(r.quoteId)}">
        <div class="kickoff-page-order-row kickoff-quote-parent" data-kickoff-page-token="${esc(r.token)}">
          <span class="kickoff-page-order-index">${esc(pageLabel)}</span>
          <div class="kickoff-page-order-copy"><strong>${esc(r.title)}</strong><span>${esc(r.sub)}</span></div>
          <div class="kickoff-page-order-actions">
            <button class="btn btn-secondary btn-small kickoff-quote-page-toggle" type="button" data-toggle-kickoff-quote-pages="${esc(r.quoteId)}" aria-expanded="${isExpanded ? 'true' : 'false'}"><span class="kickoff-quote-page-chevron">▶</span>Pages (${r.count})</button>
            <button class="btn btn-secondary btn-small" type="button" data-kickoff-page-up="${esc(r.token)}" ${first ? 'disabled' : ''} title="Move quote up">↑</button>
            <button class="btn btn-secondary btn-small" type="button" data-kickoff-page-down="${esc(r.token)}" ${last ? 'disabled' : ''} title="Move quote down">↓</button>
            <button class="btn btn-danger btn-small kickoff-page-remove-pdf" type="button" data-remove-kickoff-quote="${esc(r.quoteId)}">Remove PDF</button>
          </div>
        </div>
        <div class="kickoff-quote-page-children">${childPages}</div>
      </div>`;
    }).join('');

    wrap.querySelectorAll('[data-kickoff-page-up]').forEach(b => b.addEventListener('click', () => moveKickoffPageToken(b.dataset.kickoffPageUp, -1)));
    wrap.querySelectorAll('[data-kickoff-page-down]').forEach(b => b.addEventListener('click', () => moveKickoffPageToken(b.dataset.kickoffPageDown, 1)));
    wrap.querySelectorAll('[data-remove-kickoff-quote]').forEach(b => b.addEventListener('click', () => removeKickoffQuote(b.dataset.removeKickoffQuote)));
    wrap.querySelectorAll('[data-toggle-kickoff-quote-pages]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.toggleKickoffQuotePages;
      if (expandedQuotes.has(id)) expandedQuotes.delete(id); else expandedQuotes.add(id);
      const group = b.closest('.kickoff-quote-page-group');
      const expanded = expandedQuotes.has(id);
      group?.classList.toggle('expanded', expanded);
      b.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }));
    wrap.querySelectorAll('[data-remove-kickoff-quote-page]').forEach(b => b.addEventListener('click', () => removeKickoffQuotePage(b.dataset.quoteId, b.dataset.removeKickoffQuotePage, Number(b.dataset.quotePageNumber || 1))));
  }

  renderKickoffPageOrder = renderKickoffPageOrderWithNestedQuotes;
  window.renderKickoffPageOrder = renderKickoffPageOrderWithNestedQuotes;
  window.removeKickoffQuotePage = removeKickoffQuotePage;

  if (state?.currentKickoffProjectId && state?.currentKickoffTab === 'documents') {
    renderKickoffPageOrderWithNestedQuotes();
  }
})();
