const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
    const container = client.database("VaakDb").container("Editors");

    try {
        const editorData = req.body;

        if (!editorData.email) {
            context.res = { status: 400, body: "Email is required as the ID." };
            return;
        }

        // We use the email as the ID so each editor has exactly one profile
        const profile = {
            id: editorData.email.toLowerCase().trim(),
            email: editorData.email.toLowerCase().trim(),
            firstName: editorData.firstName,
            lastName: editorData.lastName,
            gurudwaraName: editorData.gurudwaraName,
            gurudwaraLocation: editorData.gurudwaraLocation,
            status: editorData.status || "Active",
            updatedAt: new Date().toISOString()
        };

        await container.items.upsert(profile);

        context.res = {
            status: 200,
            body: "Editor profile saved successfully!"
        };
    } catch (err) {
        context.log.error("SaveEditor Error:", err.message);
        context.res = { status: 500, body: err.message };
    }
};
