# slg-reconocimientos-2026

Página para que los directores de grupo de **Bachillerato** (I.E. San Luis Gonzaga) verifiquen las listas **Deportivo** y **Cultural**, confirmen su nombre como director(a) y elijan el estudiante de **Inspiración** de su grado. Funciona en celular.

- `index.html`, `assets/` → página (GitHub Pages)
- `apps-script/Code.gs` → API que lee/escribe la hoja de Google
- `tests/backend.test.js` → `node tests/backend.test.js` (18 pruebas del backend)
- Sin `APPS_SCRIPT_URL` (o con `?demo=1`) la página corre en **modo demo** con datos ficticios.

> **Privacidad:** este repositorio es público y NO contiene nombres de estudiantes. Los datos viven solo en la hoja de Google (con nombres, sin documentos). No subas aquí el libro base.

## Puesta en marcha (≈15 min)
1. **Hoja:** en Google Drive importa `SLG_Reconocimientos_BASE.xlsx` (Archivo → Importar → *Crear hoja de cálculo*). En *Archivo → Configuración* pon zona horaria **Bogotá**.
2. **Apps Script:** en la hoja, *Extensiones → Apps Script*. Pega `Code.gs`; en *Configuración del proyecto* activa “Mostrar appsscript.json” y pega el de este repo.
3. **Implementar → Nueva implementación → Aplicación web:** ejecutar como **Yo**, acceso **Cualquier persona**. Autoriza y copia la URL (`…/exec`).
4. Pega esa URL en `assets/config.js`.
5. Crea el repo `slg-reconocimientos-2026` en GitHub, sube estos archivos y activa *Settings → Pages → main / root*.
6. Abre la página, entra con la clave y prueba con un grupo (revisa que aparezcan filas en `Envios`).
7. Al cambiar `Code.gs` hay que *Implementar → Administrar implementaciones → editar → Nueva versión* (la URL no cambia).

## Configuración (hoja `Config`, sin tocar código)
| Clave | Qué hace |
|---|---|
| `clave_acceso` | Clave de docentes (2026) |
| `fecha_limite_listas` | `AAAA-MM-DD HH:MM` hora Colombia (inicial 2026-11-13 23:59). Para ampliar el plazo, solo cámbiala |
| `fecha_limite_votacion` | Cierre de la votación de Inspiración (inicial 2026-11-15 23:59) |
| `abierto` | `NO` cierra todo de inmediato |
| `cupo_*` | Cupos por grupo |

Tras el plazo la página queda en solo lectura.

## Revisar lo que envían los docentes
- `Listas`: lista vigente (columna *Autor* = quién guardó, *Actualizado* = cuándo). Académico lo editan coordinación directamente aquí.
- `Grupos`: *Estado* = Sin confirmar / Confirmado / Cambio solicitado.
- `Solicitudes`: quién dice ser director de qué grupo. Para aprobar, cambia el nombre en `Grupos` y marca *Aprobada*.
- `Votos`: un voto por grupo; el conteo se ve en la pestaña “Votación del grado”. Los directores deciden; el ganador es el más votado.
- `Envios`: bitácora de todo.

Reglas del servidor: ⭐ (estudiantes con evento destacado) no se pueden quitar; no pasar del cupo; sin repetidos; si un director cambia la propuesta de Inspiración, los votos a la anterior dejan de contar.

## Seguridad (honesta)
La clave es una barrera ligera, no un login: sirve para que los nombres no queden abiertos en internet, pero cualquiera con la clave puede escribir. Por eso todo queda con autor y bitácora. Cambia la clave después del evento.

## Mensaje para WhatsApp
> Buen día, colegas 🌟 Para los reconocimientos del 24 de noviembre necesitamos que cada director(a) de grupo de Bachillerato verifique sus listas (Deportivo y Cultural), confirme su nombre y, en el caso de Inspiración, que los directores de cada grado elijan un solo estudiante. Son 3 minutos desde el celular:
> 👉 https://TU-USUARIO.github.io/slg-reconocimientos-2026/
> Clave: *2026* · Plazo: *13 de noviembre*. Por favor no reenviar fuera del grupo docente. ¡Gracias! — Llerzy
