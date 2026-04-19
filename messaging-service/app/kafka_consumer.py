import json
import threading
from kafka import KafkaConsumer
from app.config import KAFKA_BOOTSTRAP_SERVERS


def handle_message_sent(data: dict):
    print(f"[Consumer] message.sent received: {data}")


def handle_dm_sent(data: dict):
    print(f"[Consumer] dm.sent received: {data}")


def start_consumer():
    def consume():
        try:
            consumer = KafkaConsumer(
                "message.sent",
                "dm.sent",
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                group_id="messaging-service-group",
                auto_offset_reset="earliest"
            )
            print("Kafka consumer started")
            for msg in consumer:
                if msg.topic == "message.sent":
                    handle_message_sent(msg.value)
                elif msg.topic == "dm.sent":
                    handle_dm_sent(msg.value)
        except Exception as e:
            print(f"Kafka consumer error: {e}")

    thread = threading.Thread(target=consume, daemon=True)
    thread.start()