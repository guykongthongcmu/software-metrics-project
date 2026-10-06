
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
    const config = { host: '127.0.0.1', port: 3307, user: 'root', password: 'rootpass', database: 'core_co', multipleStatements: false };
    const pool = mysql.createPool(config);
    
    try {
        console.log('--- Reseeding Database (Robustly) ---');
        
        const seedPath = path.join(__dirname, '..', 'db', 'seeds', 'seed_products.sql');
        if (fs.existsSync(seedPath)) {
            const seedSql = fs.readFileSync(seedPath, 'utf8');
            // Split by ';' but be careful of content, for simple seeds it works
            const statements = seedSql.split(/;(?:\s*[\n\r]|$)/);
            
            for (let stmt of statements) {
                stmt = stmt.trim();
                if (!stmt || stmt.startsWith('--')) continue;
                try {
                    await pool.query(stmt);
                    console.log(`Executed: ${stmt.substring(0, 50)}... [Success]`);
                } catch (e) {
                    console.warn(`Warning: ${e.message} [Skipped Statement]`);
                }
            }
        }

        // 2. Perform the UPDATES for dashboard range
        console.log('--- Applying Date Range Updates ---');
        const nowStr = '2026-03-25 12:00:00';
        
        const updateOrders = `
            UPDATE orders 
            SET 
              created_at = DATE_SUB('${nowStr}', INTERVAL (FLOOR(RAND() * 29) + 1) DAY),
              status = 'DELIVERED'
            WHERE order_id > 0
        `;
        await pool.execute(updateOrders);

        const updateEvents = `
            UPDATE analytics_event
            SET 
              created_at = DATE_SUB('${nowStr}', INTERVAL (FLOOR(RAND() * 29) + 1) DAY)
            WHERE event_id > 0
        `;
        await pool.execute(updateEvents);

        // 3. Insert some extra analytics events for viewers
        console.log('--- Inserting extra viewers for metrics ---');
        for (let i = 0; i < 20; i++) {
          await pool.execute(`INSERT INTO analytics_event (session_id, event_type, created_at) VALUES ('session_${i}', 'PRODUCT_VIEW', DATE_SUB('${nowStr}', INTERVAL (FLOOR(RAND() * 10)) DAY))`);
        }

        console.log('--- SUCCESS! ---');
    } catch (err) {
        console.error('Fatal Error:', err);
    } finally {
        await pool.end();
    }
}

run();
