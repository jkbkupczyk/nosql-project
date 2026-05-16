export async function watchCollection(db, collectionName) {
    console.log(`Starting watch for collection ${collectionName}...`);
    const changeStream = await db.collection(collectionName)
        .watch([{$match: {operationType: {$in: ["insert", "update"]}}}], {});

    changeStream.on('change', change => onChange(db, change, collectionName));
    changeStream.on('error', err => onError(err, collectionName));
}

async function onChange(db, change, collectionName) {
    console.log(`Change for collection: ${collectionName}`, change);

    const doc = change.fullDocument;
    await db.collection("payment_view");
    await markLogAsProcessed(db, collectionName, doc._id);
}

async function markLogAsProcessed(db, collectionName, id) {
    await db.collection(collectionName)
        .updateOne(
            {_id: id},
            {$set: {processed: new Date()}}
        );
}

async function onError(err, collectionName) {
    console.error(`Change stream error for collection ${collectionName}`, err);
}
