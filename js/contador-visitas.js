import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, onDisconnect, onValue, push, ref, runTransaction, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const counter = document.getElementById("visitas");
const liveCounter = document.getElementById("personas-en-vivo");
const unavailableText = () => window.siteLanguage?.() === "en" ? "Unavailable" : "No disponible";

document.addEventListener("site-language-change", () => {
  if (counter && ["No disponible", "Unavailable"].includes(counter.textContent)) {
    counter.textContent = unavailableText();
  }
  if (liveCounter && ["No disponible", "Unavailable"].includes(liveCounter.textContent)) {
    liveCounter.textContent = unavailableText();
  }
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

  // El total acumulado de visitas sigue siendo independiente de las sesiones activas.
  const visitsRef = ref(database, "visitas");
  runTransaction(visitsRef, (current) => (current || 0) + 1)
      .catch((error) => console.error("No se pudo actualizar el contador de visitas:", error));
  if (counter) {
    onValue(visitsRef, (snapshot) => {
      counter.textContent = snapshot.val() ?? 0;
    }, (error) => {
      counter.textContent = unavailableText();
      console.error("No se pudo leer el contador de visitas:", error);
    });
  }

  const presenceRef = ref(database, "presencia/inicio");
  const connectedRef = ref(database, ".info/connected");
  const SESSION_TTL_MS = 90_000;
  const HEARTBEAT_MS = 30_000;

  let connected = false;
  let isRegistered = false;
  let sessionRef = null;
  let latestPresenceSnapshot = null;
  let updateQueue = Promise.resolve();

  const renderPresence = () => {
    if (!liveCounter || !latestPresenceSnapshot) return;
    const now = Date.now();
    let active = 0;
    latestPresenceSnapshot.forEach((child) => {
      const session = child.val();
      const startedAt = Number(session?.startedAt);
      if (
        session?.visible === true &&
        Number.isFinite(startedAt) &&
        startedAt <= now &&
        now - startedAt < SESSION_TTL_MS
      ) {
        active += 1;
      }
    });
    liveCounter.textContent = active;
  };

  onValue(presenceRef, (snapshot) => {
    latestPresenceSnapshot = snapshot;
    renderPresence();
  }, (error) => {
    if (liveCounter) liveCounter.textContent = unavailableText();
    console.error("No se pudo leer la presencia en tiempo real:", error);
  });

  const removeCurrentSession = async () => {
    const previousRef = sessionRef;
    const wasRegistered = isRegistered;
    sessionRef = null;
    isRegistered = false;
    if (!previousRef || !wasRegistered) return;

    try {
      await onDisconnect(previousRef).cancel();
    } catch (error) {
      console.warn("No se pudo cancelar la limpieza de la sesión anterior:", error);
    }
    try {
      await set(previousRef, null);
    } catch (error) {
      // Aunque no se logre borrar, la sesión deja de contar al vencer su TTL.
      console.warn("No se pudo borrar la sesión anterior:", error);
    }
  };

  const syncPresence = (rotate = false) => {
    updateQueue = updateQueue.then(async () => {
      if (!connected) return;

      if (document.visibilityState !== "visible") {
        await removeCurrentSession();
        return;
      }

      if (isRegistered && !rotate) return;
      if (isRegistered) await removeCurrentSession();

      // Una clave nueva evita reescribir una sesión existente; las reglas actuales
      // permiten crear y borrar sesiones, y las claves antiguas vencen por TTL.
      const nextSessionRef = push(presenceRef);
      await onDisconnect(nextSessionRef).remove();
      await set(nextSessionRef, { visible: true, startedAt: Date.now() });
      sessionRef = nextSessionRef;
      isRegistered = true;
    }).catch((error) => {
      console.error("No se pudo actualizar la presencia:", error);
    });
  };

  onValue(connectedRef, (snapshot) => {
    connected = snapshot.val() === true;
    if (!connected) {
      sessionRef = null;
      isRegistered = false;
      return;
    }
    syncPresence();
  });

  document.addEventListener("visibilitychange", () => syncPresence());
  window.setInterval(() => {
    syncPresence(true);
    renderPresence();
  }, HEARTBEAT_MS);
} catch (error) {
  if (counter) counter.textContent = unavailableText();
  if (liveCounter) liveCounter.textContent = unavailableText();
  console.error("No se pudo iniciar Firebase:", error);
}
