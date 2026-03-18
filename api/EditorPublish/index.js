const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);

module.exports = async function (context, req) {
    try {
        const db = client.database("VaakDb");
        const header = req.headers["x-ms-client-principal"];
        if (!header) return context.res = { status: 401, body: "Unauthorized" };

        const user = JSON.parse(Buffer.from(header, "base64").toString("ascii"));
        const email = user.userDetails;

        // 1. Get Editor Info to check permissions
        const { resource: editorProfile } = await db.container("Editors").item(email, email).read();

        if (!editorProfile || editorProfile.status !== "Active") {
            return context.res = { status: 403, body: "No active editor profile found." };
        }

        const { verseItem, date } = req.body;

        // 2. Determine Gurudwara details (Dropdown for Super Admin, Profile for others)
        let finalGName, finalGLocation;

        if (editorProfile.role === "super_admin") {
            // Trust the selection from the dropdown in app.js
            finalGName = verseItem.gurudwaraName;
            finalGLocation = verseItem.gurudwaraLocation;
        } else {
            // Force the editor's assigned Gurudwara
            finalGName = editorProfile.gurudwaraName;
            finalGLocation = editorProfile.gurudwaraLocation;
        }

        // 3. CREATE THE UNIQUE ID (Crucial Step)
        // We remove spaces from the Gurudwara name to make a clean URL-safe ID
        const safeGName = finalGName.replace(/\s+/g, '');
        const uniqueId = `${date}-${safeGName}`; 

        const newItem = {
            id: uniqueId, // This prevents overwriting other Gurudwaras
            date: date,
            verse: verseItem.verse,
            pageNumber: verseItem.pageNumber,
            gurudwaraName: finalGName,
            gurudwaraLocation: finalGLocation,
            editorName: `${editorProfile.firstName} ${editorProfile.lastName}`,
            publishedAt: new Date().toISOString()
        };

        // 4. Save to Cosmos DB
        // 'upsert' will only overwrite if the ID (Date + Gurudwara) is identical
        await db.container("DailySchedule").items.upsert(newItem);

        context.res = { 
            body: `Published successfully for ${finalGName}!` 
        };

    } catch (err) {
        context.log.error("Publishing Error:", err.message);
        context.res = { status: 500, body: err.message };
    }
};
