const COLL_NAME_LOG_RAW1 = "log_1";
const COLL_NAME_LOG_RAW2 = "log_2";
const COLL_NAME_LOG_RAW3 = "log_3";
const COLL_NAME_LOG_RAW4 = "log_4";

const COLL_NAME_MAIN = 'payment_view';

const SECONDS_IN_DAY = 3600 * 24;

export async function createLogCollections(db) {
    await createLogCollection(db, COLL_NAME_LOG_RAW1);
    await createLogCollection(db, COLL_NAME_LOG_RAW2);
    await createLogCollection(db, COLL_NAME_LOG_RAW3);
    await createLogCollection(db, COLL_NAME_LOG_RAW4);
}

async function createLogCollection(db, collectionName) {
    console.log(`Creating collection ${collectionName}...`)
    const coll = await db.createCollection(collectionName);
    await coll.createIndex(
        {"timestamp": 1},
        {
            expireAfterSeconds: SECONDS_IN_DAY * 180,
            name: `${collectionName}_timestamp_ttl_idx`
        }
    );
}

export async function createPaymentViewCollection(db) {
    console.log(`Creating collection ${COLL_NAME_MAIN}`);
    const coll = await db.createCollection(COLL_NAME_MAIN, {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                title: 'Unified view of payment',
                required: [
                    'endToEndId',
                    'creditorAccount',
                    'creditorName',
                    'debtorAccount',
                    'debtorName',
                    'title',
                    'amount',
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
