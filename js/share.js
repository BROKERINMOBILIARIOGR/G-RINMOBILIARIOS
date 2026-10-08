(() => {
  let nextMenuId = 0;

  function closeMenu(actions) {
    const toggle = actions.querySelector(".share-toggle");
    const options = actions.querySelector(".share-options");
    actions.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    options.hidden = true;
  }

  function makeLink(label, href, className) {
    const link = document.createElement("a");
    link.className = `share-button ${className}`;
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
  }

  function shareLabel() {
    return window.siteLanguage?.() === "en" ? "Share" : "Compartir";
  }

  function refreshShareLabels() {
    document.querySelectorAll(".share-actions").forEach((actions) => {
      const title = actions.dataset.shareTitle || "";
      actions.setAttribute("aria-label", `${shareLabel()} ${title}`.trim());
      const toggle = actions.querySelector(".share-toggle");
      toggle.setAttribute("aria-label", shareLabel());
      toggle.title = shareLabel();
      const status = actions.querySelector(".share-status");
      if (status) status.textContent = "";
    });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest(".share-actions")) return;
    document.querySelectorAll(".share-actions.is-open").forEach(closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      document.querySelectorAll(".share-actions.is-open").forEach(closeMenu);
    }
  });
  document.addEventListener("site-language-change", refreshShareLabels);

  window.sharePageUrl = (collection, identifier, image) => {
    const url = new URL(`compartir/${collection}/${encodeURIComponent(identifier)}.html`, window.location.href);
    url.searchParams.set("v", image || "logo.jpeg");
    return url.href;
  };

  window.createShareActions = (title, url, image) => {
    const actions = document.createElement("div");
    actions.className = "share-actions";
    actions.setAttribute("role", "group");
    actions.dataset.shareTitle = title;
    actions.setAttribute("aria-label", `${shareLabel()} ${title}`);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "share-toggle";
    toggle.setAttribute("aria-label", shareLabel());
    toggle.setAttribute("aria-expanded", "false");
    toggle.title = shareLabel();
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("width", "20");
    icon.setAttribute("height", "20");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    const lines = document.createElementNS("http://www.w3.org/2000/svg", "path");
    lines.setAttribute("d", "M8.7 10.65 15.3 6.35M8.7 13.35l6.6 4.3");
    const nodes = [[18, 5], [6, 12], [18, 19]].map(([x, y]) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", "3");
      return circle;
    });
    icon.append(lines, ...nodes);
    toggle.append(icon);

    const options = document.createElement("div");
    options.className = "share-options";
    options.id = `share-options-${++nextMenuId}`;
    options.hidden = true;
    toggle.setAttribute("aria-controls", options.id);

    const text = `${title} ${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    const whatsapp = makeLink("WhatsApp", whatsappUrl, "share-whatsapp");
    whatsapp.addEventListener("click", async (event) => {
      if (!image || !navigator.share || !navigator.canShare) return;
      event.preventDefault();
      closeMenu(actions);
      try {
        const imageUrl = new URL(image, document.baseURI);
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error("No se pudo cargar la imagen");
        const blob = await response.blob();
        const file = new File([blob], imageUrl.pathname.split("/").pop() || "propiedad.jpg", {
          type: blob.type || "image/jpeg"
        });
        if (!navigator.canShare({ files: [file] })) {
          window.location.assign(whatsappUrl);
          return;
        }
        await navigator.share({ files: [file], text: `${title}\n${url}` });
      } catch (error) {
        if (error.name === "AbortError") return;
        status.textContent = window.siteLanguage?.() === "en" ? "Could not attach the photo. Use this link to share it: " : "No se pudo adjuntar la foto. Usa este enlace para compartirla: ";
        status.append(makeLink(window.siteLanguage?.() === "en" ? "Open WhatsApp" : "Abrir WhatsApp", whatsappUrl, "share-whatsapp"));
      }
    });
    options.append(
      whatsapp,
      makeLink("Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "share-facebook")
    );

    const instagram = document.createElement("button");
    instagram.type = "button";
    instagram.className = "share-button share-instagram";
    instagram.textContent = "Instagram";
    instagram.addEventListener("click", async () => {
      closeMenu(actions);
      try {
        if (navigator.share) {
          await navigator.share({ title, text: title, url });
          return;
        }
        await navigator.clipboard.writeText(url);
        status.textContent = window.siteLanguage?.() === "en" ? "Link copied. Paste it on Instagram to share." : "Enlace copiado. Pégalo en Instagram para compartirlo.";
      } catch (error) {
        if (error.name === "AbortError") return;
        status.textContent = window.siteLanguage?.() === "en" ? "Copy this link and share it on Instagram: " : "Copia este enlace y compártelo en Instagram: ";
        const copy = document.createElement("a");
        copy.href = url;
        copy.textContent = title;
        copy.target = "_blank";
        copy.rel = "noopener noreferrer";
        status.append(copy);
      }
    });

    const status = document.createElement("span");
    status.className = "share-status";
    status.setAttribute("role", "status");
    options.append(instagram);
    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      document.querySelectorAll(".share-actions.is-open").forEach(closeMenu);
      if (!isOpen) {
        actions.classList.add("is-open");
        options.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
      }
    });
    options.addEventListener("click", (event) => {
      if (event.target.closest("a.share-button")) closeMenu(actions);
    });
    actions.append(toggle, options, status);
    return actions;
  };
})();
