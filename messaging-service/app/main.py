from fastapi import FastAPI
from app.database import Base, engine
from app.rest_router import router
from app.kafka_consumer import start_consumer

app = FastAPI(title="Messaging Service")


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    start_consumer()


app.include_router(router)