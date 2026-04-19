import json
from kafka import KafkaProducer
from app.config import KAFKA_BOOTSTRAP_SERVERS

producer = None


def get_producer():
    global producer
    if producer is None:
        producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            retries=5
        )
    return producer


def publish_message_sent(message_data: dict):
    try:
        get_producer().send("message.sent", message_data)
        get_producer().flush()
        print(f"Kafka: published message.sent -> {message_data}")
    except Exception as e:
        print(f"Kafka error: {e}")


def publish_dm_sent(message_data: dict):
    try:
        get_producer().send("dm.sent", message_data)
        get_producer().flush()
        print(f"Kafka: published dm.sent -> {message_data}")
    except Exception as e:
        print(f"Kafka error: {e}")