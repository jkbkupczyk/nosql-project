import {
    aggregateEventById,
    createLogCollections,
    createPaymentViewCollection,
    findPaymentViewByPaymentId,
    textSearchPaymentViews,
    watchCollections
} from "./api.js";
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

// Wykonać po zasileniu bazy

// powinno zwrócić jeden rekord
const paymentView = await findPaymentViewByPaymentId(db, "934110120");
console.log(`Wyszikiwanie po id = `, paymentView);

// powinno zwrócić 3 rekordy
const paymentViews = await textSearchPaymentViews(db, "city")
console.log(`Text search = `, paymentViews);

// ponowna agregacja eventu = "658690df-9502-4921-9b41-8d006de8029e"
await aggregateEventById(db, "swift", "658690df-9502-4921-9b41-8d006de8029e")
console.log(`Ponownie zagregowano event 658690df-9502-4921-9b41-8d006de8029e`);