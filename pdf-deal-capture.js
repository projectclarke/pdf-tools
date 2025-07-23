javascript:(async () => {
  if (window._pdfCropUI) return;
  window._pdfCropUI = true;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const loadScript = src => new Promise(res => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    document.body.appendChild(s);
  });

  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');

  const scrollAndWaitForPage = async (pageEl) => {
    pageEl.scrollIntoView({ behavior: 'instant', block: 'center' });
    await sleep(300);
    const linksReady = () =>
      pageEl.querySelectorAll('section.linkAnnotation a[href]').length > 0;
    let attempts = 0;
    while (!linksReady() && attempts < 20) {
      await sleep(200);
      attempts++;
    }
  };

  const getAllPages = () => [...document.querySelectorAll('.page')];

  const extractDealsFromPage = (page) => {
    const deals = [];
    const pageNum = page.getAttribute('data-page-number');
    const canvas = page.querySelector('canvas');
    const pageRect = page.getBoundingClientRect();

    page.querySelectorAll('section.linkAnnotation').forEach(section => {
      const a = section.querySelector('a[href]');
      if (!a) return;
      const rect = section.getBoundingClientRect();
      deals.push({
        page: pageNum,
        href: a.href,
        text: a.title || a.textContent.trim() || '',
        crop: {
          x: Math.round(rect.left - pageRect.left),
          y: Math.round(rect.top - pageRect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        canvasParent: page
      });
    });

    return deals;
  };

  const extractAllDeals = async () => {
    const deals = [];
    const pages = getAllPages();
    for (const page of pages) {
      await scrollAndWaitForPage(page);
      deals.push(...extractDealsFromPage(page));
    }
    return deals;
  };

  const captureDeal = async (deal, index) => {
    deal.canvasParent.scrollIntoView({ behavior: 'instant', block: 'center' });
    await sleep(300);

    const fullCanvas = await html2canvas(deal.canvasParent, { backgroundColor: null });

    const cropped = document.createElement('canvas');
    cropped.width = deal.crop.width;
    cropped.height = deal.crop.height;
    const ctx = cropped.getContext('2d');
    ctx.drawImage(
      fullCanvas,
      deal.crop.x,
      deal.crop.y,
      deal.crop.width,
      deal.crop.height,
      0,
      0,
      deal.crop.width,
      deal.crop.height
    );

    const img = cropped.toDataURL();
    const link = document.createElement('a');
    link.href = img;
    link.download = `Deal-${String(index + 1).padStart(3, '0')}.png`;
    link.click();

    // Format title from URL if missing
    let title = deal.text && deal.text !== '(no text)' ? deal.text : '';
    if (!title && deal.href) {
      const path = deal.href.split('/').filter(Boolean).pop();
      title = path.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    return `Deal ${index + 1}:\nPage: ${deal.page}\nTitle:\n${title}\nLink:\n${deal.href}`;
  };

  const saveTextFile = (lines, filename = 'pdf_deals.txt') => {
    const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const runCapture = async (selectedDeals) => {
    const output = [];
    for (let i = 0; i < selectedDeals.length; i++) {
      const line = await captureDeal(selectedDeals[i], i);
      output.push(line);
    }
    saveTextFile(output);
    alert(`✅ ${selectedDeals.length} deals captured and exported.`);
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
      width: '400px',
      boxShadow: '0 0 10px rgba(0,0,0,0.3)',
      maxHeight: '70vh',
      overflowY: 'auto'
    });

    const header = document.createElement('h3');
    header.innerText = 'Select Deals to Capture';
    modal.appendChild(header);

    const form = document.createElement('div');
    deals.forEach((deal, i) => {
      const label = document.createElement('label');
      label.style.display = 'block';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = i;
      label.appendChild(cb);
      const name = deal.text || `Deal ${i + 1}`;
      label.appendChild(document.createTextNode(` ${name}`));
      form.appendChild(label);
    });
    modal.appendChild(form);

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
  };

  const createButton = (text, topOffset, bgColor, onclick) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      position: 'fixed',
      top: `calc(50% + ${topOffset}px)`,
      right: '20px',
      zIndex: 9999,
      padding: '10px 16px',
      fontSize: '14px',
      backgroundColor: bgColor,
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      transform: 'translateY(-50%)'
    });
    btn.onclick = onclick;
    document.body.appendChild(btn);
  };

  createButton('📸 Capture All Deals', -30, '#007bff', async () => {
    const allDeals = await extractAllDeals();
    if (!allDeals.length) return alert('No deals found.');
    await runCapture(allDeals);
  });

  createButton('📸 Select Deals to Capture', 30, '#6f42c1', async () => {
    const allDeals = await extractAllDeals();
    if (!allDeals.length) return alert('No deals found.');
    showSelector(allDeals);
  });
})();
