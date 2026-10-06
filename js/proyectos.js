(() => {
  const root = document.getElementById("lista-proyectos");
  const message = document.getElementById("mensaje-proyectos");
  const dialog = document.getElementById("detalle-proyecto");

  function imagePath(project) {
    return (project.images || [])[0] || "logo.jpeg";
  }

  function openDetails(project) {
    document.getElementById("detalle-titulo").textContent = project.title || "Proyecto";
    document.getElementById("detalle-precio").textContent = project.price || "";
    document.getElementById("detalle-ubicacion").textContent = project.location || "";
    document.getElementById("detalle-descripcion").textContent = project.details || project.summary || "";

    const gallery = document.getElementById("detalle-imagenes");
    gallery.replaceChildren();
    (project.images || []).forEach((src) => {
      const image = document.createElement("img");
      image.src = src;
      image.alt = project.title || "Imagen del proyecto";
      gallery.append(image);
    });

    const features = document.getElementById("detalle-caracteristicas");
    features.replaceChildren();
    (project.features || []).forEach((feature) => {
      const item = document.createElement("li");
      item.textContent = feature;
      features.append(item);
    });
    dialog.showModal();
  }

  function makeCard(project) {
    const card = document.createElement("article");
    card.className = "card card-proyecto";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-haspopup", "dialog");
    const image = document.createElement("img");
    image.src = imagePath(project);
    image.alt = project.title || "Proyecto inmobiliario";
    const title = document.createElement("h3");
    title.textContent = project.title || "Proyecto inmobiliario";
    const summary = document.createElement("p");
    summary.textContent = project.summary || "Conoce los detalles de este proyecto.";
    card.append(image, title, summary);
    card.addEventListener("click", () => openDetails(project));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails(project);
      }
    });
    return card;
  }

  document.getElementById("cerrar-detalle").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  fetch("data/proyectos.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar la lista de proyectos.");
      return response.json();
    })
    .then((projects) => {
      root.replaceChildren(...projects.map(makeCard));
      if (!projects.length) message.textContent = "Pronto publicaremos nuevos proyectos.";
    })
    .catch(() => {
      message.textContent = "No se pudieron cargar los proyectos. Intenta de nuevo más tarde.";
    });
})();
