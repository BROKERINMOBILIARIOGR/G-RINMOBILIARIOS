(() => {
  const status = document.getElementById("detalle-estado");
  const card = document.getElementById("detalle-propiedad");
  const id = new URLSearchParams(window.location.search).get("id");
  const money = (value) => new Intl.NumberFormat(window.siteLanguage() === "en" ? "en-US" : "es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value) || 0);
  let property = null;
  let translations = {};

  function render() {
    if (!property) return;
    const visible = window.localizeListing(property, "properties", translations);
    document.title = `${visible.title} | ${window.siteLanguage() === "en" ? "Broker Real Estate G&R" : "Broker Inmobiliario G&R"}`;
    document.getElementById("detalle-titulo").textContent = visible.title || window.siteText("Propiedad en venta");
    document.getElementById("detalle-ubicacion").textContent = [visible.city, visible.department].filter(Boolean).join(", ");
    document.getElementById("detalle-tipo").textContent = visible.type || window.siteText("Inmueble");
    document.getElementById("detalle-precio").textContent = money(property.price);
    document.getElementById("detalle-resumen").textContent = visible.summary || "";
    document.getElementById("detalle-descripcion").textContent = visible.details || "";
    const gallery = document.getElementById("detalle-galeria");
    gallery.replaceChildren();
    const paths = property.images && property.images.length ? property.images : ["logo.jpeg"];
    paths.forEach((path, index) => {
      const image = document.createElement("img");
      image.src = path;
      image.alt = `${visible.title || window.siteText("Propiedad")} — ${window.siteLanguage() === "en" ? "photo" : "foto"} ${index + 1}`;
      image.loading = index === 0 ? "eager" : "lazy";
      image.className = index === 0 ? "imagen-principal" : "imagen-galeria";
      gallery.append(image);
    });
    const items = [];
    if (property.bedrooms) items.push(window.siteLanguage() === "en" ? `${property.bedrooms} bedrooms` : `${property.bedrooms} habitaciones`);
    if (property.bathrooms) items.push(window.siteLanguage() === "en" ? `${property.bathrooms} bathrooms` : `${property.bathrooms} baños`);
    if (property.area) items.push(`${property.area} m²`);
    if (property.areaHectares) {
      const english = window.siteLanguage() === "en";
      const hectares = new Intl.NumberFormat(english ? "en-US" : "es-CO", { maximumFractionDigits: 4 }).format(Number(property.areaHectares));
      items.push(`${hectares} ${english ? "hectares" : "hectáreas"}`);
    }
    const characteristics = document.getElementById("detalle-caracteristicas");
    characteristics.replaceChildren();
    if (items.length) {
      const heading = document.createElement("h3");
      heading.textContent = window.siteText("Características");
      const list = document.createElement("ul");
      items.forEach((text) => { const li = document.createElement("li"); li.textContent = text; list.append(li); });
      characteristics.append(heading, list);
    }
    const shareImage = (property.images || [])[0];
    document.getElementById("share-propiedad").replaceChildren(
      window.createShareActions(visible.title || window.siteText("Propiedad en venta"), window.sharePageUrl("propiedades", property.id, shareImage), shareImage)
    );
    const message = window.siteLanguage() === "en"
      ? `Hello, I would like more information about ${visible.title}.`
      : `Hola, quisiera más información sobre la propiedad ${visible.title}.`;
    document.getElementById("contactar-propiedad").href = "https://wa.me/573243716454?text=" + encodeURIComponent(message);
    status.hidden = true;
    card.hidden = false;
  }

  Promise.all([
    fetch("data/propiedades.json", { cache: "no-store" }).then((response) => { if (!response.ok) throw new Error("No se pudo cargar la propiedad."); return response.json(); }),
    window.siteTranslationReady
  ])
    .then(([properties, loadedTranslations]) => {
      property = properties.find((item) => item.id === id);
      if (!property) throw new Error("No encontramos esa propiedad.");
      window.trackListingAnalytics?.("view", property.id, property.title, "property");
      translations = loadedTranslations;
      render();
    })
    .catch((error) => { status.textContent = window.siteLanguage() === "en" ? "This property could not be found." : error.message; status.classList.add("error"); });

  document.addEventListener("site-language-change", render);
})();
