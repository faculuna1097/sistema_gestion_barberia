# Barbershop Manager

Sistema de gestión SaaS para barberías. Multi-tenant, optimizado para iPad en landscape.

## Stack

- **Frontend:** React + Vite (deploy en Vercel)
- **Backend:** Node.js + Express (deploy en Railway)
- **DB:** PostgreSQL via Supabase
- **Dominio:** `barbermanager.app` (subdominios por tenant)

## Estructura

```
/backend            API Node.js + Express                        (dev: puerto 3001)
/frontend           Panel de gestión: modo operativo + admin      (dev: puerto 5173)
/frontend-barbero   App del barbero, servida en /barbero/        (dev: puerto 5174)
/frontend-turnero   Turnero público del cliente, en /turnos/     (dev: puerto 5175)
/frontend-landing   Landing de marketing (barbermanager.app)     (dev: puerto 5176)
/frontend-alta      Formulario de alta de clientes (alta.barbermanager.app) (dev: puerto 5177)
/docs               Documentación del proyecto
CLAUDE.md           Instrucciones de trabajo para Claude Code
```

## Documentación

El mapa de documentos (qué doc sirve para qué) está en [`CLAUDE.md`](./CLAUDE.md) §3.

## Desarrollo local

```bash
# Backend (requiere backend/.env, ver backend/.env.example)
cd backend
npm install
npm start

# Cualquier frontend (frontend, frontend-barbero, frontend-turnero, frontend-landing, frontend-alta)
cd frontend
npm install
npm run dev
```

En local no hay subdominio: el backend resuelve el tenant con `TENANT_ID` del `.env`.
El formulario de alta no usa tenant: se abre en `http://localhost:5177/<id>`, con el id de una fila de `solicitud_alta`.
Para probar desde un celular en la red local, ver `docs/estado_actual.md` → Deploy.
