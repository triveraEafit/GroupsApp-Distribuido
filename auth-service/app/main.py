import threading
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.rest_router import router
from app.grpc_server import serve

app = FastAPI(title="Auth Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    grpc_thread = threading.Thread(target=serve, daemon=True)
    grpc_thread.start()

app.include_router(router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "auth"}