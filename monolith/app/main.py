from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.routers import users
from app.database import engine, Base
from app.routers import groups
from app.schema_bootstrap import ensure_compat_schema
from app.storage import storage_service
from app.coordination import coordination_service
from prometheus_fastapi_instrumentator import Instrumentator


ACCESS_TOKEN_EXPIRE_MINUTES = 60

app = FastAPI()
Instrumentator().instrument(app).expose(app)
app.include_router(groups.router)

# Create tables when the app starts
@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    ensure_compat_schema(engine)
    storage_service.ensure_bucket()

app.include_router(users.router)

@app.get("/")
def root():
    return {"message": "GroupsApp backend running"}


@app.get("/health")
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "error",
                "service": "monolith",
                "database": "unreachable",
                "error": str(exc),
            },
        ) from exc

    return {
        "status": "ok",
        "service": "monolith",
        "database": "reachable",
        "coordination_etcd": coordination_service.health(),
    }