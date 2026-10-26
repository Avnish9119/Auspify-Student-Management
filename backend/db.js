
require("dotenv").config();

const mysql = require("mysql2");
const fs = require("fs");
const path = require("path");

const caPath =
    process.env.NODE_EXTRA_CA_CERTS ||
    path.join(__dirname, "ca.pem");

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "defaultdb",

    ssl: {
        ca: fs.readFileSync(caPath),
        rejectUnauthorized: true
    },

    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error("MySQL connection failed:", err.message);
        return;
    }

    console.log("Aiven MySQL pool connected successfully!");
    connection.release();
});

module.exports = db;
