(() => {
  const root = document.getElementById("proyectos-destacados");
  const message = document.getElementById("mensaje-destacados");
  if (!root) return;
  let projects = [];
  let translations = {};

  function render() {
    const featured = projects.filter((project) => project.featured).slice(0, 3);
    root.replaceChildren();
    featured.forEach((source) => {
        const project = window.localizeListing(source, "projects", translations);
        const card = document.createElement("article");
        card.className = "card";
        const image = document.createElement("img");
        image.src = (project.images || [])[0] || "logo.jpeg";
        image.alt = project.title || "Proyecto inmobiliario";
        const title = document.createElement("h3");
        title.textContent = project.title || "Proyecto inmobiliario";
        const summary = document.createElement("p");
        summary.textContent = project.summary || window.siteText("Conoce nuestros proyectos.");
        const gallery = document.createElement("div");
        gallery.className = "galeria-proyecto";
        (project.images || []).slice(1, 3).forEach((src) => {
          const thumbnail = document.createElement("img");
          thumbnail.src = src;
          thumbnail.alt = "Imagen de " + (project.title || "proyecto");
          gallery.append(thumbnail);
        });
        const link = document.createElement("a");
        link.className = "card-proyecto-link";
        link.href = `proyecto.html?id=${encodeURIComponent(project.id)}`;
        link.append(image, title, summary, gallery);
        const shareImage = (project.images || [])[0];
        const shareUrl = window.sharePageUrl("proyectos", project.id, shareImage);
        const share = window.createShareActions(project.title || "Proyecto inmobiliario", shareUrl, shareImage);
        card.append(link, share);
        root.append(card);
      });
    if (!featured.length) message.textContent = window.siteText("Pronto publicaremos proyectos destacados.");
  }

  Promise.all([
    fetch("data/proyectos.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("No se pudieron cargar los proyectos.");
      return response.json();
    }),
    window.siteTranslationReady
  ])
    .then(([loadedProjects, loadedTranslations]) => { projects = loadedProjects; translations = loadedTranslations; render(); })
    .catch(() => { message.textContent = window.siteLanguage() === "en" ? "Projects could not be loaded. Please try again later." : "No se pudieron cargar los proyectos. Intenta de nuevo más tarde."; });

  document.addEventListener("site-language-change", render);
})();
