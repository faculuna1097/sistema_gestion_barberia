# CLAUDE.md

Este archivo define cómo Claude debe trabajar en este proyecto.
Lee esto antes de cualquier otra cosa.

---

## 1. Cómo trabajar conmigo

### Ritmo
- Avanzá **paso a paso**. Antes de escribir código, explicame qué vas a hacer y por qué.
- No avances al siguiente paso hasta que yo confirme que el anterior funciona.
- Cuando haya más de una forma de resolver algo, presentame las opciones con ventajas y desventajas, y **siempre indicá cuál recomendás**. La recomendación tiene que seguir el estándar de un programador senior profesional. Quiero aprender a pensar y construir como uno.

### Cómo me hacés preguntas
- Cuando me pidas decisiones, **enumerá las preguntas (1, 2, 3...)** así mis respuestas pueden referenciar el número y queda claro a qué estoy contestando.
- Nunca uses interfaces de selección tipo botón/checkbox que me obliguen a elegir una opción cerrada. Siempre dejá que escriba libre.

### Mi nivel técnico
- Soy programador con conocimiento de Java, C++, C# y SQL, **sin experiencia en desarrollo web**.
- Explicame las decisiones técnicas importantes antes de implementarlas, sobre todo si introducen conceptos o tecnologías nuevas para mí.
- Cuando uses una librería o herramienta nueva, decime en dos líneas qué es y por qué la estás usando.

### Código
- Comentá todas las funciones explicando qué hacen, qué parámetros reciben y qué retornan.
- Antes de escribir cualquier función, helper o componente, **evaluá si puede centralizarse** en `/utils`, `/components` u otra carpeta similar. Preguntate: ¿esto lo voy a usar en otro lado? ¿Ya existe algo parecido? Si la respuesta es sí, centralizalo.
- Si algo que pido va a generar problemas más adelante (deuda técnica, problemas de escalabilidad, conflictos con la arquitectura), avisame antes de implementarlo.

### Revisión activa del código
- Cuando leas o revises archivos del proyecto, **anotá deudas técnicas, posibles bugs, code smells o decisiones cuestionables** que vayas detectando, aunque no sean parte de la tarea actual. Mencionámelas al final de tu respuesta para que decida si las atacamos ahora, las posponemos, o las descartamos.
- Si algo no te cierra mientras revisás código, **pedime los archivos que necesites** para entender el contexto completo antes de opinar. No asumas. Es preferible pedir tres archivos más y dar un diagnóstico sólido, a opinar con información parcial.

---

## 2. Convenciones no-negociables

Las convenciones técnicas completas (logs, errores, async, timezone, multi-tenancy, Supabase, frontend, etc.) están en:

**`/docs/convenciones_tecnicas.md`**

Léelo cuando vayas a escribir código por primera vez en una sesión, o cuando tengas dudas de patrón.

---

## 3. Lectura de archivos del proyecto

**No leas archivos del proyecto por tu cuenta.** Yo te indico explícitamente qué leer cuando lo necesite.

Excepción: podés leer los archivos `.md` de contexto general (los que están en este mapa de documentos) cuando sean **estrictamente necesarios** para la tarea que te pedí.

### Mapa de documentos

| Archivo | Para qué sirve |
|---|---|
| `/docs/convenciones_tecnicas.md` | Referencia activa de cómo se escribe código en el proyecto. |
| `/docs/estado_actual.md` | El "dónde estamos": estado funcional, lo que ya está, lo que falta, decisiones tomadas. |
| `ruta_actual_proyecto.txt` | Estructura de carpetas y archivos del proyecto. Consultá esto antes de asumir rutas. |
| `/docs/SQL_Schema.md` | Schema completo de la DB (referencia, no ejecutar). |
| `/docs/onboarding.md`| Alta de un cliente nuevo.


---

## 4. Flujo de trabajo por sesión

### Durante el chat
- Trabajamos paso a paso, con tu confirmación entre cada paso.
- Si surge una decisión técnica, me das opciones con tu recomendación senior.

### Al final del chat — siempre
1. **Resumen libre** de lo que se hizo: qué se construyó, qué decisiones técnicas se tomaron, qué corresponde para el próximo chat. No formato rígido, prosa libre.
2. **Propuesta de commit** (si aplica): vos proponés el mensaje exacto y la lista de archivos a incluir. Yo lo ejecuto.

Si no hubo cambios de código en el chat, no hay commit. Igual va el resumen.

---

## 5. Comandos comunes

*(Pendientes de definir — agregar acá los comandos que más uso: levantar backend local, levantar frontend, apuntar al tenant demo, etc.)*

---

*— Fin del documento —*
