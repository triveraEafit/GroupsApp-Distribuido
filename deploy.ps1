Write-Host "Construyendo imagenes Docker..." -ForegroundColor Cyan
docker compose build

Write-Host "Desplegando infraestructura..." -ForegroundColor Cyan
kubectl apply -f k8s/infrastructure/postgres.yml
kubectl apply -f k8s/infrastructure/redis.yml
kubectl apply -f k8s/infrastructure/etcd.yml
kubectl apply -f k8s/infrastructure/zookeeper.yml
kubectl apply -f k8s/infrastructure/kafka.yml

Write-Host "Esperando que postgres este listo..." -ForegroundColor Yellow
kubectl wait --for=condition=ready pod -l app=postgres --timeout=120s

Write-Host "Inicializando bases de datos..." -ForegroundColor Cyan
kubectl apply -f k8s/infrastructure/db-init.yml
kubectl wait --for=condition=complete job/db-init --timeout=60s

Write-Host "Desplegando servicios..." -ForegroundColor Cyan
kubectl apply -f k8s/services/monolith.yml
kubectl apply -f k8s/services/auth-service.yml
kubectl apply -f k8s/services/messaging-service.yml
kubectl apply -f k8s/services/presence-service.yml

Write-Host "Desplegando gateway..." -ForegroundColor Cyan
kubectl apply -f k8s/gateway/nginx-ingress.yml

Write-Host "Estado del cluster:" -ForegroundColor Green
kubectl get pods
kubectl get services
kubectl get hpa
