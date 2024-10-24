const {Client} = require('pg');

const client = new Client({
    host: "csdb9q88fa8c73900h00-a.frankfurt-postgres.render.com",
    user: "dbwebprojekt_user",
    port: 5432,
    password: "gXdmvhq6OHu6LkW8ZUevRRCcPdAX6rd2",
    database: "dbwebprojekt"
});

module.exports = client;