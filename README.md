# Copiloto de reparto

App para repartidores: tramos a pie con aparcamiento sugerido, orden de carga, modo reparto,
notas por dirección, gasóleo más barato con ahorro real, control por voz y copia en la nube (Supabase).

**Abrir la app:** https://reyeduardo0.github.io/Copiloto-Reparto/

## Publicar con GitHub Pages
Settings → Pages → *Deploy from a branch* → rama `main`, carpeta `/ (root)` → Save.

## Base de datos (Supabase)
Ejecuta `supabase-tabla.sql` una vez en *SQL Editor* de tu proyecto.
En *Authentication → URL Configuration* pon como *Site URL*: `https://reyeduardo0.github.io/Copiloto-Reparto/`

La clave de Supabase que va en la app es la **publicable** (pensada para ir en webs).
Nunca subas aquí la clave secreta (`sb_secret_…`).

## Actualizar
Sustituye `index.html` por la versión nueva y haz commit. La app instalada se actualiza sola al abrirla con conexión.
