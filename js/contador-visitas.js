import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, onDisconnect, onValue, push, ref, runTransaction, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const counter = document.getElementById("visitas");
const liveCounter = document.getElementById("personas-en-vivo");
const unavailableText = () => window.siteLanguage?.() === "en" ? "Unavailable" : "No disponible";
document.addEventListener("site-language-change", () => {
  if (counter.textContent === "No disponible" || counter.textContent === "Unavailable") counter.textContent = unavailableText();
  if (liveCounter.textContent === "No disponible" || liveCounter.textContent === "Unavailable") liveCounter.textContent = unavailableText();
});
const firebaseConfig = {
  apiKey: "AIzaSyAKDczyyUwdxTn1QP1jkQks8SL91PwZawQ",
  authDomain: "contador-web-gyr.firebaseapp.com",
  databaseURL: "https://contador-web-gyr-default-rtdb.firebaseio.com",
  projectId: "contador-web-gyr"
};

try {
  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);

  // El contador acumulado permanece separado de la presencia en tiempo real.
  const visitsRef = ref(database, "visitas");
  runTransaction(visitsRef, (current) => (current || 0) + 1)
    .catch((error) => console.error("No se pudo actualizar el contador de visitas:", error));
  onValue(visitsRef, (snapshot) => {
    counter.textContent = snapshot.val() ?? 0;
  }, (error) => {
    counter.textContent = unavailableText();
    console.error("No se pudo leer el contador de visitas:", error);
  });

  // Una entrada por pestaña visible; Firebase la elimina cuando se pierde la conexión.
  const presenceRef = ref(database, "presencia/inicio");
  const connectedRef = ref(database, ".info/connected");
  const sessionRef = push(presenceRef);
  let connected = false;
  let isRegistered = false;
  let updateQueue = Promise.resolve();

  onValue(presenceRef, (snapshot) => {
    let active = 0;
    snapshot.forEach((child) => {
      if (child.val()?.visible === true) active += 1;
    });
    liveCounter.textContent = active;
  }, (error) => {
    liveCounter.textContent = unavailableText();
    console.error("No se pudo leer la presencia en tiempo real:", error);
  });

  const syncPresence = () => {
    updateQueue = updateQueue.then(async () => {
      if (!connected) return;
      if (document.visibilityState === "visible") {
        await onDisconnect(sessionRef).remove();
        await set(sessionRef, { visible: true, startedAt: Date.now() });
        isRegistered = true;
      } else if (isRegistered) {
        await onDisconnect(sessionRef).cancel();
        await set(sessionRef, null);
        isRegistered = false;
      }
    }).catch((error) => console.error("No se pudo actualizar la presencia:", error));
  };

  onValue(connectedRef, (snapshot) => {
    connected = snapshot.val() === true;
    if (!connected) isRegistered = false;
    else syncPresence();
  });
  document.addEventListener("visibilitychange", syncPresence);
} catch (error) {
  counter.textContent = unavailableText();
  liveCounter.textContent = unavailableText();
  console.error("No se pudo iniciar Firebase:", error);
}
