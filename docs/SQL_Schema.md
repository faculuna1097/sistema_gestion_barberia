-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
--
-- El export de Supabase NO incluye índices, EXCLUDE ni extensiones. Existen además:
--   - Extensión btree_gist.
--   - turno: EXCLUDE GIST turno_no_solapamiento (mismo barbero, rangos [inicio, fin)
--     solapados, solo estado = 'reservado'). Violación → SQLSTATE 23P01, el backend
--     responde 409. 3 índices parciales sobre estado = 'reservado'.
--   - cliente: UNIQUE (tenant_id, email) (admite múltiples NULL; lo usa el
--     ON CONFLICT del find-or-create en turnosService).
--   - corte: UNIQUE corte_turno_unico (turno_id) WHERE turno_id IS NOT NULL
--     (un turno se vincula a un solo corte; violación → 23505).
--   - barbero_suspension: índice (barbero_id, desde, hasta).
--   - Comisión: siempre un porcentaje sobre el precio del servicio (decisión de
--     negocio del 2026-09-29). El tipo 'fijo' se sacó del CHECK el 2026-11-03. La
--     fórmula vive solo en backend/src/utils/comision.js.
--   - Row Level Security ACTIVADO y sin policies en las 19 tablas (desde 2026-09-30;
--     solicitud_alta se creó con RLS el 2026-11-10).
--     Cierra la API automática de Supabase (roles anon / authenticated); el backend
--     entra como owner (postgres) y RLS no le aplica. Toda tabla nueva se crea con
--     ALTER TABLE ... ENABLE ROW LEVEL SECURITY (el SQL editor no lo activa solo).
--     Excepción a propósito: las 3 vistas web_* (al final del archivo).
--   - FK de tenant_id con ON DELETE CASCADE solo en barbero, servicio, producto,
--     corte, venta, categoria_gasto, gasto y cierre_caja (leído de la DB el
--     2026-11-03). En las demás tablas el FK es sin acción, así que borrar un tenant
--     falla mientras le queden filas ahí: la baja de un tenant es activo = false
--     (onboarding.md).
--   - Web de Kingsai: barbero, servicio y tenant_horario_atencion tienen triggers
--     web_deploy_* que pueden disparar un deploy real de la web de Kingsai. Detalle
--     al final del archivo. Nada de eso está en el repo: vive solo en la DB.

CREATE TABLE public.tenant (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre_negocio text NOT NULL,
  pin_admin text NOT NULL,
  -- Claves que lee el código: recordatorio.activo (mail de recordatorio), whatsapp
  -- (E.164) y resena_url (https, link de reseñas de Google) que expone el turnero.
  -- Ver onboarding.md → Notas.
  configuracion jsonb DEFAULT '{}'::jsonb,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  booking_url text,
  suscripcion_vigente_hasta date,
  subdominio text NOT NULL UNIQUE,
  duracion_slot_minutos integer NOT NULL DEFAULT 30 CHECK (duracion_slot_minutos > 0 AND duracion_slot_minutos <= 240),
  operativo_usuario text,
  operativo_password_hash text,
  operativo_token_version integer NOT NULL DEFAULT 0,
  admin_token_version integer NOT NULL DEFAULT 0,
  telefono text,
  direccion text,
  CONSTRAINT tenant_pkey PRIMARY KEY (id)
);
CREATE TABLE public.barbero (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nombre text NOT NULL,
  pin text NOT NULL,
  -- comision_tipo: solo 'porcentaje' desde el 2026-11-03 (antes admitía 'fijo', sin
  -- filas). Ningún front publicado la usa desde el deploy del 2026-11-05; se puede
  -- borrar sacándola antes del backend (gestion.js la lee y la escribe).
  comision_tipo text DEFAULT 'porcentaje'::text CONSTRAINT barbero_comision_tipo_check CHECK (comision_tipo = 'porcentaje'::text),
  -- comision_valor: % actual del barbero (0 a 100, lo valida el backend). Vale para
  -- los cortes nuevos: cada corte guarda el suyo en corte.comision_porcentaje.
  comision_valor numeric(10,2) DEFAULT 0,
  -- activo y created_at: NOT NULL desde el 2026-11-03 (no había NULLs).
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  email text,
  token_version integer NOT NULL DEFAULT 0,
  CONSTRAINT barbero_pkey PRIMARY KEY (id),
  CONSTRAINT barbero_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id) ON DELETE CASCADE,
  -- Target de los FK compuestos (tenant_id, barbero_id) de turno y corte.
  -- Trivialmente satisfacible: id ya es PK (único por sí solo).
  CONSTRAINT barbero_tenant_id_id_key UNIQUE (tenant_id, id)
);
CREATE TABLE public.servicio (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nombre text NOT NULL,
  precio numeric(10,2) NOT NULL,
  -- activo y created_at: NOT NULL desde el 2026-11-03.
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  cantidad_slots integer NOT NULL DEFAULT 1 CHECK (cantidad_slots > 0 AND cantidad_slots <= 20),
  CONSTRAINT servicio_pkey PRIMARY KEY (id),
  CONSTRAINT servicio_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id) ON DELETE CASCADE,
  -- Target de los FK compuestos (tenant_id, servicio_id) de turno y corte.
  CONSTRAINT servicio_tenant_id_id_key UNIQUE (tenant_id, id)
);
CREATE TABLE public.producto (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nombre text NOT NULL,
  precio numeric(10,2) NOT NULL,
  stock_actual integer DEFAULT 0,
  stock_minimo integer DEFAULT 0,
  -- activo y created_at: NOT NULL desde el 2026-11-03.
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT producto_pkey PRIMARY KEY (id),
  CONSTRAINT producto_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id) ON DELETE CASCADE
);
CREATE TABLE public.corte (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  barbero_id uuid NOT NULL,
  forma_pago text NOT NULL CHECK (forma_pago = ANY (ARRAY['efectivo'::text, 'mercado_pago'::text])),
  propina numeric(10,2) DEFAULT 0,
  monto_total numeric(10,2) NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  servicio_id uuid NOT NULL,
  precio numeric NOT NULL,
  turno_id uuid,
  -- % de comisión del barbero al registrar el corte (2026-11-03): un cambio de %
  -- vale solo para adelante. Lo completa registrarCorte en el mismo INSERT; los
  -- cortes anteriores se rellenaron con el % de su barbero ese día. Mismo tipo que
  -- barbero.comision_valor y sin CHECK, para que copiarlo nunca falle. NOT NULL desde
  -- el 2026-11-05, con el backend que lo escribe ya desplegado (antes se rellenaron
  -- los 38 cortes que cargó el backend anterior en el medio).
  comision_porcentaje numeric(10,2) NOT NULL,
  CONSTRAINT corte_pkey PRIMARY KEY (id),
  CONSTRAINT corte_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id) ON DELETE CASCADE,
  -- FK compuestos con tenant_id: hacen imposible que un corte referencie un
  -- barbero/servicio/turno de OTRO tenant (aislamiento estructural, auditoría 2.1).
  CONSTRAINT corte_barbero_tenant_fkey  FOREIGN KEY (tenant_id, barbero_id)  REFERENCES public.barbero(tenant_id, id),
  CONSTRAINT corte_servicio_tenant_fkey FOREIGN KEY (tenant_id, servicio_id) REFERENCES public.servicio(tenant_id, id),
  -- turno_id es nullable (walk-ins): con MATCH SIMPLE (default) el FK no se
  -- chequea si turno_id es NULL, así que los walk-ins no se rompen.
  CONSTRAINT corte_turno_tenant_fkey    FOREIGN KEY (tenant_id, turno_id)    REFERENCES public.turno(tenant_id, id)
);
CREATE TABLE public.venta (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  producto_id uuid NOT NULL,
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric(10,2) NOT NULL,
  forma_pago text NOT NULL CHECK (forma_pago = ANY (ARRAY['efectivo'::text, 'mercado_pago'::text])),
  timestamp timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT venta_pkey PRIMARY KEY (id),
  CONSTRAINT venta_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id) ON DELETE CASCADE,
  CONSTRAINT venta_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id)
);
-- Categorías de gasto: todos los tenants tienen las mismas 9 predeterminadas y no
-- se agregan propias (decidido el 2026-11-03). Cada tenant tiene su copia (no hay
-- filas globales), sembrada por crearTenant.js (CATEGORIAS_GASTO_BASE); la lista y
-- el SQL de respaldo están en onboarding.md, paso 2c.
-- Cambios del 2026-11-03: tenant_id y activo NOT NULL, UNIQUE (tenant_id, id) y
-- DROP de es_default (no la leía nadie y tenía valores distintos según el tenant).
-- No tiene created_at.
CREATE TABLE public.categoria_gasto (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  CONSTRAINT categoria_gasto_pkey PRIMARY KEY (id),
  CONSTRAINT categoria_gasto_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id) ON DELETE CASCADE,
  -- Target del FK compuesto (tenant_id, categoria_id) de gasto.
  CONSTRAINT categoria_gasto_tenant_id_id_key UNIQUE (tenant_id, id)
);
CREATE TABLE public.gasto (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  categoria_id uuid,
  descripcion text NOT NULL,
  monto numeric(10,2) NOT NULL,
  -- timestamp: cuándo se hizo el gasto (lo que muestran Gastos, Caja y Balances).
  -- created_at: cuándo se registró (auditoría), igual que en movimiento_extra. Hoy
  -- el backend no deja cargar un gasto con otra fecha, así que coinciden; se
  -- conserva a propósito (decisión del 2026-10-30), no es una columna de más.
  timestamp timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  forma_pago text NOT NULL DEFAULT 'efectivo'::text CHECK (forma_pago = ANY (ARRAY['efectivo'::text, 'mercado_pago'::text])),
  CONSTRAINT gasto_pkey PRIMARY KEY (id),
  CONSTRAINT gasto_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id) ON DELETE CASCADE,
  -- FK compuesto (2026-11-03, reemplaza al simple gasto_categoria_id_fkey): un gasto
  -- no puede referenciar una categoría de otro tenant. MATCH SIMPLE: no se chequea
  -- si categoria_id es NULL (hoy no hay ninguno; el backend la exige).
  CONSTRAINT gasto_categoria_tenant_fkey FOREIGN KEY (tenant_id, categoria_id) REFERENCES public.categoria_gasto(tenant_id, id)
);
CREATE TABLE public.cierre_caja (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  fecha date NOT NULL,
  efectivo_esperado numeric(10,2) NOT NULL,
  efectivo_real numeric(10,2) NOT NULL,
  diferencia numeric(10,2) DEFAULT (efectivo_real - efectivo_esperado),
  comentario text,
  usuario_id uuid,
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT cierre_caja_pkey PRIMARY KEY (id),
  CONSTRAINT cierre_caja_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id) ON DELETE CASCADE,
  CONSTRAINT cierre_caja_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.barbero(id)
);
CREATE TABLE public.cliente (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nombre text NOT NULL,
  telefono text,
  email text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cliente_pkey PRIMARY KEY (id),
  CONSTRAINT cliente_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
);
CREATE TABLE public.barbero_horario (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  barbero_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  CONSTRAINT barbero_horario_pkey PRIMARY KEY (id),
  CONSTRAINT barbero_horario_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT barbero_horario_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.barbero(id) ON DELETE CASCADE,
  CONSTRAINT barbero_horario_rango_valido CHECK (hora_fin > hora_inicio),
  -- Un barbero puede tener varias franjas por día, pero no solapadas ([inicio, fin)).
  -- Por ser un EXCLUDE (sin clave), reemplazarHorarios fuerza el DELETE antes del
  -- INSERT en la misma sentencia (convenciones_tecnicas.md §6).
  CONSTRAINT barbero_horario_no_solapamiento EXCLUDE USING gist (
    barbero_id WITH =, dia_semana WITH =, timerange(hora_inicio, hora_fin, '[)'::text) WITH &&
  )
);
CREATE TABLE public.barbero_suspension (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  barbero_id uuid NOT NULL,
  desde timestamp with time zone NOT NULL,
  hasta timestamp with time zone NOT NULL,
  motivo text,
  origen text NOT NULL DEFAULT 'admin'::text CHECK (origen = ANY (ARRAY['admin'::text, 'barbero'::text, 'whatsapp'::text])),
  created_at timestamp with time zone DEFAULT now(),
  -- tipo, liberada_en y liberada_por: agregadas el 2026-10-15
  -- (decisiones_descansos.md). Un descanso es una fila con tipo = 'descanso'. Las filas no se borran:
  -- liberar (o terminar antes) completa liberada_en/liberada_por.
  -- Rango efectivo: [desde, LEAST(hasta, COALESCE(liberada_en, hasta))); vacío si se
  -- liberó antes de empezar. El backend lo calcula en un solo lugar
  -- (suspensionesService, RANGO_EFECTIVO_SQL).
  tipo text NOT NULL DEFAULT 'suspension'::text CHECK (tipo = ANY (ARRAY['suspension'::text, 'descanso'::text])),
  liberada_en timestamp with time zone,
  liberada_por text CHECK (liberada_por = ANY (ARRAY['admin'::text, 'barbero'::text])),
  CONSTRAINT barbero_suspension_pkey PRIMARY KEY (id),
  CONSTRAINT barbero_suspension_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT barbero_suspension_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.barbero(id) ON DELETE CASCADE,
  CONSTRAINT barbero_suspension_rango_valido CHECK (hasta > desde),
  CONSTRAINT barbero_suspension_liberada_completa CHECK ((liberada_en IS NULL) = (liberada_por IS NULL))
);
CREATE TABLE public.turno (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  barbero_id uuid NOT NULL,
  servicio_id uuid NOT NULL,
  inicio timestamp with time zone NOT NULL,
  fin timestamp with time zone NOT NULL,
  estado text NOT NULL DEFAULT 'reservado'::text CHECK (estado = ANY (ARRAY['reservado'::text, 'cancelado'::text, 'completado'::text, 'no_asistio'::text])),
  origen_creacion text NOT NULL DEFAULT 'turnero'::text CHECK (origen_creacion = ANY (ARRAY['turnero'::text, 'barbero'::text, 'admin'::text])),
  token_gestion text NOT NULL UNIQUE,
  google_event_id text,
  created_at timestamp with time zone DEFAULT now(),
  cancelado_en timestamp with time zone,
  cancelado_por text CHECK (cancelado_por = ANY (ARRAY['cliente'::text, 'barbero'::text, 'admin'::text, 'suspension'::text])),
  recordatorio_enviado_en timestamp with time zone,
  -- Por qué link llegó el cliente al turnero (el ?origen= de la URL, ej. 'instagram',
  -- 'qr'). Solo lo graba el turnero público; null si no vino o no cumple el formato
  -- (la reserva no se rechaza). Agregada el 2026-10-08. No confundir con origen_creacion.
  origen_link text CONSTRAINT turno_origen_link_formato CHECK (origen_link ~ '^[a-z0-9_-]{1,30}$'),
  CONSTRAINT turno_pkey PRIMARY KEY (id),
  CONSTRAINT turno_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT turno_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id),
  -- FK compuestos con tenant_id (auditoría 2.1): impiden que un turno referencie
  -- un barbero/servicio de otro tenant. Cierran el DoS de agenda cross-tenant.
  CONSTRAINT turno_barbero_tenant_fkey  FOREIGN KEY (tenant_id, barbero_id)  REFERENCES public.barbero(tenant_id, id),
  CONSTRAINT turno_servicio_tenant_fkey FOREIGN KEY (tenant_id, servicio_id) REFERENCES public.servicio(tenant_id, id),
  -- Target del FK compuesto (tenant_id, turno_id) de corte.
  CONSTRAINT turno_tenant_id_id_key UNIQUE (tenant_id, id)
);
CREATE TABLE public.tenant_horario_atencion (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio time without time zone NOT NULL,
  hora_fin time without time zone NOT NULL,
  CONSTRAINT tenant_horario_atencion_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_horario_atencion_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  -- Una franja por día. Es la clave del upsert de reemplazarHorario.
  CONSTRAINT tenant_horario_atencion_dia_unico UNIQUE (tenant_id, dia_semana),
  CONSTRAINT tenant_horario_atencion_horas_validas CHECK (hora_inicio < hora_fin)
);
CREATE TABLE public.tenant_feriado (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  fecha date NOT NULL,
  descripcion text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tenant_feriado_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_feriado_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
);
CREATE TABLE public.tenant_imagen (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['local'::text, 'corte'::text, 'logo'::text])),
  orden smallint NOT NULL DEFAULT 1 CHECK (orden >= 1),
  storage_path text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tenant_imagen_pkey PRIMARY KEY (id),
  CONSTRAINT tenant_imagen_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
);
CREATE TABLE public.socio (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nombre text NOT NULL,
  -- Vínculo opcional con barbero (NULL: el dueño no corta). Va acá y no en
  -- barbero para no tocar la tabla central. Nadie lo lee todavía.
  barbero_id uuid,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT socio_pkey PRIMARY KEY (id),
  CONSTRAINT socio_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  -- Target del FK compuesto (tenant_id, socio_id) de movimiento_extra.
  CONSTRAINT socio_tenant_id_id_key UNIQUE (tenant_id, id),
  CONSTRAINT socio_tenant_nombre_key UNIQUE (tenant_id, nombre),
  -- Un barbero es, a lo sumo, un socio (admite múltiples NULL).
  CONSTRAINT socio_barbero_id_key UNIQUE (barbero_id),
  CONSTRAINT socio_barbero_tenant_fkey FOREIGN KEY (tenant_id, barbero_id) REFERENCES public.barbero(tenant_id, id)
);
-- Movimientos de plata que no son corte, venta ni gasto. El signo y si afectan la
-- ganancia salen del tipo (mapa en backend/src/utils/movimientos.js), nunca del monto.
CREATE TABLE public.movimiento_extra (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['aporte_capital'::text, 'retiro_socio'::text, 'otro_ingreso'::text])),
  socio_id uuid,
  descripcion text,
  monto numeric NOT NULL CHECK (monto > 0),
  forma_pago text NOT NULL CHECK (forma_pago = ANY (ARRAY['efectivo'::text, 'mercado_pago'::text])),
  -- timestamp: cuándo se movió la plata (puede ser un día pasado).
  -- created_at: cuándo se registró (auditoría).
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT movimiento_extra_pkey PRIMARY KEY (id),
  CONSTRAINT movimiento_extra_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  -- FK compuesto con tenant_id (mismo estándar que auditoría 2.1): un movimiento
  -- no puede referenciar un socio de otro tenant. MATCH SIMPLE: no se chequea si
  -- socio_id es NULL (otro_ingreso).
  CONSTRAINT movimiento_extra_socio_tenant_fkey FOREIGN KEY (tenant_id, socio_id) REFERENCES public.socio(tenant_id, id),
  -- Aporte y retiro llevan socio; otro_ingreso no.
  CONSTRAINT movimiento_extra_socio_segun_tipo CHECK (
    (tipo = 'otro_ingreso' AND socio_id IS NULL) OR (tipo <> 'otro_ingreso' AND socio_id IS NOT NULL)
  ),
  -- otro_ingreso lleva descripción; en aporte y retiro es opcional (la conservan
  -- los retiros migrados desde gasto).
  CONSTRAINT movimiento_extra_descripcion_otro_ingreso CHECK (
    tipo <> 'otro_ingreso' OR (descripcion IS NOT NULL AND btrim(descripcion) <> '')
  )
);
-- Formulario de alta de clientes (frontend-alta, desde el 2026-11-10). Una fila por
-- cliente nuevo: Facundo la crea con INSERT (referencia) RETURNING id y le manda el
-- link alta.barbermanager.app/<id>. El id es el token del link (uuid v4). La leen y
-- escriben solo /api/alta (controllers/alta.js) y la skill alta-cliente (solo lee);
-- no tiene tenant_id: el tenant todavía no existe. Decisiones en
-- decisiones_alta_clientes.md.
CREATE TABLE public.solicitud_alta (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),   -- es el token del link
  referencia text NOT NULL,                      -- de quién es, para Facundo y los logs
  -- Todo el formulario, con la forma de plan_alta_clientes.md §5.6 (version 1).
  -- Al enviar se guarda normalizado por validarSolicitudAlta.
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- borrador (el cliente completa) → enviada (POST /enviar) → cargada (la query de
  -- alta de la skill). Solo en borrador se puede escribir.
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado = ANY (ARRAY['borrador'::text, 'enviada'::text, 'cargada'::text])),
  vence_en timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  enviada_en timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  -- Sin trigger: lo setea cada UPDATE (guardar, enviar y la query de alta).
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT solicitud_alta_pkey PRIMARY KEY (id)
);
-- ─────────────────────────────────────────────────────────────────────────────
-- Web de Kingsai (sitio aparte, no es parte de este repo). Vive solo en la DB;
-- documentado leyéndolo de la DB el 2026-11-03. No se modifica desde este proyecto.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Vistas que lee la web con la API de Supabase (rol anon, solo SELECT). Las tres
-- filtran al tenant de Kingsai (a1b2c3d4-0000-0000-0000-000000000001) y exponen solo
-- lo que ya es público. No tienen RLS: corren con los permisos de su dueño
-- (postgres), así que pasan por encima del RLS de las tablas a propósito.
CREATE VIEW public.web_barberos AS
  SELECT nombre FROM barbero
  WHERE tenant_id = 'a1b2c3d4-0000-0000-0000-000000000001' AND activo IS TRUE;
CREATE VIEW public.web_servicios AS
  SELECT nombre, precio FROM servicio
  WHERE tenant_id = 'a1b2c3d4-0000-0000-0000-000000000001' AND activo IS TRUE;
CREATE VIEW public.web_horarios AS
  SELECT dia_semana, hora_inicio, hora_fin FROM tenant_horario_atencion
  WHERE tenant_id = 'a1b2c3d4-0000-0000-0000-000000000001';
--
-- Triggers: 9, uno por sentencia (FOR EACH STATEMENT, AFTER), con tablas de
-- transición (filas_viejas / filas_nuevas). Todos ejecutan web_deploy_kingsai():
--   web_deploy_barbero_insert / _update / _delete   ON barbero
--   web_deploy_servicio_insert / _update / _delete  ON servicio
--   web_deploy_horario_insert / _update / _delete   ON tenant_horario_atencion
--
-- Función web_deploy_kingsai() (plpgsql, SECURITY DEFINER, search_path ''): decide
-- si la sentencia cambió algo que se ve en la web de Kingsai y, si es así, encola un
-- POST al deploy hook de Vercel con pg_net (net.http_post, timeout 30 s). La URL del
-- hook está en Vault (secreto kingsai_deploy_hook), no en la función. El POST sale
-- después, fuera de la transacción; si falla al encolar, queda un warning y la
-- escritura de la app sigue. Cuenta como cambio:
--   - tenant_horario_atencion: cualquier INSERT o DELETE de filas de Kingsai, o un
--     UPDATE que cambie dia_semana, hora_inicio u hora_fin.
--   - servicio y barbero, INSERT: una fila de Kingsai con activo = true.
--   - servicio y barbero, DELETE: una fila de Kingsai que tenía activo = true.
--   - servicio, UPDATE: fila de Kingsai activa antes o después, con cambio de
--     nombre, precio o activo.
--   - barbero, UPDATE: fila de Kingsai activa antes o después, con cambio de nombre
--     o activo (no PIN, email, comisión ni token_version).
-- Consecuencia: en demo o en otro tenant nunca se dispara. Antes de un UPDATE manual
-- sobre esas tablas con filas de Kingsai, revisar si cambia algo de lo de arriba.
-- Un ALTER TABLE no dispara estos triggers.
