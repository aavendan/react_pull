import { useState } from 'react'
import { XMLParser } from "fast-xml-parser";
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

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

// Convierte XML string a JSON (objeto JS)
function xmlToJson(xmlText: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,      // conserva atributos
    attributeNamePrefix: "@_",    // prefijo para atributos
    parseTagValue: true,
    trimValues: true,
  });

  return parser.parse(xmlText);
}

// Construye URL segura con section (encodéala para evitar problemas)
function buildUrl(section: string) {
  return BASE_URL.replace("{section}", encodeURIComponent(section));
}

// Fetch XML de una sección y lo convierte a JSON
async function fetchSectionAsJson(section: string) {
  const url = buildUrl(section);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!res.ok) {
    // Lanza error con detalle por sección
    const text = await res.text().catch(() => "");
    throw new Error(
      `Error ${res.status} (${res.statusText}) en section="${section}". Body: ${text.slice(
        0,
        200
      )}`
    );
  }

  const xmlText = await res.text();
  const json = xmlToJson(xmlText);

  // Opcional: agrega metadatos de la sección
  return { section, url, json };
}

// Hace todos los requests en paralelo y retorna arreglo con los JSON
async function fetchAllSections() {
  const promises = SECTIONS.map((section) => fetchSectionAsJson(section));
  // Promise.all = paralelo; si una falla, falla todo
  const results = await Promise.all(promises);
  return results; // [{section, url, json}, ...]
}

function App() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);

    try {
      const results = await fetchAllSections();
      setData(results);
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1>El Universo RSS → JSON</h1>

      <button onClick={handleLoad} disabled={loading}>
        {loading ? "Cargando..." : "Cargar"}
      </button>

      {error && (
        <p style={{ marginTop: 12, color: "crimson" }}>
          <b>Error:</b> {error}
        </p>
      )}

      <pre style={{ marginTop: 12, background: "#f5f5f5", padding: 12 }}>
        {/* {JSON.stringify(data, null, 2)} */}
        {/* Render por sección */}
        <div style={{ marginTop: 12 }}>
          {data.length === 0 ? (
            <p>No hay datos todavía. Presiona “Cargar”.</p>
          ) : (
            data.map((entry) => {
              const channel = entry?.json?.rss?.channel;
              const title = channel?.title ?? "(sin título)";
              const link = channel?.link ?? entry.url;

              return (
                <div
                  key={entry.section}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    <b>section:</b> 
                  </div>

                  <div style={{ fontSize: 18, marginTop: 6 }}>
                    <b>{entry.section}</b>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </pre>
    </div>
  );

}

export default App
