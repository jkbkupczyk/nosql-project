import {COLL_NAME_INTERBANK_EVENTS, COLL_NAME_PAYMENT_VIEW, COLL_NAME_SWIFT_EVENTS} from "./collections.js";

export async function watchCollections(db) {
    await watchCollection(db, COLL_NAME_INTERBANK_EVENTS, processInterbankEvent);
    await watchCollection(db, COLL_NAME_SWIFT_EVENTS, processSwiftEvent);
}

async function watchCollection(db, collectionName, mapper) {
    console.log(`Starting watch for collection ${collectionName}...`);
    const changeStream = await db.collection(collectionName)
        .watch([{$match: {operationType: {$in: ["insert"]}}}], {fullDocument: "updateLookup"});

    changeStream.on('change', async (change) => {
        try {
            mapper(db, change.fullDocument)
        } catch (err) {
            await onError(err, collectionName);
        }
        await markLogAsProcessed(db, collectionName, change.documentKey._id);
    });
    changeStream.on('error', err => onError(err, collectionName));
}

async function processInterbankEvent(db, document) {
    const payload = document.payload;

    const paymentId = String(payload['message_id'])
    const setValue = getDefaultSetPipeline(payload, payload['status'], document);

    const debtor = {};
    if (payload['debtor_account']) {
        debtor.account = payload['debtor_account'];
        setValue["debtor"] = debtor;
    }
    if (payload['debtor_name']) {
        debtor.name = payload['debtor_name'];
        setValue["debtor"] = debtor;
    }

    const creditor = {};
    if (payload['creditor_account']) {
        creditor.account = payload['creditor_account'];
        setValue["creditor"] = creditor;
    }
    if (payload['creditor_name']) {
        creditor.name = payload['creditor_name'];
        setValue["creditor"] = creditor;
    }

    const amount = Number(payload['amount']);
    if (payload['amount'] && !Number.isNaN(amount)) {
        setValue.amount = {
            $ifNull: ["$amount", amount]
        };
    }

    if (payload['currency']) {
        setValue['currency'] = {
            $ifNull: ["$currency", payload['currency']]
        };
    }

    if (payload['title']) {
        setValue['title'] = {
            $ifNull: ["$title", payload['title']]
        };
    }

    const interbankInfo = {}
    if (payload['session_date']) {
        interbankInfo.sessionDate = payload['session_date'];
        setValue["interbankInfo"] = interbankInfo;
    }
    if (payload['session_number']) {
        interbankInfo.sessionNumber = payload['session_number'];
        setValue["interbankInfo"] = interbankInfo;
    }

    await db.collection(COLL_NAME_PAYMENT_VIEW).findOneAndUpdate(
        {paymentId: paymentId},
        [
            {
                $set: setValue,
            }
        ],
        {upsert: true, returnDocument: "after"}
    );
}

async function processSwiftEvent(db, document) {
    const payload = document.payload;

    const paymentId = String(payload['txId'])
    const setValue = getDefaultSetPipeline(payload, payload['status'], document);

    const debtor = {};
    if (payload['debtorAccount']) {
        if (payload['debtorAccount']['value']) {
            debtor.account = payload['debtorAccount']['value'];
        }
        setValue["debtor"] = debtor;
    }
    if (payload['debtorParty']) {
        setValue["debtor"] = payload['debtorParty'];
    }

    const creditor = {};
    if (payload['creditorAccount']) {
        if (payload['creditorAccount']['value']) {
            creditor.account = payload['creditorAccount']['value'];
        }
        setValue["creditor"] = creditor;
    }
    if (payload['creditorParty']) {
        setValue["creditor"] = payload['creditorParty'];
    }

    if (payload['amount']) {
        if (payload['amount']['value']) {
            setValue.amount = {
                $ifNull: ["$amount", payload['amount']['value']]
            };
        }
        if (payload['amount']['currency']) {
            setValue['currency'] = {
                $ifNull: ["$currency", payload['currency']]
            };
        }
    }

    if (payload['title']) {
        setValue['title'] = {
            $ifNull: ["$title", payload['title']]
        };
    }

    const swift = {}
    if (payload['debtorAgent']) {
        swift.debtorAgent = payload['debtorAgent'];
        setValue["swift"] = swift;
    }
    if (payload['creditorAgent']) {
        swift.creditorAgent = payload['creditorAgent'];
        setValue["swift"] = swift;
    }

    await db.collection(COLL_NAME_PAYMENT_VIEW).findOneAndUpdate(
        {paymentId: paymentId},
        [
            {
                $set: setValue,
            }
        ],
        {upsert: true, returnDocument: "after"}
    );
}

function getDefaultSetPipeline(paymentId, rawStatus, document) {
    const statusValue = rawStatus ?? "INITIALIZED";
    return {
        paymentId: paymentId,
        currentStatus: statusValue,
        statusFlow: {
            $sortArray: {
                input: {
                    $concatArrays: [
                        {$ifNull: ["$statusFlow", []]},
                        [{
                            status: statusValue,
                            occurredAt: {
                                $dateFromString: {
                                    dateString: document.eventTimestamp
                                }
                            }
                        }]
                    ]
                },
                sortBy: {
                    occurredAt: 1
                }
            }
        },
        events: {
            $concatArrays: [
                {$ifNull: ["$events", []]},
                [document.eventId]
            ]
        }
    }
}

async function markLogAsProcessed(db, collectionName, id) {
    await db.collection(collectionName)
        .updateOne(
            {_id: id},
            {$set: {'processed_date_time': new Date()}}
        );
}

async function onError(err, collectionName) {
    console.error(`Could not process change for collection ${collectionName}`, err);
}
