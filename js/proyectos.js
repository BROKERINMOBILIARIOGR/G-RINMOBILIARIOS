(() => {
  const root = document.getElementById("lista-proyectos");
  const message = document.getElementById("mensaje-proyectos");
  let projects = [];
  let translations = {};

  function makeCard(source) {
    const project = window.localizeListing(source, "projects", translations);
    const card = document.createElement("article");
    card.className = "card card-proyecto";
    const link = document.createElement("a");
    link.className = "card-proyecto-link";
    link.href = `proyecto.html?id=${encodeURIComponent(project.id)}`;
    const image = document.createElement("img");
    image.src = (project.images || [])[0] || "logo.jpeg";
    image.alt = project.title || "Proyecto inmobiliario";
    const title = document.createElement("h3");
    title.textContent = project.title || "Proyecto inmobiliario";
    const summary = document.createElement("p");
    summary.textContent = project.summary || "Conoce los detalles de este proyecto.";
    const prompt = document.createElement("span");
    prompt.className = "ver-detalle";
    prompt.textContent = window.siteText("Ver detalles ↗");
    link.append(image, title, summary, prompt);
    const shareImage = (project.images || [])[0];
    const shareUrl = window.sharePageUrl("proyectos", project.id, shareImage);
    const share = window.createShareActions(project.title || "Proyecto inmobiliario", shareUrl, shareImage);
    card.append(link, share);
    return card;
  }

  function render() {
    const visibleProjects = projects.map(makeCard);
    root.replaceChildren(...visibleProjects);
    if (!projects.length) message.textContent = window.siteText("Pronto publicaremos nuevos proyectos.");
  }

  Promise.all([
    fetch("data/proyectos.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar la lista de proyectos.");
      return response.json();
    }),
    window.siteTranslationReady
  ])
    .then(([loadedProjects, loadedTranslations]) => {
      projects = loadedProjects;
      translations = loadedTranslations;
      render();
    })
    .catch(() => { message.textContent = window.siteLanguage() === "en" ? "Projects could not be loaded. Please try again later." : "No se pudieron cargar los proyectos. Intenta de nuevo más tarde."; });

  document.addEventListener("site-language-change", render);
})();
