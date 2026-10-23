#!/usr/bin/env python3
"""Actualiza titulares sobre vivienda desde canales RSS públicos de medios colombianos."""
import json
import re
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

OUTPUT = Path("data/noticias.json")
FEEDS = [
    ("EL TIEMPO · Economía", "https://www.eltiempo.com/rss/economia.xml"),
    ("EL TIEMPO · Colombia", "https://www.eltiempo.com/rss/colombia.xml"),
    ("EL TIEMPO · Política", "https://www.eltiempo.com/rss/politica.xml"),
]
HEADERS = {
    "User-Agent": "G-R-Inmobiliarios-Noticias/1.0 (+https://brokerinmobiliariogr.github.io/G-RINMOBILIARIOS/)",
    "Accept": "application/rss+xml, application/xml, text/xml",
}
TOPIC = re.compile(
    r"\bviviend\w*\b|inmobili\w*|finca\s*ra[ií]z|"
    r"\bcasas?\b|\bhogares?\b|"
    r"subsid\w*|mi casa ya|arriendo|arrendamiento|hipoteca|cr[eé]dito hipotecario|"
    r"\bv\.?\s*i\.?\s*s\.?\b|\bv\.?\s*i\.?\s*p\.?\b|"
    r"construcci[oó]n de vivienda|proyecto[s]? de vivienda|vivienda nueva|constructora[s]?|"
    r"licencia[s]? de construcci[oó]n|urbanismo|uso del suelo|impuesto predial|catastro|"
    r"\blotes?\b|desalojo|damnificad\w*",
    re.I,
)
CATEGORIES = [
    ("Subsidios", re.compile(r"subsid|mi casa ya|vivienda gratis|cobertura|caja de compensación", re.I)),
    ("Política y normas", re.compile(r"reforma|ley |decreto|congreso|ministerio|gobierno|política|senado|cámara de representantes|norma", re.I)),
    ("Proyectos y construcción", re.compile(r"construcción de vivienda|proyectos? de vivienda|vivienda nueva|constructoras?|licencias? de construcción|urbanismo", re.I)),
]

def category_for(text):
    for label, pattern in CATEGORIES:
        if pattern.search(text):
            return label
    return "Mercado inmobiliario"

def local_name(element):
    return element.tag.rsplit("}", 1)[-1].lower()

def child_text(node, name):
    return next(((element.text or "").strip() for element in node if local_name(element) == name), "")

def parse_date(value):
    if not value:
        return ""
    try:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat(timespec="seconds")
    except (TypeError, ValueError, OverflowError):
        return ""

def image_from_rss(node):
    for element in node.iter():
        name = local_name(element)
        candidate = ""
        if name in ("thumbnail", "content", "enclosure") and element.attrib.get("url"):
            if name != "enclosure" or element.attrib.get("type", "").startswith("image/"):
                candidate = element.attrib["url"]
        elif name == "image":
            candidate = element.attrib.get("url", "") or (element.text or "").strip()
        if candidate.startswith("https://"):
            return candidate
    return ""

def fetch_feed(label, url, cutoff):
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        root = ET.fromstring(response.read())
    channel = root.find("channel")
    if channel is None:
        raise RuntimeError(f"El RSS de {label} no tiene un canal válido.")
    results = []
    for node in channel.findall("item"):
        title = child_text(node, "title")
        link = child_text(node, "link")
        description = child_text(node, "description")
        published = parse_date(child_text(node, "pubdate"))
        if not published or not title or not link:
            continue
        published_dt = datetime.fromisoformat(published)
        if published_dt < cutoff or not TOPIC.search(f"{title} {description}"):
            continue
        results.append({
            "title": title[:240],
            "url": link,
            "source": label,
            "publishedAt": published,
            "category": category_for(f"{title} {description}"),
            "imageUrl": image_from_rss(node),
        })
    return results

def main():
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    items = []
    errors = []
    for label, url in FEEDS:
        try:
            items.extend(fetch_feed(label, url, cutoff))
        except (urllib.error.URLError, TimeoutError, ET.ParseError, RuntimeError) as error:
            errors.append(f"{label}: {error}")
    unique = {}
    for item in items:
        unique.setdefault(item["url"], item)
    items = sorted(unique.values(), key=lambda item: item["publishedAt"], reverse=True)[:36]
    if not items:
        details = "; ".join(errors) if errors else "los RSS no tienen titulares pertinentes"
        raise RuntimeError(f"No se recibieron noticias de vivienda; se conserva la lista publicada. Detalle: {details}")
    payload = {
        "updatedAt": datetime.now(ZoneInfo("America/Bogota")).isoformat(timespec="minutes"),
        "items": items,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Guardados {len(items)} titulares; {sum(bool(item['imageUrl']) for item in items)} con miniatura RSS.")
    if errors:
        print("Fuentes temporalmente omitidas: " + "; ".join(errors))

if __name__ == "__main__":
    main()
