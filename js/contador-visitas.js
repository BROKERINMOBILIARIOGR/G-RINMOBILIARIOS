import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, onValue, ref, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const counter = document.getElementById("visitas");
const unavailableText = () => window.siteLanguage?.() === "en" ? "Unavailable" : "No disponible";
document.addEventListener("site-language-change", () => {
  if (counter.textContent === "No disponible" || counter.textContent === "Unavailable") counter.textContent = unavailableText();
});
const firebaseConfig = {
  apiKey: "AIzaSyAKDczyyUwdxTn1QP1jkQks8SL91PwZawQ",
  authDomain: "contador-web-gyr.firebaseapp.com",
  databaseURL: "https://contador-web-gyr-default-rtdb.firebaseio.com",
  projectId: "contador-web-gyr"
};

try {
  const app = initializeApp(firebaseConfig);
  const visitsRef = ref(getDatabase(app), "visitas");

  runTransaction(visitsRef, (current) => (current || 0) + 1)
    .catch((error) => console.error("No se pudo actualizar el contador de visitas:", error));
  onValue(visitsRef, (snapshot) => {
    counter.textContent = snapshot.val() ?? 0;
  }, (error) => {
    counter.textContent = unavailableText();
    console.error("No se pudo leer el contador de visitas:", error);
  });
} catch (error) {
  counter.textContent = unavailableText();
  console.error("No se pudo iniciar el contador de visitas:", error);
}
