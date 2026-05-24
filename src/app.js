import {createLogCollections, createPaymentViewCollection} from "./collections.js";
import {watchCollections} from "./watchCollection.js";
import {MongoClient} from "mongodb";


async function connect(uri, dbName) {
    const client = new MongoClient(uri);
    await client.connect();
    return client.db(dbName);
}

const db = await connect('mongodb://localhost:27017/?replicaSet=rs0', 'payment_arch');

await createLogCollections(db);

await createPaymentViewCollection(db);

await watchCollections(db);


