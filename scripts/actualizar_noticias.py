#!/usr/bin/env python3
"""Actualiza titulares y enlaces RSS, sin copiar artículos completos."""
import hashlib
import html
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

OUTPUT = Path("data/noticias.json")
SHARE_DIR = Path("compartir/noticias")
SITE_URL = "https://brokerinmobiliariogr.github.io/G-RINMOBILIARIOS/"
BASE = "https://news.google.com/rss/search?"
QUERIES = [
    "vivienda Colombia",
    "subsidio de vivienda Colombia",
    "finca raíz Colombia",
    "mercado inmobiliario Colombia",
    "construcción de vivienda Colombia",
    "política de vivienda Colombia",
]
def feed_url(cutoff, search_terms):
    query = search_terms + " after:" + cutoff.strftime("%Y-%m-%d")
    return BASE + urllib.parse.urlencode({
        "q": query, "hl": "es-419", "gl": "CO", "ceid": "CO:es-419"
    })
HEADERS = {"User-Agent": "G-R-Inmobiliarios-Noticias/1.0 (+https://brokerinmobiliariogr.github.io/G-RINMOBILIARIOS/)"}
CATEGORIES = [
    ("Subsidios", re.compile(r"subsid|mi casa ya|vivienda gratis|cobertura|caja de compensación", re.I)),
    ("Política y normas", re.compile(r"reforma|ley |decreto|congreso|ministerio|gobierno|política|política pública|senado|cámara de representantes", re.I)),
    ("Proyectos y construcción", re.compile(r"construcc|proyecto|licencia|obra|urbanismo|vivienda nueva|constructor", re.I)),
]

def category_for(text):
    for label, pattern in CATEGORIES:
        if pattern.search(text):
            return label
    return "Mercado inmobiliario"

def parse_date(value):
    if not value:
        return ""
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat(timespec="seconds")
    except (TypeError, ValueError, OverflowError):
        return ""

class ArticleImageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.image = ""

    def handle_starttag(self, tag, attrs):
        if tag.lower() != "meta" or self.image:
            return
        values = {key.lower(): value for key, value in attrs if key and value}
        key = (values.get("property") or values.get("name") or "").lower()
        if key in ("og:image", "og:image:secure_url", "twitter:image", "twitter:image:src"):
            self.image = values.get("content", "")

def image_from_rss(node):
    for element in node.iter():
        name = element.tag.rsplit("}", 1)[-1].lower()
        candidate = ""
        if name in ("thumbnail", "content") and element.attrib.get("url"):
            candidate = element.attrib["url"]
        elif name == "enclosure" and element.attrib.get("type", "").startswith("image/"):
            candidate = element.attrib.get("url", "")
        if candidate and candidate.startswith("https://"):
            return candidate
    return ""

def image_from_article(url):
    try:
        request = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; GRNoticias/1.0)",
            "Accept": "text/html,application/xhtml+xml",
        })
        with urllib.request.urlopen(request, timeout=10) as response:
            content_type = response.headers.get("Content-Type", "")
            if "html" not in content_type.lower():
                return ""
            html = response.read(1024 * 1024).decode("utf-8", errors="replace")
            parser = ArticleImageParser()
            parser.feed(html)
            image = urllib.parse.urljoin(response.geturl(), parser.image)
            parsed = urllib.parse.urlparse(image)
            return image if parsed.scheme == "https" and parsed.netloc else ""
    except (urllib.error.URLError, TimeoutError, ValueError):
        return ""

def add_article_images(items):
    def find(item):
        if not item.get("imageUrl"):
            item["imageUrl"] = image_from_article(item["url"])
        return item
    with ThreadPoolExecutor(max_workers=6) as executor:
        enriched = list(executor.map(find, items))
    image_counts = {}
    for item in enriched:
        image = item.get("imageUrl", "")
        if image:
            image_counts[image] = image_counts.get(image, 0) + 1
    for item in enriched:
        image = item.get("imageUrl", "")
        if image and image_counts[image] > 1:
            item["imageUrl"] = ""
    return enriched

def camara_project(cutoff):
    # Proyecto legislativo de vivienda publicado en la ficha oficial de la Cámara.
    url = "https://www.camara.gov.co/vivienda-sin-cuota-inicial/"
    filed = datetime(2026, 10, 21, 12, tzinfo=timezone.utc)
    if filed < cutoff:
        return []
    request = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            page = response.read(2 * 1024 * 1024).decode("utf-8", errors="replace")
    except (urllib.error.URLError, TimeoutError):
        return []
    if "455/2026C" not in page or "sin cuota inicial" not in page.lower():
        return []
    return [{
        "title": "Proyecto de ley propone vivienda VIP sin cuota inicial (455/2026C)",
        "url": url,
        "source": "Cámara de Representantes",
        "publishedAt": filed.isoformat(timespec="seconds"),
        "category": "Política y normas",
        "imageUrl": "",
    }]


def create_news_share_pages(items):
    SHARE_DIR.mkdir(parents=True, exist_ok=True)
    active_paths = set()
    for item in items:
        identifier = hashlib.sha256(item["url"].encode("utf-8")).hexdigest()[:20]
        relative_path = f"compartir/noticias/{identifier}.html"
        item["sharePath"] = relative_path
        active_paths.add(f"{identifier}.html")
        title = str(item.get("title") or "Actualidad de vivienda")
        description = f"{item.get('source') or 'Fuente original'} · Lee la noticia completa en su publicación original."
        article_url = item["url"]
        image = item.get("imageUrl") or "Images/logo-gr-facebook.png"
        image_url = urllib.parse.urljoin(SITE_URL, urllib.parse.quote(image, safe=":/%?=&"))
        share_url = urllib.parse.urljoin(SITE_URL, relative_path)
        safe_title = html.escape(title, quote=True)
        safe_description = html.escape(description, quote=True)
        safe_image = html.escape(image_url, quote=True)
        safe_share_url = html.escape(share_url, quote=True)
        safe_article_url = html.escape(article_url, quote=True)
        redirect_url = json.dumps(article_url, ensure_ascii=True).replace("</", "<\\/")
        page = f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{safe_title} | Actualidad G&amp;R</title>
  <meta name="description" content="{safe_description}">
  <link rel="icon" href="../../logo-gr.svg">
  <script src="../../js/analytics.js?v=2" defer></script>
  <script type="module" src="../../js/contador-visitas.js?v=3"></script>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: #f5f7f6; color: #202a25; font: 16px/1.6 Arial, sans-serif; }}
    .brand {{ display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px max(20px, calc((100% - 920px) / 2)); background: #173d2d; color: #fff; }}
    .brand a {{ display: inline-flex; align-items: center; gap: 10px; color: inherit; font-weight: 700; text-decoration: none; }}
    .brand img {{ width: 38px; height: 38px; object-fit: contain; border-radius: 6px; background: #fff; }}
    .brand-label {{ color: #e4c353; font-size: 14px; font-weight: 700; }}
    main {{ width: min(100% - 32px, 760px); margin: 40px auto; overflow: hidden; border: 1px solid #e1e7e2; border-radius: 16px; background: #fff; box-shadow: 0 12px 34px rgba(23, 61, 45, .09); }}
    .cover {{ display: block; width: 100%; max-height: 420px; object-fit: cover; background: #edf2ee; }}
    .content {{ padding: clamp(22px, 5vw, 42px); }}
    .source {{ display: inline-block; margin-bottom: 12px; padding: 5px 11px; border-radius: 99px; background: #edf3ef; color: #1f4f3a; font-size: 13px; font-weight: 700; }}
    h1 {{ margin: 0 0 14px; font-size: clamp(24px, 4vw, 36px); line-height: 1.2; }}
    .description {{ margin: 0 0 24px; color: #58645d; }}
    .actions {{ display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }}
    .read-link {{ display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 10px 20px; border-radius: 9px; background: #1f4f3a; color: #fff; font-weight: 700; text-decoration: none; }}
    .read-link:hover {{ background: #173d2d; }}
    .more-link {{ color: #1f4f3a; font-weight: 700; text-decoration: none; }}
    footer {{ padding: 0 16px 28px; color: #66736b; text-align: center; font-size: 13px; }}
    @media (max-width: 520px) {{ .brand {{ padding: 12px 16px; }} main {{ margin: 20px auto; }} .cover {{ max-height: 260px; }} .read-link {{ width: 100%; }} }}
  </style>
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Broker Inmobiliario G&amp;R">
  <meta property="og:title" content="{safe_title}">
  <meta property="og:description" content="{safe_description}">
  <meta property="og:url" content="{safe_share_url}">
  <meta property="og:image" content="{safe_image}">
  <meta property="og:image:alt" content="{safe_title}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{safe_title}">
  <meta name="twitter:description" content="{safe_description}">
  <meta name="twitter:image" content="{safe_image}">
</head>
<body>
  <header class="brand">
    <a href="../../index.html"><img src="../../logo-gr.svg" alt=""><span>Broker Inmobiliario G&amp;R</span></a>
    <span class="brand-label">Actualidad de vivienda</span>
  </header>
  <main>
    <img class="cover" src="{safe_image}" alt="">
    <div class="content">
      <span class="source">Publicado originalmente en {html.escape(str(item.get("source") or "Fuente original"), quote=True)}</span>
      <h1>{safe_title}</h1>
      <p class="description">{safe_description}</p>
      <div class="actions">
        <a class="read-link" href="{safe_article_url}" target="_blank" rel="noopener noreferrer" data-news-outbound data-news-title="{safe_title}" data-news-source="{html.escape(str(item.get("source") or "Fuente original"), quote=True)}">Leer noticia original ↗</a>
        <a class="more-link" href="../../noticias.html">Ver más noticias</a>
      </div>
    </div>
  </main>
  <footer>© Broker Inmobiliario G&amp;R · Actualidad de vivienda</footer>
</body>
</html>
"""
        (SHARE_DIR / f"{identifier}.html").write_text(page, encoding="utf-8")
    for old_page in SHARE_DIR.glob("[0-9a-f]" * 20 + ".html"):
        if old_page.name not in active_paths:
            old_page.unlink()


def main():
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    try:
        previous_items = json.loads(OUTPUT.read_text(encoding="utf-8")).get("items", [])
    except (OSError, json.JSONDecodeError):
        previous_items = []
    previous_by_title = {
        (" ".join(str(item.get("title", "")).split()).casefold(), str(item.get("source", "")).casefold()): item
        for item in previous_items
    }
    items = camara_project(cutoff)
    seen = {item["url"] for item in items}
    seen_titles = {re.sub(r"\\s+", " ", item["title"]).strip().casefold() for item in items}
    for search_terms in QUERIES:
        request = urllib.request.Request(feed_url(cutoff, search_terms), headers=HEADERS)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                root = ET.fromstring(response.read())
        except (urllib.error.URLError, TimeoutError, ET.ParseError):
            continue
        channel = root.find("channel")
        if channel is None:
            continue
        for node in channel.findall("item"):
            title = (node.findtext("title") or "").strip()
            link = (node.findtext("link") or "").strip()
            source_node = node.find("source")
            source = (source_node.text or "").strip() if source_node is not None else ""
            published = parse_date(node.findtext("pubDate"))
            if not published or not title or not link:
                continue
            normalized_title = re.sub(r"\\s+", " ", title).strip().casefold()
            if "apuest" in normalized_title or normalized_title in seen_titles:
                continue
            try:
                published_dt = datetime.fromisoformat(published)
            except ValueError:
                continue
            if published_dt < cutoff or link in seen:
                continue
            seen.add(link)
            seen_titles.add(normalized_title)
            items.append({
                "title": title[:240],
                "url": link,
                "source": source[:100] or "Google Noticias",
                "publishedAt": published,
                "category": category_for(title + " " + source),
                "imageUrl": image_from_rss(node),
            })
    for item in items:
        key = (" ".join(str(item.get("title", "")).split()).casefold(), str(item.get("source", "")).casefold())
        previous = previous_by_title.get(key)
        if not previous:
            continue
        previous_url = str(previous.get("url", ""))
        current_host = urllib.parse.urlparse(item["url"]).hostname or ""
        previous_host = urllib.parse.urlparse(previous_url).hostname or ""
        if current_host == "news.google.com" and previous_host and previous_host != "news.google.com":
            item["url"] = previous_url
        if not item.get("imageUrl") and previous.get("imageUrl"):
            item["imageUrl"] = previous["imageUrl"]
    items.sort(key=lambda item: item["publishedAt"], reverse=True)
    items = add_article_images(items[:36])
    create_news_share_pages(items)
    payload = {
        "updatedAt": datetime.now(ZoneInfo("America/Bogota")).isoformat(timespec="minutes"),
        "items": items,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Guardados {len(payload['items'])} titulares de varias fuentes.")

if __name__ == "__main__":
    main()
