# Prototipo navegable de CompuLab

Prototipo de alta fidelidad de la navegación por rol y de las tres pantallas del núcleo ejecutable, según `docs/15-diseno-ux-ui.md`. Es HTML, CSS y JavaScript sin dependencias ni compilación; los datos son ficticios y "hoy" está fijo en el martes 24 de noviembre de 2026 a las 10:00.

## Cómo abrirlo

Desde esta carpeta (`docs/prototipo`), con cualquier servidor estático:

```bash
python -m http.server 5180
```

Luego abrir `http://localhost:5180`. También funciona abriendo `index.html` directamente en Chrome o Edge. Las fuentes se cargan de Google Fonts, así que necesita conexión.

## Qué se puede recorrer

| Entrar como | Pantallas | Ruta |
| --- | --- | --- |
| Estudiante (Ana) | Elegir sede, ver laboratorios del día, **reservar una máquina** (CU-11), mis reservas | `#/reservar` |
| Asistente (Diego) | Mi turno con el botón de marcar salida; también reserva como estudiante | `#/mi-turno` |
| Coordinación de laboratorio (Laura) | Pendientes, **horario semanal y asignación de turnos** (CU-06) | `#/laboratorios/c1/horario` |
| Coordinación de soporte (Marco) | Panel, laboratorios por sede, **cierre mensual** con descarga del CSV para Becas (CU-14) | `#/cierres` |

Pantallas fuera del núcleo muestran un estado vacío que explica qué contendrán. Si un rol escribe una ruta que no le corresponde, llega a `#/sin-permiso`.

El control **Prototipo** (esquina inferior derecha) simula la respuesta del servidor:
- **Normal:** la operación se confirma.
- **Conflicto:** otra persona se adelantó (`MAQUINA_NO_DISPONIBLE` o `FRANJA_OCUPADA_EN_LABORATORIO`).
- **Sin respuesta:** la respuesta se pierde y se reintenta con la misma clave de solicitud (ADR-0010).

Para volver al selector de rol: menú de usuario › Cerrar sesión.

## Sistema de diseño

| Token | Valor | Uso |
| --- | --- | --- |
| Tinta | `#1E2B37` | Texto, menú lateral |
| Papel | `#F2F4F5` | Fondo |
| Linóleo | `#23675A` | Acciones, turnos asignados, horario de apertura |
| Cinta | `#F3D36B` | Etiquetas de máquinas, estados pendientes |
| Alerta | `#B3261E` | Errores, máquinas fuera de servicio |
| Línea | `#CBD3D9` | Bordes |

Tipografía: **Barlow Condensed** para rótulos y horarios (como la rotulación de puertas y horarios impresos) y **Atkinson Hyperlegible** para el texto (diseñada para máxima legibilidad). El elemento distintivo es el plano del laboratorio con etiquetas de cinta en cada máquina.

## Exportarlo a Figma

Figma no importa HTML por sí solo; se usa el plugin **html.to.design** (de terceros, con plan gratuito limitado), que convierte una página web en capas editables de Figma.

1. Abrir el prototipo en Chrome con el servidor local.
2. Instalar la extensión de Chrome de html.to.design y, en Figma, el plugin html.to.design.
3. Para cada pantalla que se quiera llevar a Figma:
   - Entrar con el rol correspondiente y dejar la pantalla en el estado deseado (por ejemplo, la hoja de confirmación abierta o el panel de asignar turno con un asistente elegido).
   - Para vistas móviles, activar en Chrome el modo dispositivo (F12 › Toggle device toolbar) con un ancho de 390 px; para escritorio, una ventana de 1440 px.
   - Capturar la página con la extensión y abrir la captura con el plugin en Figma.
4. En Figma, ordenar los marcos por rol y unirlos con las conexiones de *Prototype* para reproducir el flujo de `15-diseno-ux-ui.md`.

La importación trae la estructura visual y los textos, no la interacción: los enlaces entre pantallas se rehacen en el modo Prototype de Figma. La importación por URL del plugin solo funciona con páginas publicadas en internet, por eso para este prototipo local se usa la extensión.

### Capturas sugeridas (núcleo)

| Rol | Estado | Ancho |
| --- | --- | --- |
| Estudiante | Elegir sede | 390 |
| Estudiante | Laboratorios del día | 390 |
| Estudiante | Laboratorio con hora, duración y máquina elegidas | 390 |
| Estudiante | Hoja de confirmación | 390 |
| Estudiante | Reserva confirmada | 390 |
| Estudiante | Error por conflicto | 390 |
| Coord. laboratorio | Horario semanal | 1440 |
| Coord. laboratorio | Panel de asignar turno con advertencias | 1440 |
| Coord. soporte | Lista de meses | 1440 |
| Coord. soporte | Confirmación de cierre | 1440 |
| Coord. soporte | Resultado del cierre | 1440 |
