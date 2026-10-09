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

### Conectar las estadísticas privadas

El panel puede consultar informes privados de Google Analytics. Las cifras solo se entregan después de iniciar sesión; la clave de consulta se guarda en `.local`, que no se publica.

1. En Google Cloud, habilita **Google Analytics Data API** y crea una cuenta de servicio. Descarga su archivo JSON y guárdalo como `.local/ga4-service-account.json` dentro de la carpeta del sitio.
2. En Google Analytics, abre **Administrador → Gestión de accesos a la propiedad** y agrega el correo de esa cuenta de servicio con permiso **Lector**.
3. En `.env.admin`, completa `GA4_PROPERTY_ID` con el ID numérico de la propiedad y conserva `GA4_SERVICE_ACCOUNT_FILE=.local/ga4-service-account.json`.
4. Instala el conector una sola vez desde PowerShell en la carpeta del sitio: `python -m pip install -r requirements-admin.txt`.
5. Reinicia el panel e inicia sesión. En **Rendimiento de la página** puedes elegir 7, 30 o 90 días.

La medición de fichas y clics comienza cuando se publique el seguimiento actualizado. Los informes anteriores de anuncios individuales no se pueden reconstruir. La portada ya tenía Google Analytics; ahora el seguimiento se amplía a todas las páginas, fichas abiertas, clics para abrir anuncios y clics de contacto por WhatsApp.

## 3. Acceder desde teléfonos en el mismo Wi-Fi

1. Inicia `iniciar-panel.bat`. Si Windows muestra una alerta de Firewall, permite el acceso en **redes privadas**; no lo habilites en redes públicas.
2. En la ventana negra aparecerá una dirección como `http://192.168.1.20:8765/admin/`. En el teléfono conectado al mismo Wi-Fi, abre esa dirección. La IP puede cambiar al conectarse a otra red.
3. Si no abre, revisa en Windows Defender Firewall que Python pueda recibir conexiones en redes privadas. No abras el puerto del router.

## 4. Acceder desde otra red con Tailscale

Instala Tailscale desde su [sitio oficial](https://tailscale.com/download) e inicia sesión en el computador. Para dar acceso privado, cada trabajador también necesita Tailscale en su teléfono y estar en el mismo equipo/red Tailscale. Consulta [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve).

1. Con el panel abierto, inicia PowerShell y ejecuta `tailscale serve 8765`. Tailscale mostrará la dirección HTTPS privada del equipo. Los trabajadores podrán abrirla desde cualquier red si tienen Tailscale conectado.
2. Para trabajadores que no puedan instalar Tailscale, se puede usar Funnel con `tailscale funnel 8765`. Esto crea una dirección HTTPS accesible desde Internet; cualquier persona puede llegar a la pantalla de inicio de sesión. Cada persona necesita su propio usuario y contraseña del panel. Consulta [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel).
3. Mientras Tailscale no esté configurado, usa desde el teléfono conectado al mismo Wi-Fi la dirección local que muestra la ventana del panel. Cuando configures la dirección HTTPS, sustituye el enlace provisional `https://CONFIGURA-TU-EQUIPO.ts.net` en `index.html`, `proyectos.html` y `proyecto.html`, conservando `/admin/`, y publica esos cambios desde GitHub Desktop.

No hace falta abrir puertos del router. El computador, el panel y Tailscale deben estar activos para recibir cargas. El sitio público ya publicado seguirá funcionando cuando el computador se apague.

## 5. Uso diario

1. Enciende el computador y conéctalo a internet.
2. Inicia `iniciar-panel.bat` y activa el acceso remoto que hayas elegido (`tailscale serve 8765` para acceso privado o `tailscale funnel 8765` para acceso con enlace público).
3. Abre la dirección HTTPS privada de Tailscale o, si estás en el mismo Wi-Fi, la dirección local indicada por el panel. Inicia sesión y completa nombre, resumen, ubicación, precio, detalles y características; puedes subir hasta cinco imágenes JPG, PNG o WEBP por envío, de hasta 6 MB cada una.
4. Pulsa **Guardar y publicar**. El panel guarda una copia local y envía los archivos nuevos a GitHub. GitHub Pages puede tardar unos minutos en mostrar los cambios.
5. Al terminar, puedes cerrar las dos ventanas y apagar el computador. El sitio público seguirá mostrando los proyectos ya publicados.

Si el panel indica que guardó localmente pero no pudo publicar, deja el computador conectado, revisa el token o la conexión y pulsa **Publicar cambios pendientes**.

## Límites de esta versión

- El equipo y el túnel deben estar activos durante cada carga; con el computador apagado el sitio público sigue visible, pero el panel no recibe archivos.
- Los archivos publicados se guardan en el repositorio público del sitio, así que las imágenes son públicas.
- Este panel crea y edita fichas y permite añadir imágenes. La versión inicial no elimina proyectos ni fotos desde la interfaz.
- El antiguo contador público de Firebase se retiró. Las estadísticas detalladas se consultan en el panel con acceso privado a Google Analytics.
