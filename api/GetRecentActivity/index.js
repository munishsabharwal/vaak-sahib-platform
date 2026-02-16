const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    // Uses the connection string defined in your Azure Function App Settings
    const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
    const container = client.database("VaakDb").container("DailySchedule");

    try {
        // Querying the 5 most recent entries based on the system timestamp (_ts)
        const { resources: items } = await container.items
            .query("SELECT TOP 5 * FROM c ORDER BY c._ts DESC")
            .fetchAll();

        context.res = {
            status: 200,
            body: items,
            headers: { 'Content-Type': 'application/json' }
        };
    } catch (err) {
        context.log.error("Error fetching recent activity:", err.message);
        context.res = {
            status: 500,
            body: "Internal Server Error: " + err.message
        };
    }
};
