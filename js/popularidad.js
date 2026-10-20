import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { get, getDatabase, ref, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAKDczyyUwdxTn1QP1jkQks8SL91PwZawQ",
  authDomain: "contador-web-gyr.firebaseapp.com",
  databaseURL: "https://contador-web-gyr-default-rtdb.firebaseio.com",
  projectId: "contador-web-gyr"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const database = getDatabase(app);

export async function recordListingView(type, id) {
  if (!id || !["proyectos", "propiedades"].includes(type)) return;

  const sessionKey = `gyr-visto-${type}-${id}`;
  try {
    if (window.sessionStorage.getItem(sessionKey)) return;
  } catch (_) {
    // El contador funciona aunque el navegador no permita usar almacenamiento de sesión.
  }

  await runTransaction(ref(database, `popularidad/${type}/${id}`), (current) =>
    (Number(current) || 0) + 1
  );

  try {
    window.sessionStorage.setItem(sessionKey, "1");
  } catch (_) {
    // No se interrumpe la navegación si el navegador bloquea el almacenamiento.
  }
}

export async function getListingPopularity(type) {
  if (!["proyectos", "propiedades"].includes(type)) return {};
  const snapshot = await get(ref(database, `popularidad/${type}`));
  return snapshot.exists() ? snapshot.val() || {} : {};
}

export function sortByPopularity(listings, popularity = {}) {
  return listings
    .map((listing, index) => ({ listing, index, views: Number(popularity[listing.id]) || 0 }))
    .sort((a, b) => b.views - a.views || a.index - b.index)
    .map(({ listing }) => listing);
}
