const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);

module.exports = async function (context, req) {
    const container = client.database("VaakDb").container("Library");

    try {
        // --- DELETE LOGIC ---
        if (req.method === "DELETE") {
            const id = req.query.id;
            const page = req.query.page; // Partition Key

            if (!id || !page) {
                context.res = { status: 400, body: "Missing id or page (partition key)" };
                return;
            }

            await container.item(id, page).delete();
            context.res = { status: 200, body: "Deleted" };
        } 
        
        // --- GET LOGIC (Search) ---
        else if (req.method === "GET") {
            const keyword = req.query.keyword || "";
            let querySpec = keyword 
                ? {
                    query: "SELECT * FROM c WHERE CONTAINS(c.keywords, @kw) OR CONTAINS(c.pageNumber, @kw) OR CONTAINS(c.verse, @kw)",
                    parameters: [{ name: "@kw", value: keyword }]
                  }
                : { query: "SELECT TOP 100 * FROM c ORDER BY c._ts DESC" };

            const { resources: items } = await container.items.query(querySpec).fetchAll();
            context.res = { body: items };
        } 
        
        // --- POST LOGIC (Bulk Import) ---
        else if (req.method === "POST") {
            const items = req.body;
            for (const item of items) {
                await container.items.upsert({
                    id: item.id || `${item.pageNumber}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    pageNumber: item.pageNumber.toString(),
                    keywords: item.keywords || "",
                    verse: item.verse
                });
            }
            context.res = { body: "Import Successful" };
        }
    } catch (err) {
        context.res = { status: 500, body: err.message };
    }
};
