
const mysql = require('mysql2/promise');

async function run() {
    const config = {
        host: '127.0.0.1',
        port: 3307,
        user: 'root',
        password: 'rootpass',
        database: 'core_co',
    };

    try {
        const pool = mysql.createPool(config);
        console.log('--- Connecting to DB at 127.0.0.1:3307 ---');
        
        // 1. Update Orders
        const updateOrders = `
            UPDATE orders 
            SET 
            created_at = DATE_SUB('2026-03-25 12:00:00', INTERVAL (FLOOR(RAND() * 29) + 1) DAY),
            status = CASE 
                WHEN order_id % 3 = 0 THEN 'DELIVERED'
                WHEN order_id % 3 = 1 THEN 'SHIPPED'
                ELSE 'PROCESSING'
            END
            WHERE order_id > 0
        `;
        const [res1] = await pool.execute(updateOrders);
        console.log(`Updated ${res1.affectedRows} orders.`);

        // 2. Update Analytics Events
        const updateEvents = `
            UPDATE analytics_event
            SET 
            created_at = DATE_SUB('2026-03-25 12:00:00', INTERVAL (FLOOR(RAND() * 29) + 1) DAY)
            WHERE event_id > 0
        `;
        const [res2] = await pool.execute(updateEvents);
        console.log(`Updated ${res2.affectedRows} analytics events.`);

        // 3. Verify
        const verify = `
            SELECT 
            status,
            COUNT(*) as total_orders, 
            SUM(total) as revenue_sum
            FROM orders 
            WHERE created_at >= DATE_SUB('2026-03-25', INTERVAL 30 DAY)
            AND status IN ('PROCESSING', 'SHIPPED', 'DELIVERED')
            GROUP BY status
        `;
        const [rows] = await pool.execute(verify);
        console.table(rows);

        console.log('--- Success! ---');
        await pool.end();
    } catch (err) {
        console.error('Error updating database:', err);
    }
}

run();
