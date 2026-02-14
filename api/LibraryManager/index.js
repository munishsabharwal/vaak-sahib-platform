const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    try {
        const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
        const client = new CosmosClient(connectionString);
        const container = client.database("VaakDb").container("Library");

        if (req.method === "GET") {
            // SIMPLEST QUERY POSSIBLE
            const querySpec = {
                query: "SELECT TOP 50 * FROM c"
            };

            const { resources: items } = await container.items.query(querySpec).fetchAll();
            
            context.res = {
                status: 200,
                headers: { "Content-Type": "application/json" },
                body: items
            };
        } else {
            context.res = { status: 200, body: "Method not supported in this test" };
        }
    } catch (err) {
        context.log.error(err);
        context.res = {
            status: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};
