const mysql = require('mysql2/promise');

async function fixSessions() {
    const config = { host: '127.0.0.1', port: 3307, user: 'root', password: 'rootpass', database: 'core_co' };
    const pool = mysql.createPool(config);
    try {
        console.log('--- Fixing sessions table structure ---');
        
        // 1. Add admin_id column
        await pool.query('ALTER TABLE sessions ADD COLUMN admin_id BIGINT UNSIGNED NULL AFTER user_id');
        
        // 2. Add subject_type column
        await pool.query(`ALTER TABLE sessions ADD COLUMN subject_type ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER' AFTER admin_id`);
        
        // 3. Make user_id nullable
        await pool.query('ALTER TABLE sessions MODIFY COLUMN user_id BIGINT UNSIGNED NULL');
        
        // 4. Update existing sessions to 'USER' type (just in case)
        await pool.query(`UPDATE sessions SET subject_type = 'USER' WHERE user_id IS NOT NULL`);
        
        console.log('--- SUCCESS --- sessions table is now compatible with admin login.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await pool.end();
    }
}

fixSessions();
