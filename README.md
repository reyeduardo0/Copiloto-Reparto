# Copiloto de reparto

App para repartidores: grupos a pie con aparcamiento sugerido, orden de carga, modo reparto,
ruta que queda con tiempo estimado, notas por dirección, gasóleo más barato con ahorro real,
control por voz, asistente con IA y copia en la nube (Supabase).

**Abrir la app:** https://reyeduardo0.github.io/Copiloto-Reparto/

## Archivos
| Archivo | Qué es |
|---|---|
| `index.html` | La app completa (HTML, CSS y JavaScript en un solo archivo) |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Para instalarla y abrirla sin cobertura |
| `supabase-tabla.sql` | Tabla de la copia en la nube (`copiloto_datos`) |
| `supabase-ia.sql` | Contador diario de consultas a la IA (`copiloto_ia_uso`, `copiloto_ia_contar`) |
| `supabase/functions/copiloto-ia/` | Función del servidor que habla con Claude |

## Publicar con GitHub Pages
Settings → Pages → *Deploy from a branch* → rama `main`, carpeta `/ (root)` → Save.

## Montar Supabase desde cero
1. **SQL Editor:** ejecuta `supabase-tabla.sql` y después `supabase-ia.sql`.
2. **Authentication → URL Configuration:** en *Site URL* pon `https://reyeduardo0.github.io/Copiloto-Reparto/`.
3. **Función de la IA:** en *Edge Functions → Deploy a new function → Via Editor*, nómbrala `copiloto-ia`
   y pega `supabase/functions/copiloto-ia/index.ts` (deja activado *Verify JWT*). Con la CLI:
   `supabase functions deploy copiloto-ia`.
4. **Edge Functions → Secrets:**
   - `ANTHROPIC_API_KEY` (obligatorio): clave de platform.claude.com.
   - `IA_CORREOS_PERMITIDOS` (opcional): correos que pueden usar la IA, separados por comas.
     Si no existe, solo puede usarla reyeduardo0@gmail.com.
   - `IA_LIMITE_DIARIO` (opcional, 300 por defecto) e `IA_MODELO` (opcional).
5. Crea tu cuenta desde la app y después desactiva los registros nuevos en
   *Authentication → Sign In / Providers → Allow new users to sign up*.

La clave de Supabase que va en la app es la **publicable** (pensada para ir en webs).
Nunca subas aquí la clave secreta (`sb_secret_…`) ni la de Anthropic.

## Actualizar
Cambia los archivos, haz commit y `git push`. La app instalada se actualiza sola al abrirla con conexión.
Si cambias la función, vuelve a desplegarla en Supabase.
