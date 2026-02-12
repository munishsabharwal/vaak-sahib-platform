const { editors } = require('../Shared/cosmos');

module.exports = async function (context, req) {
    if (req.method === "POST") {
        const editor = req.body;
        // Use Email as ID and Partition Key
        editor.id = editor.email;
        editor.status = "Active"; 
        
        await editors.items.upsert(editor);
        context.res = { body: "Editor saved successfully." };
    }
};
