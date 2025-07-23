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

  const showSelector = async (deals, withThumbnails = true) => {
    if (withThumbnails) {
      const progressBarContainer = document.createElement('div');
      Object.assign(progressBarContainer.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '6px',
        backgroundColor: '#ccc',
        zIndex: '10001'
      });

      const progressBar = document.createElement('div');
      Object.assign(progressBar.style, {
        width: '0%',
        height: '100%',
        backgroundColor: '#28a745',
        transition: 'width 0.2s ease-in-out'
      });

      progressBarContainer.appendChild(progressBar);
      document.body.appendChild(progressBarContainer);

      await new Promise(requestAnimationFrame);

      for (let i = 0; i < deals.length; i++) {
        const percent = Math.round(((i + 1) / deals.length) * 100);
        progressBar.style.width = percent + '%';

        await sleep(100);
        const canvas = await html2canvas(deals[i].canvasParent, { backgroundColor: null });
        const cropped = document.createElement('canvas');
        cropped.width = deals[i].crop.width;
        cropped.height = deals[i].crop.height;
        const ctx = cropped.getContext('2d');
        ctx.drawImage(canvas, deals[i].crop.x, deals[i].crop.y, deals[i].crop.width, deals[i].crop.height, 0, 0, deals[i].crop.width, deals[i].crop.height);
        deals[i].thumbnail = cropped.toDataURL();
      }

      progressBarContainer.remove();
    }

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

    deals.forEach((deal, i) => {
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

      if (withThumbnails && deal.thumbnail) {
        const preview = document.createElement('img');
        preview.src = deal.thumbnail;
        Object.assign(preview.style, {
          width: '100px',
          height: 'auto',
          marginRight: '8px',
          border: '1px solid #ddd',
          borderRadius: '4px'
        });
        label.appendChild(preview);
      }

      const text = document.createElement('span');
      text.textContent = deal.text;
      label.appendChild(text);
      form.appendChild(label);
    });

    const filterDeals = () => {
      const term = search.value.trim().toLowerCase();
      form.querySelectorAll('label').forEach(label => {
        label.style.display = label.dataset.text.includes(term) ? 'flex' : 'none';
      });
    };

    search.addEventListener('input', filterDeals);

    const action = document.createElement('div');
    Object.assign(action.style, { marginTop: '10px', textAlign: 'right' });

    const runBtn = document.createElement('button');
    runBtn.textContent = '📸 Capture Selected';
    Object.assign(runBtn.style, {
      marginRight: '8px', background: '#28a745', color: 'white',
      border: 'none', padding: '6px 10px', cursor: 'pointer', borderRadius: '4px'
    });
    runBtn.onclick = async () => {
      const selected = Array.from(form.querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
      modal.remove();
      await runCapture(selected.map(i => deals[i]));
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => modal.remove();

    action.append(runBtn, cancelBtn);
    modal.appendChild(action);
    document.body.appendChild(modal);
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

  createButton('📸 Capture All Deals', -60, async () => {
    const pages = getAllPages(), allDeals = [];
    for (const page of pages) {
      page.scrollIntoView({ behavior: 'instant', block: 'center' });
      await sleep(300);
      await waitForAnnotations(page);
      allDeals.push(...extractDealsFromPage(page));
    }
    if (!allDeals.length) return alert('No deals found.');
    await runCapture(allDeals);
  }, '#007bff');

  createButton('📸 Select Deals to Capture', 0, async () => {
    const pages = getAllPages(), allDeals = [];
    for (const page of pages) {
      page.scrollIntoView({ behavior: 'instant', block: 'center' });
      await sleep(300);
      await waitForAnnotations(page);
      allDeals.push(...extractDealsFromPage(page));
    }
    if (!allDeals.length) return alert('No deals found.');
    await showSelector(allDeals, true);
  }, '#6f42c1');

  createButton('📋 Select Deals (No Thumbnails)', 60, async () => {
    const pages = getAllPages(), allDeals = [];
    for (const page of pages) {
      page.scrollIntoView({ behavior: 'instant', block: 'center' });
      await sleep(300);
      await waitForAnnotations(page);
      allDeals.push(...extractDealsFromPage(page));
    }
    if (!allDeals.length) return alert('No deals found.');
    await showSelector(allDeals, false);
  }, '#17a2b8');
})();
