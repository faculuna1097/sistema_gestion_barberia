CREATE TABLE public.barbero (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nombre text NOT NULL,
  pin text NOT NULL,
  comision_tipo text DEFAULT 'porcentaje'::text CHECK (comision_tipo = ANY (ARRAY['porcentaje'::text, 'fijo'::text])),
  comision_valor numeric DEFAULT 0,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT barbero_pkey PRIMARY KEY (id),
  CONSTRAINT barbero_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
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
  CONSTRAINT corte_pkey PRIMARY KEY (id),
  CONSTRAINT corte_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id),
  CONSTRAINT corte_barbero_id_fkey FOREIGN KEY (barbero_id) REFERENCES public.barbero(id),
  CONSTRAINT corte_servicio_id_fkey FOREIGN KEY (servicio_id) REFERENCES public.servicio(id)
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
CREATE TABLE public.servicio (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL,
  nombre text NOT NULL,
  precio numeric NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT servicio_pkey PRIMARY KEY (id),
  CONSTRAINT servicio_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenant(id)
);
CREATE TABLE public.tenant (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  nombre_negocio text NOT NULL,
  logo text,
  pin_admin text NOT NULL,
  configuracion jsonb DEFAULT '{}'::jsonb,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  booking_url text,
  suscripcion_vigente_hasta date,
  subdominio text NOT NULL UNIQUE,
  CONSTRAINT tenant_pkey PRIMARY KEY (id)
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