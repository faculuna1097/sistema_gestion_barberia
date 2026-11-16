# Auditoría de seguridad y calidad — 2026-11

> **Estado (2026-11-16): en curso.** Esqueleto creado; ninguna zona auditada todavía.
>
> Auditoría de **solo lectura**: no se modifica código, ni la base, ni configuración. Los arreglos se deciden
> al final, hallazgo por hallazgo, y van aparte. El plan (decisiones, zonas, filtro de hallazgos y fases) está
> en [`plan_auditoria_2026-11.md`](./plan_auditoria_2026-11.md).

Se audita el branch `feature/mejoras-operativas`, que contiene todo `main` más las fases hechas de mejoras
operativas. Commit base al crear este documento: `e80815c`. Si el branch avanza durante la auditoría, cada
zona anota el commit que auditó.

La auditoría anterior es la de julio ([`auditoria_2026-07.md`](./auditoria_2026-07.md)).

---

## Resumen ejecutivo

*Pendiente: se escribe en la consolidación (fase 9), con el veredicto general, el conteo por severidad y la
tabla de todos los hallazgos con su destino.*

---

## Zonas

| Zona | Área | Commit auditado | Estado | Crítico | Alto | Medio | Bajo |
|---|---|---|---|---|---|---|---|
| 1 | Autenticación, sesiones y recuperación | — | Pendiente | — | — | — | — |
| 2 | Aislamiento entre tenants y permisos por rol | — | Pendiente | — | — | — | — |
| 3 | Superficie pública: turnero, alta y mails | — | Pendiente | — | — | — | — |
| 4 | Plata: caja, planillas, balances y stock | — | Pendiente | — | — | — | — |
| 5 | Agenda, turnos y concurrencia | — | Pendiente | — | — | — | — |
| 6 | Panel de gestión y app del barbero (front) | — | Pendiente | — | — | — | — |
| 7 | Operación, infraestructura y dependencias | — | Pendiente | — | — | — | — |
| 8 | Rendimiento y consumo del backend | — | Pendiente | — | — | — | — |

Estados: **Pendiente** (sin empezar), **Escrita** (el ejecutor terminó su sección) y **Revisada** (el
orquestador la revisó contra el código y la commiteó).

## Formato y severidades

Cada hallazgo se identifica como `Z<zona>-<nn>` (ej. `Z3-02`) y lleva título, severidad, dónde, alcance ("en
producción" o "solo en el branch"), qué pasa, evidencia, arreglo propuesto con su tamaño y novedad. El detalle
del formato y la guía de severidad (crítico, alto, medio, bajo) están en el plan, §4. La zona 8 cambia "Qué
pasa" por "Costo" y lee la severidad según cuánto pesa (plan, §5 → Zona 8).

Cada zona cierra con "Verificado correcto" (lo que se revisó y está bien, una línea por punto) y "Para otra
zona" (lo que se encontró de paso y le toca a otra).

---

## Zona 1. Autenticación, sesiones y recuperación

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 2. Aislamiento entre tenants y permisos por rol

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 3. Superficie pública: turnero, alta y mails

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 4. Plata: caja, planillas, balances y stock

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 5. Agenda, turnos y concurrencia

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 6. Panel de gestión y app del barbero (front)

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 7. Operación, infraestructura y dependencias

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Zona 8. Rendimiento y consumo del backend

### Hallazgos

### Verificado correcto

### Para otra zona

---

## Segunda pasada

*Pendiente: se escribe en la fase 10, antes del PR de merge de `feature/mejoras-operativas`, sobre el diff de
las fases hechas después de esta auditoría.*

---

*— Fin del documento —*
