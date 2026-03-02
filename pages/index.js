import { useState } from "react";
import { useRouter } from "next/router";

const USERS = [
   { user: "agustin", pass: "Nadargentina" },
  { user: "nacho", pass: "NadNacho" },
];

export default function Login() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function handleLogin() {
    const found = USERS.find(u => u.user === user.trim().toLowerCase() && u.pass === pass.trim());
    if (found) {
      localStorage.setItem("loggedIn", "true");
      localStorage.setItem("username", user.trim().toLowerCase());
      router.push("/reclamos");
    } else {
      setError("Usuario o contraseña incorrectos.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Space+Mono:wght@700&display=swap');`}</style>
      <div style={{ background: "#1a1d27", border: "1px solid #2d3748", borderRadius: 16, padding: 40, width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <h1 style={{ fontFamily: "'Space Mono', monospace", color: "#e2e8f0", fontSize: 20, marginBottom: 6 }}>Reclamos</h1>
          <p style={{ color: "#64748b", fontSize: 13 }}>Ingresá con tu usuario</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>Usuario</label>
          <input value={user} onChange={e => setUser(e.target.value)} placeholder="tu usuario" style={{ width: "100%", background: "#13161f", border: "1.5px solid #2d3748", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>Contraseña</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleLogin()} style={{ width: "100%", background: "#13161f", border: "1.5px solid #2d3748", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        {error && <div style={{ background: "#2d1a1a", border: "1px solid #7f1d1d", color: "#f87171", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{error}</div>}
        <button onClick={handleLogin} style={{ width: "100%", background: "#3b82f6", color: "white", border: "none", borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Ingresar</button>
      </div>
    </div>
  );
}
