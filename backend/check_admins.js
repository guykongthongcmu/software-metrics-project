const mysql = require('mysql2/promise');

async function checkAdmins() {
    const config = { host: '127.0.0.1', port: 3307, user: 'root', password: 'rootpass', database: 'core_co' };
    const pool = mysql.createPool(config);
    try {
        const [rows] = await pool.query('SELECT email, password_hash FROM admin');
        console.table(rows);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkAdmins();
