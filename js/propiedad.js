(() => {
  const status = document.getElementById("detalle-estado");
  const card = document.getElementById("detalle-propiedad");
  const id = new URLSearchParams(window.location.search).get("id");
  const money = (value) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value) || 0);

  fetch("data/propiedades.json", { cache: "no-store" })
    .then((response) => { if (!response.ok) throw new Error("No se pudo cargar la propiedad."); return response.json(); })
    .then((properties) => {
      const property = properties.find((item) => item.id === id);
      if (!property) throw new Error("No encontramos esa propiedad.");
      document.title = property.title + " | Broker Inmobiliario G&R";
      document.getElementById("detalle-titulo").textContent = property.title || "Propiedad en venta";
      document.getElementById("detalle-ubicacion").textContent = [property.city, property.department].filter(Boolean).join(", ");
      document.getElementById("detalle-tipo").textContent = property.type || "Inmueble";
      document.getElementById("detalle-precio").textContent = money(property.price);
      document.getElementById("detalle-resumen").textContent = property.summary || "";
      document.getElementById("detalle-descripcion").textContent = property.details || "";
      const gallery = document.getElementById("detalle-galeria");
      const paths = property.images && property.images.length ? property.images : ["logo.jpeg"];
      paths.forEach((path, index) => {
        const image = document.createElement("img");
        image.src = path;
        image.alt = (property.title || "Propiedad") + " — foto " + (index + 1);
        image.loading = index === 0 ? "eager" : "lazy";
        image.className = index === 0 ? "imagen-principal" : "imagen-galeria";
        gallery.append(image);
      });
      const items = [];
      if (property.bedrooms) items.push(property.bedrooms + " habitaciones");
      if (property.bathrooms) items.push(property.bathrooms + " baños");
      if (property.area) items.push(property.area + " m²");
      const characteristics = document.getElementById("detalle-caracteristicas");
      if (items.length) {
        const heading = document.createElement("h3");
        heading.textContent = "Características";
        const list = document.createElement("ul");
        items.forEach((text) => { const li = document.createElement("li"); li.textContent = text; list.append(li); });
        characteristics.append(heading, list);
      } else characteristics.hidden = true;
      const message = "Hola, quisiera más información sobre la propiedad " + property.title + ".";
      document.getElementById("contactar-propiedad").href = "https://wa.me/573243716454?text=" + encodeURIComponent(message);
      status.hidden = true;
      card.hidden = false;
    })
    .catch((error) => { status.textContent = error.message; status.classList.add("error"); });
})();
