(() => {
  const root = document.getElementById("lista-proyectos");
  const message = document.getElementById("mensaje-proyectos");

  function makeCard(project) {
    const card = document.createElement("a");
    card.className = "card card-proyecto";
    card.href = `proyecto.html?id=${encodeURIComponent(project.id)}`;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    const image = document.createElement("img");
    image.src = (project.images || [])[0] || "logo.jpeg";
    image.alt = project.title || "Proyecto inmobiliario";
    const title = document.createElement("h3");
    title.textContent = project.title || "Proyecto inmobiliario";
    const summary = document.createElement("p");
    summary.textContent = project.summary || "Conoce los detalles de este proyecto.";
    const prompt = document.createElement("span");
    prompt.className = "ver-detalle";
    prompt.textContent = "Ver detalles ↗";
    card.append(image, title, summary, prompt);
    return card;
  }

  fetch("data/proyectos.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar la lista de proyectos.");
      return response.json();
    })
    .then((projects) => {
      root.replaceChildren(...projects.map(makeCard));
      if (!projects.length) message.textContent = "Pronto publicaremos nuevos proyectos.";
    })
    .catch(() => {
      message.textContent = "No se pudieron cargar los proyectos. Intenta de nuevo más tarde.";
    });
})();
