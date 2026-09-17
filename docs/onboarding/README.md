# Kit de onboarding — preparar el contenido del bot

Esta guía es para el negocio que va a usar el bot de WhatsApp. Te dice **qué
información cargar** y **cómo cargarla** para que el bot responda bien.

## Lo primero: el bot NO se "entrena" con inteligencia artificial

No hay un botón de "entrenar" ni un proceso que tarde horas. El bot ya viene con
el modelo de lenguaje incorporado. Lo que vos hacés es **darle la información de
tu negocio** y **probar** que responda como querés. Eso es todo.

Su comportamiento sale de dos lugares:

1. **Base de conocimiento** — lo que el bot SABE. Tus precios, horarios,
   políticas, preguntas frecuentes. El bot busca acá la respuesta a cada
   consulta.
2. **Flujos** — lo que el bot HACE paso a paso (saludo, menú, derivar a una
   persona). Se arman en la pestaña *Flujos* del panel.

Este kit cubre la **base de conocimiento**, que es de donde sale el 90% de las
respuestas.

## El ciclo de trabajo (es un loop, no se hace una sola vez)

```
1. Llenás el cuestionario  →  2. Lo volcás a la plantilla FAQ
        ↑                                    │
        │                                    ▼
4. Ajustás lo que falló  ←  3. Lo subís y lo probás en el panel
```

Paso a paso:

1. **Completá** [`01-cuestionario-negocio.md`](01-cuestionario-negocio.md) —
   es el "estudio" de tu negocio. No se sube al bot; es tu hoja de trabajo.
2. **Volcá** las respuestas a [`02-plantilla-faq.example.json`](02-plantilla-faq.example.json)
   (preguntas y respuestas) y, si tenés textos largos como políticas o
   descripciones, a [`03-plantilla-conocimiento.md`](03-plantilla-conocimiento.md).
3. **Subí** el archivo en el panel → **Base de conocimiento** → subir documento.
   Esperá a que el estado pase de `pending` a `indexed`.
4. **Probá** en el panel → **Ajustes → Probar bot**. Escribí preguntas como las
   haría un cliente real. ¿Respondió mal o dijo que no sabe algo que sí cargaste?
   Volvé al paso 2, mejorá ese contenido, y volvé a subir.

Repetí hasta que el bot conteste bien las consultas más comunes. Empezá con
20–30 preguntas; se amplía con el tiempo según lo que pregunten los clientes.

## Formatos que acepta el panel

| Formato | Para qué sirve | Archivo |
|---|---|---|
| **FAQ (JSON)** | Preguntas y respuestas. **El más recomendado.** | `.json` |
| **Markdown** | Textos en prosa: descripciones, políticas largas. | `.md` |
| **Texto plano** | Notas simples. | `.txt` |
| **PDF** | Folletos o documentos que ya tenés en PDF. | `.pdf` |

Límites: hasta **10 MB por archivo** y **100 documentos** por cuenta.

## Reglas de oro del buen contenido

El bot busca por **significado**, no por palabras exactas. Para que encuentre la
respuesta correcta:

- **Una idea por pregunta.** No metas horarios, precios y envíos en una sola
  respuesta gigante. Separá cada tema en su propia entrada.
- **Respuestas autocontenidas.** Cada respuesta tiene que entenderse sola. Nunca
  "como dije antes" ni "ver la pregunta anterior" — el bot recupera fragmentos
  sueltos, no lee el documento de corrido.
- **Cortas y concretas.** 1 a 3 oraciones por respuesta. Si necesitás más, partilo
  en varias preguntas.
- **Nombrá las cosas como las nombra el cliente.** Si la gente pregunta por
  "pulido", no escribas solo "tratamiento de superficie". Usá las dos palabras.
- **Una pregunta, varias formas de preguntarla.** Si dudás, sumá una entrada con
  la variante ("¿Hacen envíos?" y "¿Mandan a domicilio?").

## Qué hace el bot cuando NO tiene la respuesta

Si preguntás algo que no está en la base de conocimiento, el bot lo dice
honestamente ("no tengo esa información") en lugar de inventar. Eso es a
propósito: preferimos que admita que no sabe antes que dar datos falsos. Por eso
**lo que no cargues, no lo va a contestar** — el kit existe para que no quede
nada importante afuera.
