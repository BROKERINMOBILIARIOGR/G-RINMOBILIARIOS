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

  function card(item, featured = false) {
    const link = safeUrl(item.url);
    if (featured) return `<article class="noticia-destacada"><a href="${link}" target="_blank" rel="noopener noreferrer">${escapeText(item.title)}</a><p class="noticia-meta">${escapeText(item.source)} · ${formatDate(item.publishedAt)}</p></article>`;
    return `<article class="noticia-card"><span class="noticia-categoria">${escapeText(item.category)}</span><h3><a href="${link}" target="_blank" rel="noopener noreferrer">${escapeText(item.title)}</a></h3><p class="noticia-meta">${escapeText(item.source)} · ${formatDate(item.publishedAt)}</p></article>`;
  }
  function render() {
    const visible = activeFilter === "Todas" ? items : items.filter(item => item.category === activeFilter);
    if (list) list.innerHTML = visible.map(item => card(item)).join("");
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
      if (updated && data.updatedAt) updated.textContent = "Actualizado el " + formatDate(data.updatedAt) + " · Fuentes: Google Noticias y los medios enlazados.";
      if (homeCards) {
        const featured = items.slice(0, 3);
        homeCards.innerHTML = featured.map(item => card(item, true)).join("");
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
