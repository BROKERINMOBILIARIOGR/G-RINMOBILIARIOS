(() => {
  function makeLink(label, href, className) {
    const link = document.createElement("a");
    link.className = `share-button ${className}`;
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    return link;
  }

  window.createShareActions = (title, url) => {
    const actions = document.createElement("div");
    actions.className = "share-actions";
    actions.setAttribute("role", "group");
    actions.setAttribute("aria-label", `Compartir ${title}`);

    const text = `${title} ${url}`;
    actions.append(
      makeLink("WhatsApp", `https://wa.me/?text=${encodeURIComponent(text)}`, "share-whatsapp"),
      makeLink("Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title)}`, "share-facebook")
    );

    const instagram = document.createElement("button");
    instagram.type = "button";
    instagram.className = "share-button share-instagram";
    instagram.textContent = "Instagram";
    instagram.addEventListener("click", async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title, text: title, url });
          return;
        }
        await navigator.clipboard.writeText(url);
        status.textContent = "Enlace copiado. Pégalo en Instagram para compartirlo.";
      } catch (error) {
        if (error.name === "AbortError") return;
        status.textContent = "Copia este enlace y compártelo en Instagram: ";
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
    actions.append(instagram, status);
    return actions;
  };
})();
