# GroupsApp Distribuido

Aplicacion de mensajeria instantanea con arquitectura distribuida para el proyecto academico de Topicos de Telematica.

## Stack

- Frontend: React + Vite + Tailwind
- Auth: FastAPI + JWT + gRPC
- Messaging: FastAPI + Kafka
- Presence: FastAPI + Redis + Kafka
- Core groups/chat: Monolith service (FastAPI)
- Gateway: Nginx
- Data: PostgreSQL
- Blob storage: MinIO (S3 compatible)
- Coordinacion distribuida: etcd

## Levantar el proyecto en local

### 1) Clonar

```bash
git clone https://github.com/triveraEafit/GroupsApp-Distribuido.git
cd GroupsApp-Distribuido
```

### 2) Backend completo con Docker

```bash
docker compose up -d --build
```

Si hay cambios grandes o inconsistencias de servicios:

```bash
docker compose down
docker compose up -d --build
```

### 3) Frontend (Vite)

```bash
cd monolith/frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173 --force
```

## URLs principales

- Frontend: `http://localhost:5173`
- Gateway: `http://localhost:8080`
- Monolith docs: `http://localhost:8000/docs`
- Auth docs: `http://localhost:8001/docs`
- Messaging docs: `http://localhost:8002/docs`
- Presence docs: `http://localhost:8003/docs`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- etcd: `http://localhost:2379`

## Funcionalidad implementada

### Backend distribuido

- WebSocket grupal y DM funcionando por gateway (`/groups/ws/...` y `/groups/dm/ws/...`).
- Recibos de DM en tiempo real (`delivered` y `read`) con persistencia.
- Gobernanza de grupos:
  - modos de suscripcion (`open`, `approval`, `invite_only`)
  - roles (`admin`, `moderator`, `member`)
  - estados de membresia (`pending`, `active`, `rejected`, `left`, `banned`)
  - endpoints de aprobacion, promocion, democion, salida y remocion
  - contactos por grupo (`GET/POST/DELETE /groups/{group_id}/contacts`)
- Adjuntos distribuidos:
  - metadata en DB + blob en MinIO
  - descarga servida por backend (sin redireccion a hostname interno de Docker)
- Coordinacion con etcd:
  - health de etcd expuesto en `GET /health` del monolith
  - lock best-effort para operaciones concurrentes de ingreso a grupos
- Bootstrap de esquema para compatibilidad de DB existente.

### Frontend UI/UX

- Vista de chat redisenada tipo app comercial:
  - sidebar unificado (groups + direct)
  - busqueda en tiempo real
  - preview del ultimo mensaje + hora
  - chips por fecha (`Hoy`, `Ayer`)
  - avatares y badges de no leidos
  - doble check visual para DM
  - mejoras de scroll (abre al final de la conversacion)
  - mejoras mobile (lista/chat por panel)
- Navbar y layout principal refinados.
- Auth (login/register) redisenado:
  - tabs, labels flotantes, password visibility toggle
  - feedback visual de validaciones
  - indicador de fortaleza de password
- Dashboard de grupos redisenado:
  - cards de crear/unirse
  - lista de grupos con acciones compactas y responsive
  - empty states y busqueda mejorada

## Servicios en docker-compose

- `postgres`
- `postgres-init`
- `messaging-db-init`
- `redis`
- `minio`
- `etcd`
- `zookeeper`
- `kafka`
- `monolith`
- `auth-service`
- `messaging-service`
- `presence-service`
- `gateway`

## Apagar entorno

```bash
docker compose down
```

Para eliminar volumenes y datos:

```bash
docker compose down -v
```

## Nota para el equipo

Si en frontend aparece una version vieja en browser, reiniciar Vite con `--force`.
Si Kafka falla por estado previo en Zookeeper, recrear ambos contenedores (`zookeeper` y `kafka`) y volver a levantar dependencias.