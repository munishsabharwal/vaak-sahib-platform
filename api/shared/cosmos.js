const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
const database = client.database("VaakDb");

module.exports = {
    library: database.container("Library"),
    editors: database.container("Editors"),
    schedule: database.container("DailySchedule")
};
