(() => {
  const status = document.getElementById("detalle-estado");
  const card = document.getElementById("detalle-proyecto");
  const id = new URLSearchParams(window.location.search).get("id");

  fetch("data/proyectos.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar el proyecto.");
      return response.json();
    })
    .then((projects) => {
      const project = projects.find((item) => item.id === id);
      if (!project) throw new Error("No encontramos ese proyecto.");

      document.title = `${project.title} | Broker Inmobiliario G&R`;
      document.getElementById("detalle-titulo").textContent = project.title || "Proyecto inmobiliario";
      document.getElementById("detalle-ubicacion").textContent = project.location || "";
      document.getElementById("detalle-precio").textContent = project.price || "";
      document.getElementById("detalle-resumen").textContent = project.summary || "";
      document.getElementById("detalle-descripcion").textContent = project.details || "";

      const gallery = document.getElementById("detalle-galeria");
      const paths = project.images && project.images.length ? project.images : ["logo.jpeg"];
      paths.forEach((path, index) => {
        const image = document.createElement("img");
        image.src = path;
        image.alt = `${project.title || "Proyecto"} — imagen ${index + 1}`;
        image.loading = index === 0 ? "eager" : "lazy";
        image.className = index === 0 ? "imagen-principal" : "imagen-galeria";
        gallery.append(image);
      });

      const features = project.features || [];
      if (features.length) {
        const list = document.getElementById("detalle-caracteristicas");
        features.forEach((feature) => {
          const item = document.createElement("li");
          item.textContent = feature;
          list.append(item);
        });
        document.getElementById("seccion-caracteristicas").hidden = false;
      }

      const shareImage = (project.images || [])[0];
      document.getElementById("share-proyecto").replaceChildren(
        window.createShareActions(
          project.title || "Proyecto inmobiliario",
          window.sharePageUrl("proyectos", project.id, shareImage),
          shareImage
        )
      );
      const message = `Hola, quisiera más información sobre ${project.title}.`;
      document.getElementById("contactar-proyecto").href = `https://wa.me/573243716454?text=${encodeURIComponent(message)}`;
      status.hidden = true;
      card.hidden = false;
    })
    .catch((error) => {
      status.textContent = error.message;
      status.classList.add("error");
    });
})();
