(() => {
  const labels = {
    "Inicio": "Home", "Proyectos": "Projects", "Proyectos Inmobiliarios": "Real Estate Projects", "Propiedades": "Properties",
    "Propiedades en venta": "Properties for Sale", "Vende": "Sell",
    "Contáctenos": "Contact Us", "Contacto": "Contact", "Contáctanos": "Contact Us",
    "Invierte con confianza en proyectos inmobiliarios.": "Invest with confidence in real estate projects.",
    "Explora nuestras oportunidades de inversión": "Explore our investment opportunities",
    "Encuentra tu inmueble ideal": "Find your ideal property",
    "Nuestros Asesores": "Our Agents", "Nuestros asesores": "Our Agents",
    "Quiénes somos": "About Us", "Proyectos destacados": "Featured Projects",
    "Ver todos los proyectos": "View all projects",
    "Información de contacto": "Contact Information", "¿Listo para empezar?": "Ready to get started?",
    "Escríbenos ahora y te asesoramos sin compromiso.": "Message us today for a no-obligation consultation.",
    "Estamos listos para ayudarte a invertir o vender tu propiedad": "We are ready to help you invest in or sell your property.",
    "Escribir ahora": "Message Us", "¿Listo para vender?": "Ready to sell?",
    "Agenda tu valoración gratuita ahora mismo": "Schedule your free property valuation today.",
    "Vende tu propiedad": "Sell Your Property", "Vende tu propiedad sin complicaciones": "Sell your property with ease",
    "📱 Ver catálogo en WhatsApp": "📱 View our WhatsApp catalog", "🚀 Quiero invertir": "🚀 I want to invest",
    "Te ayudamos a vender rápido, seguro y al mejor precio": "We help you sell quickly, securely, and for the best price.",
    "En G&R Broker Inmobiliario nos encargamos de todo: valoración, promoción, clientes y cierre seguro.": "At G&R Real Estate, we handle everything: valuation, marketing, buyers, and a secure closing.",
    "¿Por qué vender con nosotros?": "Why sell with us?", "Mejor precio": "Best Price",
    "Analizamos el mercado para vender al valor correcto.": "We analyze the market to price your property right.",
    "Venta rápida": "Fast Sale", "Conectamos tu propiedad con compradores reales.": "We connect your property with serious buyers.",
    "Seguridad total": "Peace of Mind", "Acompañamiento legal y comercial completo.": "Full legal and commercial support.",
    "¿Cómo funciona?": "How It Works?", "1. Valoración": "1. Valuation",
    "Analizamos tu propiedad sin costo.": "We assess your property at no cost.",
    "2. Publicación": "2. Listing", "La promocionamos en nuestros canales.": "We promote it across our channels.",
    "3. Venta": "3. Sale", "Cerramos la negociación contigo seguro.": "We help you close the deal securely.",
    "Solicitar valoración gratuita": "Request a Free Valuation", "Hablar por WhatsApp": "Chat on WhatsApp",
    "Consulta por este proyecto": "Ask about this project", "Consultar por este proyecto": "Ask about this project",
    "Consultar por esta propiedad": "Ask about this property", "← Volver a proyectos": "← Back to projects",
    "← Volver a propiedades": "← Back to properties", "Características": "Features", "Ver detalles ↗": "View details ↗",
    "Acceso de trabajadores": "Team Login", "Encuentra tu propiedad": "Find a Property",
    "Departamento": "Department", "Ciudad": "City", "Tipo": "Type", "Precio máximo": "Maximum Price",
    "Buscar": "Search", "Casa": "House", "Casa lote": "House and Lot", "Apartamento": "Apartment",
    "Lote": "Lot", "Finca": "Country Estate", "Bodega": "Warehouse", "Local comercial": "Commercial Space",
    "Local": "Commercial Space", "Tipo de inmueble": "Property Type", "Inmueble": "Property",
    "Ver más": "View Details", "No encontramos propiedades con esos filtros.": "No properties match those filters.",
    "No encontramos ese proyecto.": "Project not found.", "No encontramos esa propiedad.": "Property not found.",
    "Cargando propiedades…": "Loading properties…", "Cargando proyecto…": "Loading project…",
    "Cargando propiedad…": "Loading property…", "Cargando…": "Loading…", "👀 Visitas:": "👀 Visits:",
    "© Broker Inmobiliario G&R": "© Broker Inmobiliario G&R",
    "📱 WhatsApp": "📱 WhatsApp", "📧 Correo": "📧 Email", "📍 Ubicación": "📍 Location",
    "📘 Facebook": "📘 Facebook", "💬 WhatsApp": "💬 WhatsApp",
    "💰 Solicitar valoración gratuita": "💰 Request a free valuation", "📲 Hablar por WhatsApp": "📲 Chat on WhatsApp",
    "En G&R Broker Inmobiliario nos encargamos de todo:": "At G&R Real Estate, we handle everything:",
    "💬 Hablar por WhatsApp": "💬 Chat on WhatsApp", "📈 Mejor precio": "📈 Best Price",
    "🚀 Venta rápida": "🚀 Fast Sale", "🔒 Seguridad total": "🔒 Peace of Mind",
    "valoración, promoción, clientes y cierre seguro.": "valuation, marketing, buyers, and a secure closing.",
    "G&R Broker Inmobiliario es una firma especializada en la intermediación y comercialización de bienes raíces. Facilitamos transacciones seguras y eficientes, conectando propietarios, compradores e inversionistas con profesionalismo y confianza.": "G&R Real Estate is a firm specializing in real estate brokerage and sales. We facilitate secure, efficient transactions, connecting property owners, buyers, and investors with professionalism and trust.",
    "© Broker Inmobiliario G&R - Todos los derechos reservados": "© Broker Inmobiliario G&R - All rights reserved",
    "Mostrar también en la página de inicio": "Also feature on the home page",
    "Cargando proyectos…": "Loading projects…", "Pronto publicaremos nuevos proyectos.": "New projects coming soon.",
    "Pronto publicaremos proyectos destacados.": "Featured projects coming soon.",
    "Conoce los detalles de este proyecto.": "Explore the details of this project.",
    "Propiedad en venta": "Property for Sale", "Proyecto inmobiliario": "Real Estate Project"
  };
  const storageKey = "gr-site-language";
  let language = localStorage.getItem(storageKey) === "en" ? "en" : "es";
  const staticText = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest("script,style,.language-switch")) continue;
    staticText.push({ node, spanish: node.nodeValue });
  }
  const placeholders = [...document.querySelectorAll("input[placeholder],textarea[placeholder]")]
    .map((element) => ({ element, spanish: element.placeholder }));

  function applyStaticText() {
    staticText.forEach(({ node, spanish }) => {
      if (!node.isConnected) return;
      if (language === "es") node.nodeValue = spanish;
      else {
        const trimmed = spanish.trim();
        const normalized = trimmed.replace(/\s+/g, " ");
        if (labels[normalized]) node.nodeValue = spanish.replace(trimmed, labels[normalized]);
      }
    });
    placeholders.forEach(({ element, spanish }) => {
      if (element.isConnected && language === "en") element.placeholder = labels[spanish] || spanish;
      else if (element.isConnected) element.placeholder = spanish;
    });
    document.documentElement.lang = language;
    const pageTitles = {
      "Broker Inmobiliario G&R": "G&R Real Estate Broker",
      "Proyectos | Broker Inmobiliario G&R": "Projects | G&R Real Estate Broker",
      "Proyectos Inmobiliarios | Broker Inmobiliario G&R": "Real Estate Projects | G&R Real Estate Broker",
      "Propiedades en venta": "Properties for Sale",
      "Detalle de propiedad | Broker Inmobiliario G&R": "Property Details | G&R Real Estate Broker",
      "Detalle del proyecto | Broker Inmobiliario G&R": "Project Details | G&R Real Estate Broker",
      "Proyectos | Broker Inmobiliario G&R": "Projects | G&R Real Estate Broker",
      "Contacto - Broker Inmobiliario G&R": "Contact | G&R Real Estate Broker",
      "Vende tu propiedad": "Sell Your Property"
    };
    document.title = language === "en" ? (pageTitles[originalTitle] || labels[originalTitle] || originalTitle) : originalTitle;
    document.querySelectorAll(".language-switch button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.language === language));
    });
    document.dispatchEvent(new CustomEvent("site-language-change", { detail: { language } }));
  }

  const originalTitle = document.title;
  const nav = document.querySelector(".menu-hero");
  if (nav) {
    const control = document.createElement("div");
    control.className = "language-switch";
    control.setAttribute("role", "group");
    control.setAttribute("aria-label", "Language / Idioma");
    [["es", "ES"], ["en", "EN"]].forEach(([code, text]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.language = code;
      button.textContent = text;
      button.addEventListener("click", () => {
        language = code;
        localStorage.setItem(storageKey, code);
        applyStaticText();
      });
      control.append(button);
    });
    nav.append(control);
  }

  window.siteLanguage = () => language;
  window.siteText = (spanish) => language === "en" ? (labels[spanish] || spanish) : spanish;
  const translationPromise = fetch("data/translations-en.json", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : {})
    .catch(() => ({}));
  window.siteTranslationReady = translationPromise;
  window.localizeListing = (record, collection, translations = {}) => {
    if (language !== "en") return record;
    const translated = translations[collection]?.[record.id] || {};
    const fields = collection === "properties"
      ? ["title", "summary", "city", "department", "type", "details"]
      : ["title", "summary", "location", "price", "details"];
    const result = { ...record };
    fields.forEach((field) => {
      result[field] = record[`${field}En`] || translated[field] || labels[record[field]] || record[field] || "";
    });
    if (Array.isArray(record.features)) {
      result.features = record.featuresEn || translated.features || record.features;
    }
    return result;
  };

  applyStaticText();
})();
