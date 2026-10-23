(() => {
  const endpoint = "data/noticias.json?v=" + Date.now();
  const list = document.getElementById("lista-noticias");
  const status = document.getElementById("estado-noticias");
  const updated = document.getElementById("actualidad-actualizada");
  const homeCards = document.getElementById("noticias-destacadas");
  let items = [];
  let activeFilter = "Todas";

  const safeUrl = value => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "#";
    } catch { return "#"; }
  };
  const formatDate = value => {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("es-CO", {dateStyle:"medium"}).format(date);
  };
  const escapeText = value => String(value || "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[char]);

  function imageMarkup(item) {
    const image = safeUrl(item.imageUrl);
    if (image !== "#") {
      return `<img src="${image}" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="noticia-sin-miniatura" aria-hidden="true">⌂</span>`;
    }
    return '<span class="noticia-sin-miniatura" aria-hidden="true">⌂</span>';
  }
  function card(item, featured = false) {
    const link = safeUrl(item.url);
    const title = escapeText(item.title);
    const media = `<a class="noticia-miniatura" href="${link}" target="_blank" rel="noopener noreferrer" aria-label="Abrir noticia: ${title}">${imageMarkup(item)}</a>`;
    if (featured) return `<article class="noticia-destacada">${media}<div class="noticia-contenido"><a class="noticia-titulo" href="${link}" target="_blank" rel="noopener noreferrer">${title}</a><p class="noticia-meta">${escapeText(item.source)} · ${formatDate(item.publishedAt)}</p></div></article>`;
    return `<article class="noticia-card">${media}<div class="noticia-contenido"><span class="noticia-categoria">${escapeText(item.category)}</span><h3><a href="${link}" target="_blank" rel="noopener noreferrer">${title}</a></h3><p class="noticia-meta">${escapeText(item.source)} · ${formatDate(item.publishedAt)}</p></div></article>`;
  }
  function watchImages(container) {
    if (!container) return;
    container.querySelectorAll(".noticia-miniatura img").forEach(image => {
      image.addEventListener("error", () => {
        const holder = image.closest(".noticia-miniatura");
        image.remove();
        holder?.classList.add("sin-imagen");
      }, {once:true});
    });
  }
  function render() {
    const visible = activeFilter === "Todas" ? items : items.filter(item => item.category === activeFilter);
    if (list) {
      list.innerHTML = visible.map(item => card(item)).join("");
      watchImages(list);
    }
    if (status && list) status.textContent = visible.length ? `${visible.length} titulares recientes. Abre cada enlace para leer la noticia en su fuente original.` : "No hay titulares para esta categoría por ahora.";
  }
  document.querySelectorAll(".filtro-noticia").forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filtro;
      document.querySelectorAll(".filtro-noticia").forEach(item => {
        const selected = item === button;
        item.classList.toggle("activo", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      render();
    });
  });
  fetch(endpoint, {cache:"no-store"})
    .then(response => { if (!response.ok) throw new Error("No disponible"); return response.json(); })
    .then(data => {
      items = Array.isArray(data.items) ? data.items : [];
      if (updated && data.updatedAt) updated.textContent = "Actualizado el " + formatDate(data.updatedAt) + " · Fuentes: agregadores y medios enlazados.";
      if (homeCards) {
        const featured = items.slice(0, 3);
        homeCards.innerHTML = featured.map(item => card(item, true)).join("");
        watchImages(homeCards);
        const message = document.getElementById("estado-noticias-inicio");
        if (message && !featured.length) message.textContent = "La primera actualización automática está en preparación.";
      }
      render();
    })
    .catch(() => {
      if (status) status.textContent = "No pudimos cargar las noticias en este momento. Intenta de nuevo más tarde.";
      const message = document.getElementById("estado-noticias-inicio");
      if (message) message.textContent = "Las noticias no están disponibles temporalmente.";
    });
})();
