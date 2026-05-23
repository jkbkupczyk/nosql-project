export async function watchCollection(db, collectionName) {
    console.log(`Starting watch for collection ${collectionName}...`);
    const changeStream = await db.collection(collectionName)
        .watch([{$match: {operationType: {$in: ["insert"]}}}], {fullDocument: "updateLookup"});

    changeStream.on('change', change => onChange(db, change, collectionName));
    changeStream.on('error', err => onError(err, collectionName));
}

async function onChange(db, change, collectionName) {
    console.log(`Change for collection: ${collectionName}`, change);

    const doc = change.fullDocument;
    console.log(`DOC: ${doc}`);
    await markLogAsProcessed(db, collectionName, change.documentKey._id);
}

async function markLogAsProcessed(db, collectionName, id) {
    await db.collection(collectionName)
        .updateOne(
            {_id: id},
            {$set: {processed_date_time: new Date()}}
        );
}

async function onError(err, collectionName) {
    console.error(`Change stream error for collection ${collectionName}`, err);
}
