async function loadList() {
  const grid = document.getElementById('grid');
  try {
    const res = await fetch('sketches.json', { cache: 'no-store' });
    const list = await res.json();

    if (!Array.isArray(list) || list.length === 0) {
      grid.innerHTML = '<p>No sketches yet. Add one to <code>sketches/</code> and update <code>sketches.json</code>.</p>';
      return;
    }

    grid.innerHTML = '';
    for (const item of list) {
      const a = document.createElement('a');
      a.className = 'card';
      a.href = `viewer.html?slug=${encodeURIComponent(item.slug)}`;

      const thumb = document.createElement('div');
      thumb.className = 'thumb';
      // If you later add actual images at sketches/<slug>/thumb.jpg, they’ll show automatically
      const img = new Image();
      img.onload = () => { thumb.innerHTML = ''; thumb.appendChild(img); img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit='cover'; };
      img.onerror = () => { thumb.textContent = 'No thumbnail'; };
      img.src = `sketches/${item.slug}/thumb.jpg`;

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = item.title || item.slug;

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = item.note || 'Click to open';

      a.appendChild(thumb);
      a.appendChild(title);
      a.appendChild(meta);
      grid.appendChild(a);
    }
  } catch (e) {
    grid.innerHTML = `<p>Could not load <code>sketches.json</code>. Check it is valid JSON. (${e})</p>`;
  }
}
loadList();
