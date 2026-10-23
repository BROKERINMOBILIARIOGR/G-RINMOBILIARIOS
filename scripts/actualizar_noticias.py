#!/usr/bin/env python3
"""Actualiza titulares y enlaces RSS, sin copiar artículos completos."""
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


def main():
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    items = camara_project(cutoff)
    items = camara_project(cutoff)
    seen = {item["url"] for item in items}
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
            try:
                published_dt = datetime.fromisoformat(published)
            except ValueError:
                continue
            if published_dt < cutoff or link in seen:
                continue
            seen.add(link)
            items.append({
                "title": title[:240],
                "url": link,
                "source": source[:100] or "Google Noticias",
                "publishedAt": published,
                "category": category_for(title + " " + source),
                "imageUrl": image_from_rss(node),
            })
    items.sort(key=lambda item: item["publishedAt"], reverse=True)
    items = add_article_images(items[:36])
    payload = {
        "updatedAt": datetime.now(ZoneInfo("America/Bogota")).isoformat(timespec="minutes"),
        "items": items,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Guardados {len(payload['items'])} titulares de varias fuentes.")

if __name__ == "__main__":
    main()
