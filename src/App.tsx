import React, { useState } from "react";
import { XMLParser } from "fast-xml-parser";

const BASE_URL =
  "https://www.eluniverso.com/arc/outboundfeeds/rss-subsection/{section}/?outputType=xml";

const SECTIONS = [
  "guayaquil/comunidad",
  "noticias/ecuador",
  "noticias/internacional",
  "noticias/politica",
  "deportes/futbol",
  "noticias/economia",
];

const FIREBASE_BASE = "https://news-reader-2acd6-default-rtdb.firebaseio.com";
const FIREBASE_PATH = "eluniverso"; // terminará en .../eluniverso.json

function xmlToJson(xmlText: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: true,
    trimValues: true,
  });
  return parser.parse(xmlText);
}

function buildUrl(section: string) {
  return BASE_URL.replace("{section}", encodeURIComponent(section));
}

async function fetchSectionAsJson(section: string) {
  const url = buildUrl(section);
  const res = await fetch(url, {
    headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Error ${res.status} en section="${section}". Body: ${body.slice(0, 200)}`
    );
  }

  const xmlText = await res.text();
  const json = xmlToJson(xmlText);
  return { section, url, json };
}

function sanitizeKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeKeys);
  }

  if (obj !== null && typeof obj === "object") {
    const cleanObj: any = {};
    for (const key of Object.keys(obj)) {
      const cleanKey = key.replace(/[.$#[\]/]/g, "_");
      cleanObj[cleanKey] = sanitizeKeys(obj[key]);
    }
    return cleanObj;
  }

  return obj;
}


async function fetchAllSections() {
  const results = await Promise.all(SECTIONS.map(fetchSectionAsJson));
  return results; // [{section,url,json}, ...]
}

async function sendToFirebase(payload: any) {
  // 
  const endpoint = `${FIREBASE_BASE}/${FIREBASE_PATH}.json`;

  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.log(payload)
    throw new Error(
      `Firebase error ${res.status} (${res.statusText}). Body: ${body.slice(
        0,
        200
      )}`
    );
  }

  // Firebase devuelve algo tipo: { name: "-Nxxxx..." }
  return res.json();
}

// ✅ Variante opcional: guardar por fecha (sobrescribe ese día)
// PUT a .../eluniverso/2026-02-07.json
function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function sendToFirebaseByDate(payload: any) {
  const key = todayKey();
  const endpoint = `${FIREBASE_BASE}/${FIREBASE_PATH}/${key}.json`;

  const res = await fetch(endpoint, {
    method: "PUT", // PUT para escribir exactamente en esa fecha
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Firebase error ${res.status} (${res.statusText}). Body: ${body.slice(
        0,
        200
      )}`
    );
  }

  return res.json();
}

export default function App() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  const handleLoadAndSave = async () => {
    setLoading(true);
    setStatus("");

    try {
      // 1) obtener todas las respuestas (paralelo)
      const results = await fetchAllSections();
      setData(results);

      const cleanResults = sanitizeKeys(results);

      // 2) armar payload (incluye timestamp)
      const payload = {
        createdAt: new Date().toISOString(),
        source: "eluniverso",
        sections: cleanResults,
      };

      // 3) enviar a Firebase (elige UNA)
      // const fbResp = await sendToFirebase(payload); // POST con key automática
      const fbResp = await sendToFirebaseByDate(payload); // PUT por fecha

      setStatus(`Guardado en Firebase. Respuesta: ${JSON.stringify(fbResp)}`);
    } catch (e: any) {
      setStatus(`Error: ${e?.message ?? "desconocido"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1>RSS → JSON → Firebase</h1>

      <button onClick={handleLoadAndSave} disabled={loading}>
        {loading ? "Cargando y guardando..." : "Cargar y Guardar"}
      </button>

      {/* {status && (
        <p style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{status}</p>
      )} */}

      {/* render mínimo por sección */}
      <div style={{ marginTop: 12 }}>
        {data.map((entry) => (
          <div key={entry.section} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
             <b>{entry.section}</b> {/* — {entry?.json?.rss?.channel?.title ?? "(sin título)"} */}
          </div>
        ))}
      </div>
    </div>
  );
}
