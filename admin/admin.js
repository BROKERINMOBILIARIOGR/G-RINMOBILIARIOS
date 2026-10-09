(() => {
  const tokenKey = "gr-project-admin-token";
  const loginView = document.getElementById("login-view");
  const dashboard = document.getElementById("dashboard-view");
  const token = () => sessionStorage.getItem(tokenKey) || "";
  let currentUser = null;
  let projects = [];
  let englishTranslations = {};
  let translationSupport = false;

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (token()) headers.set("Authorization", `Bearer ${token()}`);
    if (options.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...options, headers, cache: "no-store" });
    let body = {};
    try { body = await response.json(); } catch (_) { body = {}; }
    if (!response.ok) throw new Error(body.error || "No se pudo completar la solicitud.");
    return body;
  }

  function showMessage(text, isError = false) {
    const target = document.getElementById("dashboard-message");
    target.textContent = text;
    target.classList.toggle("error", isError);
  }

  function setLoggedIn(user) {
    currentUser = user;
    loginView.hidden = true;
    dashboard.hidden = false;
    document.getElementById("user-controls").hidden = false;
    document.getElementById("user-label").textContent = user.username;
    document.getElementById("workers-section").hidden = user.role !== "owner";
    loadProjects();
    loadAnalytics();
    if (user.role === "owner") loadWorkers();
  }

  function clearSession() {
    sessionStorage.removeItem(tokenKey);
    currentUser = null;
    dashboard.hidden = true;
    loginView.hidden = false;
    document.getElementById("user-controls").hidden = true;
  }

  const loginForm = document.getElementById("login-form");
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);
    const message = document.getElementById("login-message");
    message.textContent = "Verificando acceso…";
    try {
      const result = await api("/api/login", { method: "POST", body: JSON.stringify({
        username: form.get("username"), password: form.get("password")
      }) });
      sessionStorage.setItem(tokenKey, result.token);
      loginForm.reset();
      message.textContent = "";
      setLoggedIn(result.user);
    } catch (error) { message.textContent = error.message; }
  });

  document.getElementById("logout-button").addEventListener("click", async () => {
    try { await api("/api/logout", { method: "POST", body: "{}" }); } catch (_) { /* La sesión se elimina localmente igualmente. */ }
    clearSession();
  });

  async function loadProjects() {
    showMessage("Cargando proyectos…");
    try {
      const [{ projects: loaded }, translationResult] = await Promise.all([
        api("/api/projects"),
        api("/api/translations-en").catch(() => ({ translations: {} }))
      ]);
      projects = loaded;
      englishTranslations = translationResult.translations.projects || {};
      translationSupport = true;
      renderProjects();
      showMessage(loaded.length ? "Puedes crear, editar o eliminar proyectos." : "Todavía no hay proyectos.");
    } catch (error) {
      if (error.message.includes("sesión")) clearSession();
      showMessage(error.message, true);
    }
  }

  const analyticsRange = document.getElementById("analytics-range");
  const analyticsMessage = document.getElementById("analytics-message");
  const analyticsResults = document.getElementById("analytics-results");
  const numberFormat = new Intl.NumberFormat("es-CO");

  function renderAnalyticsTable(targetId, rows, includePeople) {
    const body = document.getElementById(targetId);
    body.replaceChildren();
    if (!rows.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = includePeople ? 3 : 2;
      cell.className = "analytics-empty";
      cell.textContent = "Aún no hay datos para este periodo.";
      row.append(cell);
      body.append(row);
      return;
    }
    rows.forEach((item) => {
      const row = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = item.name || "Anuncio";
      const count = document.createElement("td");
      count.textContent = numberFormat.format(item.count || 0);
      row.append(name, count);
      if (includePeople) {
        const people = document.createElement("td");
        people.textContent = numberFormat.format(item.people || 0);
        row.append(people);
      }
      body.append(row);
    });
  }

  function renderAnalytics(data) {
    const summary = document.getElementById("analytics-summary");
    summary.replaceChildren();
    [
      ["Personas", data.overview.activeUsers],
      ["Sesiones", data.overview.sessions],
      ["Páginas vistas", data.overview.pageViews],
      ["Clics a WhatsApp", data.overview.contacts]
    ].forEach(([label, value]) => {
      const card = document.createElement("div");
      card.className = "analytics-card";
      const caption = document.createElement("span");
      caption.textContent = label;
      const number = document.createElement("strong");
      number.textContent = numberFormat.format(value || 0);
      card.append(caption, number);
      summary.append(card);
    });
    renderAnalyticsTable("analytics-views", data.topViews || [], true);
    renderAnalyticsTable("analytics-clicks", data.topClicks || [], false);
    analyticsResults.hidden = false;
  }

  async function loadAnalytics() {
    analyticsMessage.textContent = "Cargando estadísticas…";
    analyticsResults.hidden = true;
    try {
      const data = await api(`/api/analytics?days=${encodeURIComponent(analyticsRange.value)}`);
      renderAnalytics(data);
      analyticsMessage.textContent = `Datos de los últimos ${analyticsRange.value} días.`;
    } catch (error) {
      analyticsMessage.textContent = error.message;
    }
  }

  document.getElementById("analytics-refresh").addEventListener("click", loadAnalytics);
  analyticsRange.addEventListener("change", loadAnalytics);

  function renderProjects() {
    const root = document.getElementById("project-list");
    root.replaceChildren();
    projects.forEach((project) => {
      const row = document.createElement("article");
      row.className = "project-row";
      const image = document.createElement("img");
      image.src = (project.images || [])[0] || "/logo.jpeg";
      image.alt = "";
      const description = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = project.title;
      const summary = document.createElement("p");
      summary.textContent = project.summary || "";
      description.append(title, summary);
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "button button-quiet";
      edit.textContent = "Editar";
      edit.addEventListener("click", () => openProject(project));
      const actions = document.createElement("div");
      actions.className = "project-actions";
      actions.append(edit);
      if (currentUser?.role === "owner") {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "button button-danger";
        remove.textContent = "Eliminar";
        remove.addEventListener("click", async () => {
          if (!window.confirm(`¿Eliminar el proyecto "${project.title}" de la página? Esta acción no se puede deshacer desde el panel.`)) return;
          remove.disabled = true;
          showMessage(`Eliminando y publicando "${project.title}"…`);
          try {
            const result = await api(`/api/projects/${encodeURIComponent(project.id)}`, { method: "DELETE" });
            await loadProjects();
            showMessage(result.published ? `"${project.title}" se eliminó y publicó en GitHub.` : "El proyecto se eliminó.");
          } catch (error) {
            showMessage(error.message, true);
            remove.disabled = false;
          }
        });
        actions.append(remove);
      }
      row.append(image, description, actions);
      root.append(row);
    });
  }

  const dialog = document.getElementById("project-dialog");
  const form = document.getElementById("project-form");
  let currentProjectImages = [];
  function renderCurrentImages() {
    const images = document.getElementById("current-images");
    images.replaceChildren();
    currentProjectImages.forEach((src, index) => {
      const item = document.createElement("div");
      item.className = "current-image-item";
      const image = document.createElement("img");
      image.src = "/" + src;
      image.alt = "Imagen actual del proyecto";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-image-button";
      remove.textContent = "Quitar";
      remove.setAttribute("aria-label", "Quitar esta imagen");
      remove.addEventListener("click", () => {
        currentProjectImages = currentProjectImages.filter((path) => path !== src);
        renderCurrentImages();
      });
      const reorder = document.createElement("div");
      reorder.className = "image-order-actions";
      [
        { label: "Mover foto antes", text: "↑", offset: -1, disabled: index === 0 },
        { label: "Mover foto después", text: "↓", offset: 1, disabled: index === currentProjectImages.length - 1 }
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
          [currentProjectImages[index], currentProjectImages[nextIndex]] = [currentProjectImages[nextIndex], currentProjectImages[index]];
          renderCurrentImages();
        });
        reorder.append(move);
      });
      item.append(image, reorder, remove);
      images.append(item);
    });
  }
  function openProject(project = null) {
    const translated = englishTranslations[project?.id] || {};
    form.reset();
    document.getElementById("form-message").textContent = "";
    document.getElementById("form-title").textContent = project ? "Editar proyecto" : "Nuevo proyecto";
    form.elements.id.value = project?.id || "";
    form.elements.title.value = project?.title || "";
    form.elements.summary.value = project?.summary || "";
    form.elements.titleEn.value = project?.titleEn || translated.title || "";
    form.elements.summaryEn.value = project?.summaryEn || translated.summary || "";
    form.elements.location.value = project?.location || "";
    form.elements.price.value = project?.price || "";
    form.elements.details.value = project?.details || "";
    form.elements.features.value = (project?.features || []).join("\n");
    form.elements.locationEn.value = project?.locationEn || translated.location || "";
    form.elements.priceEn.value = project?.priceEn || translated.price || "";
    form.elements.detailsEn.value = project?.detailsEn || translated.details || "";
    form.elements.featuresEn.value = (project?.featuresEn || translated.features || []).join("\n");
    form.elements.featured.checked = Boolean(project?.featured);
    currentProjectImages = [...(project?.images || [])];
    renderCurrentImages();
    dialog.showModal();
  }

  document.getElementById("new-project-button").addEventListener("click", () => openProject());
  document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
  document.getElementById("cancel-dialog").addEventListener("click", () => dialog.close());

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, data: String(reader.result).split(",")[1] });
      reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}.`));
      reader.readAsDataURL(file);
    });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector("button[type=submit]");
    const message = document.getElementById("form-message");
    submit.disabled = true;
    message.textContent = "Guardando el proyecto y publicándolo…";
    try {
      const files = Array.from(form.elements.images.files || []);
      if (files.length > 5) throw new Error("Puedes seleccionar hasta cinco imágenes por envío.");
      if (files.some((file) => file.size > 6 * 1024 * 1024)) throw new Error("Cada imagen debe pesar menos de 6 MB.");
      const spanishDetails = form.elements.details.value.trim();
      const spanishFeatures = form.elements.features.value.split("\n").map((item) => item.trim()).filter(Boolean);
      const englishFeatures = form.elements.featuresEn.value.split("\n").map((item) => item.trim()).filter(Boolean);
      if (form.elements.summary.value.trim() && !form.elements.summaryEn.value.trim()) throw new Error("Agrega también el resumen en inglés.");
      if (translationSupport) {
        if (!form.elements.titleEn.value.trim() || !form.elements.summaryEn.value.trim()) throw new Error("Completa el nombre y el resumen en inglés.");
        if (spanishDetails && !form.elements.detailsEn.value.trim()) throw new Error("Agrega también la descripción en inglés para que la ficha esté completa.");
        if (spanishFeatures.length && !englishFeatures.length) throw new Error("Agrega también las características en inglés.");
      }
      const payload = {
        id: form.elements.id.value,
        title: form.elements.title.value,
        summary: form.elements.summary.value,
        titleEn: form.elements.titleEn.value,
        summaryEn: form.elements.summaryEn.value,
        location: form.elements.location.value,
        locationEn: form.elements.locationEn.value,
        price: form.elements.price.value,
        priceEn: form.elements.priceEn.value,
        details: form.elements.details.value,
        detailsEn: form.elements.detailsEn.value,
        features: spanishFeatures,
        featuresEn: englishFeatures,
        featured: form.elements.featured.checked,
        removeImages: (projects.find((project) => project.id === form.elements.id.value)?.images || [])
          .filter((src) => !currentProjectImages.includes(src)),
        imageOrder: currentProjectImages,
        images: await Promise.all(files.map(readImage))
      };
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token()}` },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar el proyecto.");
      dialog.close();
      await loadProjects();
      showMessage(result.published ? "Proyecto publicado en GitHub. La página se actualizará en unos minutos." : result.error, !result.published);
    } catch (error) { message.textContent = error.message; }
    finally { submit.disabled = false; }
  });

  document.getElementById("publish-button").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    showMessage("Publicando los cambios guardados…");
    try {
      await api("/api/publish", { method: "POST", body: "{}" });
      showMessage("Cambios publicados en GitHub. La página se actualizará en unos minutos.");
    } catch (error) { showMessage(error.message, true); }
    finally { button.disabled = false; }
  });

  async function loadWorkers() {
    try {
      const { workers } = await api("/api/workers");
      const list = document.getElementById("worker-list");
      list.replaceChildren();
      workers.forEach((worker) => {
        const row = document.createElement("div");
        row.className = "worker-row";
        const label = document.createElement("span");
        label.textContent = `${worker.username}${worker.active ? "" : " (desactivado)"}`;
        row.append(label);
        if (worker.active) {
          const disable = document.createElement("button");
          disable.type = "button";
          disable.className = "button button-danger";
          disable.textContent = "Desactivar";
          disable.addEventListener("click", async () => {
            if (!window.confirm(`¿Desactivar la cuenta de ${worker.username}?`)) return;
            try { await api(`/api/workers/${encodeURIComponent(worker.username)}`, { method: "DELETE" }); await loadWorkers(); }
            catch (error) { showMessage(error.message, true); }
          });
          row.append(disable);
        }
        list.append(row);
      });
    } catch (error) { showMessage(error.message, true); }
  }

  document.getElementById("worker-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
      await api("/api/workers", { method: "POST", body: JSON.stringify({
        username: values.get("username"), password: values.get("password")
      }) });
      event.currentTarget.reset();
      showMessage("Cuenta de trabajador creada.");
      loadWorkers();
    } catch (error) { showMessage(error.message, true); }
  });

  if (token()) {
    api("/api/me").then(({ user }) => setLoggedIn(user)).catch(clearSession);
  }
})();
