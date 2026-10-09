(() => {
  const status = document.getElementById("detalle-estado");
  const card = document.getElementById("detalle-proyecto");
  const id = new URLSearchParams(window.location.search).get("id");
  let project = null;
  let translations = {};

  function render() {
    if (!project) return;
    const visible = window.localizeListing(project, "projects", translations);
    document.title = `${visible.title} | ${window.siteLanguage() === "en" ? "Broker Real Estate G&R" : "Broker Inmobiliario G&R"}`;
    document.getElementById("detalle-titulo").textContent = visible.title || window.siteText("Proyecto inmobiliario");
    document.getElementById("detalle-ubicacion").textContent = visible.location || "";
    document.getElementById("detalle-precio").textContent = visible.price || "";
    document.getElementById("detalle-resumen").textContent = visible.summary || "";
    document.getElementById("detalle-descripcion").textContent = visible.details || "";
    const gallery = document.getElementById("detalle-galeria");
    gallery.replaceChildren();
    const paths = project.images && project.images.length ? project.images : ["logo.jpeg"];
    paths.forEach((path, index) => {
      const image = document.createElement("img");
      image.src = path;
      image.alt = `${visible.title || window.siteText("Proyecto")} — ${window.siteLanguage() === "en" ? "image" : "imagen"} ${index + 1}`;
      image.loading = index === 0 ? "eager" : "lazy";
      image.className = index === 0 ? "imagen-principal" : "imagen-galeria";
      gallery.append(image);
    });

    const features = visible.features || [];
    const list = document.getElementById("detalle-caracteristicas");
    list.replaceChildren();
    if (features.length) {
      features.forEach((feature) => {
        const item = document.createElement("li");
        item.textContent = feature;
        list.append(item);
      });
      document.getElementById("seccion-caracteristicas").hidden = false;
    } else document.getElementById("seccion-caracteristicas").hidden = true;

    const shareImage = (project.images || [])[0];
    document.getElementById("share-proyecto").replaceChildren(
      window.createShareActions(visible.title || window.siteText("Proyecto inmobiliario"), window.sharePageUrl("proyectos", project.id, shareImage), shareImage)
    );
    const message = window.siteLanguage() === "en"
      ? `Hello, I would like more information about ${visible.title}.`
      : `Hola, quisiera más información sobre ${visible.title}.`;
    document.getElementById("contactar-proyecto").href = `https://wa.me/573243716454?text=${encodeURIComponent(message)}`;
    status.hidden = true;
    card.hidden = false;
  }

  Promise.all([
    fetch("data/proyectos.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar el proyecto.");
      return response.json();
    }),
    window.siteTranslationReady
  ])
    .then(([projects, loadedTranslations]) => {
      project = projects.find((item) => item.id === id);
      if (!project) throw new Error("No encontramos ese proyecto.");
      window.trackListingAnalytics?.("view", project.id, project.title, "project");
      translations = loadedTranslations;
      render();
    })
    .catch((error) => {
      status.textContent = window.siteLanguage() === "en" ? "This project could not be found." : error.message;
      status.classList.add("error");
    });

  document.addEventListener("site-language-change", render);
})();
