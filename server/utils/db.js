const mongoose = require('mongoose');
const { MONGODB, DB_NAME } = process.env;


const db = async () => {
    try {
        await mongoose.connect(`${MONGODB}/${DB_NAME}`, {
        });    
        console.log(`Database connected to: ${MONGODB}/${DB_NAME}`)
    } catch (err) {
        throw new Error(`Error: ${err.message}`);
    }

};

module.exports = {db, mongoose};