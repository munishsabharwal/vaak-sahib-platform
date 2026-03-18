const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);

module.exports = async function (context, req) {
    try {
        const db = client.database("VaakDb");
        const container = db.container("DailySchedule");
        
        const header = req.headers["x-ms-client-principal"];
        if (!header) return context.res = { status: 401, body: "Unauthorized" };

        const user = JSON.parse(Buffer.from(header, "base64").toString("ascii"));
        const email = user.userDetails;

        // 1. Fetch Profile
        const { resource: editorProfile } = await db.container("Editors").item(email, email).read();
        if (!editorProfile || editorProfile.status !== "Active") {
            return context.res = { status: 403, body: "Unauthorized profile." };
        }

        const { verseItem, date } = req.body;

        // 2. Identify the target Gurudwara
        let finalGName, finalGLocation;
        if (editorProfile.role === "super_admin") {
            finalGName = verseItem.gurudwaraName;
            finalGLocation = verseItem.gurudwaraLocation;
        } else {
            finalGName = editorProfile.gurudwaraName;
            finalGLocation = editorProfile.gurudwaraLocation;
        }

        // 3. GENERATE A TRULY UNIQUE ID
        // Format: 2024-03-27_BanglaSahib_NewDelhi
        const safeName = finalGName.replace(/[^a-zA-Z0-9]/g, '');
        const safeCity = finalGLocation.replace(/[^a-zA-Z0-9]/g, '');
        const uniqueId = `${date}_${safeName}_${safeCity}`;

        const newItem = {
            id: uniqueId, 
            date: date, // If 'date' is your Partition Key, this remains the same
            verse: verseItem.verse,
            pageNumber: verseItem.pageNumber,
            gurudwaraName: finalGName,
            gurudwaraLocation: finalGLocation,
            editorName: `${editorProfile.firstName} ${editorProfile.lastName}`,
            publishedAt: new Date().toISOString()
        };

        // 4. Use 'create' instead of 'upsert' to test
        // If 'create' throws an error, it tells us the ID already exists
        // If it successfully creates, it means we fixed the overwrite!
        await container.items.upsert(newItem);

        context.res = { 
            body: `Success! Published for ${finalGName}.` 
        };

    } catch (err) {
        context.log.error("Error:", err.message);
        context.res = { status: 500, body: "Backend Error: " + err.message };
    }
};
