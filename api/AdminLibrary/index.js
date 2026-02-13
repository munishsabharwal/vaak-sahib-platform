const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);

module.exports = async function (context, req) {
    context.log('AdminLibrary processed a request.');

    try {
        const database = client.database("VaakDb");
        const container = database.container("Library");

        // GET: Fetch/Search Library
        if (req.method === "GET") {
            const keyword = req.query.keyword || "";
            
            let querySpec;
            if (!keyword) {
                // If no keyword, just get the last 50 items
                querySpec = { query: "SELECT TOP 50 * FROM c ORDER BY c._ts DESC" };
            } else {
                querySpec = {
                    query: "SELECT * FROM c WHERE CONTAINS(c.keywords, @kw) OR CONTAINS(c.pageNumber, @kw) OR CONTAINS(c.verse, @kw)",
                    parameters: [{ name: "@kw", value: keyword }]
                };
            }

            const { resources: items } = await container.items.query(querySpec).fetchAll();
            
            context.res = {
                status: 200,
                headers: { "Content-Type": "application/json" },
                body: items
            };
        } 
        // POST: Bulk Import
        else if (req.method === "POST") {
            const items = req.body;
            if (!Array.isArray(items)) {
                context.res = { status: 400, body: "Please provide an array of items." };
                return;
            }

            for (const item of items) {
                const uniqueId = `${item.pageNumber}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                await container.items.upsert({
                    id: item.id || uniqueId,
                    pageNumber: item.pageNumber.toString(),
                    keywords: item.keywords || "",
                    verse: item.verse
                });
            }
            context.res = { status: 200, body: "Import Successful" };
        }
    } catch (err) {
        context.log.error(err);
        context.res = {
            status: 500,
            body: { error: err.message }
        };
    }
};
