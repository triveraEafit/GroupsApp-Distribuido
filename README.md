# GroupsApp Distribuido

Aplicación de mensajería instantánea construida con arquitectura de microservicios.

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo
- [Node.js](https://nodejs.org/) instalado
- Git instalado

## Cómo correr el proyecto

### 1. Clonar el repositorio

git clone https://github.com/triveraEafit/GroupsApp-Distribuido.git
cd GroupsApp-Distribuido

### 2. Levantar el backend completo

Desde la carpeta raíz del proyecto:

docker compose up --build

La primera vez tarda varios minutos porque descarga las imágenes de Docker.
Cuando veas "Application startup complete" en los logs, todo está listo.

### 3. Levantar el frontend

Abre una terminal nueva y ejecuta:

cd monolith/frontend
npm install
npm run dev

## URLs del sistema

| Servicio | URL | Descripción |
|---|---|---|
| Frontend | http://localhost:5173 | Interfaz de usuario |
| API Gateway | http://localhost:8080 | Punto de entrada único |
| Monolito | http://localhost:8000/docs | API principal |
| Auth Service | http://localhost:8001/docs | Registro y login |
| Messaging Service | http://localhost:8002/docs | Mensajería con Kafka |
| Presence Service | http://localhost:8003/docs | Estado online/offline |

## Arquitectura

El sistema está compuesto por los siguientes servicios:

- **Monolito**: contiene la lógica principal de grupos, chat y archivos
- **Auth Service**: maneja registro, login y validación de tokens JWT. Se comunica internamente via gRPC en el puerto 50051
- **Messaging Service**: recibe y persiste mensajes, publica eventos a Kafka
- **Presence Service**: rastrea usuarios online/offline usando Redis, consume eventos de Kafka
- **API Gateway**: nginx que enruta el tráfico al servicio correcto según la URL
- **Kafka**: broker de mensajes para comunicación asíncrona entre servicios
- **Redis**: almacenamiento en memoria para estado de presencia
- **PostgreSQL**: base de datos relacional, una por cada servicio

## Cómo agregar un nuevo microservicio

1. Crea una carpeta nueva en la raíz, por ejemplo `mi-servicio/`
2. Agrega `Dockerfile`, `requirements.txt` y la carpeta `app/` con el código
3. Agrega el servicio al `docker-compose.yml`
4. Si necesita base de datos propia, agrega un bloque `*-db-init` en el compose
5. Agrega la ruta correspondiente en `gateway/nginx.conf`
6. Ejecuta `docker compose up --build`

## Cómo detener el sistema

docker compose down

Para detener y eliminar todos los datos (bases de datos, volúmenes):

docker compose down -v

## Variables de entorno

Cada servicio lee sus variables del `docker-compose.yml`. Para producción
se recomienda usar un archivo `.env` separado y no hardcodear contraseñas.# GroupsApp-Distribuido