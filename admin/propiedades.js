(() => {
  const tokenKey = "gr-project-admin-token";
  const token = () => sessionStorage.getItem(tokenKey) || "";
  const loginView = document.getElementById("login-view");
  const dashboard = document.getElementById("dashboard-view");
  const form = document.getElementById("property-form");
  const dialog = document.getElementById("property-dialog");
  let currentUser = null;
  let properties = [];
  let currentImages = [];
  let englishTranslations = {};
  let translationSupport = false;

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (token()) headers.set("Authorization", "Bearer " + token());
    if (options.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...options, headers, cache: "no-store" });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || "No se pudo completar la solicitud.");
    return data;
  }

  function message(text, error = false, formMessage = false) {
    const node = document.getElementById(formMessage ? "form-message" : "dashboard-message");
    node.textContent = text;
    if (!formMessage) node.classList.toggle("error", error);
  }

  function setLoggedIn(user) {
    currentUser = user;
    loginView.hidden = true;
    dashboard.hidden = false;
    document.getElementById("user-controls").hidden = false;
    document.getElementById("user-label").textContent = user.username;
    loadProperties();
  }

  function clearSession() {
    sessionStorage.removeItem(tokenKey);
    dashboard.hidden = true;
    loginView.hidden = false;
    document.getElementById("user-controls").hidden = true;
  }

  document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    message("Verificando acceso…", false, true);
    try {
      const result = await api("/api/login", { method: "POST", body: JSON.stringify({ username: values.get("username"), password: values.get("password") }) });
      sessionStorage.setItem(tokenKey, result.token);
      event.currentTarget.reset();
      setLoggedIn(result.user);
    } catch (error) { message(error.message, true, true); }
  });

  document.getElementById("logout-button").addEventListener("click", async () => {
    try { await api("/api/logout", { method: "POST", body: "{}" }); } catch (_) {}
    clearSession();
  });

  async function loadProperties() {
    message("Cargando propiedades…");
    try {
      const [result, translated] = await Promise.all([
        api("/api/properties"),
        api("/api/translations-en").catch(() => ({ translations: {} }))
      ]);
      properties = result.properties || [];
      englishTranslations = translated.translations.properties || {};
      translationSupport = true;
      renderProperties();
      message(properties.length ? "Puedes agregar, editar o eliminar propiedades." : "Todavía no hay propiedades.");
    } catch (error) {
      if (error.message.toLowerCase().includes("sesión")) clearSession();
      message(error.message, true);
    }
  }

  function renderProperties() {
    const list = document.getElementById("property-list");
    list.replaceChildren();
    properties.forEach((property) => {
      const row = document.createElement("article");
      row.className = "project-row";
      const image = document.createElement("img");
      image.src = (property.images || [])[0] || "/logo.jpeg";
      image.alt = "";
      const description = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = property.title;
      const summary = document.createElement("p");
      const price = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(property.price || 0);
      summary.textContent = (property.type || "Inmueble") + " · " + (property.city || "") + ", " + (property.department || "") + " · " + price;
      description.append(title, summary);
      const actions = document.createElement("div");
      actions.className = "project-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "button button-quiet";
      edit.textContent = "Editar";
      edit.addEventListener("click", () => openProperty(property));
      actions.append(edit);
      if (currentUser && currentUser.role === "owner") {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "button button-danger";
        remove.textContent = "Eliminar";
        remove.addEventListener("click", async () => {
          if (!window.confirm("¿Eliminar \"" + property.title + "\" de la página de propiedades?")) return;
          remove.disabled = true;
          message("Eliminando y publicando \"" + property.title + "\"…");
          try {
            await api("/api/properties/" + encodeURIComponent(property.id), { method: "DELETE" });
            await loadProperties();
            message("\"" + property.title + "\" se eliminó y publicó en GitHub.");
          } catch (error) { message(error.message, true); remove.disabled = false; }
        });
        actions.append(remove);
      }
      row.append(image, description, actions);
      list.append(row);
    });
  }

  function renderImages() {
    const root = document.getElementById("current-images");
    root.replaceChildren();
    currentImages.forEach((src, index) => {
      const item = document.createElement("div");
      item.className = "current-image-item";
      const image = document.createElement("img");
      image.src = "/" + src;
      image.alt = "Foto guardada";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-image-button";
      remove.textContent = "Quitar";
      remove.addEventListener("click", () => { currentImages = currentImages.filter((path) => path !== src); renderImages(); });
      const reorder = document.createElement("div");
      reorder.className = "image-order-actions";
      [
        { label: "Mover foto antes", text: "↑", offset: -1, disabled: index === 0 },
        { label: "Mover foto después", text: "↓", offset: 1, disabled: index === currentImages.length - 1 }
      ].forEach(({ label, text, offset, disabled }) => {
        const move = document.createElement("button");
        move.type = "button";
        move.className = "image-order-button";
        move.textContent = text;
        move.setAttribute("aria-label", label);
        move.title = label;
        move.disabled = disabled;
        move.addEventListener("click", () => {
          const nextIndex = index + offset;
          [currentImages[index], currentImages[nextIndex]] = [currentImages[nextIndex], currentImages[index]];
          renderImages();
        });
        reorder.append(move);
      });
      item.append(image, reorder, remove);
      root.append(item);
    });
  }

  function openProperty(property = null) {
    const translated = englishTranslations[property?.id] || {};
    form.reset();
    message("", false, true);
    document.getElementById("form-title").textContent = property ? "Editar propiedad" : "Nueva propiedad";
    form.elements.id.value = (property && property.id) || "";
    form.elements.title.value = (property && property.title) || "";
    form.elements.summary.value = (property && property.summary) || "";
    form.elements.titleEn.value = property?.titleEn || translated.title || "";
    form.elements.summaryEn.value = property?.summaryEn || translated.summary || "";
    form.elements.department.value = (property && property.department) || "";
    form.elements.city.value = (property && property.city) || "";
    form.elements.type.value = (property && property.type) || "";
    form.elements.departmentEn.value = property?.departmentEn || translated.department || "";
    form.elements.cityEn.value = property?.cityEn || translated.city || "";
    form.elements.typeEn.value = property?.typeEn || translated.type || "";
    form.elements.price.value = (property && property.price) || "";
    form.elements.bedrooms.value = (property && property.bedrooms) || 0;
    form.elements.bathrooms.value = (property && property.bathrooms) || 0;
    form.elements.area.value = (property && property.area) || 0;
    form.elements.details.value = (property && property.details) || "";
    form.elements.detailsEn.value = property?.detailsEn || translated.details || "";
    currentImages = [...((property && property.images) || [])];
    renderImages();
    dialog.showModal();
  }

  document.getElementById("new-property-button").addEventListener("click", () => openProperty());
  document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
  document.getElementById("cancel-dialog").addEventListener("click", () => dialog.close());

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, data: String(reader.result).split(",")[1] });
      reader.onerror = () => reject(new Error("No se pudo leer " + file.name + "."));
      reader.readAsDataURL(file);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    message("Guardando y publicando la propiedad…", false, true);
    try {
      const files = Array.from(form.elements.images.files || []);
      if (files.length > 5) throw new Error("Puedes agregar hasta cinco fotos por envío.");
      if (files.some((file) => file.size > 6 * 1024 * 1024)) throw new Error("Cada foto debe pesar menos de 6 MB.");
      if (translationSupport) {
        if (!form.elements.titleEn.value.trim()) throw new Error("Completa el nombre en inglés.");
        if (form.elements.summary.value.trim() && !form.elements.summaryEn.value.trim()) throw new Error("Agrega también el resumen en inglés.");
        if (form.elements.details.value.trim() && !form.elements.detailsEn.value.trim()) throw new Error("Agrega también la descripción en inglés para que la ficha esté completa.");
      }
      const original = properties.find((item) => item.id === form.elements.id.value);
      const body = {
        id: form.elements.id.value,
        title: form.elements.title.value,
        titleEn: form.elements.titleEn.value,
        summary: form.elements.summary.value,
        summaryEn: form.elements.summaryEn.value,
        department: form.elements.department.value,
        departmentEn: form.elements.departmentEn.value,
        city: form.elements.city.value,
        cityEn: form.elements.cityEn.value,
        type: form.elements.type.value,
        typeEn: form.elements.typeEn.value,
        price: form.elements.price.value,
        bedrooms: form.elements.bedrooms.value,
        bathrooms: form.elements.bathrooms.value,
        area: form.elements.area.value,
        details: form.elements.details.value,
        detailsEn: form.elements.detailsEn.value,
        removeImages: ((original && original.images) || []).filter((src) => !currentImages.includes(src)),
        imageOrder: currentImages,
        images: await Promise.all(files.map(readImage))
      };
      const result = await api("/api/properties", { method: "POST", body: JSON.stringify(body) });
      if (!result.published) throw new Error(result.error || "No se pudo publicar la propiedad.");
      dialog.close();
      await loadProperties();
      message("Propiedad publicada en GitHub. La página se actualizará en unos minutos.");
    } catch (error) { message(error.message, true, true); }
    finally { button.disabled = false; }
  });

  if (token()) api("/api/me").then(({ user }) => setLoggedIn(user)).catch(clearSession);
})();
