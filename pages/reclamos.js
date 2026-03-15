import { useState, useEffect } from "react";
import { useRouter } from "next/router";

const STATUS_COLORS = {
  pendiente: "#f59e0b",
  "en proceso": "#3b82f6",
  resuelto: "#10b981",
};

const DB = "https://reclamos-app-7ff44-default-rtdb.firebaseio.com";

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── FUNCIÓN DE EXPORTAR A EXCEL ───────────────────────────────────────────
function exportarExcel(reclamos, filtroActivo) {
  // Carga SheetJS dinámicamente si todavía no está
  const cargarYExportar = () => {
    const filas = reclamos.map(r => ({
      "Orden": r.orden || "",
      "Cliente": r.cliente || "",
      "Estado": r.estado || "",
      "Etiqueta": r.etiqueta ? "Generada" : "No generada",
      "Productos": r.productos || "",
      "Productos Faltantes": r.productosFaltantes || "",
      "Notas": r.notas || "",
      "Responsable": r.responsable || "",
      "Fecha Creación": formatDate(r.fechaCreacion),
      "Última Actualización": formatDate(r.fechaActualizacion),
    }));

    const XLSX = window.XLSX;
    const hoja = XLSX.utils.json_to_sheet(filas);

    // Ancho de columnas
    hoja["!cols"] = [
      { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
      { wch: 35 }, { wch: 25 }, { wch: 30 }, { wch: 15 },
      { wch: 20 }, { wch: 20 },
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Reclamos");

    const nombreArchivo = `reclamos_${filtroActivo}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(libro, nombreArchivo);
  };

  if (window.XLSX) {
    cargarYExportar();
  } else {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = cargarYExportar;
    document.head.appendChild(script);
  }
}
// ───────────────────────────────────────────────────────────────────────────

export default function Reclamos() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [view, setView] = useState("lista");
  const [reclamos, setReclamos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    orden: "", cliente: "", etiqueta: false,
    productos: "", productosFaltantes: "", notas: "", estado: "pendiente"
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const loggedIn = localStorage.getItem("loggedIn");
      if (!loggedIn) { router.push("/"); return; }
      setUsername(localStorage.getItem("username") || "");
    }
    fetchReclamos();
  }, []);

  async function fetchReclamos() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${DB}/reclamos.json`);
      if (!res.ok) throw new Error("Error al conectar con la base de datos");
      const data = await res.json();
      if (data && typeof data === "object") {
        const lista = Object.entries(data).map(([id, val]) => ({ ...val, fireId: id }));
        lista.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
        setReclamos(lista);
      } else {
        setReclamos([]);
      }
    } catch (e) {
      setError("No se pudo conectar: " + e.message);
    }
    setLoading(false);
  }

  async function handleSubmit() {
    if (!form.orden.trim()) return alert("Completá el número de orden.");
    if (!form.productos.trim()) return alert("Completá los productos.");
    setSaving(true);
    setError("");
    try {
      const nuevo = {
        orden: form.orden.trim(),
        cliente: form.cliente.trim(),
        etiqueta: form.etiqueta,
        productos: form.productos.trim(),
        productosFaltantes: form.productosFaltantes.trim(),
        notas: form.notas.trim(),
        estado: form.estado,
        responsable: username,
        fechaCreacion: new Date().toISOString(),
      };
      const res = await fetch(`${DB}/reclamos.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevo),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      const data = await res.json();
      if (!data || !data.name) throw new Error("Respuesta inválida de Firebase");
      setSaved(true);
      setTimeout(async () => {
        setSaved(false);
        setForm({ orden: "", cliente: "", etiqueta: false, productos: "", productosFaltantes: "", notas: "", estado: "pendiente" });
        await fetchReclamos();
        setView("lista");
      }, 1200);
    } catch (e) {
      setError("Error al guardar: " + e.message);
    }
    setSaving(false);
  }

  async function updateEstado(fireId, estado) {
    try {
      await fetch(`${DB}/reclamos/${fireId}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, fechaActualizacion: new Date().toISOString() }),
      });
      const updated = reclamos.map(r => r.fireId === fireId ? { ...r, estado } : r);
      setReclamos(updated);
      setSelected(prev => ({ ...prev, estado }));
    } catch (e) {
      alert("Error al actualizar estado");
    }
  }

  async function deleteReclamo(fireId) {
    if (!confirm("¿Eliminar este reclamo?")) return;
    try {
      await fetch(`${DB}/reclamos/${fireId}.json`, { method: "DELETE" });
      setReclamos(reclamos.filter(r => r.fireId !== fireId));
      setView("lista");
      setSelected(null);
    } catch (e) {
      alert("Error al eliminar");
    }
  }

  function logout() {
    localStorage.clear();
    router.push("/");
  }

  const filtered = filter === "todos" ? reclamos : reclamos.filter(r => r.estado === filter);
  const counts = {
    pendiente: reclamos.filter(r => r.estado === "pendiente").length,
    "en proceso": reclamos.filter(r => r.estado === "en proceso").length,
    resuelto: reclamos.filter(r => r.estado === "resuelto").length,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, textarea, select { font-family: inherit; }
        .btn { cursor: pointer; border: none; border-radius: 8px; font-family: inherit; font-weight: 600; transition: all 0.18s; }
        .btn-primary { background: #3b82f6; color: white; padding: 10px 22px; font-size: 14px; }
        .btn-primary:hover { background: #2563eb; }
        .btn-primary:disabled { background: #1e3a5f; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: #94a3b8; padding: 8px 16px; font-size: 13px; border: 1px solid #2d3748; }
        .btn-ghost:hover { border-color: #3b82f6; color: #3b82f6; }
        .btn-danger { background: #ef4444; color: white; padding: 8px 16px; font-size: 13px; border: none; border-radius: 8px; cursor: pointer; font-family: inherit; font-weight: 600; }
        .btn-excel { background: #166534; color: #bbf7d0; padding: 8px 16px; font-size: 13px; border: 1px solid #15803d; border-radius: 8px; cursor: pointer; font-family: inherit; font-weight: 600; transition: all 0.18s; }
        .btn-excel:hover { background: #15803d; color: white; }
        .field { margin-bottom: 18px; }
        .field label { display: block; font-size: 12px; font-weight: 600; color: #94a3b8; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 7px; }
        .field input, .field textarea, .field select { width: 100%; background: #13161f; border: 1.5px solid #2d3748; border-radius: 8px; padding: 10px 14px; color: #e2e8f0; font-size: 14px; outline: none; }
        .field input:focus, .field textarea:focus, .field select:focus { border-color: #3b82f6; }
        .field textarea { resize: vertical; min-height: 80px; }
        .card { background: #1a1d27; border: 1px solid #2d3748; border-radius: 12px; padding: 18px; cursor: pointer; transition: all 0.18s; margin-bottom: 10px; }
        .card:hover { border-color: #3b82f6; background: #1e2235; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .toggle { width: 44px; height: 24px; background: #2d3748; border-radius: 12px; cursor: pointer; position: relative; transition: background 0.2s; border: none; flex-shrink: 0; }
        .toggle.on { background: #3b82f6; }
        .toggle::after { content: ''; position: absolute; width: 18px; height: 18px; background: white; border-radius: 50%; top: 3px; left: 3px; transition: left 0.2s; }
        .toggle.on::after { left: 23px; }
        .err { background: #2d1a1a; border: 1px solid #7f1d1d; color: #f87171; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
      `}</style>

      <div style={{ background: "#13161f", borderBottom: "1px solid #2d3748", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: "#3b82f6", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
          <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 15 }}>Reclamos</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>👤 {username}</span>
          <button className="btn btn-ghost" onClick={() => { setView("lista"); fetchReclamos(); }}>Lista</button>
          <button className="btn btn-primary" onClick={() => setView("nuevo")}>+ Nuevo</button>
          <button className="btn btn-ghost" onClick={logout}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px" }}>
        {error && <div className="err">⚠ {error}</div>}

        {view === "lista" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
              {[["Pendientes", "pendiente", "#f59e0b"], ["En Proceso", "en proceso", "#3b82f6"], ["Resueltos", "resuelto", "#10b981"]].map(([label, key, color]) => (
                <div key={key} onClick={() => setFilter(filter === key ? "todos" : key)}
                  style={{ background: "#1a1d27", border: `1px solid ${filter === key ? color : "#2d3748"}`, borderRadius: 12, padding: "16px 20px", textAlign: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "'Space Mono', monospace" }}>{counts[key]}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
              <span style={{ color: "#64748b", fontSize: 13 }}>{filtered.length} reclamo{filtered.length !== 1 ? "s" : ""}{filter !== "todos" ? ` · ${filter}` : ""}</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {filter !== "todos" && <button className="btn btn-ghost" onClick={() => setFilter("todos")}>Ver todos</button>}
                <button className="btn btn-ghost" onClick={fetchReclamos}>↻ Actualizar</button>
                {/* ─── BOTÓN EXPORTAR EXCEL ─── */}
                <button
                  className="btn-excel"
                  onClick={() => exportarExcel(filtered, filter)}
                  disabled={filtered.length === 0}
                  title={`Exportar ${filtered.length} reclamo(s) a Excel`}
                >
                  ⬇ Exportar Excel {filter !== "todos" ? `(${filter})` : ""}
                </button>
              </div>
            </div>
            {loading ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: 40 }}>Cargando...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: 60, background: "#1a1d27", borderRadius: 12, border: "1px dashed #2d3748" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ fontWeight: 600 }}>No hay reclamos</div>
              </div>
            ) : (
              filtered.map(r => (
                <div key={r.fireId} className="card" onClick={() => { setSelected(r); setView("detalle"); }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: "#3b82f6", fontSize: 15 }}>#{r.orden}</span>
                        {r.cliente && <span style={{ color: "#94a3b8", fontSize: 13 }}>{r.cliente}</span>}
                        <span className="badge" style={{ background: STATUS_COLORS[r.estado] + "22", color: STATUS_COLORS[r.estado], border: `1px solid ${STATUS_COLORS[r.estado]}44` }}>{r.estado}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 4 }}><strong style={{ color: "#94a3b8" }}>Productos:</strong> {r.productos}</div>
                      {r.productosFaltantes && <div style={{ fontSize: 12, color: "#f87171" }}>⚠ Faltan: {r.productosFaltantes}</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                      <div style={{ fontSize: 11, color: "#475569" }}>{formatDate(r.fechaCreacion)}</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: r.etiqueta ? "#10b981" : "#ef4444", fontWeight: 600 }}>{r.etiqueta ? "✓ Etiqueta" : "✗ Sin etiqueta"}</div>
                      {r.responsable && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>👤 {r.responsable}</div>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {view === "nuevo" && (
          <div style={{ background: "#1a1d27", border: "1px solid #2d3748", borderRadius: 16, padding: 28 }}>
            <h2 style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, marginBottom: 24 }}>Nuevo Reclamo</h2>
            {saved ? (
              <div style={{ background: "#10b981", color: "white", borderRadius: 10, padding: "14px 20px", textAlign: "center", fontWeight: 600, fontSize: 16 }}>✓ Reclamo guardado correctamente</div>
            ) : (
              <>
                {error && <div className="err">⚠ {error}</div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="field"><label>Número de Orden *</label><input placeholder="Ej: 12345" value={form.orden} onChange={e => setForm({ ...form, orden: e.target.value })} /></div>
                  <div className="field"><label>Cliente</label><input placeholder="Nombre del cliente" value={form.cliente} onChange={e => setForm({ ...form, cliente: e.target.value })} /></div>
                </div>
                <div className="field"><label>Productos *</label><textarea placeholder="Listá los productos del pedido..." value={form.productos} onChange={e => setForm({ ...form, productos: e.target.value })} /></div>
                <div className="field"><label>Productos Faltantes</label><textarea placeholder="¿Qué productos faltan?" value={form.productosFaltantes} onChange={e => setForm({ ...form, productosFaltantes: e.target.value })} style={{ minHeight: 60 }} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div className="field">
                    <label>Etiqueta de Envío</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                      <button className={`toggle ${form.etiqueta ? "on" : ""}`} onClick={() => setForm({ ...form, etiqueta: !form.etiqueta })} />
                      <span style={{ fontSize: 14, color: form.etiqueta ? "#10b981" : "#94a3b8", fontWeight: 500 }}>{form.etiqueta ? "Generada ✓" : "No generada"}</span>
                    </div>
                  </div>
                  <div className="field"><label>Estado</label>
                    <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                      <option value="pendiente">Pendiente</option>
                      <option value="en proceso">En Proceso</option>
                      <option value="resuelto">Resuelto</option>
                    </select>
                  </div>
                </div>
                <div className="field"><label>Notas</label><textarea placeholder="Observaciones..." value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} style={{ minHeight: 60 }} /></div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button className="btn btn-ghost" onClick={() => setView("lista")}>Cancelar</button>
                  <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? "Guardando..." : "Guardar Reclamo"}</button>
                </div>
              </>
            )}
          </div>
        )}

        {view === "detalle" && selected && (
          <div style={{ background: "#1a1d27", border: "1px solid #2d3748", borderRadius: 16, padding: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: "#3b82f6" }}>Orden #{selected.orden}</span>
                {selected.cliente && <span style={{ marginLeft: 12, color: "#94a3b8" }}>{selected.cliente}</span>}
              </div>
              <button className="btn btn-ghost" onClick={() => setView("lista")}>← Volver</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <div><div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Creado</div><div style={{ fontSize: 14 }}>{formatDate(selected.fechaCreacion)}</div></div>
              {selected.responsable && <div><div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Responsable</div><div style={{ fontSize: 14 }}>👤 {selected.responsable}</div></div>}
              <div><div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Etiqueta</div><div style={{ fontSize: 14, color: selected.etiqueta ? "#10b981" : "#ef4444", fontWeight: 600 }}>{selected.etiqueta ? "✓ Generada" : "✗ No generada"}</div></div>
              <div><div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Estado</div><span className="badge" style={{ background: STATUS_COLORS[selected.estado] + "22", color: STATUS_COLORS[selected.estado], border: `1px solid ${STATUS_COLORS[selected.estado]}44` }}>{selected.estado}</span></div>
            </div>
            <div style={{ background: "#13161f", borderRadius: 10, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Productos</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selected.productos}</div>
            </div>
            {selected.productosFaltantes && (
              <div style={{ background: "#2d1a1a", border: "1px solid #7f1d1d", borderRadius: 10, padding: 16, marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>⚠ Productos Faltantes</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "#fca5a5" }}>{selected.productosFaltantes}</div>
              </div>
            )}
            {selected.notas && (
              <div style={{ background: "#13161f", borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Notas</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selected.notas}</div>
              </div>
            )}
            <div style={{ borderTop: "1px solid #2d3748", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>Cambiar estado:</span>
                {["pendiente", "en proceso", "resuelto"].map(s => (
                  <button key={s} onClick={() => updateEstado(selected.fireId, s)}
                    style={{ background: selected.estado === s ? STATUS_COLORS[s] : "transparent", color: selected.estado === s ? "white" : STATUS_COLORS[s], border: `1.5px solid ${STATUS_COLORS[s]}`, padding: "6px 14px", fontSize: 12, borderRadius: 8, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>{s}</button>
                ))}
              </div>
              <button className="btn-danger" onClick={() => deleteReclamo(selected.fireId)}>🗑 Eliminar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
