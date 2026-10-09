#!/usr/bin/env python3
"""Small, invite-only project manager for the G&R GitHub Pages site."""
from __future__ import annotations

import base64
from contextlib import contextmanager
import html
import hashlib
import hmac
import json
import mimetypes
import math
import os
import re
import secrets
import socket
import sqlite3
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
ADMIN_DIR = ROOT / "admin"
DB_FILE = ROOT / ".local" / "admin.sqlite3"
PROJECTS_FILE = ROOT / "data" / "proyectos.json"
PROPERTIES_FILE = ROOT / "data" / "propiedades.json"
IMAGE_DIR = ROOT / "Images" / "proyectos"
PROPERTY_IMAGE_DIR = ROOT / "Images" / "propiedades"
MAX_BODY = 48 * 1024 * 1024
MAX_IMAGE = 6 * 1024 * 1024
MAX_IMAGES = 5
SESSION_TTL = 12 * 60 * 60
PASSWORD_ROUNDS = 500_000
LOGIN_FAILURES: dict[str, list[float]] = {}


def read_dotenv() -> None:
    env_file = ROOT / ".env.admin"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"\''))


@contextmanager
def db():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_FILE)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        connection.executescript("""
          CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('owner','worker')),
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
            expires_at INTEGER NOT NULL
          );
        """)
        connection.commit()
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def password_record(password: str, salt: bytes | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ROUNDS)
    return base64.b64encode(derived).decode("ascii"), base64.b64encode(salt).decode("ascii")


def create_user(username: str, password: str, role: str) -> None:
    username = username.strip().lower()
    if not re.fullmatch(r"[a-z0-9_.-]{3,32}", username):
        raise ValueError("El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.")
    if len(password) < 12:
        raise ValueError("La contraseña debe tener al menos 12 caracteres.")
    digest, salt = password_record(password)
    with db() as connection:
        connection.execute(
            "INSERT INTO users(username,password_hash,salt,role) VALUES(?,?,?,?)",
            (username, digest, salt, role),
        )


def safe_json_projects() -> list[dict]:
    try:
        value = json.loads(PROJECTS_FILE.read_text(encoding="utf-8"))
        return value if isinstance(value, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def write_projects(projects: list[dict]) -> bytes:
    PROJECTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    content = (json.dumps(projects, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    PROJECTS_FILE.write_bytes(content)
    return content


def safe_json_properties() -> list[dict]:
    try:
        value = json.loads(PROPERTIES_FILE.read_text(encoding="utf-8"))
        return value if isinstance(value, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def write_properties(properties: list[dict]) -> bytes:
    PROPERTIES_FILE.parent.mkdir(parents=True, exist_ok=True)
    content = (json.dumps(properties, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    PROPERTIES_FILE.write_bytes(content)
    return content


def social_share_page_path(collection: str, identifier: str) -> str:
    if collection not in ("proyectos", "propiedades") or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", identifier):
        raise ValueError("No se puede crear la vista previa de esta ficha.")
    return f"compartir/{collection}/{identifier}.html"


def social_share_pages(items: list[dict], collection: str) -> dict[str, bytes]:
    read_dotenv()
    site_url = os.environ.get(
        "PUBLIC_SITE_URL", "https://brokerinmobiliariogr.github.io/G-RINMOBILIARIOS/"
    ).rstrip("/") + "/"
    detail_file = "proyecto.html" if collection == "proyectos" else "propiedad.html"
    pages = {}
    for item in items:
        identifier = str(item.get("id", ""))
        path = social_share_page_path(collection, identifier)
        title = str(item.get("title") or ("Proyecto inmobiliario" if collection == "proyectos" else "Propiedad en venta"))
        description = str(item.get("summary") or item.get("details") or title).strip()[:300]
        image = "logo.jpeg"
        for candidate in item.get("images", []):
            relative = Path(str(candidate).replace("\\", "/"))
            if (not relative.is_absolute() and ".." not in relative.parts
                    and relative.parts and relative.parts[0] == "Images"):
                image = relative.as_posix()
                break
        share_url = urllib.parse.urljoin(site_url, path) + "?" + urllib.parse.urlencode({"v": image})
        image_url = urllib.parse.urljoin(site_url, urllib.parse.quote(image, safe="/"))
        detail_url = urllib.parse.urljoin(
            site_url, detail_file + "?" + urllib.parse.urlencode({"id": identifier})
        )
        safe_title = html.escape(title, quote=True)
        safe_description = html.escape(description, quote=True)
        safe_share_url = html.escape(share_url, quote=True)
        safe_image_url = html.escape(image_url, quote=True)
        safe_detail_url = html.escape(detail_url, quote=True)
        redirect_url = json.dumps(detail_url, ensure_ascii=True).replace("</", "<\\/")
        page = f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{safe_title} | Broker Inmobiliario G&amp;R</title>
  <meta name="description" content="{safe_description}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Broker Inmobiliario G&amp;R">
  <meta property="og:title" content="{safe_title}">
  <meta property="og:description" content="{safe_description}">
  <meta property="og:url" content="{safe_share_url}">
  <meta property="og:image" content="{safe_image_url}">
  <meta property="og:image:alt" content="{safe_title}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{safe_title}">
  <meta name="twitter:description" content="{safe_description}">
  <meta name="twitter:image" content="{safe_image_url}">
  <script>window.location.replace({redirect_url});</script>
</head>
<body>
  <main>
    <img src="{safe_image_url}" alt="{safe_title}" style="max-width:100%;height:auto">
    <h1>{safe_title}</h1>
    <p>{safe_description}</p>
    <a href="{safe_detail_url}">Ver ficha</a>
  </main>
</body>
</html>
"""
        pages[path] = page.encode("utf-8")
    return pages


def analytics_report(days: int) -> dict:
    read_dotenv()
    property_id = os.environ.get("GA4_PROPERTY_ID", "").strip()
    credentials_path = Path(os.environ.get(
        "GA4_SERVICE_ACCOUNT_FILE", ".local/ga4-service-account.json"
    ))
    if not credentials_path.is_absolute():
        credentials_path = ROOT / credentials_path
    if not property_id or property_id.startswith("PEGA_AQUI"):
        raise RuntimeError("Falta configurar el ID de Google Analytics en .env.admin.")
    if not credentials_path.is_file():
        raise RuntimeError("Falta el archivo privado de acceso a Google Analytics en .local.")
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import DateRange, Dimension, Metric, RunReportRequest
        from google.oauth2 import service_account
    except ImportError as error:
        raise RuntimeError("Falta instalar el conector de Google Analytics. Sigue la guía del panel.") from error

    credentials = service_account.Credentials.from_service_account_file(
        str(credentials_path),
        scopes=["https://www.googleapis.com/auth/analytics.readonly"],
    )
    client = BetaAnalyticsDataClient(credentials=credentials)
    date_ranges = [DateRange(start_date=f"{days - 1}daysAgo", end_date="today")]
    property_name = f"properties/{property_id}"

    def report(dimensions: list[str], metrics: list[str]):
        request = RunReportRequest(
            property=property_name,
            date_ranges=date_ranges,
            dimensions=[Dimension(name=name) for name in dimensions],
            metrics=[Metric(name=name) for name in metrics],
            limit=10000,
        )
        return client.run_report(request)

    overview_response = report([], ["activeUsers", "sessions", "screenPageViews"])
    overview_values = overview_response.rows[0].metric_values if overview_response.rows else []
    overview = {
        "activeUsers": int(overview_values[0].value) if len(overview_values) > 0 else 0,
        "sessions": int(overview_values[1].value) if len(overview_values) > 1 else 0,
        "pageViews": int(overview_values[2].value) if len(overview_values) > 2 else 0,
        "contacts": 0,
    }

    listings = {}
    for kind, collection in (("proj", safe_json_projects()), ("prop", safe_json_properties())):
        for item in collection:
            identifier = str(item.get("id", ""))
            slug = re.sub(r"[^a-z0-9_]", "_", identifier.lower())
            slug = re.sub(r"_+", "_", slug).strip("_")[:26]
            listings[(kind, identifier)] = {"name": str(item.get("title") or identifier), "slug": slug}

    page_response = report(["pagePathPlusQueryString"], ["screenPageViews", "activeUsers"])
    view_totals: dict[str, dict] = {}
    for row in page_response.rows:
        page_path = row.dimension_values[0].value
        parsed = urllib.parse.urlsplit(page_path)
        if parsed.path.rstrip("/").endswith("/proyecto.html"):
            kind = "proj"
        elif parsed.path.rstrip("/").endswith("/propiedad.html"):
            kind = "prop"
        else:
            continue
        identifier = urllib.parse.parse_qs(parsed.query).get("id", [""])[0]
        if not identifier:
            continue
        current = view_totals.setdefault((kind, identifier), {"count": 0, "people": 0})
        current["count"] += int(row.metric_values[0].value)
        current["people"] += int(row.metric_values[1].value)

    top_views = [
        {"id": identifier, "name": listings.get((kind, identifier), {}).get("name", identifier), **values}
        for (kind, identifier), values in view_totals.items()
    ]
    top_views.sort(key=lambda item: item["count"], reverse=True)

    events_response = report(["eventName"], ["eventCount"])
    clicks: dict[tuple[str, str], int] = {}
    for row in events_response.rows:
        event_name = row.dimension_values[0].value
        count = int(row.metric_values[0].value)
        if event_name.startswith("ad_c_proj_") or event_name.startswith("ad_c_prop_"):
            kind = "proj" if event_name.startswith("ad_c_proj_") else "prop"
            prefix = f"ad_c_{kind}_"
            slug = event_name.removeprefix(prefix)
            identifier = next((key for (item_kind, key), value in listings.items()
                               if item_kind == kind and value["slug"] == slug), slug)
            key = (kind, identifier)
            clicks[key] = clicks.get(key, 0) + count
        elif event_name.startswith("ad_w_proj_") or event_name.startswith("ad_w_prop_") or event_name == "contact_click":
            overview["contacts"] += count

    top_clicks = [
        {"id": identifier, "name": listings.get((kind, identifier), {}).get("name", identifier), "count": count}
        for (kind, identifier), count in clicks.items()
    ]
    top_clicks.sort(key=lambda item: item["count"], reverse=True)
    return {"days": days, "overview": overview, "topViews": top_views[:10], "topClicks": top_clicks[:10]}


def write_social_share_pages(pages: dict[str, bytes]) -> None:
    for relative, content in pages.items():
        target = (ROOT / relative).resolve()
        target.relative_to((ROOT / "compartir").resolve())
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)


def github_request(path: str, method: str = "GET", payload: dict | None = None):
    read_dotenv()
    token = os.environ.get("GITHUB_TOKEN", "")
    owner = os.environ.get("GITHUB_OWNER", "BROKERINMOBILIARIOGR")
    repo = os.environ.get("GITHUB_REPO", "G-RINMOBILIARIOS")
    if not token:
        raise RuntimeError("Falta GITHUB_TOKEN en .env.admin. Configura el token de publicación siguiendo la guía.")
    url = f"https://api.github.com/repos/{owner}/{repo}/{path.lstrip('/')}"
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(url, data=body, method=method, headers={
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "GR-Project-Manager",
        **({"Content-Type": "application/json"} if body is not None else {}),
    })
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            raw = response.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:700]
        if error.code == 401:
            raise RuntimeError("GitHub rechazó el token. Revisa su vigencia y permisos de Contents: Read and write.") from error
        if error.code == 404:
            raise RuntimeError("GitHub no encontró el repositorio o la rama. Revisa GITHUB_OWNER, GITHUB_REPO y GITHUB_BRANCH.") from error
        raise RuntimeError(f"GitHub devolvió error {error.code}: {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"No se pudo conectar con GitHub: {error.reason}") from error


def publish_files(files: dict[str, bytes], deletions: list[str] | None = None) -> str:
    read_dotenv()
    branch = os.environ.get("GITHUB_BRANCH", "main")
    owner = os.environ.get("GITHUB_OWNER", "BROKERINMOBILIARIOGR")
    repo = os.environ.get("GITHUB_REPO", "G-RINMOBILIARIOS")
    ref = github_request(f"git/ref/heads/{urllib.parse.quote(branch, safe='')}")
    parent_sha = ref["object"]["sha"]
    parent = github_request(f"git/commits/{parent_sha}")
    tree_entries = []
    for path, content in files.items():
        blob = github_request("git/blobs", "POST", {
            "content": base64.b64encode(content).decode("ascii"),
            "encoding": "base64",
        })
        tree_entries.append({"path": path.replace("\\", "/"), "mode": "100644", "type": "blob", "sha": blob["sha"]})
    for path in deletions or []:
        tree_entries.append({"path": path.replace("\\", "/"), "mode": "100644", "type": "blob", "sha": None})
    tree = github_request("git/trees", "POST", {"base_tree": parent["tree"]["sha"], "tree": tree_entries})
    commit = github_request("git/commits", "POST", {
        "message": "Actualizar proyectos inmobiliarios desde el panel",
        "tree": tree["sha"],
        "parents": [parent_sha],
    })
    github_request(f"git/refs/heads/{urllib.parse.quote(branch, safe='')}", "PATCH", {"sha": commit["sha"], "force": False})
    return commit["sha"]


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:55] or "proyecto"


def verify_image(data: bytes, extension: str) -> bool:
    if extension in (".jpg", ".jpeg"):
        return data.startswith(b"\xff\xd8\xff")
    if extension == ".png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == ".webp":
        return len(data) > 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return False


class Handler(BaseHTTPRequestHandler):
    server_version = "GRProjectManager/1.0"

    def log_message(self, _format, *_args):
        return

    def send_bytes(self, status: int, content: bytes, content_type: str, *, private: bool = False) -> None:
        try:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
            self.send_header("Cache-Control", "no-store" if private else "public, max-age=300")
            self.end_headers()
            self.wfile.write(content)
        except ConnectionError:
            return

    def reply(self, status: int, value: dict) -> None:
        self.send_bytes(status, json.dumps(value, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8", private=True)

    def read_json(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ValueError("Tamaño de solicitud inválido.") from error
        if length <= 0 or length > MAX_BODY:
            raise ValueError("La solicitud está vacía o supera el límite permitido (48 MB).")
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError("El formulario no tiene un formato válido.") from error
        if not isinstance(value, dict):
            raise ValueError("El formulario no tiene un formato válido.")
        return value

    def user(self, owner_only: bool = False):
        header = self.headers.get("Authorization", "")
        token = header[7:] if header.startswith("Bearer ") else ""
        if not token:
            return None
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        with db() as connection:
            row = connection.execute("""
              SELECT users.username, users.role FROM sessions
              JOIN users ON users.username=sessions.username
              WHERE sessions.token_hash=? AND sessions.expires_at>? AND users.active=1
            """, (token_hash, int(time.time()))).fetchone()
        if not row or (owner_only and row["role"] != "owner"):
            return None
        return dict(row)

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == "/api/translations-en":
            if not self.user():
                return self.reply(401, {"error": "Inicia sesión para continuar."})
            source = ROOT / "data" / "translations-en.json"
            try:
                translations = json.loads(source.read_text(encoding="utf-8")) if source.is_file() else {}
            except (OSError, json.JSONDecodeError):
                translations = {}
            return self.reply(200, {"translations": translations})
        if path == "/api/analytics":
            if not self.user():
                return self.reply(401, {"error": "Inicia sesión para continuar."})
            try:
                days = int(urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get("days", ["30"])[0])
            except (TypeError, ValueError):
                return self.reply(400, {"error": "Elige un periodo válido: 7, 30 o 90 días."})
            if days not in (7, 30, 90):
                return self.reply(400, {"error": "Elige un periodo válido: 7, 30 o 90 días."})
            try:
                return self.reply(200, analytics_report(days))
            except RuntimeError as error:
                return self.reply(503, {"error": str(error)})
            except Exception:
                return self.reply(502, {"error": "Google Analytics no respondió. Revisa el ID de propiedad y el acceso de solo lectura de la cuenta de servicio."})
        if path == "/api/me":
            user = self.user()
            return self.reply(200, {"user": user}) if user else self.reply(401, {"error": "Inicia sesión para continuar."})
        if path == "/api/projects":
            if not self.user():
                return self.reply(401, {"error": "Inicia sesión para continuar."})
            return self.reply(200, {"projects": safe_json_projects()})
        if path == "/api/properties":
            if not self.user():
                return self.reply(401, {"error": "Inicia sesión para continuar."})
            return self.reply(200, {"properties": safe_json_properties()})
        if path == "/api/workers":
            if not self.user(owner_only=True):
                return self.reply(403, {"error": "Solo la persona administradora puede gestionar cuentas."})
            with db() as connection:
                rows = connection.execute("SELECT username,active,created_at FROM users WHERE role='worker' ORDER BY username").fetchall()
            return self.reply(200, {"workers": [dict(row) for row in rows]})
        if path in ("/", "/admin", "/admin/"):
            path = "/admin/index.html"
        target = (ROOT / path.lstrip("/")).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            return self.reply(404, {"error": "No se encontró esa página."})
        allowed = (
            (path.startswith("/admin/") and target.is_relative_to(ADMIN_DIR))
            or (path.startswith("/Images/") and target.is_relative_to((ROOT / "Images").resolve()))
            or path == "/logo.jpeg"
        )
        if not allowed or not target.is_file():
            return self.reply(404, {"error": "No se encontró esa página."})
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in ("application/javascript", "application/json"):
            content_type += "; charset=utf-8"
        self.send_bytes(200, target.read_bytes(), content_type, private=path.startswith("/admin/"))

    def do_POST(self):
        path = urllib.parse.urlsplit(self.path).path
        try:
            body = self.read_json()
            if path == "/api/login":
                return self.login(body)
            if path == "/api/logout":
                return self.logout()
            if path == "/api/projects":
                if not self.user():
                    return self.reply(401, {"error": "Tu sesión venció. Vuelve a iniciar sesión."})
                return self.save_project(body)
            if path == "/api/properties":
                if not self.user():
                    return self.reply(401, {"error": "Tu sesión venció. Vuelve a iniciar sesión."})
                return self.save_property(body)
            if path == "/api/publish":
                if not self.user():
                    return self.reply(401, {"error": "Tu sesión venció. Vuelve a iniciar sesión."})
                files = {"data/proyectos.json": PROJECTS_FILE.read_bytes()}
                if PROPERTIES_FILE.exists():
                    files["data/propiedades.json"] = PROPERTIES_FILE.read_bytes()
                share_pages = {
                    **social_share_pages(safe_json_projects(), "proyectos"),
                    **social_share_pages(safe_json_properties(), "propiedades"),
                }
                write_social_share_pages(share_pages)
                files.update(share_pages)
                for image_root in (IMAGE_DIR, PROPERTY_IMAGE_DIR):
                    for image in image_root.rglob("*") if image_root.exists() else []:
                        if image.is_file():
                            files[image.relative_to(ROOT).as_posix()] = image.read_bytes()
                commit = publish_files(files)
                return self.reply(200, {"published": True, "commit": commit})
            if path == "/api/workers":
                if not self.user(owner_only=True):
                    return self.reply(403, {"error": "Solo la persona administradora puede gestionar cuentas."})
                username = str(body.get("username", "")).strip().lower()
                password = str(body.get("password", ""))
                create_user(username, password, "worker")
                return self.reply(201, {"created": True, "username": username})
            return self.reply(404, {"error": "No se encontró esa acción."})
        except ValueError as error:
            return self.reply(400, {"error": str(error)})
        except sqlite3.IntegrityError:
            return self.reply(409, {"error": "Ese usuario ya existe."})
        except Exception as error:
            return self.reply(500, {"error": str(error) or "No se pudo completar la operación."})

    def do_DELETE(self):
        path = urllib.parse.urlsplit(self.path).path
        user = self.user(owner_only=True)
        if not user:
            return self.reply(403, {"error": "Solo la persona administradora puede gestionar cuentas."})
        project_prefix = "/api/projects/"
        if path.startswith(project_prefix):
            identifier = urllib.parse.unquote(path[len(project_prefix):])
            if not identifier or "/" in identifier or "\\" in identifier or identifier in (".", ".."):
                return self.reply(404, {"error": "No se encontró ese proyecto."})
            projects = safe_json_projects()
            project = next((item for item in projects if item.get("id") == identifier), None)
            if not project:
                return self.reply(404, {"error": "No encontramos el proyecto que intentas eliminar."})
            remaining = [item for item in projects if item.get("id") != identifier]
            still_used = {
                str(image)
                for entry in remaining
                for image in entry.get("images", [])
            }
            still_used.update(
                str(image)
                for item in safe_json_properties()
                for image in item.get("images", [])
            )
            image_paths = []
            for image in project.get("images", []):
                relative = Path(str(image).replace("\\", "/"))
                if str(image) in still_used or relative.is_absolute() or ".." in relative.parts:
                    continue
                image_file = (ROOT / relative).resolve()
                try:
                    image_file.relative_to((ROOT / "Images").resolve())
                except ValueError:
                    continue
                image_paths.append(relative.as_posix())
            content = (json.dumps(remaining, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
            share_path = social_share_page_path("proyectos", identifier)
            commit = publish_files({"data/proyectos.json": content}, deletions=[*image_paths, share_path])
            PROJECTS_FILE.write_bytes(content)
            share_file = (ROOT / share_path).resolve()
            try:
                share_file.relative_to((ROOT / "compartir" / "proyectos").resolve())
                share_file.unlink(missing_ok=True)
            except (OSError, ValueError):
                pass
            for relative in image_paths:
                image_file = (ROOT / relative).resolve()
                try:
                    image_file.relative_to((ROOT / "Images").resolve())
                    image_file.unlink(missing_ok=True)
                except (OSError, ValueError):
                    pass
            return self.reply(200, {"deleted": True, "published": True, "commit": commit})

        property_prefix = "/api/properties/"
        if path.startswith(property_prefix):
            identifier = urllib.parse.unquote(path[len(property_prefix):])
            if not identifier or "/" in identifier or "\\" in identifier or identifier in (".", ".."):
                return self.reply(404, {"error": "No se encontró esa propiedad."})
            properties = safe_json_properties()
            item = next((entry for entry in properties if entry.get("id") == identifier), None)
            if not item:
                return self.reply(404, {"error": "No encontramos la propiedad que intentas eliminar."})
            remaining = [entry for entry in properties if entry.get("id") != identifier]
            still_used = {str(path) for entry in remaining for path in entry.get("images", [])}
            deletions = []
            for image in item.get("images", []):
                path = Path(str(image))
                parts = path.as_posix().split("/")
                if (str(image) not in still_used and not path.is_absolute() and ".." not in parts
                        and len(parts) == 4 and parts[:3] == ["Images", "propiedades", identifier]):
                    deletions.append(path.as_posix())
            content = (json.dumps(remaining, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
            share_path = social_share_page_path("propiedades", identifier)
            commit = publish_files({"data/propiedades.json": content}, deletions=[*deletions, share_path])
            PROPERTIES_FILE.write_bytes(content)
            share_file = (ROOT / share_path).resolve()
            try:
                share_file.relative_to((ROOT / "compartir" / "propiedades").resolve())
                share_file.unlink(missing_ok=True)
            except (OSError, ValueError):
                pass
            for relative in deletions:
                image_file = (ROOT / relative).resolve()
                try:
                    image_file.relative_to(PROPERTY_IMAGE_DIR.resolve())
                    image_file.unlink(missing_ok=True)
                except (OSError, ValueError):
                    pass
            try:
                (PROPERTY_IMAGE_DIR / identifier).rmdir()
            except OSError:
                pass
            return self.reply(200, {"deleted": True, "published": True, "commit": commit})

        prefix = "/api/workers/"
        if not path.startswith(prefix):
            return self.reply(404, {"error": "No se encontró esa acción."})
        username = urllib.parse.unquote(path[len(prefix):]).lower()
        with db() as connection:
            connection.execute("UPDATE users SET active=0 WHERE username=? AND role='worker'", (username,))
            connection.execute("DELETE FROM sessions WHERE username=?", (username,))
        return self.reply(200, {"disabled": True})

    def login(self, body: dict):
        ip = self.client_address[0]
        now = time.time()
        failures = [at for at in LOGIN_FAILURES.get(ip, []) if now - at < 600]
        if len(failures) >= 10:
            return self.reply(429, {"error": "Demasiados intentos. Espera diez minutos y prueba de nuevo."})
        username = str(body.get("username", "")).strip().lower()
        password = str(body.get("password", ""))
        with db() as connection:
            row = connection.execute("SELECT * FROM users WHERE username=? AND active=1", (username,)).fetchone()
        valid = False
        if row:
            expected = base64.b64decode(row["password_hash"])
            salt = base64.b64decode(row["salt"])
            actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ROUNDS)
            valid = hmac.compare_digest(actual, expected)
        if not valid:
            failures.append(now)
            LOGIN_FAILURES[ip] = failures
            return self.reply(401, {"error": "Usuario o contraseña incorrectos."})
        LOGIN_FAILURES.pop(ip, None)
        token = secrets.token_urlsafe(32)
        with db() as connection:
            connection.execute("DELETE FROM sessions WHERE expires_at<=?", (int(now),))
            connection.execute("INSERT INTO sessions(token_hash,username,expires_at) VALUES(?,?,?)",
                               (hashlib.sha256(token.encode()).hexdigest(), username, int(now) + SESSION_TTL))
        return self.reply(200, {"token": token, "user": {"username": username, "role": row["role"]}})

    def logout(self):
        header = self.headers.get("Authorization", "")
        token = header[7:] if header.startswith("Bearer ") else ""
        if token:
            with db() as connection:
                connection.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(token.encode()).hexdigest(),))
        return self.reply(200, {"loggedOut": True})

    def save_project(self, body: dict):
        title = str(body.get("title", "")).strip()[:120]
        summary = str(body.get("summary", "")).strip()[:500]
        details = str(body.get("details", "")).strip()[:6000]
        location = str(body.get("location", "")).strip()[:180]
        price = str(body.get("price", "")).strip()[:100]
        features = [str(item).strip()[:180] for item in body.get("features", []) if str(item).strip()][:30]
        title_en = str(body.get("titleEn", "")).strip()[:120]
        summary_en = str(body.get("summaryEn", "")).strip()[:500]
        location_en = str(body.get("locationEn", "")).strip()[:180]
        price_en = str(body.get("priceEn", "")).strip()[:100]
        details_en = str(body.get("detailsEn", "")).strip()[:6000]
        features_en = [str(item).strip()[:180] for item in body.get("featuresEn", []) if str(item).strip()][:30]
        if not title or not summary:
            raise ValueError("El nombre y el resumen son obligatorios.")
        projects = safe_json_projects()
        identifier = str(body.get("id", "")).strip()
        project = next((item for item in projects if item.get("id") == identifier), None) if identifier else None
        if identifier and not project:
            raise ValueError("No encontramos el proyecto que intentas editar.")
        if not identifier:
            identifier = slugify(title)
            used = {item.get("id") for item in projects}
            if identifier in used:
                identifier = f"{identifier}-{uuid.uuid4().hex[:6]}"
            project = {"id": identifier, "images": [], "featured": False}

        uploads = body.get("images", [])
        if not isinstance(uploads, list) or len(uploads) > MAX_IMAGES:
            raise ValueError("Puedes subir hasta cinco imágenes por envío.")
        image_files: dict[str, bytes] = {}
        image_paths = list(project.get("images", []))
        remove_images = body.get("removeImages", [])
        if not isinstance(remove_images, list):
            raise ValueError("La selección de imágenes por quitar no es válida.")
        remove_images = [str(path) for path in remove_images]
        if any(
            path not in image_paths
            or Path(path).is_absolute()
            or ".." in Path(path).as_posix().split("/")
            for path in remove_images
        ):
            raise ValueError("Una de las imágenes que intentas quitar no pertenece a este proyecto.")
        image_paths = [path for path in image_paths if path not in remove_images]
        image_order = body.get("imageOrder", image_paths)
        if not isinstance(image_order, list) or any(not isinstance(path, str) for path in image_order):
            raise ValueError("El orden de las imágenes no es válido.")
        if len(image_order) != len(set(image_order)) or set(image_order) != set(image_paths):
            raise ValueError("El orden debe incluir exactamente las imágenes actuales.")
        image_paths = list(image_order)
        for upload in uploads:
            if not isinstance(upload, dict):
                raise ValueError("Una imagen no tiene un formato válido.")
            original_name = Path(str(upload.get("name", "foto.jpg"))).name
            extension = Path(original_name).suffix.lower()
            if extension not in (".jpg", ".jpeg", ".png", ".webp"):
                raise ValueError("Usa imágenes JPG, PNG o WEBP.")
            try:
                binary = base64.b64decode(str(upload.get("data", "")), validate=True)
            except (ValueError, base64.binascii.Error) as error:
                raise ValueError("No se pudo leer una de las imágenes.") from error
            if not binary or len(binary) > MAX_IMAGE:
                raise ValueError("Cada imagen debe pesar menos de 6 MB.")
            if not verify_image(binary, extension):
                raise ValueError("El contenido de una imagen no coincide con su extensión.")
            filename = f"{uuid.uuid4().hex}{extension}"
            relative = f"Images/proyectos/{identifier}/{filename}"
            destination = ROOT / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(binary)
            image_files[relative] = binary
            image_paths.append(relative)
        if not image_paths:
            raise ValueError("El proyecto debe conservar al menos una imagen.")

        project.update({"id": identifier, "title": title, "summary": summary, "location": location,
                        "price": price, "details": details, "features": features,
                        "titleEn": title_en, "summaryEn": summary_en, "locationEn": location_en,
                        "priceEn": price_en, "detailsEn": details_en, "featuresEn": features_en,
                        "images": image_paths, "featured": bool(body.get("featured", project.get("featured", False)))})
        if project not in projects:
            projects.append(project)
        else:
            projects = [project if item.get("id") == identifier else item for item in projects]
        still_used = {
            str(path)
            for item in projects
            for path in item.get("images", [])
        }
        physical_deletions = [
            path for path in remove_images
            if path not in still_used and Path(path).as_posix().split("/")[0] == "Images"
        ]
        share_pages = social_share_pages(projects, "proyectos")
        write_social_share_pages(share_pages)
        previous_projects = PROJECTS_FILE.read_bytes() if PROJECTS_FILE.exists() else b"[]\n"
        json_bytes = write_projects(projects)
        try:
            commit = publish_files(
                {"data/proyectos.json": json_bytes, **image_files, **share_pages},
                deletions=physical_deletions,
            )
            for relative in physical_deletions:
                image_file = (ROOT / relative).resolve()
                try:
                    image_file.relative_to(IMAGE_DIR.resolve())
                    image_file.unlink(missing_ok=True)
                except (OSError, ValueError):
                    pass
            return self.reply(200, {"saved": True, "published": True, "commit": commit, "project": project})
        except Exception as error:
            PROJECTS_FILE.write_bytes(previous_projects)
            return self.reply(202, {"saved": True, "published": False, "project": project,
                                    "error": f"El proyecto quedó guardado en este computador, pero falta publicarlo en GitHub: {error}"})

    def save_property(self, body: dict):
        title = str(body.get("title", "")).strip()[:120]
        department = str(body.get("department", "")).strip()[:80]
        city = str(body.get("city", "")).strip()[:100]
        property_type = str(body.get("type", "")).strip()[:60]
        summary = str(body.get("summary", "")).strip()[:500]
        details = str(body.get("details", "")).strip()[:6000]
        title_en = str(body.get("titleEn", "")).strip()[:120]
        summary_en = str(body.get("summaryEn", "")).strip()[:500]
        department_en = str(body.get("departmentEn", "")).strip()[:80]
        city_en = str(body.get("cityEn", "")).strip()[:100]
        type_en = str(body.get("typeEn", "")).strip()[:60]
        details_en = str(body.get("detailsEn", "")).strip()[:6000]
        if not title or not department or not city or not property_type:
            raise ValueError("Completa nombre, departamento, ciudad y tipo de inmueble.")
        try:
            price = int(body.get("price", 0))
        except (TypeError, ValueError) as error:
            raise ValueError("Escribe un precio válido en pesos colombianos.") from error
        if price <= 0:
            raise ValueError("El precio debe ser mayor que cero.")
        properties = safe_json_properties()
        identifier = str(body.get("id", "")).strip()
        item = next((entry for entry in properties if entry.get("id") == identifier), None) if identifier else None
        if identifier and not item:
            raise ValueError("No encontramos la propiedad que intentas editar.")
        if not identifier:
            identifier = slugify(title)
            used = {entry.get("id") for entry in properties}
            if identifier in used:
                identifier = f"{identifier}-{uuid.uuid4().hex[:6]}"
            item = {"id": identifier, "images": []}
        uploads = body.get("images", [])
        if not isinstance(uploads, list) or len(uploads) > MAX_IMAGES:
            raise ValueError("Puedes subir hasta cinco imágenes por envío.")
        image_paths = list(item.get("images", []))
        remove_images = body.get("removeImages", [])
        if not isinstance(remove_images, list):
            raise ValueError("La selección de imágenes no es válida.")
        remove_images = [str(path) for path in remove_images]
        if any(path not in image_paths or Path(path).is_absolute() or ".." in Path(path).as_posix().split("/")
               for path in remove_images):
            raise ValueError("Una de las imágenes no pertenece a esta propiedad.")
        image_paths = [path for path in image_paths if path not in remove_images]
        image_order = body.get("imageOrder", image_paths)
        if not isinstance(image_order, list) or any(not isinstance(path, str) for path in image_order):
            raise ValueError("El orden de las fotos no es válido.")
        if len(image_order) != len(set(image_order)) or set(image_order) != set(image_paths):
            raise ValueError("El orden debe incluir exactamente las fotos actuales.")
        image_paths = list(image_order)
        image_files: dict[str, bytes] = {}
        for upload in uploads:
            if not isinstance(upload, dict):
                raise ValueError("Una imagen no tiene un formato válido.")
            filename = Path(str(upload.get("name", "foto.jpg"))).name
            extension = Path(filename).suffix.lower()
            if extension not in (".jpg", ".jpeg", ".png", ".webp"):
                raise ValueError("Usa imágenes JPG, PNG o WEBP.")
            try:
                binary = base64.b64decode(str(upload.get("data", "")), validate=True)
            except (ValueError, base64.binascii.Error) as error:
                raise ValueError("No se pudo leer una de las imágenes.") from error
            if not binary or len(binary) > MAX_IMAGE:
                raise ValueError("Cada imagen debe pesar menos de 6 MB.")
            if not verify_image(binary, extension):
                raise ValueError("El contenido de una imagen no coincide con su extensión.")
            relative = f"Images/propiedades/{identifier}/{uuid.uuid4().hex}{extension}"
            image_files[relative] = binary
            image_paths.append(relative)
        if not image_paths:
            raise ValueError("Agrega al menos una foto a la propiedad.")
        try:
            bedrooms = max(0, min(50, int(body.get("bedrooms", 0) or 0)))
            bathrooms = max(0, min(50, int(body.get("bathrooms", 0) or 0)))
            area = max(0, min(1_000_000, int(body.get("area", 0) or 0)))
            area_hectares = float(body.get("areaHectares", 0) or 0)
            if not math.isfinite(area_hectares) or not 0 <= area_hectares <= 1_000_000:
                raise ValueError("El área en hectáreas debe estar entre 0 y 1.000.000.")
            area_hectares = round(area_hectares, 4)
        except (TypeError, ValueError) as error:
            raise ValueError("Habitaciones, baños, área en m² y hectáreas deben tener valores numéricos válidos.") from error
        item.update({"id": identifier, "title": title, "department": department, "city": city,
                     "type": property_type, "price": price, "summary": summary, "details": details,
                     "titleEn": title_en, "summaryEn": summary_en, "departmentEn": department_en,
                     "cityEn": city_en, "typeEn": type_en, "detailsEn": details_en,
                     "bedrooms": bedrooms, "bathrooms": bathrooms, "area": area,
                     "areaHectares": area_hectares, "images": image_paths})
        if item not in properties:
            properties.append(item)
        else:
            properties = [item if entry.get("id") == identifier else entry for entry in properties]
        still_used = {str(path) for entry in properties for path in entry.get("images", [])}
        deletions = [path for path in remove_images if path not in still_used
                     and Path(path).as_posix().split("/")[:3] == ["Images", "propiedades", identifier]]
        share_pages = social_share_pages(properties, "propiedades")
        write_social_share_pages(share_pages)
        previous = PROPERTIES_FILE.read_bytes() if PROPERTIES_FILE.exists() else b"[]\n"
        content = write_properties(properties)
        try:
            for relative, binary in image_files.items():
                destination = ROOT / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(binary)
            commit = publish_files(
                {"data/propiedades.json": content, **image_files, **share_pages},
                deletions=deletions,
            )
            for relative in deletions:
                try:
                    target = (ROOT / relative).resolve()
                    target.relative_to(PROPERTY_IMAGE_DIR.resolve())
                    target.unlink(missing_ok=True)
                except (OSError, ValueError):
                    pass
            return self.reply(200, {"saved": True, "published": True, "commit": commit, "property": item})
        except Exception as error:
            PROPERTIES_FILE.write_bytes(previous)
            write_social_share_pages(social_share_pages(safe_json_properties(), "propiedades"))
            return self.reply(202, {"saved": False, "published": False,
                                    "error": f"No se pudo publicar la propiedad en GitHub: {error}"})


def command_line() -> int:
    read_dotenv()
    if len(sys.argv) >= 2 and sys.argv[1] in ("create-owner", "create-worker"):
        role = "owner" if sys.argv[1] == "create-owner" else "worker"
        username = sys.argv[2] if len(sys.argv) > 2 else input("Usuario: ")
        import getpass
        password = getpass.getpass("Contraseña nueva (mínimo 12 caracteres): ")
        confirm = getpass.getpass("Repite la contraseña: ")
        if password != confirm:
            print("Las contraseñas no coinciden.")
            return 2
        try:
            create_user(username, password, role)
        except (ValueError, sqlite3.IntegrityError) as error:
            print(f"No se creó la cuenta: {error}")
            return 2
        print(f"Cuenta {role} creada para {username.strip().lower()}.")
        return 0
    with db() as connection:
        if connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            print("Primero crea la cuenta responsable con: python admin_server.py create-owner")
            return 2
    # Accept connections from the company Wi-Fi as well as from a local Tailscale
    # proxy. Authentication remains mandatory for every admin API endpoint.
    host = "0.0.0.0"
    port = int(os.environ.get("ADMIN_PORT", "8765"))
    print(f"Panel en este computador: http://127.0.0.1:{port}/admin/")
    try:
        addresses = sorted({item[4][0] for item in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)})
        for address in addresses:
            if not address.startswith("127."):
                print(f"Panel en la red Wi-Fi: http://{address}:{port}/admin/")
    except OSError:
        pass
    print("Mantén esta ventana abierta mientras los trabajadores cargan proyectos.")
    try:
        ThreadingHTTPServer((host, port), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\nServidor cerrado.")
    return 0


if __name__ == "__main__":
    raise SystemExit(command_line())
