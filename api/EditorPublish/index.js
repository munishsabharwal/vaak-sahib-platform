const { CosmosClient } = require("@azure/cosmos");
const client = new CosmosClient(process.env.COSMOS_DB_CONNECTION_STRING);

module.exports = async function (context, req) {
    try {
        const db = client.database("VaakDb");
        const container = db.container("DailySchedule");
        
        const header = req.headers["x-ms-client-principal"];
        if (!header) return context.res = { status: 401, body: "Unauthorized" };

        const clientPrincipal = JSON.parse(Buffer.from(header, "base64").toString("ascii"));
        const email = clientPrincipal.userDetails;
        
        // Dynamic Role Check: Get roles directly from Azure Login claims
        const roles = clientPrincipal.userRoles || [];
        const isSuperAdmin = roles.includes("super_admin");

        // Fetch Profile for Editor Name and secondary verification
        const { resource: editorProfile } = await db.container("Editors").item(email, email).read();
        if (!editorProfile || editorProfile.status !== "Active") {
            return context.res = { status: 403, body: "Unauthorized profile." };
        }

        const { verseItem, date } = req.body;

        // Identify Target Gurudwara using dynamic role
        let finalGName, finalGLocation;
        if (isSuperAdmin) {
            finalGName = verseItem.gurudwaraName;
            finalGLocation = verseItem.gurudwaraLocation;
        } else {
            finalGName = editorProfile.gurudwaraName;
            finalGLocation = editorProfile.gurudwaraLocation;
        }

        // GENERATE UNIQUE ID (Using your preferred format)
        const safeName = finalGName.replace(/[^a-zA-Z0-9]/g, '');
        const safeCity = finalGLocation.replace(/[^a-zA-Z0-9]/g, '');
        const uniqueId = `${date}_${safeName}_${safeCity}`;

        const newItem = {
            id: uniqueId, 
            date: date,
            verse: verseItem.verse,
            pageNumber: verseItem.pageNumber,
            gurudwaraName: finalGName,
            gurudwaraLocation: finalGLocation,
            editorName: `${editorProfile.firstName} ${editorProfile.lastName}`,
            publishedAt: new Date().toISOString()
        };

        await container.items.upsert(newItem);

        context.res = { 
            body: `Success! Published for ${finalGName}.` 
        };

    } catch (err) {
        context.log.error("Error:", err.message);
        context.res = { status: 500, body: "Backend Error: " + err.message };
    }
};
