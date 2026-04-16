const { CosmosClient } = require("@azure/cosmos");

module.exports = async function (context, req) {
    const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);
    const container = client.database("VaakDb").container("Editors");

    try {
        // --- GET: Fetch all editors for the Super Admin list ---
        if (req.method === "GET") {
            // Support fetching a specific editor by email for login checks
            const email = req.query.email;
            if (email) {
                const { resources: specificEditor } = await container.items
                    .query({
                        query: "SELECT * FROM c WHERE c.email = @email",
                        parameters: [{ name: "@email", value: email.toLowerCase().trim() }]
                    }).fetchAll();
                context.res = { status: 200, body: specificEditor };
                return;
            }

            const { resources: editors } = await container.items
                .query("SELECT * FROM c ORDER BY c.lastName ASC")
                .fetchAll();
            
            context.res = { status: 200, body: editors, headers: { 'Content-Type': 'application/json' }};
            return;
        }

        // --- POST: Save or Update an Editor Profile ---
        if (req.method === "POST") {
            const editorData = req.body;

            if (!editorData || !editorData.email) {
                context.res = { status: 400, body: "Email is required as the ID." };
                return;
            }

            const profile = {
                id: editorData.email.toLowerCase().trim(),
                email: editorData.email.toLowerCase().trim(),
                firstName: editorData.firstName,
                lastName: editorData.lastName,
                gurudwaraName: editorData.gurudwaraName,
                gurudwaraLocation: editorData.gurudwaraLocation,
                status: editorData.status || "Active",
                comments: editorData.comments || "", // NEW: Added Comments
                updatedAt: new Date().toISOString()
            };

            await container.items.upsert(profile);

            context.res = { status: 200, body: "Editor profile saved successfully!" };
            return;
        }

        // --- DELETE: Remove an Editor ---
        if (req.method === "DELETE") {
            const email = req.query.email;
            if (!email) {
                context.res = { status: 400, body: "Email is required to delete." };
                return;
            }
            const id = email.toLowerCase().trim();
            // Delete requires both ID and Partition Key (assuming partition key is /id)
            await container.item(id, id).delete();

            context.res = { status: 200, body: "Editor deleted successfully." };
            return;
        }

    } catch (err) {
        context.log.error("ManageEditors Error:", err.message);
        context.res = { status: 500, body: "Internal Server Error: " + err.message };
    }
};
