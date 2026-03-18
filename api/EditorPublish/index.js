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

        // 2. Logic: Who is the Gurudwara?
        // If the user is a super_admin, we trust the frontend dropdown (verseItem)
        // If not, we force it to the editor's assigned Gurudwara for security
        let finalGName, finalGLocation;

        if (editorProfile.role === "super_admin") {
            finalGName = verseItem.gurudwaraName;
            finalGLocation = verseItem.gurudwaraLocation;
        } else {
            finalGName = editorProfile.gurudwaraName;
            finalGLocation = editorProfile.gurudwaraLocation;
        }

        // 3. Create Schedule Item (ID enforces 1 per Gurudwara per day)
        const newItem = {
            // ID format: 2023-10-27-BanglaSahib
            id: `${date}-${finalGName.replace(/\s+/g, '')}`, 
            date: date,
            verse: verseItem.verse,
            pageNumber: verseItem.pageNumber,
            gurudwaraName: finalGName,
            gurudwaraLocation: finalGLocation,
            editorName: `${editorProfile.firstName} ${editorProfile.lastName}`
        };

        // Use 'upsert' so we can update if a mistake was made earlier
        await db.container("DailySchedule").items.upsert(newItem);
        
        context.res = { 
            body: `Published successfully for ${finalGName}!` 
        };

    } catch (err) {
        context.log.error("Backend Error:", err.message);
        context.res = { status: 500, body: err.message };
    }
};
