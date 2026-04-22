# GroupsApp Distribuido

Aplicación de mensajería instantánea construida con arquitectura de microservicios, desplegada en Kubernetes.

## Arquitectura

El sistema está compuesto por los siguientes servicios:

- **Frontend** (React/Vite) en puerto 5173
- **API Gateway** (nginx) en puerto 8090
- **Monolith** en puerto 8000
- **Auth Service** en puerto 8001 con gRPC en puerto 50051
- **Messaging Service** en puerto 8002
- **Presence Service** en puerto 8003
- **PostgreSQL** con 3 bases de datos separadas
- **Redis** para presencia y caché
- **Kafka** para eventos asíncronos
- **Prometheus** en puerto 9090 para métricas
- **Grafana** en puerto 3000 para dashboards

## Checklist de requerimientos

### Funcionales
- [x] Registro y autenticación de usuarios
- [x] Creación y gestión de grupos
- [x] Mensajería grupal en tiempo real (WebSocket)
- [x] Mensajería directa 1-1
- [x] Persistencia e historial de mensajes
- [x] Estado de presencia online/offline (Redis)
- [x] Envío y recepción de archivos en DMs
- [ ] Roles de administrador en grupos
- [ ] Subida de archivos en grupos

### No Funcionales
- [x] Mínimo 3 microservicios (tenemos 4)
- [x] API REST (todos los servicios)
- [x] gRPC (Auth Service, puerto 50051)
- [x] Kafka/MOM (Messaging + Presence Service)
- [x] Bases de datos distribuidas (una por servicio)
- [x] API Gateway con balanceador de carga (nginx)
- [x] Kubernetes (Docker Desktop)
- [x] Autoescalado HPA (messaging x5, presence x3)
- [x] Alta disponibilidad
- [x] Prometheus (métricas)
- [x] Grafana (dashboards)
- [ ] Despliegue en AWS EKS
- [ ] Servicio de coordinación (etcd/Consul)

## Requisitos previos

- Docker Desktop instalado, abierto y con Kubernetes habilitado
- Node.js instalado
- Git instalado

## Cómo correr el proyecto

### 1. Clonar el repositorio

    git clone https://github.com/triveraEafit/GroupsApp-Distribuido.git
    cd GroupsApp-Distribuido

### 2. Desplegar el backend en Kubernetes

    .\deploy.ps1

Espera hasta que todos los pods estén en estado Running:

    kubectl get pods

### 3. Abrir los puertos (4 terminales separadas)

Terminal 1 — Gateway:

    kubectl port-forward service/gateway 8090:8080 --address 0.0.0.0

Terminal 2 — Grafana:

    kubectl port-forward service/grafana 3000:3000

Terminal 3 — Prometheus:

    kubectl port-forward service/prometheus 9090:9090

Terminal 4 — Frontend:

    cd monolith\frontend
    npm install
    npm run dev

### 4. Abrir en el navegador

| Servicio | URL | Credenciales |
|---|---|---|
| App | http://localhost:5173 | - |
| Grafana | http://localhost:3000 | admin / admin123 |
| Prometheus | http://localhost:9090 | - |

## URLs de los servicios

| Servicio | URL |
|---|---|
| Monolito | http://localhost:8000/docs |
| Auth Service | http://localhost:8001/docs |
| Messaging Service | http://localhost:8002/docs |
| Presence Service | http://localhost:8003/docs |

## Comunicaciones entre servicios

| Tipo | Usado en |
|---|---|
| REST | Todos los servicios (externo) |
| gRPC | Auth Service puerto 50051 (interno) |
| Kafka | Messaging a Presence (eventos async) |
| WebSocket | Monolito a Frontend (chat tiempo real) |

## Autoescalado

El HPA (Horizontal Pod Autoscaler) está configurado:

    kubectl get hpa

| Servicio | Mínimo | Máximo | Trigger |
|---|---|---|---|
| Messaging Service | 1 pod | 5 pods | CPU mayor 50% |
| Presence Service | 1 pod | 3 pods | CPU mayor 50% |

## Cómo actualizar el repositorio

    git add .
    git commit -m "descripcion del cambio"
    git push

## Cómo obtener los últimos cambios

    git pull
    .\deploy.ps1

## Detener el sistema

    kubectl delete -f k8s/