const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function addCurlAdmin() {
    const config = { host: '127.0.0.1', port: 3307, user: 'root', password: 'rootpass', database: 'core_co' };
    const pool = mysql.createPool(config);
    try {
        const email = 'curl.admin@local.test';
        const password = 'secret123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await pool.query(`INSERT INTO admin (email, password_hash, display_name, is_active) 
                          VALUES (?, ?, 'Curl Admin', 1) 
                          ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`, [email, hashedPassword]);
        console.log(`--- SUCCESS --- Admin ${email} is now ready with password ${password}`);
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

addCurlAdmin();
