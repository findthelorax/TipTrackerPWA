const mongoose = require('mongoose');
const { MONGODB, DB_NAME } = process.env;

const db = async () => {
    try {
        await mongoose.connect(`${MONGODB}/${DB_NAME}`);
        return mongoose.connection;
    } catch (err) {
        throw new Error(`Error: ${err.message}`);
    }
};

module.exports = db;