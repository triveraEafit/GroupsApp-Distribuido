from fastapi import FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.database import Base, engine
from app.rest_router import router
from app.kafka_consumer import start_consumer

app = FastAPI(title="Messaging Service")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    start_consumer()


app.include_router(router)


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
                "service": "messaging",
                "database": "unreachable",
                "error": str(exc),
            },
        ) from exc

    return {"status": "ok", "service": "messaging", "database": "reachable"}