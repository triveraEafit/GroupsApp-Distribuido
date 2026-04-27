# GroupsApp Distribuido

Aplicacion de mensajeria instantanea tipo WhatsApp/Telegram construida sobre una arquitectura hibrida: un `monolith` funcional con frontend React/Vite y varios servicios distribuidos de apoyo (`auth-service`, `messaging-service`, `presence-service`) mas `gateway`, Kafka, Redis, PostgreSQL y almacenamiento de archivos.


## Estado actual

### Funcionalidades listas

- Registro e inicio de sesion de usuarios
- Chat grupal y chat directo
- Historial persistente de mensajes
- Envio y recepcion de archivos en grupos y DMs
- Estados de entrega y lectura en grupos y DMs
- Presencia online/offline
- Creacion y administracion de grupos
- Roles de grupo (`admin`, `moderator`, `member`)
- Solicitudes de ingreso y aprobacion/rechazo
- Contactos visibles dentro de los grupos
- Canales/subgrupos dentro de los grupos
- Busqueda en la conversacion activa
- Vista de chat mejorada para desktop y mobile
- Tema claro/oscuro y seccion base de `Settings`

### Distribucion e infraestructura ya implementada

- API REST
- gRPC en `auth-service`
- Kafka como MOM/event bus
- Redis para presencia/cache
- API Gateway con Nginx
- Coordinacion distribuida con `etcd`
- Particionamiento logico visible por grupo/canal
- Manifests de Kubernetes
- HPA para algunos servicios
- Metricas Prometheus expuestas en FastAPI


## Arquitectura

Servicios del repositorio:

- `monolith`: backend principal y WebSockets del chat
- `monolith/frontend`: cliente React/Vite
- `auth-service`: autenticacion y gRPC
- `messaging-service`: servicio de mensajeria desacoplado
- `presence-service`: presencia y eventos
- `gateway`: entrada unificada por Nginx
- `postgres`: persistencia
- `redis`: presencia/cache
- `kafka` + `zookeeper`: eventos asincronos
- `etcd`: coordinacion distribuida
- `minio`: almacenamiento de archivos

Nota importante: aunque existen varios microservicios, el estado actual sigue siendo hibrido. El frontend todavia consume buena parte del flujo principal a traves del `monolith`.

## Checklist frente al PDF

### Funcionales

- [x] Registro y autenticacion de usuarios
- [x] Creacion y gestion de grupos
- [x] Todo grupo tiene al menos un administrador
- [x] Opciones base de suscripcion al grupo
- [x] Creacion y gestion de contactos de mis grupos
- [x] Mensajeria grupal 1-n
- [x] Mensajeria persona a persona 1-1
- [x] Persistencia e historial de mensajes
- [x] Presencia y lectura
- [x] Envio y recepcion de archivos
- [x] Visualizacion/descarga de archivos enviados
- [x] Canales o subgrupos
- [ ] Otros extras multimedia del enunciado opcional

### No funcionales

- [x] Minimo 3 microservicios
- [x] API REST para operaciones externas
- [x] gRPC para comunicacion interna
- [x] MOM con Kafka
- [x] Datos distribuidos
- [x] Replicacion/particionamiento demostrable
- [x] Servicio de coordinacion
- [x] Despliegue real en AWS
- [x] Ingress/gateway con balanceo
- [x] Autoescalado y HA a nivel de manifests
- [x] Logs y metricas basicas

## Ejecucion local

### Opcion recomendada: Docker Compose + frontend

Backend e infraestructura:

```bash
docker compose up -d
```

Frontend:

```bash
cd monolith/frontend
npm install
npm run dev
```

### URLs locales

- App frontend: `http://localhost:5173`
- Gateway/API: `http://localhost:8080`
- Monolith docs: `http://localhost:8000/docs`
- Auth docs: `http://localhost:8001/docs`
- Messaging docs: `http://localhost:8002/docs`
- Presence docs: `http://localhost:8003/docs`
- MinIO Console: `http://localhost:9001`
- etcd: `http://localhost:2379`

## Kubernetes

El repositorio incluye manifests en `k8s/` y un `deploy.ps1` para levantar la infraestructura en un cluster local. Esa ruta sirve para la demostracion tecnica de K8s, HPAs y observabilidad, pero no reemplaza el pendiente de despliegue real en AWS.

## Desarrollo

### Frontend

```bash
cd monolith/frontend
npm install
npm run dev
npm run build
```

### Backend monolith

```bash
python3 -m compileall monolith/app
```

## Repositorio

Para traer la ultima version:

```bash
git pull
```

Para apagar el entorno local con Compose:

```bash
docker compose down
```
