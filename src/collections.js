export const COLL_NAME_PAYMENT_VIEW = 'payment_view';
export const LOG_COLLECTION_TTL_FIELD_NAME = 'processed_date_time';
export const COLL_NAME_INTERBANK_EVENTS = 'interbank_events';
export const COLL_NAME_SWIFT_EVENTS = 'swift_events';

const SECONDS_IN_DAY = 3600 * 24;
const DEFAULT_TTL = 180 * SECONDS_IN_DAY; // 15552000

export async function createLogCollections(db) {
    await createLogCollection(db, COLL_NAME_INTERBANK_EVENTS);
    await createLogCollection(db, COLL_NAME_SWIFT_EVENTS);
}

async function createLogCollection(db, collectionName) {
    console.log(`Creating collection and indices for ${collectionName}...`)
    const coll = await db.createCollection(collectionName);
    await coll.createIndex(
        {LOG_COLLECTION_TTL_FIELD_NAME: 1},
        {
            expireAfterSeconds: DEFAULT_TTL,
            name: `${collectionName}_${LOG_COLLECTION_TTL_FIELD_NAME}_ttl_idx`
        }
    );
}

export async function createPaymentViewCollection(db) {
    const coll = await db.createCollection(COLL_NAME_PAYMENT_VIEW, {
        validator: {
            $jsonSchema: {
                bsonType: 'object',
                title: 'Payment View Validation',
                required: ['paymentId', 'currentStatus'],
                properties: {
                    paymentId: {
                        bsonType: 'string',
                        description: "'paymentId' must be a string and is required",
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
        {"paymentId": 1},
        {
            unique: true,
            name: "payment_view_paymentId_unique_idx",
        },
    );

    await coll.createIndex(
        {"status": 1},
        {name: "payment_view_status_idx",},
    );
}
