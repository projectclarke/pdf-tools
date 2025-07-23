(async () => {
  if (window._pdfDealCaptureActive) return;
  window._pdfDealCaptureActive = true;

  const sleep = ms => new Promise(res => setTimeout(res, ms));

  const loadScript = src =>
    new Promise(res => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      document.body.appendChild(s);
    });

  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');

  const getAllPages = () => Array.from(document.querySelectorAll('.page[data-page-number]'));

  const waitForAnnotations = async (page, maxWait = 3000) => {
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      const links = page.querySelectorAll('section.linkAnnotation a[href]');
      if (links.length) return;
      await sleep(100);
    }
  };

  const extractDealsFromPage = (page) => {
    const pageNum = page.getAttribute('data-page-number');
    const pageRect = page.getBoundingClientRect();
    const blocks = [];

    page.querySelectorAll('section.linkAnnotation a[href]').forEach(a => {
      const section = a.closest('section.linkAnnotation');
      const rect = section.getBoundingClientRect();
      blocks.push({
        page: pageNum,
        href: a.href,
        text: a.title || a.textContent.trim() || '(no text)',
        crop: {
          x: Math.round(rect.left - pageRect.left),
          y: Math.round(rect.top - pageRect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        canvasParent: page
      });
    });

    return blocks;
  };

  const captureDeal = async (deal, index) => {
    deal.canvasParent.scrollIntoView({ behavior: 'instant', block: 'center' });
    await sleep(300);
    const fullCanvas = await html2canvas(deal.canvasParent, { backgroundColor: null });
    const cropped = document.createElement('canvas');
    cropped.width = deal.crop.width;
    cropped.height = deal.crop.height;
    const ctx = cropped.getContext('2d');
    ctx.drawImage(fullCanvas, deal.crop.x, deal.crop.y, deal.crop.width, deal.crop.height, 0, 0, deal.crop.width, deal.crop.height);
    const img = cropped.toDataURL();
    const link = document.createElement('a');
    link.href = img;
    link.download = `Deal-${String(index + 1).padStart(3, '0')}.png`;
    link.click();
    return `Deal ${index + 1}:\nPage: ${deal.page}\nTitle: ${deal.text}\nLink: ${deal.href}`;
  };

  const saveTextFile = (lines, filename = 'pdf_deals.txt') => {
    const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const runCapture = async (deals) => {
    const output = [];
    for (let i = 0; i < deals.length; i++) {
      const line = await captureDeal(deals[i], i);
      output.push(line);
    }
    saveTextFile(output);
    alert(`✅ ${deals.length} deals captured and exported.`);
  };

  const showSelector = (deals) => {
    const modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 10000,
      background: '#fff',
      border: '1px solid #ccc',
      padding: '20px',
      width: '500px',
      boxShadow: '0 0 10px rgba(0,0,0,0.3)',
      maxHeight: '80vh',
      overflowY: 'auto'
    });

    const header = document.createElement('h3');
    header.innerText = 'Select Deals to Capture';
    modal.appendChild(header);

    const search = document.createElement('input');
    Object.assign(search.style, {
      width: '100%',
      padding: '6px',
      marginBottom: '10px',
      boxSizing: 'border-box',
      border: '1px solid #ccc',
      borderRadius: '4px'
    });
    search.placeholder = 'Search deals by keyword...';
    modal.appendChild(search);

    const form = document.createElement('div');
    modal.appendChild(form);

    const buildDealEntry = (deal, i) => {
      const label = document.createElement('label');
      label.style.display = 'flex';
      label.style.alignItems = 'center';
      label.style.marginBottom = '8px';
      label.dataset.text = deal.text.toLowerCase();

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = i;
      cb.style.marginRight = '8px';
      label.appendChild(cb);

      const preview = document.createElement('img');
      preview.style.width = '100px';
      preview.style.height = 'auto';
      preview.style.marginRight = '8px';
      preview.style.border = '1px solid #ddd';
      preview.style.borderRadius = '4px';

      html2canvas(deal.canvasParent, { backgroundColor: null }).then(canvas => {
        const cropped = document.createElement('canvas');
        cropped.width = deal.crop.width;
        cropped.height = deal.crop.height;
        const ctx = cropped.getContext('2d');
        ctx.drawImage(
          canvas,
          deal.crop.x,
          deal.crop.y,
          deal.crop.width,
          deal.crop.height,
          0,
          0,
          deal.crop.width,
          deal.crop.height
        );
        preview.src = cropped.toDataURL();
      });

      label.appendChild(preview);
      const text = document.createElement('span');
      text.textContent = deal.text;
      label.appendChild(text);

      return label;
    };

    const renderDeals = () => {
      form.innerHTML = '';
      deals.forEach((deal, i) => {
        const entry = buildDealEntry(deal, i);
        form.appendChild(entry);
      });
    };

    const filterDeals = () => {
      const term = search.value.trim().toLowerCase();
      const labels = form.querySelectorAll('label');
      labels.forEach(label => {
        const text = label.dataset.text;
        label.style.display = text.includes(term) ? 'flex' : 'none';
      });
    };

    search.addEventListener('input', filterDeals);

    const action = document.createElement('div');
    action.style.marginTop = '10px';
    action.style.textAlign = 'right';

    const runBtn = document.createElement('button');
    runBtn.textContent = '📸 Capture Selected';
    Object.assign(runBtn.style, {
      marginRight: '8px',
      background: '#28a745',
      color: 'white',
      border: 'none',
      padding: '6px 10px',
      cursor: 'pointer',
      borderRadius: '4px'
    });

    runBtn.onclick = async () => {
      const selected = Array.from(form.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
      const toCapture = selected.map(i => deals[i]);
      modal.remove();
      await runCapture(toCapture);
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => modal.remove();

    action.appendChild(runBtn);
    action.appendChild(cancelBtn);
    modal.appendChild(action);
    document.body.appendChild(modal);

    renderDeals();
  };

  const createButton = (text, topOffset, onclick, colour) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      position: 'fixed',
      top: `calc(50% + ${topOffset}px)`,
      right: '20px',
      zIndex: 9999,
      padding: '10px 16px',
      fontSize: '14px',
      backgroundColor: colour,
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      transform: 'translateY(-50%)'
    });
    btn.onclick = onclick;
    document.body.appendChild(btn);
  };

  createButton('📸 Capture All Deals', -30, async () => {
    const pages = getAllPages();
    const allDeals = [];

    for (const page of pages) {
      page.scrollIntoView({ behavior: 'instant', block: 'center' });
      await sleep(300);
      await waitForAnnotations(page);
      allDeals.push(...extractDealsFromPage(page));
    }

    if (!allDeals.length) return alert('No deals found.');
    await runCapture(allDeals);
  }, '#007bff');

  createButton('📸 Select Deals to Capture', 30, async () => {
    const pages = getAllPages();
    const allDeals = [];

    for (const page of pages) {
      page.scrollIntoView({ behavior: 'instant', block: 'center' });
      await sleep(300);
      await waitForAnnotations(page);
      allDeals.push(...extractDealsFromPage(page));
    }

    if (!allDeals.length) return alert('No deals found.');
    showSelector(allDeals);
  }, '#6f42c1');
})();
