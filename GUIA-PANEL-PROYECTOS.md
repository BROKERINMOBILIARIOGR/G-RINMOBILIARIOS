# Panel de proyectos G&R

El sitio público continúa en GitHub Pages. Este panel se ejecuta en el computador de la empresa y publica los datos e imágenes nuevos directamente en el repositorio de GitHub. Una vez publicados, los visitantes ven la última versión aunque el computador se apague. Para recibir una carga, el computador y el túnel de acceso deben estar encendidos y conectados a internet.

## 1. Actualizar el sitio en GitHub

1. Instala [GitHub Desktop](https://desktop.github.com/) e inicia sesión con una cuenta que tenga permiso para actualizar `BROKERINMOBILIARIOGR/G-RINMOBILIARIOS`.
2. Clona el repositorio `G-RINMOBILIARIOS` en este computador.
3. Descomprime el ZIP actualizado del sitio y copia su contenido dentro de la carpeta clonada, reemplazando los archivos cuando Windows lo pregunte. Conserva las carpetas existentes `Images` y `video`.
4. En GitHub Desktop, revisa los cambios, escribe un resumen como “Agregar panel de proyectos” y pulsa **Commit to main** y después **Push origin**.

Esto publica el nuevo catálogo de proyectos y el panel. No subas ningún archivo llamado `.env.admin`.

## 2. Preparar la publicación desde el panel

El panel usa un token privado para publicar en el repositorio. El token se queda en este computador; los trabajadores no lo reciben.

1. En GitHub, abre **Settings → Developer settings → Personal access tokens → Fine-grained tokens** y crea un token limitado al repositorio `G-RINMOBILIARIOGR/G-RINMOBILIARIOS`.
2. Dale permiso de repositorio **Contents: Read and write**. No agregues permisos adicionales.
3. En la carpeta local del sitio, copia `.env.admin.example` y nombra la copia `.env.admin`.
4. Abre `.env.admin` y reemplaza `PEGA_AQUI_EL_TOKEN_PRIVADO` con el token. Guarda el archivo. `.env.admin` está excluido de Git; no lo compartas ni lo publiques.
5. Haz doble clic en `crear-responsable.bat`, elige un usuario y una contraseña de al menos 12 caracteres. Esa cuenta puede crear y desactivar cuentas de trabajadores desde el panel.

## 3. Iniciar el panel y habilitar acceso remoto

Instala Tailscale desde su [sitio oficial](https://tailscale.com/download/windows) y conecta este computador a tu cuenta. Tailscale Funnel da al panel una dirección HTTPS accesible desde otras redes; no hace falta abrir puertos del router. Consulta sus [instrucciones oficiales de Funnel](https://tailscale.com/kb/1223/funnel).

1. Haz doble clic en `iniciar-panel.bat` y deja abierta esa ventana mientras alguien carga o edita proyectos.
2. Abre otra ventana de PowerShell y ejecuta `tailscale funnel 8765`. Acepta la activación que Tailscale solicite y deja también esa ventana abierta mientras se reciben cargas.
3. Tailscale mostrará una dirección HTTPS terminada en `.ts.net`. Esa dirección abre el panel de trabajadores.
4. En `index.html` y `proyectos.html`, reemplaza `https://CONFIGURA-TU-EQUIPO.ts.net` por el nombre de equipo y la dirección `.ts.net` que mostró Tailscale. Conserva `/admin/` al final. Guarda y publica esos dos cambios con GitHub Desktop.

La dirección de Funnel es pública, pero el panel exige una cuenta y contraseña de trabajador. Crea una cuenta distinta por persona desde la sección **Trabajadores** del panel y desactiva las cuentas cuando alguien ya no deba tener acceso.

## 4. Uso diario

1. Enciende el computador y conéctalo a internet.
2. Inicia `iniciar-panel.bat` y `tailscale funnel 8765`.
3. Desde **Acceso de trabajadores** en la página, inicia sesión. Completa nombre, resumen, ubicación, precio, detalles y características; puedes subir hasta cinco imágenes JPG, PNG o WEBP por envío, de hasta 6 MB cada una.
4. Pulsa **Guardar y publicar**. El panel guarda una copia local y envía los archivos nuevos a GitHub. GitHub Pages puede tardar unos minutos en mostrar los cambios.
5. Al terminar, puedes cerrar las dos ventanas y apagar el computador. El sitio público seguirá mostrando los proyectos ya publicados.

Si el panel indica que guardó localmente pero no pudo publicar, deja el computador conectado, revisa el token o la conexión y pulsa **Publicar cambios pendientes**.

## Límites de esta versión

- El equipo y el túnel deben estar activos durante cada carga; con el computador apagado el sitio público sigue visible, pero el panel no recibe archivos.
- Los archivos publicados se guardan en el repositorio público del sitio, así que las imágenes son públicas.
- Este panel crea y edita fichas y permite añadir imágenes. La versión inicial no elimina proyectos ni fotos desde la interfaz.
- El contador de visitas que antes estaba conectado a Firebase se retiró. Google Analytics de la página se conserva.
