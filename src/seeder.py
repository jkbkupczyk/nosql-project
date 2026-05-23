from faker import Faker
from random import choice, randint, uniform, random
from datetime import datetime, timedelta
import json
import uuid
from typing import TextIO

EVENT_TYPE_KEY = "eventType"
EVENT_PAYLOAD_KEY = "payload"

pl_faker = Faker(locale="pl")
generic_faker = Faker()

def base_event(timestamp):
    return {
        "eventId": str(uuid.uuid4()),
        "eventTimestamp": timestamp.isoformat()
    }

def random_date() -> datetime:
    return datetime.now() - timedelta(
        days=randint(0, 180),
        hours=randint(1, 24),
        minutes=randint(1, 60),
        seconds=randint(1, 60),
        milliseconds=randint(0, 999)
    )

def random_amount(min_value = 10, max_value = 10000) -> float:
    return round(uniform(min_value, max_value), 2)

def random_full_name(generator) -> str:
    return generator.first_name() + " " + generator.last_name()

EVENT_IB_INIT = "IB_INIT"
EVENT_IB_INPROGRESS = "IB_INPROGRESS"
EVENT_IB_PROCESSED = "IB_PROCESSED"
EVENT_IB_REJECTED = "IB_REJECTED"

INTERBANK_EVENTS = [
    EVENT_IB_INIT, EVENT_IB_INPROGRESS, EVENT_IB_PROCESSED, EVENT_IB_REJECTED
]

INTERBANK_REJECT_REASONS = [
    "Brak środków",
    "Rachunek zamknięty",
    "Błąd"
]

def generate_interbank_event():
    random_timestamp = random_date()
    message_id = randint(1, 999_999_999)
    all_events = []

    init_event = base_event(random_timestamp)
    init_event[EVENT_TYPE_KEY] = EVENT_IB_INIT
    init_event[EVENT_PAYLOAD_KEY] = {
        "message_id": message_id,
        "creditor_account": pl_faker.iban(),
        "creditor_name": (random_full_name(pl_faker) + " " + pl_faker.address())[:140],
        "debtor_account": pl_faker.iban(),
        "debtor_name": (random_full_name(pl_faker) + " " + pl_faker.address())[:140],
        "amount": random_amount(),
        "currency": "PLN",
        "title": pl_faker.sentence(nb_words=10)[:140],
        "timestamp": (random_timestamp - timedelta(milliseconds=randint(0, 30000))).isoformat()
    }
    all_events.append(init_event)

    event_datetime = random_timestamp + timedelta(milliseconds=randint(10, 250))
    inprogress_event = base_event(event_datetime)
    inprogress_event[EVENT_TYPE_KEY] = EVENT_IB_INPROGRESS
    inprogress_event[EVENT_PAYLOAD_KEY] = {
        "message_id": message_id,
        "status": "IN_PROGRESS"
    }
    all_events.append(inprogress_event)

    chance = random()
    if chance < 0.7:
        event_datetime = random_timestamp + timedelta(hours=randint(1, 6), seconds=randint(1, 59))
        processed_event = base_event(event_datetime)
        processed_event[EVENT_TYPE_KEY] = EVENT_IB_PROCESSED
        processed_event[EVENT_PAYLOAD_KEY] = {
            "message_id": message_id,
            "status": "PROCESSED",
            "session_date": str(random_timestamp.date()),
            "session_number": choice([1, 2, 3]),
        }
        all_events.append(processed_event)
    else:
        event_datetime = random_timestamp + timedelta(hours=randint(1, 12), seconds=randint(1, 30))
        rejected_event = base_event(event_datetime)
        rejected_event[EVENT_TYPE_KEY] = EVENT_IB_REJECTED
        rejected_event[EVENT_PAYLOAD_KEY] = {
            "message_id": message_id,
            "status": "REJECTED",
            "error": "ERR_" + str(randint(1, 10)),
            "cause": choice(INTERBANK_REJECT_REASONS)
        }
        all_events.append(rejected_event)

    return all_events

EVENT_SWIFT_CREATED = "SWIFT_CREATED"
EVENT_SWIFT_PROCESSED = "SWIFT_PROCESSED"
EVENT_SWIFT_REJECTED = "SWIFT_REJECTED"

SWIFT_EVENTS = [
    EVENT_SWIFT_CREATED, EVENT_SWIFT_PROCESSED, EVENT_SWIFT_REJECTED
]

def generate_swift_event():
    random_timestamp = random_date()
    message_id = str(uuid.uuid4())
    all_events = []

    init_event = base_event(random_timestamp)
    init_event[EVENT_TYPE_KEY] = EVENT_SWIFT_CREATED
    init_event[EVENT_PAYLOAD_KEY] = {
        "id": message_id,
        "creditorAccount": {
            "value": generic_faker.iban(),
            "type": "IBAN"
        },
        "creditorParty": {
            "name": random_full_name(generic_faker),
            "address": generic_faker.address()
        },
        "creditorAgent": generic_faker.swift11(),
        "debtorAccount": {
            "value": generic_faker.iban(),
            "type": "IBAN"
        },
        "debtorParty": {
            "name": random_full_name(generic_faker),
            "address": generic_faker.address()
        },
        "debtorAgent": generic_faker.swift11(),
        "amount": {
            "value": random_amount(min_value=10_000, max_value=999_999_999),
            "currency": generic_faker.currency_code()
        },
        "title": generic_faker.sentence(nb_words=10)[:255],
        "timestamp": (random_timestamp - timedelta(milliseconds=randint(0, 30000))).isoformat()
    }
    all_events.append(init_event)

    return all_events

def get_events(number_of_events: int, callback):
    events = []
    for _ in range(number_of_events):
        transaction_events = callback()
        events.extend(transaction_events)
    return events

def seed_data(io: TextIO):
    io.write("// INTERBANK events")
    io.write("db.interbank_events.insertMany(")
    io.write(json.dumps(get_events(10_000, generate_interbank_event), indent=2))
    io.write(");\n\n")

    io.write("// SWIFT events")
    io.write("db.swift_events.insertMany(")
    io.write(json.dumps(get_events(1000, generate_swift_event), indent=2))
    io.write(");\n\n")


if __name__ == '__main__':
    with open('seed.js', 'w', encoding='utf-8') as f:
        seed_data(f)
