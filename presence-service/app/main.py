import threading
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.rest_router import router, redis_client
from app.config import KAFKA_BOOTSTRAP_SERVERS

app = FastAPI(title="Presence Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def start_kafka_consumer():
    def consume():
        try:
            from kafka import KafkaConsumer
            consumer = KafkaConsumer(
                "message.sent",
                "dm.sent",
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                group_id="presence-service-group",
                auto_offset_reset="earliest"
            )
            print("Presence Kafka consumer started")
            for msg in consumer:
                data = msg.value
                sender_id = data.get("sender_id")
                if sender_id:
                    redis_client.setex(f"presence:{sender_id}", 300, "online")
                    print(f"Presence updated: user {sender_id} is online")
        except Exception as e:
            print(f"Presence Kafka consumer error: {e}")

    thread = threading.Thread(target=consume, daemon=True)
    thread.start()


@app.on_event("startup")
def startup():
    start_kafka_consumer()


app.include_router(router)