#!/usr/bin/env bash
# .github/scripts/backup-db.sh
# Lógica del backup diario de la base. Lo llama el workflow
# .github/workflows/backup-db.yml, que lo baja del propio repo (mismo commit) porque
# el workflow no usa actions/checkout. Plan completo: docs/plan_resguardo_db.md, fase 2.
#
# Subcomandos:
#   fecha            imprime la fecha de hoy en hora argentina (AAAA-MM-DD)
#   checkin ESTADO   avisa a Sentry Crons (in_progress | ok | error); nunca falla
#   dump             pg_dump de `public` cifrado con age, sin tocar el disco en claro
#   subir            sube el dump cifrado a B2 (diarios/ y, el día 1, mensuales/)
#
# Variables que espera (las pone el workflow): RUNNER_TEMP, AGE_CLAVE_PUBLICA,
# MONITOR_CRON, MONITOR_MARGEN_MIN, MONITOR_DURACION_MAX_MIN, CHECKIN_ID,
# FECHA_BACKUP y, según el subcomando, los secrets MONITOR_CHECKIN_URL,
# BACKUP_DB_URL, B2_ENDPOINT, B2_BUCKET y las credenciales AWS_* de B2.
#
# Los logs del workflow son públicos: ninguna función imprime URLs, hosts, usuarios,
# variables ni contenido del dump. Sin `set -x` en ningún lado.
#
# Para probar las funciones puras en local: `source .github/scripts/backup-db.sh`
# (el bloque final solo corre `main` cuando el archivo se ejecuta, no cuando se sourcea).

set -euo pipefail

readonly ZONA_ARGENTINA='America/Argentina/Buenos_Aires'
readonly PG_DUMP='/usr/lib/postgresql/17/bin/pg_dump'
readonly PG_VERSION_ESPERADA='17'

# Carpeta de trabajo del runner: acá quedan el script, la CA y el dump cifrado.
dir_trabajo() { printf '%s/backup\n' "${RUNNER_TEMP:?falta RUNNER_TEMP}"; }

# ---------------------------------------------------------------------------
# Funciones puras (no tocan servicios; se prueban en local)
# ---------------------------------------------------------------------------

# fecha_argentina
# Fecha de hoy en hora argentina. Es la que nombra el archivo del backup.
# Si el sistema no tiene la base de zonas horarias, `date` toma la zona como UTC
# sin avisar (pasa en Git Bash): por eso se confirma que el offset sea -0300 y, si
# no, se corta en vez de nombrar el archivo con otra fecha.
# Parámetros: ninguno.
# Retorna: imprime AAAA-MM-DD; sale con 1 si la zona no se resolvió.
fecha_argentina() {
  local fecha offset
  read -r fecha offset < <(TZ="$ZONA_ARGENTINA" date '+%F %z')
  if [[ "$offset" != '-0300' ]]; then
    echo "[backup-db] fecha_argentina — la zona $ZONA_ARGENTINA no se resolvió | offset: $offset" >&2
    return 1
  fi
  printf '%s\n' "$fecha"
}

# claves_destino FECHA
# Arma las keys de B2 donde va el backup de una fecha: siempre diarios/FECHA y,
# si es día 1, también mensuales/AAAA-MM (D5: cada prefijo tiene su retención).
# Parámetros: FECHA en formato AAAA-MM-DD.
# Retorna: imprime una key por línea; sale con 1 si la fecha no tiene el formato.
claves_destino() {
  local fecha="${1:-}"
  if [[ ! "$fecha" =~ ^([0-9]{4})-([0-9]{2})-([0-9]{2})$ ]]; then
    echo "[backup-db] claves_destino — fecha con formato inválido | fecha: $fecha" >&2
    return 1
  fi
  printf 'diarios/%s.dump.age\n' "$fecha"
  if [[ "${BASH_REMATCH[3]}" == "01" ]]; then
    printf 'mensuales/%s-%s.dump.age\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
  fi
}

# region_b2 ENDPOINT
# Saca la región del endpoint S3 de B2 (https://s3.<región>.backblazeb2.com), que la
# CLI de AWS necesita para firmar los pedidos.
# Parámetros: ENDPOINT, la URL del secret B2_ENDPOINT.
# Retorna: imprime la región; sale con 1 (sin mostrar el endpoint) si no tiene esa forma.
region_b2() {
  local endpoint="${1:-}"
  if [[ "$endpoint" =~ ^https://s3\.([a-z0-9-]+)\.backblazeb2\.com/?$ ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  else
    echo "[backup-db] region_b2 — B2_ENDPOINT no tiene la forma https://s3.<región>.backblazeb2.com" >&2
    return 1
  fi
}

# es_uuid VALOR
# Indica si un valor tiene forma de UUID (el check_in_id de Sentry).
# Parámetros: VALOR, el texto a validar.
# Retorna: código 0 si es un UUID, 1 si no.
es_uuid() {
  [[ "${1:-}" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]
}

# cuerpo_checkin ESTADO ID
# Arma el JSON del check-in de Sentry Crons. Siempre lleva el monitor_config, así
# el primer check-in crea el monitor y los siguientes lo mantienen igual a lo que
# dice el workflow (la configuración queda versionada acá, no en la web de Sentry).
# Parámetros: ESTADO (in_progress | ok | error) e ID (UUID del check-in; vacío = sin id).
# Retorna: imprime el JSON en una línea; sale con 1 si el estado o el id no son válidos.
cuerpo_checkin() {
  local estado="${1:-}" id="${2:-}"
  case "$estado" in
    in_progress | ok | error) ;;
    *) echo "[backup-db] cuerpo_checkin — estado inválido | estado: $estado" >&2; return 1 ;;
  esac
  if [[ -n "$id" ]] && ! es_uuid "$id"; then
    echo "[backup-db] cuerpo_checkin — check_in_id no es un UUID" >&2
    return 1
  fi
  local cron="${MONITOR_CRON:?falta MONITOR_CRON}"
  local margen="${MONITOR_MARGEN_MIN:?falta MONITOR_MARGEN_MIN}"
  local duracion="${MONITOR_DURACION_MAX_MIN:?falta MONITOR_DURACION_MAX_MIN}"
  local campo_id=''
  [[ -n "$id" ]] && campo_id="\"check_in_id\":\"$id\","
  printf '{%s"status":"%s","monitor_config":{"schedule":{"type":"crontab","value":"%s"},"checkin_margin":%s,"max_runtime":%s,"timezone":"UTC","failure_issue_threshold":1}}\n' \
    "$campo_id" "$estado" "$cron" "$margen" "$duracion"
}

# ---------------------------------------------------------------------------
# Funciones que tocan servicios (solo corren en el runner)
# ---------------------------------------------------------------------------

# enmascarar_conexion URL
# Le pide a GitHub que tape en el resto del log el usuario, la contraseña, el host y
# el project ref de la conexión. GitHub ya tapa el secret entero, pero no sus
# pedazos, y un error de pg_dump puede nombrar el host o el usuario
# ("password authentication failed for user ..."). La línea ::add-mask:: la consume
# el runner y no aparece en el log.
# Parámetros: URL, el valor de BACKUP_DB_URL (postgresql://usuario:clave@host:puerto/base).
# Retorna: nada; sale con 1 (sin mostrar la URL) si no empieza con postgresql://.
enmascarar_conexion() {
  local url="${1:-}"
  if [[ ! "$url" =~ ^postgres(ql)?://([^:@/]+):([^@/]+)@([^:/?]+) ]]; then
    echo "[backup-db] enmascarar_conexion — BACKUP_DB_URL no tiene la forma postgresql://usuario:contraseña@host:puerto/base" >&2
    return 1
  fi
  local usuario="${BASH_REMATCH[2]}" clave="${BASH_REMATCH[3]}" host="${BASH_REMATCH[4]}"
  local ref="${usuario#*.}"
  local valor
  for valor in "$usuario" "$clave" "$host" "$ref"; do
    # Un valor vacío o muy corto taparía letras sueltas en todo el log.
    if [[ ${#valor} -ge 6 ]]; then
      printf '::add-mask::%s\n' "$valor"
    fi
  done
}

# enviar_checkin ESTADO
# Avisa a Sentry Crons el estado de la corrida. Nunca corta el backup: si Sentry no
# responde, deja un ::warning:: y sigue (si el aviso de cierre se pierde, Sentry
# marca la corrida como fallida al pasar max_runtime, así que igual avisa).
# Manda POST con el JSON (lleva el monitor_config, ver cuerpo_checkin) y repite el
# check_in_id en la query: la doc de Sentry lo muestra como query param en los GET y
# el payload de check-in de los SDK lo lleva en el cuerpo, así vale en cualquiera
# de los dos.
# Parámetros: ESTADO (in_progress | ok | error). Lee MONITOR_CHECKIN_URL y CHECKIN_ID.
# Retorna: siempre 0.
enviar_checkin() {
  local estado="${1:-}" url="${MONITOR_CHECKIN_URL:-}" id="${CHECKIN_ID:-}"
  if [[ -z "$url" ]]; then
    echo "::warning::Check-in $estado no enviado: falta el secret MONITOR_CHECKIN_URL"
    return 0
  fi
  local cuerpo
  if ! cuerpo="$(cuerpo_checkin "$estado" "$id")"; then
    echo "::warning::Check-in $estado no enviado: no se pudo armar el cuerpo"
    return 0
  fi
  local destino="$url"
  [[ -n "$id" ]] && destino="${url}?check_in_id=${id}"
  # Sin -S ni -v: un error de curl nombra el host. Solo se muestra el código HTTP.
  local codigo
  if ! codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 --retry 2 \
      -X POST -H 'Content-Type: application/json' --data "$cuerpo" "$destino")"; then
    echo "::warning::Check-in $estado a Sentry falló (sin respuesta | http: ${codigo:-000}). El backup sigue."
    return 0
  fi
  if [[ "$codigo" != 2* ]]; then
    echo "::warning::Check-in $estado a Sentry rechazado (http: $codigo). El backup sigue."
    return 0
  fi
  echo "[backup-db] check-in enviado | estado: $estado | http: $codigo"
}

# hacer_dump
# Corre pg_dump del schema public con el rol de solo lectura y lo cifra con age en el
# mismo pipe: el dump en claro nunca se escribe en disco. Con pipefail, si falla
# pg_dump o age, falla el paso. Sin -v en pg_dump y sin --enable-row-security
# (el rol tiene BYPASSRLS, fase 1).
# Parámetros: ninguno. Lee BACKUP_DB_URL y AGE_CLAVE_PUBLICA.
# Retorna: deja <dir_trabajo>/backup.dump.age; sale con error si algo falla.
hacer_dump() {
  : "${BACKUP_DB_URL:?falta el secret BACKUP_DB_URL}"
  : "${AGE_CLAVE_PUBLICA:?falta AGE_CLAVE_PUBLICA}"
  local dir ca archivo
  dir="$(dir_trabajo)"
  ca="$dir/supabase-ca.crt"
  archivo="$dir/backup.dump.age"

  enmascarar_conexion "$BACKUP_DB_URL"

  # El runner puede traer otro pg_dump en el PATH: se usa el 17 por ruta completa.
  local version
  version="$("$PG_DUMP" --version)"
  if [[ ! "$version" =~ \(PostgreSQL\)\ ${PG_VERSION_ESPERADA}\. ]]; then
    echo "[backup-db] hacer_dump — pg_dump no es la versión $PG_VERSION_ESPERADA | versión: $version" >&2
    return 1
  fi
  if ! grep -q -- '-----BEGIN CERTIFICATE-----' "$ca"; then
    echo "[backup-db] hacer_dump — la CA de Supabase no es un certificado PEM" >&2
    return 1
  fi

  PGSSLMODE=verify-full PGSSLROOTCERT="$ca" PGCONNECT_TIMEOUT=30 PGAPPNAME=backup-db \
    "$PG_DUMP" --format=custom --schema=public --no-password --dbname="$BACKUP_DB_URL" \
    | age --recipient "$AGE_CLAVE_PUBLICA" --output "$archivo"

  # Chequeo de que lo que quedó es un archivo de age (y no, por ejemplo, vacío).
  if [[ "$(head -c 21 "$archivo")" != 'age-encryption.org/v1' ]]; then
    echo "[backup-db] hacer_dump — el archivo cifrado no tiene el encabezado de age" >&2
    return 1
  fi
  echo "[backup-db] dump cifrado listo | $version | tamaño: $(( $(stat -c %s "$archivo") / 1024 )) KB"
}

# subir_backup
# Sube el dump cifrado a B2 con `aws s3api put-object`: un solo pedido, sin
# multipart (que al cancelarse pediría deleteFiles, y la key no lo tiene, D4).
# La respuesta (un JSON con el ETag) va a /dev/null.
# Parámetros: ninguno. Lee FECHA_BACKUP, B2_ENDPOINT, B2_BUCKET y las AWS_* del workflow.
# Retorna: nada; sale con error si alguna subida falla.
subir_backup() {
  : "${B2_ENDPOINT:?falta el secret B2_ENDPOINT}"
  : "${B2_BUCKET:?falta el secret B2_BUCKET}"
  : "${AWS_ACCESS_KEY_ID:?falta el secret B2_KEY_ID}"
  : "${AWS_SECRET_ACCESS_KEY:?falta el secret B2_APP_KEY}"
  local archivo region claves clave
  archivo="$(dir_trabajo)/backup.dump.age"
  region="$(region_b2 "$B2_ENDPOINT")"
  claves="$(claves_destino "${FECHA_BACKUP:?falta FECHA_BACKUP}")"

  while IFS= read -r clave; do
    aws s3api put-object \
      --endpoint-url "$B2_ENDPOINT" \
      --region "$region" \
      --bucket "$B2_BUCKET" \
      --key "$clave" \
      --body "$archivo" \
      --content-type application/octet-stream \
      > /dev/null
    echo "[backup-db] subido | key: $clave"
  done <<< "$claves"
}

# main SUBCOMANDO [ARGS]
# Despacha el subcomando pedido por el workflow.
# Parámetros: SUBCOMANDO (fecha | checkin | dump | subir) y sus argumentos.
# Retorna: el código del subcomando; 2 si el subcomando no existe.
main() {
  case "${1:-}" in
    fecha) fecha_argentina ;;
    checkin) enviar_checkin "${2:-}" ;;
    dump) hacer_dump ;;
    subir) subir_backup ;;
    *) echo "[backup-db] uso: backup-db.sh fecha | checkin ESTADO | dump | subir" >&2; return 2 ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
