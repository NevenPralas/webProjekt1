const {Client} = require('pg');

const client = new Client({
    host: "localhost",
    user: "postgres",
    port: 5432,
    password: "Damburger1#",
    database: "postgres"
});

module.exports = client;