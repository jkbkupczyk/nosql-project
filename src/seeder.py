from faker import Faker
from random import choice, randint, uniform, random
from datetime import datetime, timedelta
import json
import uuid
from typing import TextIO

EVENT_TYPE_KEY = "eventType"
EVENT_PAYLOAD_KEY = "payload"

LOCALES = ["en_US", "en_GB", "es_ES", "fr_FR", "de_DE", "pl_PL"]

pl_faker = Faker(locale="pl")
eng_faker = Faker(locale="en")


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


def random_amount(min_value=10, max_value=10000) -> float:
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
    "Błąd",
    "Limit przekroczony"
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
    if chance < 0.70:  # 70%
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
    elif chance < 85:  # 15%
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
EVENT_SWIFT_SETTLED = "SWIFT_SETTLED"
EVENT_SWIFT_REJECTED = "SWIFT_REJECTED"

SWIFT_EVENTS = [
    EVENT_SWIFT_CREATED, EVENT_SWIFT_SETTLED, EVENT_SWIFT_REJECTED
]

SWIFT_REJECT_REASONS = [
    "INVALID_BIC",
    "SANCTIONS_SCREENING",
    "ACCOUNT_CLOSED",
    "LIMIT_EXCEEDED"
]


def generate_swift_event():
    random_timestamp = random_date()
    transaction_id = str(uuid.uuid4())
    all_events = []

    creditor_faker = Faker(locale=choice(LOCALES))
    debtor_faker = Faker(locale=choice(LOCALES))

    init_event = base_event(random_timestamp)
    init_event[EVENT_TYPE_KEY] = EVENT_SWIFT_CREATED
    init_event[EVENT_PAYLOAD_KEY] = {
        "txId": transaction_id,
        "creditorAccount": {
            "value": creditor_faker.iban(),
            "type": "IBAN"
        },
        "creditorParty": {
            "name": random_full_name(creditor_faker),
            "country": creditor_faker.country(),
            "city": creditor_faker.city(),
            "postcode": creditor_faker.postcode(),
            "street": creditor_faker.street_name(),
            "buildingNumber": creditor_faker.building_number(),
        },
        "creditorAgent": creditor_faker.swift11(),
        "debtorAccount": {
            "value": debtor_faker.iban(),
            "type": "IBAN"
        },
        "debtorParty": {
            "name": random_full_name(debtor_faker),
            "country": debtor_faker.country(),
            "city": debtor_faker.city(),
            "postcode": debtor_faker.postcode(),
            "street": debtor_faker.street_name(),
            "buildingNumber": debtor_faker.building_number()
        },
        "debtorAgent": debtor_faker.swift11(),
        "amount": {
            "value": random_amount(min_value=10_000, max_value=999_999_999),
            "currency": debtor_faker.currency_code()
        },
        "title": debtor_faker.sentence(nb_words=20)[:255],
        "timestamp": (random_timestamp - timedelta(milliseconds=randint(0, 30000))).isoformat()
    }
    all_events.append(init_event)

    chance = random()
    if chance < 0.8:  # 80%
        settlement_date = random_timestamp + timedelta(seconds=randint(5, 999))
        settled_event = base_event(random_timestamp + timedelta(minutes=randint(5, 120)))
        settled_event[EVENT_TYPE_KEY] = EVENT_SWIFT_SETTLED
        settled_event[EVENT_PAYLOAD_KEY] = {
            "txId": transaction_id,
            "status": "SETTLED",
            "settlementReference": f"ref_{settlement_date.date().isoformat().replace("-", "")}_{randint(999_999, 999_9999_999)}",
            "settlementTimestamp": settlement_date.isoformat()
        }
        all_events.append(settled_event)
    elif chance < 0.95:  # 15%
        rejected_event = base_event(random_timestamp + timedelta(seconds=randint(1, 5)))
        rejected_event[EVENT_TYPE_KEY] = EVENT_SWIFT_REJECTED
        rejected_event[EVENT_PAYLOAD_KEY] = {
            "txId": transaction_id,
            "status": "REJECTED",
            "reason": choice(SWIFT_REJECT_REASONS)
        }
        all_events.append(rejected_event)

    return all_events


def get_events(number_of_events: int, callback):
    events = []
    for _ in range(number_of_events):
        transaction_events = callback()
        events.extend(transaction_events)
    return events


def seed_data(io: TextIO):
    io.write("// INTERBANK events\n")
    io.write("db.interbank_events.insertMany(")
    io.write(json.dumps(get_events(1, generate_interbank_event), indent=2))
    io.write(");\n\n")

    io.write("// SWIFT events\n")
    io.write("db.swift_events.insertMany(")
    io.write(json.dumps(get_events(100, generate_swift_event), indent=2))
    io.write(");\n\n")


if __name__ == '__main__':
    with open('seed.js', 'w', encoding='utf-8') as f:
        seed_data(f)
