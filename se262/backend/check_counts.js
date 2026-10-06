
const mysql = require('mysql2/promise');

async function run() {
    const config = { host: '127.0.0.1', port: 3307, user: 'root', password: 'rootpass', database: 'core_co' };
    const pool = mysql.createPool(config);
    try {
        const [rows1] = await pool.execute('SELECT COUNT(*) as count FROM orders');
        const [rows2] = await pool.execute('SELECT COUNT(*) as count FROM analytics_event');
        console.log(`Orders: ${rows1[0].count}, Analytics Events: ${rows2[0].count}`);
        
        if (rows1[0].count === 0) {
            console.log('No orders found. Inserting dummy orders...');
            // I'll skip inserting for now to avoid mess, just check first.
        }
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
