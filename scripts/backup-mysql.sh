#!/bin/bash
# Ubuntu + MySQL 8.4 en el contenedor nanipadel-mysql.
# Uso: sudo bash backup-mysql.sh [base] [--prune]
# Sin --prune no se elimina ninguna copia anterior.
# No ejecutar migraciones ni otros cambios de estructura durante el dump.
set +x
set -Eeuo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 077

BACKUP_DIR=/srv/backups/mysql
CONTAINER=nanipadel-mysql
DATABASE=${1:-escuela_nani_padel_v2}
PRUNE=${2:-}

case "$DATABASE" in
    escuela_nani_padel_v2|nanipadel_schema_test_v2) ;;
    *) printf 'ERROR: base no permitida.\n' >&2; exit 64 ;;
esac
if (( $# > 2 )) || [[ -n "$PRUNE" && "$PRUNE" != --prune ]]; then
    printf 'Uso: %s [base] [--prune]\n' "$0" >&2
    exit 64
fi

for tool in docker gzip sha256sum flock mktemp stat find date tee grep touch chmod cp rm rmdir mv; do
    command -v "$tool" >/dev/null || {
        printf 'ERROR: falta la herramienta %s.\n' "$tool" >&2
        exit 69
    }
done
if [[ ! -d "$BACKUP_DIR" || -L "$BACKUP_DIR" ]]; then
    printf 'ERROR: la carpeta de backups no existe o es un enlace.\n' >&2
    exit 73
fi
if [[ $(stat -c %a "$BACKUP_DIR") != 700 ]]; then
    printf 'ERROR: /srv/backups/mysql debe tener permisos 700.\n' >&2
    exit 73
fi
if (( EUID != 0 )) && [[ $(stat -c %u "$BACKUP_DIR") != "$EUID" ]]; then
    printf 'ERROR: ejecuta el script como propietario de la carpeta o con sudo.\n' >&2
    exit 77
fi

LOG="$BACKUP_DIR/backup.log"
for file in "$LOG" "$BACKUP_DIR/.backup-mysql.lock" "$BACKUP_DIR/last-error.log"; do
    if [[ -L "$file" || ( -e "$file" && ! -f "$file" ) ]]; then
        printf 'ERROR: archivo de control no válido.\n' >&2
        exit 73
    fi
done
exec 9>"$BACKUP_DIR/.backup-mysql.lock"
if ! flock -n 9; then
    printf 'ERROR: ya hay otra copia en ejecución.\n' >&2
    exit 75
fi
touch "$LOG"
chmod 600 "$LOG" "$BACKUP_DIR/.backup-mysql.lock"

log() {
    printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$LOG"
}

stage=
expired=
phase=preparacion
cleanup() {
    local rc=$?
    trap - EXIT
    if (( rc != 0 )); then
        if [[ -n "$stage" && -f "$stage/diagnostics.log" ]]; then
            cp -- "$stage/diagnostics.log" "$BACKUP_DIR/last-error.log" || :
            chmod 600 "$BACKUP_DIR/last-error.log" || :
        fi
        log "ERROR base=$DATABASE fase=$phase codigo=$rc" >&2 || :
    fi
    if [[ -n "$stage" && -d "$stage" ]]; then
        rm -f -- "$stage/dump.sql.gz" "$stage/dump.sql.gz.sha256" \
            "$stage/metadata.txt" "$stage/diagnostics.log" || :
        rmdir -- "$stage" || :
    fi
    if [[ -n "$expired" && -f "$expired" ]]; then
        rm -f -- "$expired" || :
    fi
    exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

log "INICIO base=$DATABASE contenedor=$CONTAINER"
stage=$(mktemp -d "$BACKUP_DIR/.tmp-${DATABASE}.XXXXXXXX")
stamp=$(date -u +%Y%m%dT%H%M%SZ)
suffix=${stage##*.}
final="$BACKUP_DIR/${DATABASE}_${stamp}_${suffix}"

phase=dump
# El secreto se toma del entorno ya configurado en Docker, no se muestra ni se
# pasa como argumento. No se ejecuta el .env del proyecto como código shell.
{
    docker exec -i --user 0 "$CONTAINER" /bin/bash -s -- "$DATABASE" <<'MYSQL_BACKUP' | gzip -n >"$stage/dump.sql.gz"
set +x
set -Eeuo pipefail
umask 077
database=$1
private=$(mktemp -d /dev/shm/nanipadel-backup.XXXXXXXX)
clean_credentials() {
    rm -f -- "$private/client.cnf"
    rmdir -- "$private"
}
trap clean_credentials EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ -n ${MYSQL_ROOT_PASSWORD:-} && -n ${MYSQL_ROOT_PASSWORD_FILE:-} ]]; then
    printf 'ERROR: hay dos fuentes de credenciales root.\n' >&2
    exit 78
elif [[ -n ${MYSQL_ROOT_PASSWORD:-} ]]; then
    password=$MYSQL_ROOT_PASSWORD
elif [[ -n ${MYSQL_ROOT_PASSWORD_FILE:-} && -r "$MYSQL_ROOT_PASSWORD_FILE" ]]; then
    password=$(<"$MYSQL_ROOT_PASSWORD_FILE")
else
    printf 'ERROR: Docker no tiene MYSQL_ROOT_PASSWORD ni un secreto root legible.\n' >&2
    exit 78
fi
[[ -n "$password" ]] || { printf 'ERROR: contraseña vacía.\n' >&2; exit 78; }
# Evita introducir líneas u opciones nuevas en client.cnf.
if [[ "$password" == *$'\n'* || "$password" == *$'\r'* ]]; then
    printf 'ERROR: formato de credencial no admitido.\n' >&2
    exit 78
fi
password=${password//\\/\\\\}
password=${password//\"/\\\"}
builtin printf '[client]\nuser=root\npassword="%s"\nprotocol=socket\n' "$password" >"$private/client.cnf"
unset password MYSQL_ROOT_PASSWORD MYSQL_ROOT_PASSWORD_FILE MYSQL_PWD

client=(mysql --defaults-file="$private/client.cnf" --no-login-paths
    --batch --skip-column-names --database="$database")
non_innodb=$("${client[@]}" --execute="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND (engine IS NULL OR engine <> 'InnoDB')")
if [[ "$non_innodb" != 0 ]]; then
    printf 'ERROR: se necesita revisar el motor de las tablas antes del backup.\n' >&2
    exit 65
fi
tables=$("${client[@]}" --execute="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'")
printf 'INFO: base=%s tablas=%s\n' "$database" "$tables" >&2

mysqldump --defaults-file="$private/client.cnf" --no-login-paths \
    --single-transaction --quick --skip-lock-tables \
    --routines --events --triggers --hex-blob \
    --no-tablespaces --set-gtid-purged=OFF \
    --default-character-set=utf8mb4 --column-statistics=0 \
    "$database"
MYSQL_BACKUP
} 2>"$stage/diagnostics.log"

phase=verificacion
[[ -s "$stage/dump.sql.gz" ]]
gzip -t "$stage/dump.sql.gz" 2>>"$stage/diagnostics.log"
(
    cd "$stage"
    sha256sum dump.sql.gz > dump.sql.gz.sha256
    sha256sum --check --status dump.sql.gz.sha256
)
bytes=$(stat -c %s "$stage/dump.sql.gz")
builtin printf 'format=nanipadel-mysql-v1\ndatabase=%s\ncontainer=%s\ncreated_utc=%s\nbytes=%s\n' \
    "$DATABASE" "$CONTAINER" "$stamp" "$bytes" >"$stage/metadata.txt"
chmod 600 "$stage/"*

phase=publicacion
# Todos los archivos aparecen juntos, una vez comprobados, en el mismo disco.
mv -T -- "$stage" "$final"
stage=
log "COPIA_OK base=$DATABASE bytes=$bytes ruta=$final"

phase=retencion
if [[ "$PRUNE" == --prune ]]; then
    # Solo carpetas de este script, de esta base y con más de 14 días.
    # La copia nueva ya está publicada antes de borrar ninguna anterior.
    expired=$(mktemp "$BACKUP_DIR/.retention.XXXXXXXX")
    if ! find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d \
        -name "${DATABASE}_[0-9]*Z_????????" -mmin +20160 -print0 >"$expired"; then
        rm -f -- "$expired"
        exit 74
    fi
    while IFS= read -r -d '' old; do
        [[ "$old" != "$final" && ! -L "$old" ]] || continue
        [[ -f "$old/metadata.txt" && ! -L "$old/metadata.txt" ]] || continue
        grep -qx 'format=nanipadel-mysql-v1' "$old/metadata.txt" || continue
        grep -qx "database=$DATABASE" "$old/metadata.txt" || continue
        rm -f -- "$old/dump.sql.gz" "$old/dump.sql.gz.sha256" \
            "$old/metadata.txt" "$old/diagnostics.log"
        rmdir -- "$old"
        log "RETENCION eliminado=${old##*/}"
    done <"$expired"
    rm -f -- "$expired"
    expired=
else
    log 'RETENCION omitida; solo se aplica al indicar --prune'
fi
phase=fin
log "FIN_OK base=$DATABASE"
