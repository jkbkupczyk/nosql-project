const COLL_NAME_INTERBANK_EVENTS = "interbank_events";
const COLL_NAME_SWIFT_PAYMENTS = "swift_payments";
const COLL_NAME_PAYMENT_VIEW = 'payment_view';

const SECONDS_IN_DAY = 3600 * 24;

export async function createLogCollections(db) {
    await createLogCollection(db, COLL_NAME_INTERBANK_EVENTS);
    await createLogCollection(db, COLL_NAME_SWIFT_PAYMENTS);
}

async function createLogCollection(db, collectionName) {
    console.log(`Creating collection ${collectionName}...`)
    const coll = await db.createCollection(collectionName);
    await coll.createIndex(
        {"processed_date_time": 1},
        {
            expireAfterSeconds: SECONDS_IN_DAY * 180,
            name: `${collectionName}_processed_date_time_ttl_idx`
        }
    );
}

export async function createPaymentViewCollection(db) {
    console.log(`Creating collection ${COLL_NAME_PAYMENT_VIEW}`);
    const coll = await db.createCollection(COLL_NAME_PAYMENT_VIEW, {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                title: 'Payment view',
                required: [
                    'endToEndId',
                    'creditorAccount',
                    'creditorName',
                    'debtorAccount',
                    'debtorName',
                    'title',
                    'amount',
                    'currency',
                    'status'
                ],
                properties: {
                    endToEndId: {
                        bsonType: 'string',
                    },
                    creditorAccount: {
                        bsonType: 'string',
                    },
                    creditorName: {
                        bsonType: 'string',
                    },
                    debtorAccount: {
                        bsonType: 'string',
                    },
                    debtorName: {
                        bsonType: 'string',
                    },
                    title: {
                        bsonType: 'string',
                    },
                    amount: {
                        bsonType: 'number',
                    },
                    status: {
                        enum: ["IN_PROGRESS", "PROCESSED", "FAILED"],
                    }
                }
            }
        }
    });

    await coll.createIndex(
        {"endToEndId": 1},
        {
            unique: true,
            name: "payment_view_endToEndId_unique_idx",
        },
    );

    await coll.createIndex(
        {"status": 1},
        {name: "payment_view_status_idx",},
    );

    await coll.createIndex(
        {
            "creditorAccount": 1,
            "debtorAccount": 1
        },
        {name: "payment_view_creditorAccount_debtorAccount_idx"},
    );
}
