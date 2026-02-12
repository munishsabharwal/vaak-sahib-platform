const { schedule, editors } = require('../Shared/cosmos');

module.exports = async function (context, req) {
    // 1. Get Logged in User Email from Azure Header
    const header = req.headers["x-ms-client-principal"];
    if (!header) {
        context.res = { status: 401, body: "Not Authenticated" };
        return;
    }
    const encoded = Buffer.from(header, "base64");
    const user = JSON.parse(encoded.toString("ascii"));
    const email = user.userDetails;

    // 2. Fetch Editor Profile
    // We look up by Partition Key (email) and ID (email)
    try {
        const { resource: editorProfile } = await editors.item(email, email).read();

        if (!editorProfile || editorProfile.status !== "Active") {
            context.res = { status: 403, body: "Access Denied: Profile not found or inactive." };
            return;
        }

        const { verseItem, date } = req.body;

        // 3. Construct the Schedule Item
        // ID = Date + Gurudwara (Enforces 1 post per Gurudwara per day)
        const newItem = {
            id: `${date}-${editorProfile.gurudwaraName.replace(/\s+/g, '')}`, 
            date: date, // Partition Key
            verse: verseItem.verse,
            pageNumber: verseItem.pageNumber,
            keywords: verseItem.keywords,
            
            // Metadata from Editor Profile
            gurudwaraName: editorProfile.gurudwaraName,
            gurudwaraLocation: editorProfile.gurudwaraLocation,
            editorName: `${editorProfile.firstName} ${editorProfile.lastName}`,
            editorEmail: email
        };

        await schedule.items.upsert(newItem);
        context.res = { body: "Published Successfully" };

    } catch (err) {
        context.log(err);
        context.res = { status: 500, body: "Error publishing: " + err.message };
    }
};
