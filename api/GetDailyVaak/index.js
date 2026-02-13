const { CosmosClient } = require("@azure/cosmos");

// We initialize outside the handler for better performance
// But wrap it in a try/catch inside to see the error
module.exports = async function (context, req) {
    try {
        const connectionString = process.env.COSMOS_DB_CONNECTION_STRING;
        
        if (!connectionString) {
            throw new Error("COSMOS_DB_CONNECTION_STRING is missing in Environment Variables");
        }

        const client = new CosmosClient(connectionString);
        const database = client.database("VaakDb");
        const container = database.container("DailySchedule");

        const date = req.query.date || new Date().toISOString().split('T')[0];
        
        const querySpec = {
            query: "SELECT * FROM c WHERE c.date = @date",
            parameters: [{ name: "@date", value: date }]
        };

        const { resources: items } = await container.items.query(querySpec).fetchAll();
        
        context.res = {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: items
        };

    } catch (err) {
        // This makes the 500 error readable in your browser!
        context.res = {
            status: 500,
            body: {
                message: "Database Connection Failed",
                error: err.message,
                stack: err.stack
            }
        };
    }
};
