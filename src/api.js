import {processInterbankEvent, processSwiftEvent} from "./domainAggregates.js";

export const COLL_NAME_PAYMENT_VIEW = 'payment_view';
export const COLL_NAME_INTERBANK_EVENTS = 'interbank_events';
export const COLL_NAME_SWIFT_EVENTS = 'swift_events';

const SECONDS_IN_DAY = 3600 * 24;
const DEFAULT_TTL = 180 * SECONDS_IN_DAY; // 15552000

// Tworzenie kolekcji / indeksów

export async function createLogCollections(db) {
    await createLogCollection(db, COLL_NAME_INTERBANK_EVENTS);
    await createLogCollection(db, COLL_NAME_SWIFT_EVENTS);
}

async function createLogCollection(db, collectionName) {
    console.log(`Creating collection and indices for ${collectionName}...`)
    const coll = await db.createCollection(collectionName);

    // Indeksy TTL
    await coll.createIndex(
        {"processedDateTime": 1},
        {
            expireAfterSeconds: DEFAULT_TTL,
            name: `${collectionName}_processedDateTime_ttl_idx`
        }
    );
}

export async function createPaymentViewCollection(db) {
    const coll = await db.createCollection(COLL_NAME_PAYMENT_VIEW, {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                title: 'Payment View Validation',
                required: ['paymentId', 'domain', 'currentStatus'],
                properties: {
                    paymentId: {
                        bsonType: 'string',
                        description: "'paymentId' must be a string and is required",
                    },
                    domain: {
                        bsonType: 'string',
                        description: "'domain' must be a string and is required",
                    },
                    debtor: {
                        bsonType: 'object',
                    },
                    creditor: {
                        bsonType: 'object',
                    },
                    title: {
                        bsonType: 'string',
                    },
                    amount: {
                        bsonType: 'number',
                        description: "'amount' must be a number",
                    },
                    currentStatus: {
                        bsonType: 'string',
                        description: "'currentStatus' must be a string and is required",
                    }
                }
            }
        }
    });

    await coll.createIndex(
        {
            "paymentId": 1,
            "domain": 1,
        },
        {
            unique: true,
            name: "payment_view_paymentId_domain_unique_idx",
        },
    );

    await coll.createIndex(
        {"currentStatus": 1},
        {name: "payment_view_currentStatus_idx",},
    );

    await coll.createIndex(
        {
            title: "text",
            "debtor.name": "text",
            "creditor.name": "text",
            "debtor.account": "text",
            "creditor.account": "text",
        },
        {
            name: "payment_view_text_search_idx",
            weights: {
                title: 10,
                "debtor.name": 5,
                "creditor.name": 5,
                "debtor.account": 1,
                "creditor.account": 1,
            }
        }
    );
}

// Change streams

export async function watchCollections(db) {
    await watchCollection(db, COLL_NAME_INTERBANK_EVENTS, processInterbankEvent);
    await watchCollection(db, COLL_NAME_SWIFT_EVENTS, processSwiftEvent);
}

export async function watchCollection(db, collectionName, mapper) {
    console.log(`Starting watch for collection ${collectionName}...`);
    const changeStream = await db.collection(collectionName)
        .watch([{$match: {operationType: {$in: ["insert"]}}}], {fullDocument: "updateLookup"});

    changeStream.on('change', async (change) => {
        await aggregateEvent(db, collectionName, change.fullDocument, mapper);
    });
    changeStream.on('error', err => onError(err, collectionName));
}

async function aggregateEvent(db, collectionName, eventDocument, mapper) {
    const mappedValue = mapper(db, eventDocument)
    try {
        await aggregateToPaymentView(db, mappedValue.paymentId, mappedValue.setValue, true);
    } catch (err) {
        if (err.code === 11000) {
            await aggregateToPaymentView(db, mappedValue.paymentId, mappedValue.setValue, false);
        }
        await onError(err, collectionName);
    }
    await markLogAsProcessed(db, collectionName, eventDocument._id);
}

async function markLogAsProcessed(db, collectionName, id) {
    await db.collection(collectionName)
        .updateOne(
            {_id: id},
            {$set: {'processedDateTime': new Date()}}
        );
}

async function onError(err, collectionName) {
    console.error(`Could not process change for collection ${collectionName}`, err);
}

export async function aggregateToPaymentView(db, paymentId, setValue, upsert) {
    return db.collection(COLL_NAME_PAYMENT_VIEW)
        .findOneAndUpdate(
            {
                paymentId: paymentId,
                domain: setValue.domain,
            },
            [
                {
                    $set: setValue,
                },
                {
                    $set: {
                        currentStatus: {
                            $let: {
                                vars: {
                                    lastStatus: {
                                        $arrayElemAt: ["$statusFlow", -1]
                                    }
                                },
                                in: "$$lastStatus.status"
                            }
                        }
                    }
                }
            ],
            {upsert: upsert, returnDocument: "after"}
        );
}

// Inne operacje

export async function findPaymentViewByPaymentId(db, paymentId) {
    return db.collection(COLL_NAME_PAYMENT_VIEW)
        .findOne({paymentId: paymentId});
}

export async function textSearchPaymentViews(db, textSearch) {
    return db.collection(COLL_NAME_PAYMENT_VIEW)
        .find({
            $text: {
                $search: textSearch
            }
        })
        .toArray();
}

export async function aggregateEventById(db, domain, eventId) {
    let collectionName = "";
    let mapper;

    if (domain === "swift") {
        collectionName = COLL_NAME_SWIFT_EVENTS;
        mapper = processSwiftEvent;
    } else if (domain === "interbank") {
        collectionName = COLL_NAME_INTERBANK_EVENTS;
        mapper = processInterbankEvent;
    } else {
        throw new Error("Unknown domain " + domain);
    }

    const event = await db.collection(collectionName)
        .findOne({eventId: eventId});
    if (event) {
        await aggregateEvent(db, collectionName, event, mapper);
    }
}

