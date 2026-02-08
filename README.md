# Nuestra carretera

Mini-juego web romántico: conduce por una carretera infinita que cuenta vuestra historia. Hecho con HTML5 Canvas, CSS y JavaScript puro.

## Cómo jugar

- **Espacio**: acelerar
- **W** o **↑**: subir en la carretera
- **S** o **↓**: bajar en la carretera
- Recoge los corazones ♥ para ver fotos aleatorias.
- Llega a los hitos de distancia para leer los eventos de la historia.

## Publicar en GitHub Pages

### Opción 1: Desde la rama (recomendado)

1. **Sube el proyecto a GitHub** (si aún no está):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TU_USUARIO/nuestra-carretera-2026.git
   git push -u origin main
   ```

2. **Activa GitHub Pages** en el repositorio:
   - Ve a **Settings** → **Pages** (menú izquierdo).
   - En **Source** elige **Deploy from a branch**.
   - En **Branch** selecciona `main` (o `master`) y carpeta **/ (root)**.
   - Guarda (**Save**).

3. En unos minutos la web estará en:
   `https://TU_USUARIO.github.io/nuestra-carretera-2026/`

### Opción 2: Carpeta `docs`

Si prefieres que la web se sirva desde la carpeta `docs`:

1. Crea una carpeta `docs` y copia dentro: `index.html`, `styles.css`, `game.js`, `story.json`, y la carpeta `assets`.
2. En **Settings** → **Pages** → **Source** elige la rama y la carpeta **/docs**.
3. La URL será la misma: `https://TU_USUARIO.github.io/nuestra-carretera-2026/`

### Notas

- El archivo `.nojekyll` en la raíz evita que GitHub trate el sitio con Jekyll (recomendado para proyectos solo HTML/JS).
- Las rutas de las imágenes y el `story.json` son relativas; en GitHub Pages funcionan igual.
- Para probar en local antes de subir: `python3 -m http.server 8080` y abre `http://localhost:8080`.
