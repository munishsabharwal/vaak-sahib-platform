const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
    const client = new CosmosClient(connectionString);
    const container = client.database("VaakDb").container("Gurudwaras");
    const method = req.method;

    try {
        if (method === "GET") {
            const { resources } = await container.items
                .query("SELECT * FROM c ORDER BY c.name ASC")
                .fetchAll();
            context.res = { status: 200, body: resources };
        } 
        
        else if (method === "POST") {
            const { id, name, city } = req.body;
            if (!name || !city) {
                context.res = { status: 400, body: "Name and City are required." };
                return;
            }

            const itemId = id || Date.now().toString();
            const itemPayload = {
                id: itemId,
                name: name,
                city: city
            };

            // FIX: We pass the itemId as the partition key argument
            const { resource } = await container.items.upsert(itemPayload, { partitionKey: itemId });
            context.res = { status: 201, body: resource };
        } 
        
        else if (method === "DELETE") {
            const id = req.query.id;
            if (!id) {
                context.res = { status: 400, body: "ID is required for deletion." };
                return;
            }

            // FIX: Since partition key is /id, we use (id, id)
            await container.item(id, id).delete();
            context.res = { status: 204 };
        }
    } catch (error) {
        context.log.error("Cosmos DB Error:", error.message);
        context.res = { status: 500, body: error.message };
    }
};
