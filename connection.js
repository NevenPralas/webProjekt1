const {Client} = require('pg');

const client = new Client({
    host: "dpg-csdb9q88fa8c73900h00-a",
    user: "dbwebprojekt_user",
    port: 5432,
    password: "gXdmvhq6OHu6LkW8ZUevRRCcPdAX6rd2",
    database: "dbwebprojekt"
});

module.exports = client;