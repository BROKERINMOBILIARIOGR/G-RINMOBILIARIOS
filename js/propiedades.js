(() => {
  const grid = document.getElementById("listaPropiedades");
  const status = document.getElementById("estadoPropiedades");
  let properties = [];

  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ").toLowerCase().trim();
  const money = (value) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value) || 0);

  function render(list) {
    grid.replaceChildren();
    list.forEach((property) => {
      const card = document.createElement("article");
      card.className = "propiedad-card";
      const price = document.createElement("span");
      price.className = "precio";
      price.textContent = money(property.price);
      const image = document.createElement("img");
      image.src = (property.images || [])[0] || "logo.jpeg";
      image.alt = property.title || "Propiedad en venta";
      image.loading = "lazy";
      image.addEventListener("error", () => { image.src = "logo.jpeg"; }, { once: true });
      const title = document.createElement("h3");
      title.textContent = property.title || "Propiedad en venta";
      const type = document.createElement("p");
      type.className = "tipo-propiedad";
      type.textContent = property.type || "Inmueble";
      const location = document.createElement("p");
      location.className = "ubicacion";
      location.textContent = [property.city, property.department].filter(Boolean).join(", ");
      const summary = document.createElement("p");
      summary.className = "resumen-propiedad";
      summary.textContent = property.summary || "";
      const link = document.createElement("a");
      link.className = "btn-ver";
      link.href = `propiedad.html?id=${encodeURIComponent(property.id)}`;
      link.textContent = "Ver más";
      card.append(price, image, title, type, location, summary, link);
      grid.append(card);
    });
    status.textContent = list.length ? `${list.length} propiedad${list.length === 1 ? "" : "es"} disponible${list.length === 1 ? "" : "s"}.` : "No encontramos propiedades con esos filtros.";
  }

  window.filtrarPropiedades = () => {
    const departmentSelect = document.getElementById("departamento");
    const department = departmentSelect.value ? normalize(departmentSelect.selectedOptions[0]?.textContent) : "";
    const city = normalize(document.getElementById("ciudad").value);
    const type = normalize(document.getElementById("tipo").value);
    const maxPrice = Number(document.getElementById("precioMax").value) || 0;
    const filtered = properties.filter((property) =>
      (!department || normalize(property.department).includes(department)) &&
      (!city || normalize(property.city).includes(city)) &&
      (!type || normalize(property.type).includes(type)) &&
      (!maxPrice || Number(property.price) <= maxPrice)
    );
    render(filtered);
  };

  document.getElementById("ciudad").addEventListener("keydown", (event) => {
    if (event.key === "Enter") window.filtrarPropiedades();
  });
  ["departamento", "tipo", "precioMax"].forEach((id) => {
    document.getElementById(id).addEventListener("change", window.filtrarPropiedades);
  });

  fetch("data/propiedades.json", { cache: "no-store" })
    .then((response) => { if (!response.ok) throw new Error("No se pudo cargar el catálogo."); return response.json(); })
    .then((data) => { properties = Array.isArray(data) ? data : []; render(properties); })
    .catch(() => { status.textContent = "No se pudo cargar el catálogo de propiedades. Intenta actualizar la página."; status.classList.add("error"); });
})();
