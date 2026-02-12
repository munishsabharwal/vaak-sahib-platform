const { schedule } = require('../Shared/cosmos');

module.exports = async function (context, req) {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    
    // Fetch all records for the given date (Partition Key)
    const querySpec = {
        query: "SELECT * FROM c WHERE c.date = @date",
        parameters: [{ name: "@date", value: date }]
    };

    try {
        const { resources: items } = await schedule.items.query(querySpec).fetchAll();
        context.res = { body: items };
    } catch (err) {
        context.res = { status: 500, body: "Error fetching data" };
    }
};
