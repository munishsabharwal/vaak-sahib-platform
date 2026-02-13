const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);

module.exports = async function (context, req) {
    try {
        const container = client.database("VaakDb").container("Editors");
        const editor = req.body;
        editor.id = editor.email;
        editor.status = "Active"; 
        
        await container.items.upsert(editor);
        context.res = { body: "Editor profile updated." };
    } catch (err) {
        context.res = { status: 500, body: err.message };
    }
};
