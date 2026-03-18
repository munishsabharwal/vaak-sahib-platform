const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    // Check for connection string immediately
    const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
    if (!connectionString) {
        context.res = { status: 500, body: "Error: COSMOS_DB_CONNECTION_STRING is not defined in Azure Configuration." };
        return;
    }

    try {
        const client = new CosmosClient(connectionString);
        const database = client.database("VaakDb");
        const container = database.container("Gurudwaras");
        const method = req.method;

        if (method === "GET") {
            const { resources } = await container.items
                .query("SELECT * FROM c ORDER BY c.name ASC")
                .fetchAll();
            context.res = { status: 200, body: resources };
        } 
        
        else if (method === "POST") {
            const { name, city } = req.body;
            if (!name || !city) {
                context.res = { status: 400, body: "Name and City are required." };
                return;
            }

            const { resource } = await container.items.create({
                id: Date.now().toString(),
                name: name,
                city: city
            });
            context.res = { status: 201, body: resource };
        } 
        
        else if (method === "DELETE") {
            const id = req.query.id;
            if (!id) {
                context.res = { status: 400, body: "ID is required." };
                return;
            }
            await container.item(id, id).delete();
            context.res = { status: 204 };
        }
    } catch (error) {
        // This will now show the EXACT error in your browser console instead of just '500'
        context.log.error("Cosmos DB Error:", error.message);
        context.res = {
            status: 500,
            body: "Detailed Error: " + error.message
        };
    }
};
