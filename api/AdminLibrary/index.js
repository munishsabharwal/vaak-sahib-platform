const { library } = require('../Shared/cosmos');

module.exports = async function (context, req) {
    // GET: Search Library
    if (req.method === "GET") {
        const keyword = req.query.keyword || "";
        // Search Partition Key (Page) OR Keywords
        const querySpec = {
            query: "SELECT * FROM c WHERE CONTAINS(c.keywords, @kw) OR CONTAINS(c.pageNumber, @kw)",
            parameters: [{ name: "@kw", value: keyword }]
        };
        const { resources: items } = await library.items.query(querySpec).fetchAll();
        context.res = { body: items };
    } 
    // POST: Bulk Import
    else if (req.method === "POST") {
        const items = req.body; 
        if (!Array.isArray(items)) {
            context.res = { status: 400, body: "Input must be an array" };
            return;
        }

        let count = 0;
        for (const item of items) {
            // Create Unique ID: Page + Hash of text to prevent duplicates
            const uniqueId = `${item.pageNumber}-${item.verse.substring(0, 10).replace(/\s/g, '')}`;
            
            await library.items.upsert({
                id: uniqueId,
                pageNumber: item.pageNumber.toString(), // Partition Key
                keywords: item.keywords,
                verse: item.verse
            });
            count++;
        }
        context.res = { body: `Imported ${count} verses.` };
    }
};
