-- /.claude/skills/alta-cliente/plantilla_alta.sql
-- Alta de un tenant desde una solicitud del formulario (solicitud_alta.datos).
--
-- Una sola sentencia con CTEs: Postgres la ejecuta entera o nada, sin BEGIN/COMMIT.
-- Los datos del cliente se leen directo de la solicitud (no se copian ni se
-- escapan a mano); solo van a mano los parámetros del bloque `p`. No completar a
-- mano: armarQuery.mjs reemplaza los <MARCADORES> con los valores ya validados y
-- escapados.
--
-- Si la solicitud no está en 'enviada', no carga nada (la fila final sale con
-- tenant_id NULL). Si falta un PIN de barbero, falla entera (pin NOT NULL).
-- PINs y contraseña se hashean acá con pgcrypto (bcrypt $2a$10$, lo acepta el
-- bcrypt.compare de los logins: plan_alta_clientes.md D3).
WITH p AS (
  SELECT
    '<SOLICITUD_ID>'::uuid           AS solicitud_id,
    '<PIN_ADMIN>'::text              AS pin_admin,          -- 4 dígitos
    ARRAY[<PINES_BARBEROS>]::text[]  AS pines_barberos,     -- uno por barbero, en el orden de datos.barberos
    '<USUARIO_OPERATIVO>'::text      AS operativo_usuario,  -- 3+ caracteres
    '<PASSWORD_OPERATIVA>'::text     AS operativo_password, -- 8+ caracteres
    <VIGENTE_HASTA>                  AS vigente_hasta       -- fin de la suscripción (D9)
),
s AS (
  SELECT sa.id, sa.datos
  FROM solicitud_alta sa JOIN p ON sa.id = p.solicitud_id
  WHERE sa.estado = 'enviada'
),
-- WhatsApp argentino sin el 9 (+54 11 …) → con el 9 (+54 9 11 …), como pide wa.me.
wa AS (
  SELECT CASE
    WHEN w LIKE '+54%' AND w NOT LIKE '+549%' THEN '+549' || substr(w, 4)
    ELSE w
  END AS whatsapp
  FROM (SELECT s.datos->'local'->>'whatsapp' AS w FROM s) x
),
t AS (
  INSERT INTO tenant (
    nombre_negocio, subdominio, pin_admin, suscripcion_vigente_hasta,
    duracion_slot_minutos, operativo_usuario, operativo_password_hash,
    telefono, direccion, configuracion, booking_url, activo
  )
  SELECT
    s.datos->'local'->>'nombre',
    s.datos->'local'->>'subdominio',
    extensions.crypt(p.pin_admin, extensions.gen_salt('bf', 10)),
    p.vigente_hasta,
    (s.datos->'turno'->>'duracion_minutos')::int,
    p.operativo_usuario,
    extensions.crypt(p.operativo_password, extensions.gen_salt('bf', 10)),
    s.datos->'local'->>'telefono',
    s.datos->'local'->>'direccion',
    jsonb_strip_nulls(jsonb_build_object(
      'whatsapp', wa.whatsapp,
      'resena_url', s.datos->'local'->>'resena_url'
    )),
    -- El botón "Reservar" del panel abre el turnero propio del tenant.
    'https://' || (s.datos->'local'->>'subdominio') || '.barbermanager.app/turnos',
    true
  FROM s, p, wa
  RETURNING id
),
-- Horario del local: un rango por día abierto.
hl AS (
  SELECT (h->>'dia_semana')::smallint AS dia,
         (h->>'hora_inicio')::time   AS inicio,
         (h->>'hora_fin')::time      AS fin
  FROM s, jsonb_array_elements(s.datos->'local'->'horario') h
),
ins_hl AS (
  INSERT INTO tenant_horario_atencion (tenant_id, dia_semana, hora_inicio, hora_fin)
  SELECT t.id, hl.dia, hl.inicio, hl.fin FROM t, hl
  RETURNING id
),
-- Barberos de la solicitud, con su posición (para el PIN de pines_barberos).
bd AS (
  SELECT b.barbero, b.n
  FROM s, jsonb_array_elements(s.datos->'barberos') WITH ORDINALITY AS b(barbero, n)
),
ins_b AS (
  INSERT INTO barbero (tenant_id, nombre, pin, comision_valor, email)
  SELECT t.id,
         bd.barbero->>'nombre',
         extensions.crypt(p.pines_barberos[bd.n], extensions.gen_salt('bf', 10)),
         (bd.barbero->>'comision')::numeric,
         NULLIF(bd.barbero->>'email', '')
  FROM t, p, bd
  RETURNING id, nombre
),
-- Cada barbero insertado con sus datos (los nombres no se repiten: lo valida el envío).
b AS (
  SELECT ins_b.id, bd.barbero
  FROM ins_b JOIN bd ON bd.barbero->>'nombre' = ins_b.nombre
),
-- Pausa del mediodía (la misma para todos los días), si hay.
pausa AS (
  SELECT (s.datos->'local'->'pausa'->>'hora_inicio')::time AS inicio,
         (s.datos->'local'->'pausa'->>'hora_fin')::time    AS fin
  FROM s
),
-- Bloques de cada barbero: 'igual_local' = el horario del local partido por la
-- pausa (D11); un horario propio = sus bloques tal cual.
bloques AS (
  SELECT b.id AS barbero_id, hl.dia, hl.inicio, COALESCE(pausa.inicio, hl.fin) AS fin
  FROM b, hl, pausa
  WHERE b.barbero->'horario' = '"igual_local"'::jsonb
  UNION ALL
  SELECT b.id, hl.dia, pausa.fin, hl.fin
  FROM b, hl, pausa
  WHERE b.barbero->'horario' = '"igual_local"'::jsonb AND pausa.inicio IS NOT NULL
  UNION ALL
  SELECT b.id, (blk->>'dia_semana')::smallint, (blk->>'hora_inicio')::time, (blk->>'hora_fin')::time
  FROM b, jsonb_array_elements(b.barbero->'horario') blk
  WHERE jsonb_typeof(b.barbero->'horario') = 'array'
),
ins_bh AS (
  INSERT INTO barbero_horario (tenant_id, barbero_id, dia_semana, hora_inicio, hora_fin)
  SELECT t.id, bloques.barbero_id, bloques.dia, bloques.inicio, bloques.fin FROM t, bloques
  RETURNING id
),
-- Dueños: los barberos con es_duenio (vinculados a su barbero) y los que no cortan.
ins_socio AS (
  INSERT INTO socio (tenant_id, nombre, barbero_id)
  SELECT t.id, b.barbero->>'nombre', b.id FROM t, b
  WHERE (b.barbero->>'es_duenio')::boolean
  UNION ALL
  SELECT t.id, d->>'nombre', NULL::uuid
  FROM t, s, jsonb_array_elements(s.datos->'duenios_sin_corte') d
  RETURNING id
),
ins_serv AS (
  INSERT INTO servicio (tenant_id, nombre, precio, cantidad_slots)
  SELECT t.id, sv->>'nombre', (sv->>'precio')::numeric, (sv->>'cantidad_slots')::int
  FROM t, s, jsonb_array_elements(s.datos->'servicios') sv
  RETURNING id
),
ins_prod AS (
  INSERT INTO producto (tenant_id, nombre, precio, stock_actual, stock_minimo)
  SELECT t.id, pr->>'nombre', (pr->>'precio')::numeric, (pr->>'stock')::int, (pr->>'stock_minimo')::int
  FROM t, s, jsonb_array_elements(COALESCE(s.datos->'productos', '[]'::jsonb)) pr
  RETURNING id
),
-- Las 9 categorías de gasto de todos los tenants (CATEGORIAS_GASTO_BASE de crearTenant.js).
ins_cat AS (
  INSERT INTO categoria_gasto (tenant_id, nombre)
  SELECT t.id, c FROM t, unnest(ARRAY[
    'Alquiler', 'Comida y/o bebidas', 'Impuestos', 'Insumos', 'Limpieza',
    'Mantenimiento', 'Otros', 'Productos para venta', 'Servicios'
  ]) c
  RETURNING id
),
cargada AS (
  UPDATE solicitud_alta SET estado = 'cargada', updated_at = now()
  WHERE id = (SELECT solicitud_id FROM p) AND EXISTS (SELECT 1 FROM t)
  RETURNING id
)
SELECT
  (SELECT id FROM t)                AS tenant_id,
  (SELECT count(*) FROM ins_hl)     AS dias_local,
  (SELECT count(*) FROM ins_b)      AS barberos,
  (SELECT count(*) FROM ins_bh)     AS bloques_barberos,
  (SELECT count(*) FROM ins_socio)  AS socios,
  (SELECT count(*) FROM ins_serv)   AS servicios,
  (SELECT count(*) FROM ins_prod)   AS productos,
  (SELECT count(*) FROM ins_cat)    AS categorias,
  (SELECT count(*) FROM cargada)    AS solicitud_cargada;
