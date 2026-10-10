(() => {
  const gallery = document.getElementById("detalle-galeria");
  if (!gallery) return;

  const dialog = document.createElement("dialog");
  dialog.className = "visor-fotos";
  dialog.setAttribute("aria-label", "Visor de fotografías");
  dialog.innerHTML = `
    <button class="visor-fotos-boton visor-fotos-cerrar" type="button" aria-label="Cerrar">&times;</button>
    <button class="visor-fotos-boton visor-fotos-anterior" type="button" aria-label="Foto anterior">&#8249;</button>
    <div class="visor-fotos-contenido">
      <img class="visor-fotos-imagen" alt="">
      <div class="visor-fotos-pie" aria-live="polite"></div>
    </div>
    <button class="visor-fotos-boton visor-fotos-siguiente" type="button" aria-label="Foto siguiente">&#8250;</button>
  `;
  document.body.append(dialog);

  const image = dialog.querySelector(".visor-fotos-imagen");
  const caption = dialog.querySelector(".visor-fotos-pie");
  const closeButton = dialog.querySelector(".visor-fotos-cerrar");
  const previousButton = dialog.querySelector(".visor-fotos-anterior");
  const nextButton = dialog.querySelector(".visor-fotos-siguiente");
  let photos = [];
  let currentIndex = 0;
  let opener = null;

  function updatePhoto() {
    const photo = photos[currentIndex];
    if (!photo) return;
    const english = window.siteLanguage?.() === "en";
    dialog.setAttribute("aria-label", english ? "Photo viewer" : "Visor de fotografías");
    closeButton.setAttribute("aria-label", english ? "Close" : "Cerrar");
    previousButton.setAttribute("aria-label", english ? "Previous photo" : "Foto anterior");
    nextButton.setAttribute("aria-label", english ? "Next photo" : "Foto siguiente");
    image.src = photo.src;
    image.alt = photo.alt;
    caption.textContent = `${photo.alt} · ${currentIndex + 1} ${english ? "of" : "de"} ${photos.length}`;
    previousButton.hidden = photos.length < 2;
    nextButton.hidden = photos.length < 2;
  }

  function movePhoto(direction) {
    if (photos.length < 2) return;
    currentIndex = (currentIndex + direction + photos.length) % photos.length;
    updatePhoto();
  }

  function openPhoto(selected) {
    opener = selected;
    photos = Array.from(gallery.querySelectorAll("img"), (photo) => ({ src: photo.src, alt: photo.alt }));
    currentIndex = photos.findIndex((photo) => photo.src === selected.src);
    if (currentIndex < 0) currentIndex = 0;
    updatePhoto();
    dialog.showModal();
  }

  gallery.addEventListener("click", (event) => {
    const selected = event.target.closest("img");
    if (!selected) return;
    openPhoto(selected);
  });

  gallery.addEventListener("keydown", (event) => {
    const selected = event.target.closest("img");
    if (!selected || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    openPhoto(selected);
  });

  closeButton.addEventListener("click", () => dialog.close());
  previousButton.addEventListener("click", () => movePhoto(-1));
  nextButton.addEventListener("click", () => movePhoto(1));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => opener?.focus());
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") movePhoto(-1);
    if (event.key === "ArrowRight") movePhoto(1);
  });
})();
