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
--   - barbero.comision_tipo: el CHECK admite 'fijo', pero hoy no hay barberos con
--     comisión fija: toda comisión es porcentaje (decisión de negocio; ver la deuda
--     "Comisión: siempre porcentaje" en estado_actual.md).
--   - Row Level Security ACTIVADO y sin policies en las 18 tablas (desde 2026-09-30).
--     Cierra la API automática de Supabase (roles anon / authenticated); el backend
--     entra como owner (postgres) y RLS no le aplica. Toda tabla nueva se crea con
--     ALTER TABLE ... ENABLE ROW LEVEL SECURITY (el SQL editor no lo activa solo).

CREATE TABLE public.tenant (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre_negocio text NOT NULL,
  pin_admin text NOT NULL,
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
  comision_tipo text DEFAULT 'porcentaje'::text CHECK (comision_tipo = ANY (ARRAY['porcentaje'::text, 'fijo'::text])),
  comision_valor numeric DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  email text,
  token_version integer NOT NULL DEFAULT 0,
  CONSTRAINT barbero_pkey PRIMARY KEY (id),
  CONSTRAINT barbero_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  -- Target de los FK compuestos (tenant_id, barbero_id) de turno y corte.
  -- Trivialmente satisfacible: id ya es PK (único por sí solo).
  CONSTRAINT barbero_tenant_id_id_key UNIQUE (tenant_id, id)
);
CREATE TABLE public.servicio (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nombre text NOT NULL,
  precio numeric NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  cantidad_slots integer NOT NULL DEFAULT 1 CHECK (cantidad_slots > 0 AND cantidad_slots <= 20),
  CONSTRAINT servicio_pkey PRIMARY KEY (id),
  CONSTRAINT servicio_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  -- Target de los FK compuestos (tenant_id, servicio_id) de turno y corte.
  CONSTRAINT servicio_tenant_id_id_key UNIQUE (tenant_id, id)
);
CREATE TABLE public.producto (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nombre text NOT NULL,
  precio numeric NOT NULL,
  stock_actual integer DEFAULT 0,
  stock_minimo integer DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT producto_pkey PRIMARY KEY (id),
  CONSTRAINT producto_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
);
CREATE TABLE public.corte (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  barbero_id uuid NOT NULL,
  forma_pago text NOT NULL CHECK (forma_pago = ANY (ARRAY['efectivo'::text, 'mercado_pago'::text])),
  propina numeric DEFAULT 0,
  monto_total numeric NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  servicio_id uuid NOT NULL,
  precio numeric NOT NULL,
  turno_id uuid,
  CONSTRAINT corte_pkey PRIMARY KEY (id),
  CONSTRAINT corte_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
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
  precio_unitario numeric NOT NULL,
  forma_pago text NOT NULL CHECK (forma_pago = ANY (ARRAY['efectivo'::text, 'mercado_pago'::text])),
  timestamp timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT venta_pkey PRIMARY KEY (id),
  CONSTRAINT venta_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT venta_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.producto(id)
);
CREATE TABLE public.categoria_gasto (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid,
  nombre text NOT NULL,
  es_default boolean DEFAULT false,
  activo boolean DEFAULT true,
  CONSTRAINT categoria_gasto_pkey PRIMARY KEY (id),
  CONSTRAINT categoria_gasto_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
);
CREATE TABLE public.gasto (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  categoria_id uuid,
  descripcion text NOT NULL,
  monto numeric NOT NULL,
  timestamp timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  forma_pago text NOT NULL DEFAULT 'efectivo'::text CHECK (forma_pago = ANY (ARRAY['efectivo'::text, 'mercado_pago'::text])),
  CONSTRAINT gasto_pkey PRIMARY KEY (id),
  CONSTRAINT gasto_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT gasto_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categoria_gasto(id)
);
CREATE TABLE public.cierre_caja (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  fecha date NOT NULL,
  efectivo_esperado numeric NOT NULL,
  efectivo_real numeric NOT NULL,
  diferencia numeric DEFAULT (efectivo_real - efectivo_esperado),
  comentario text,
  usuario_id uuid,
  timestamp timestamp with time zone DEFAULT now(),
  CONSTRAINT cierre_caja_pkey PRIMARY KEY (id),
  CONSTRAINT cierre_caja_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
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
  CONSTRAINT barbero_horario_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.barbero(id)
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
  CONSTRAINT barbero_suspension_pkey PRIMARY KEY (id),
  CONSTRAINT barbero_suspension_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT barbero_suspension_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.barbero(id)
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
  CONSTRAINT tenant_horario_atencion_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
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