#!/usr/bin/env python3
"""Actualiza titulares y enlaces RSS, sin copiar artículos completos."""
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

OUTPUT = Path("data/noticias.json")
BASE = "https://news.google.com/rss/search?"
QUERY = '(vivienda Colombia OR subsidio vivienda Colombia OR finca raíz Colombia OR mercado inmobiliario Colombia OR construcción vivienda Colombia OR reforma vivienda Colombia OR proyectos vivienda Colombia)'
def feed_url(cutoff):
    query = QUERY + " after:" + cutoff.strftime("%Y-%m-%d")
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

def main():
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    request = urllib.request.Request(feed_url(cutoff), headers=HEADERS)
    with urllib.request.urlopen(request, timeout=30) as response:
        root = ET.fromstring(response.read())
    items = []
    seen = set()
    channel = root.find("channel")
    if channel is None:
        raise RuntimeError("El RSS no tiene un canal válido.")
    for node in channel.findall("item"):
        title = (node.findtext("title") or "").strip()
        link = (node.findtext("link") or "").strip()
        source_node = node.find("source")
        source = (source_node.text or "").strip() if source_node is not None else ""
        published = parse_date(node.findtext("pubDate"))
        if not published:
            continue
        try:
            published_dt = datetime.fromisoformat(published)
        except ValueError:
            continue
        if published_dt < cutoff:
            continue
        key = link or title.casefold()
        if not title or not link or key in seen:
            continue
        seen.add(key)
        items.append({
            "title": title[:240],
            "url": link,
            "source": source[:100] or "Google Noticias",
            "publishedAt": published,
            "category": category_for(title + " " + source),
        })
    items.sort(key=lambda item: item["publishedAt"], reverse=True)
    payload = {
        "updatedAt": datetime.now(ZoneInfo("America/Bogota")).isoformat(timespec="minutes"),
        "items": items[:36],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Guardados {len(payload['items'])} titulares.")

if __name__ == "__main__":
    main()
