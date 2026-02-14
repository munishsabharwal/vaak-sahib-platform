const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
    const container = client.database("VaakDb").container("Library");

    try {
        // --- GET: Search or Fetch All ---
        if (req.method === "GET") {
            const kw = req.query.keyword;
            let querySpec;

            if (kw) {
                // Search in pageNumber, keywords, or verse
                querySpec = {
                    query: "SELECT * FROM c WHERE CONTAINS(c.pageNumber, @kw) OR CONTAINS(LOWER(c.keywords), LOWER(@kw)) OR CONTAINS(c.verse, @kw)",
                    parameters: [{ name: "@kw", value: kw }]
                };
            } else {
                // Default view
                querySpec = { query: "SELECT TOP 100 * FROM c ORDER BY c.pageNumber ASC" };
            }

            const { resources: items } = await container.items.query(querySpec).fetchAll();
            context.res = { 
                status: 200, 
                headers: { "Content-Type": "application/json" },
                body: items 
            };
        } 
        
        // --- POST: Bulk Import ---
        else if (req.method === "POST") {
            const items = req.body;
            if (!Array.isArray(items)) throw new Error("Input must be an array");

            for (const item of items) {
                // Ensure ID is unique and valid
                const safeId = item.id || `${item.pageNumber}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                await container.items.upsert({
                    id: safeId.toString(),
                    pageNumber: item.pageNumber.toString(),
                    keywords: item.keywords || "",
                    verse: item.verse
                });
            }
            context.res = { status: 200, body: "Import Successful" };
        }
    } catch (err) {
        context.log.error(err.message);
        context.res = { status: 500, body: err.message };
    }
};
