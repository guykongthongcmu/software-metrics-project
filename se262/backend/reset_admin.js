const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function resetAdmin() {
    const config = { host: '127.0.0.1', port: 3307, user: 'root', password: 'rootpass', database: 'core_co' };
    const pool = mysql.createPool(config);
    try {
        const email = 'admin@coreco.test';
        const password = 'secret123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await pool.query('UPDATE admin SET password_hash = ? WHERE email = ?', [hashedPassword, email]);
        console.log(`--- SUCCESS --- Admin ${email} password reset to ${password}`);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

resetAdmin();
