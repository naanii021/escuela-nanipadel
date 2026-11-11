# Clases compartidas (varios profesores por grupo)

Un grupo puede tener hasta 4 profesores. Todos ven el grupo, pasan lista, cancelan y reabren
clases, y ven sus alumnos y recuperaciones. El coordinador (admin) lo ve todo. Un profesor que no
está en el grupo recibe 403.

## Antes y después de la migración

La tabla `grupo_profesores` es opcional (`backend/sql/2026-11-12_grupo_profesores.sql`).

| | Sin la tabla | Con la tabla |
|---|---|---|
| Quién pertenece al grupo | solo `grupos.profesor_id` | `grupos.profesor_id` **o** estar en `grupo_profesores` |
| Asignar `profesores_ids` con 2 o más | 409 «Para asignar varios profesores hay que aplicar antes la migración grupo_profesores» | guarda y sincroniza la tabla |
| Asignar `profesores_ids` con 1 | funciona (solo `profesor_id`) | funciona |
| API de grupos | `profesores`, `profesores_ids`, `compartido: false` con el principal | igual, con todos |

El código detecta la tabla una vez por proceso: **reinicia el backend y el bot de Telegram** tras
aplicar la migración.

## Aplicar la migración (la ejecuta el dueño a mano)

```bash
scripts/backup-mysql.sh      # copia de seguridad antes
docker exec -i nanipadel-mysql mysql -u root -p escuela_nani_padel_v2 < backend/sql/2026-11-12_grupo_profesores.sql
```

Después, desde la web (admin), asigna los profesores del grupo; o a mano con
`INSERT IGNORE INTO grupo_profesores (grupo_id, profesor_id) VALUES (...)`.

## API

- `grupos` (control/grupos, `/resumen`, `grupo` de control/sesiones): añaden `profesores`
  (`[{id, nombre, apellidos}]`, el principal primero), `profesores_ids` y `compartido`. Se mantienen
  `profesor_id` (principal) y `profesor` (nombres unidos con « y »).
- `POST/PUT /api/gestion/grupos` (admin): `profesores_ids: number[]` (máx. 4, sin duplicados,
  existentes y activos). `grupos.profesor_id` pasa a ser el primero.
- `sesion.ultimo_cambio` (GET de sesiones y al guardar/cancelar/reabrir):
  `{ profesor_id, profesor, en, hay_asistencia, estado, resumen: {presente, falta, justificada} }`.
- `base_cambio` (el `en` visto por el cliente) en guardar, asistencia, cancelar y reabrir. Si el
  grupo es compartido y otro profesor guardó después, responde 409
  `{ ok:false, conflicto:true, message, ultimo_cambio }` sin escribir. Para «no he visto nada
  todavía» (aún no había sesión) se puede mandar `1970-01-01T00:00:00.000Z`.

## Probar

```bash
cd backend && JWT_SECRET=x npm test
```

Los tests usan BD simulada (`tests/grupos-compartidos*.test.js`, `tests/helpers/grupo-profesores.js`).
Prueba manual tras migrar: entra como Dani y como Juanjo, comprueba que ambos ven el grupo; pasa
lista con uno y abre la clase con el otro (aviso de cambios).
