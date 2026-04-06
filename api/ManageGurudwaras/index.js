const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
    if (!connectionString) {
        context.res = { status: 500, body: "Error: COSMOS_DB_CONNECTION_STRING is undefined." };
        return;
    }

    try {
        const client = new CosmosClient(connectionString);
        const database = client.database("VaakDb");
        const container = database.container("Gurudwaras");
        const method = req.method;

        if (method === "GET") {
            const { resources } = await container.items.query("SELECT * FROM c ORDER BY c.name ASC").fetchAll();
            context.res = { status: 200, body: resources };
        } 
        
        else if (method === "POST") {
            const { id, name, city } = req.body;
            if (!name || !city) {
                context.res = { status: 400, body: "Name and City are required." };
                return;
            }

            // Logic: If id exists, it's an update. If not, it's a new entry.
            const itemPayload = {
                id: id ? String(id) : Date.now().toString(),
                name: name,
                city: city
            };

            // .upsert() handles both create and update automatically
            const { resource } = await container.items.upsert(itemPayload);
            context.res = { status: 201, body: resource };
        } 
        
        else if (method === "DELETE") {
            const id = req.query.id;
            const name = req.query.name; // We now require name because it's the Partition Key

            if (!id || !name) {
                context.res = { status: 400, body: "Both ID and Name (Partition Key) are required for deletion." };
                return;
            }

            // Correct Cosmos DB Delete: container.item(id, partitionKey)
            await container.item(id, name).delete();
            context.res = { status: 204 };
        }
    } catch (error) {
        context.log.error("Cosmos DB Error:", error.message);
        context.res = { status: 500, body: error.message };
    }
};
