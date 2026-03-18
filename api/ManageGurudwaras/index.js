const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);

module.exports = async function (context, req) {
    try {
        const db = client.database("VaakDb");
        const header = req.headers["x-ms-client-principal"];
        if (!header) return context.res = { status: 401, body: "Unauthorized" };

        const user = JSON.parse(Buffer.from(header, "base64").toString("ascii"));
        const email = user.userDetails;

        // 1. Get Editor Info
        const { resource: editorProfile } = await db.container("Editors").item(email, email).read();

        if (!editorProfile || editorProfile.status !== "Active") {
            return context.res = { status: 403, body: "No active editor profile found for " + email };
        }

        const { verseItem, date } = req.body;

        // 2. Create Schedule Item (ID enforces 1 per Gurudwara per day)
        const newItem = {
            id: `${date}-${editorProfile.gurudwaraName.replace(/\s+/g, '')}`, 
            date: date,
            verse: verseItem.verse,
            pageNumber: verseItem.pageNumber,
            gurudwaraName: editorProfile.gurudwaraName,
            gurudwaraLocation: editorProfile.gurudwaraLocation,
            editorName: `${editorProfile.firstName} ${editorProfile.lastName}`
        };

        await db.container("DailySchedule").items.upsert(newItem);
        context.res = { body: "Published successfully!" };

    } catch (err) {
        context.res = { status: 500, body: err.message };
    }
};
