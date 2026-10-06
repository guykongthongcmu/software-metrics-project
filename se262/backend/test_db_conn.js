
const mysql = require('mysql2/promise');

async function test(port, user, password) {
    try {
        const conn = await mysql.createConnection({
            host: '127.0.0.1',
            port, user, password,
            database: 'core_co'
        });
        console.log(`Success on port ${port} with user ${user} and password ${password ? 'Yes' : 'No'}`);
        await conn.end();
        return true;
    } catch (e) {
        console.log(`Fail on port ${port} with user ${user}: ${e.message}`);
        return false;
    }
}

async function run() {
    await test(3306, 'root', 'rootpass');
    await test(3307, 'root', 'rootpass');
    await test(3306, 'root', '');
    await test(3307, 'root', '');
}
run();
