(() => {
  const measurementId = "G-E7Z5XTEXG7";
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", measurementId);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.append(script);

  const safeId = (value) => String(value || "anuncio")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 26) || "anuncio";

  window.trackListingAnalytics = (action, id, title, type) => {
    const actionCode = { view: "v", click: "c", contact: "w" }[action] || "x";
    const typeCode = type === "project" ? "proj" : "prop";
    const event = `ad_${actionCode}_${typeCode}_${safeId(id)}`;
    window.gtag("event", event, {
      ad_id: String(id || ""),
      ad_name: String(title || "").slice(0, 100),
      ad_type: type === "project" ? "project" : "property",
      transport_type: "beacon"
    });
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;

    let destination;
    try { destination = new URL(link.href, window.location.href); }
    catch (_) { return; }

    const match = destination.pathname.match(/\/(proyecto|propiedad)\.html$/i);
    const id = destination.searchParams.get("id");
    if (match && id) {
      const title = link.closest("article")?.querySelector("h2, h3")?.textContent?.trim() || "";
      window.trackListingAnalytics("click", id, title, match[1] === "proyecto" ? "project" : "property");
      return;
    }

    if (destination.hostname === "wa.me" || destination.hostname.endsWith("whatsapp.com")) {
      const currentId = new URLSearchParams(window.location.search).get("id");
      const currentType = /(^|\/)proyecto\.html$/i.test(window.location.pathname) ? "project" : "property";
      if (currentId) {
        const title = document.querySelector("#detalle-titulo")?.textContent?.trim() || "";
        window.trackListingAnalytics("contact", currentId, title, currentType);
      } else {
        window.gtag("event", "contact_click", {
          method: "whatsapp",
          page_path: window.location.pathname,
          transport_type: "beacon"
        });
      }
    }
  });
})();
