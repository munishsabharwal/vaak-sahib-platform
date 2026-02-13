const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);

module.exports = async function (context, req) {
    try {
        const container = client.database("VaakDb").container("Library");

        if (req.method === "GET") {
            const keyword = req.query.keyword || "";
            const querySpec = {
                query: "SELECT * FROM c WHERE CONTAINS(c.keywords, @kw) OR CONTAINS(c.pageNumber, @kw)",
                parameters: [{ name: "@kw", value: keyword }]
            };
            const { resources: items } = await container.items.query(querySpec).fetchAll();
            context.res = { body: items };
        } 
        else if (req.method === "POST") {
            const items = req.body;
            for (const item of items) {
                const uniqueId = `${item.pageNumber}-${item.verse.substring(0, 10).replace(/\s/g, '')}`;
                await container.items.upsert({
                    id: uniqueId,
                    pageNumber: item.pageNumber.toString(),
                    keywords: item.keywords,
                    verse: item.verse
                });
            }
            context.res = { body: `Successfully processed ${items.length} items.` };
        }
    } catch (err) {
        context.res = { status: 500, body: err.message };
    }
};
