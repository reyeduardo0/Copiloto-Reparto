// Copiloto de reparto · función del servidor para la IA (Claude).
// La clave de Anthropic vive solo aquí, como secreto ANTHROPIC_API_KEY de Supabase.
// Solo responde a usuarios con sesión iniciada y con un límite diario de consultas.
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const LIMITE = Number(Deno.env.get("IA_LIMITE_DIARIO") ?? "300");
const MODELO = Deno.env.get("IA_MODELO") ?? "claude-haiku-4-5-20251001";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function clavePublicable(): string {
  try {
    const j = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    if (j.default) return j.default;
  } catch (_) { /* sin claves nuevas */ }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}
const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());

const SISTEMA_VOZ = `Eres el intérprete de voz de "Copiloto de reparto", una app para un repartidor de paquetería en España.
Recibes una frase dicha por el repartidor (transcrita por el móvil, puede tener errores) y un resumen del estado del día.
Tu trabajo: convertir la frase en llamadas a las herramientas disponibles. Puedes llamar a varias si pide varias cosas a la vez.
Reglas:
- Usa solo las herramientas. Nunca inventes datos que el repartidor no haya dicho (direcciones, números, precios).
- Números de parada: solo si los dice. Si no, déjalos vacíos.
- Direcciones: escríbelas limpias y con mayúscula inicial (por ejemplo "Calle Mayor 12"), sin palabras de relleno.
- Si pregunta algo sobre su día (qué le queda, dónde aparcar, gasto…), usa la herramienta "consultar": la app responde con sus datos reales.
- Si pregunta por la ruta o el recorrido que le queda, cuánto tiempo le falta o a qué hora terminará, usa "ruta_restante" (con final "base" o "casa" si lo menciona).
- Si dice que no ha podido entregar (no hay nadie, no le abren, dirección mal, lo rechazan), usa "no_entregada" con el motivo; si dice que volverá luego, con mas_tarde true.
- Si la frase no tiene que ver con el reparto o no es clara, no llames a ninguna herramienta y responde con UNA pregunta corta en español para aclararlo.
- Si solo saluda o da las gracias, responde con una frase breve y amable.
- Respuestas de texto: máximo 20 palabras, en español de España, sin emojis. Va conduciendo.
- Nunca menciones ni repitas nombres de personas.`;

const HERRAMIENTAS = [
  { name: "anadir_parada", description: "Añade una parada (entrega) a la ruta del día.",
    input_schema: { type: "object", properties: {
      numero: { type: "integer", description: "Número de parada en la secuencia, solo si lo dice" },
      direccion: { type: "string", description: "Dirección limpia, p. ej. 'Calle Mayor 12'" },
      bultos: { type: "integer", description: "Número de bultos o paquetes, si lo dice" },
      voluminoso: { type: "boolean", description: "Si dice que es grande o voluminoso" } }, required: ["direccion"] } },
  { name: "marcar_entregada", description: "Marca una parada como entregada. Sin número = la parada actual.",
    input_schema: { type: "object", properties: { numero: { type: "integer" } } } },
  { name: "no_entregada", description: "La entrega no se ha podido hacer (ausente, sin acceso, dirección incorrecta, rechazado...) o la deja para reintentar más tarde. Sin número = la parada actual.",
    input_schema: { type: "object", properties: {
      numero: { type: "integer", description: "Número de parada, solo si lo dice" },
      motivo: { type: "string", enum: ["ausente", "acceso", "direccion", "rechazado", "otro"] },
      mas_tarde: { type: "boolean", description: "true si quiere reintentarla más tarde en vez de darla por no entregada" } } } },
  { name: "quitar_parada", description: "Quita una parada de la ruta.",
    input_schema: { type: "object", properties: { numero: { type: "integer" } }, required: ["numero"] } },
  { name: "anotar_nota", description: "Guarda una nota para una dirección (código de portal, conserjería, horario, perro...). Sin número = la parada actual.",
    input_schema: { type: "object", properties: { numero: { type: "integer" }, texto: { type: "string" } }, required: ["texto"] } },
  { name: "anotar_repostaje", description: "Apunta un repostaje de gasóleo.",
    input_schema: { type: "object", properties: {
      litros: { type: "number" }, precio: { type: "number", description: "Euros por litro, p. ej. 1.439" },
      kilometros: { type: "integer", description: "Kilómetros del cuentakilómetros, si los dice" },
      lleno: { type: "boolean", description: "false solo si dice que no ha llenado el depósito" } }, required: ["litros"] } },
  { name: "guardar_aparcamiento", description: "Guarda la posición actual como buen sitio para aparcar.",
    input_schema: { type: "object", properties: { nombre: { type: "string" } } } },
  { name: "he_aparcado", description: "El repartidor ha llegado y aparcado en el grupo actual.", input_schema: { type: "object", properties: {} } },
  { name: "grupo_terminado", description: "Ha terminado todas las entregas del grupo actual.", input_schema: { type: "object", properties: {} } },
  { name: "fijar_ubicacion", description: "Está en la puerta de la parada: guardar su ubicación exacta.", input_schema: { type: "object", properties: { numero: { type: "integer" } } } },
  { name: "calcular_grupos", description: "Organiza las paradas en grupos para aparcar y repartir a pie.", input_schema: { type: "object", properties: {} } },
  { name: "consultar", description: "Pregunta sobre su día. La app responde con datos reales.",
    input_schema: { type: "object", properties: { que: { type: "string", enum: [
      "siguiente", "cuantas_quedan", "lista_paradas", "que_paquetes_coger", "resumen_dia",
      "gasto_gasoil_mes", "consumo", "gasolinera_barata", "notas_parada", "devoluciones"] },
      numero: { type: "integer" } }, required: ["que"] } },
  { name: "navegar", description: "Abre la navegación.",
    input_schema: { type: "object", properties: {
      destino: { type: "string", enum: ["aparcamiento", "gasolinera", "base", "casa"] },
      app: { type: "string", enum: ["google", "waze"] } }, required: ["destino"] } },
  { name: "ruta_restante", description: "Muestra en el mapa el recorrido que le queda por entregar y cuánto tiempo tardará. Opcionalmente, terminando en la base (Amazon) o en casa.",
    input_schema: { type: "object", properties: {
      final: { type: "string", enum: ["base", "casa", "ninguno"], description: "Dónde quiere terminar, solo si lo dice" } } } },
  { name: "mapa", description: "Cambia el mapa o muestra el tráfico o el portal.",
    input_schema: { type: "object", properties: { vista: { type: "string", enum: [
      "mapa", "satelite", "hibrido", "trafico_on", "trafico_off", "portal"] }, numero: { type: "integer" } }, required: ["vista"] } },
  { name: "abrir_pestana", description: "Abre una pantalla de la app.",
    input_schema: { type: "object", properties: { pestana: { type: "string", enum: [
      "ruta", "carga", "reparto", "gasoleo", "cuentas", "lugares", "ajustes"] } }, required: ["pestana"] } },
  { name: "deshacer", description: "Deshace la última acción.", input_schema: { type: "object", properties: {} } },
];

const SISTEMA_ETIQUETA = `Lees etiquetas de envío de paquetería (Amazon y similares) fotografiadas por un repartidor en España.
Extrae solo la dirección de entrega. Nunca devuelvas nombres de personas ni teléfonos.
Si hay un número de parada o de secuencia de ruta impreso y claramente identificable, devuélvelo; si dudas, no lo pongas.
Si la imagen no es una etiqueta o no se lee la dirección, devuelve confianza "baja" y dirección vacía.`;
const HERRAMIENTA_ETIQUETA = {
  name: "etiqueta", description: "Datos de la etiqueta",
  input_schema: { type: "object", properties: {
    direccion: { type: "string", description: "Calle y número, con piso/puerta si aparece. Ej.: 'Calle Mayor 12, 3º B'" },
    codigo_postal: { type: "string" }, localidad: { type: "string" },
    numero_parada: { type: "integer" },
    confianza: { type: "string", enum: ["alta", "media", "baja"] } }, required: ["direccion", "confianza"] },
};

async function claude(key: string, payload: Record<string, unknown>) {
  const r = await fetch((Deno.env.get("ANTHROPIC_BASE_URL") ?? "https://api.anthropic.com") + "/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELO, max_tokens: 700, ...payload }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j?.error?.message ?? `HTTP ${r.status}`) as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "metodo" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, clavePublicable(), {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data: u, error: ue } = await sb.auth.getUser(token);
  if (ue || !u?.user) return json({ error: "sin_sesion" }, 401);
  // Solo las cuentas de la lista pueden usar la IA (y gastar saldo de Anthropic).
  // Secreto IA_CORREOS_PERMITIDOS: correos separados por comas. Si falta, solo la cuenta del dueño.
  const permitidos = (Deno.env.get("IA_CORREOS_PERMITIDOS") || "reyeduardo0@gmail.com")
    .split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
  if (!permitidos.includes((u.user.email ?? "").toLowerCase())) return json({ error: "no_permitido" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch (_) { return json({ error: "formato" }, 400); }
  const modo = body.modo;
  const key = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

  if (modo === "ping") {
    const { data } = await sb.from("copiloto_ia_uso").select("llamadas").eq("dia", hoy()).maybeSingle();
    return json({ ok: true, clave: !!key, usadas: data?.llamadas ?? 0, limite: LIMITE, modelo: MODELO });
  }
  if (modo !== "voz" && modo !== "etiqueta") return json({ error: "modo" }, 400);
  if (!key) return json({ error: "sin_clave" }, 503);

  // validar entrada antes de gastar una consulta
  let payload: Record<string, unknown>;
  if (modo === "voz") {
    const texto = String(body.texto ?? "").slice(0, 500).trim();
    if (!texto) return json({ error: "vacio" }, 400);
    const ctx = JSON.stringify(body.contexto ?? {}).slice(0, 1500);
    payload = {
      system: SISTEMA_VOZ, tools: HERRAMIENTAS, tool_choice: { type: "auto" },
      messages: [{ role: "user", content: `Estado del día: ${ctx}\n\nFrase del repartidor: «${texto}»` }],
    };
  } else {
    const img = String(body.imagen ?? "");
    const tipo = String(body.tipo ?? "image/jpeg");
    if (!/^image\/(jpeg|png|webp)$/.test(tipo) || img.length < 100 || img.length > 3_000_000) return json({ error: "imagen" }, 400);
    payload = {
      system: SISTEMA_ETIQUETA, tools: [HERRAMIENTA_ETIQUETA], tool_choice: { type: "tool", name: "etiqueta" },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: tipo, data: img } },
        { type: "text", text: "Extrae la dirección de entrega de esta etiqueta." }] }],
    };
  }

  const { data: n, error: ce } = await sb.rpc("copiloto_ia_contar");
  if (ce) return json({ error: "contador" }, 500);
  if (typeof n === "number" && n > LIMITE) return json({ error: "limite", usadas: n, limite: LIMITE }, 429);

  try {
    const r = await claude(key, payload);
    const bloques = Array.isArray(r.content) ? r.content : [];
    const acciones = bloques.filter((b: { type: string }) => b.type === "tool_use")
      .map((b: { name: string; input: unknown }) => ({ nombre: b.name, args: b.input ?? {} }));
    const texto = bloques.filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join(" ").trim().slice(0, 300);
    return json({ acciones, texto, usadas: n, limite: LIMITE });
  } catch (e) {
    const st = (e as { status?: number }).status ?? 0;
    if (st === 401 || st === 403) return json({ error: "clave_invalida" }, 502);
    if (st === 429 || st === 529) return json({ error: "ocupado" }, 503);
    if (st === 400 && /credit|balance/i.test(String((e as Error).message))) return json({ error: "sin_saldo" }, 402);
    return json({ error: "ia" }, 502);
  }
});
