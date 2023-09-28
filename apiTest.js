const fs = require('fs');
const axios = require('axios');
const mysql = require('mysql2/promise');

const url = 'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

async function getP2PData(page, rows, tradeType, payTypes) {
    const headers = { 'content-type': 'application/json' };
    const requestData = {
        page: page,
        rows: rows,
        asset: 'USDT',
        fiat: 'UAH',
        tradeType: tradeType,
        payTypes: payTypes,
    };

    try {
        const response = await axios.post(url, requestData);

        if (response.status !== 200) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        return response.data;
    } catch (error) {
        console.error('Error:', error.message);
        throw error;
    }
}

async function createTableIfNotExists(connection, tableName) {
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      advertiserName VARCHAR(255),
      price DECIMAL(10, 2)
    )
  `);
}

async function clearTable(connection, tableName) {
    await connection.execute(`DELETE FROM ${tableName}`);
}

async function main() {
    const maxRows = 20;
    const tradeTypes = ['SELL', 'BUY'];
    const payTypes = ['Monobank'];
    const dbConfig = {
        host: 'localhost',
        user: 'root',
        password: '123456789_qQ',
        database: 'binance',
    };

    const connection = await mysql.createConnection(dbConfig);

    try {
        for (const tradeType of tradeTypes) {
            const tableName = `binance_data_${tradeType.toLowerCase()}`;
            await createTableIfNotExists(connection, tableName);
            await clearTable(connection, tableName);

            let page = 0;
            const rows = [];
            let count = 0;

            while (page < 5 && count < 5) {
                page += 1;
                const data = await getP2PData(page, maxRows, tradeType, payTypes);

                if (data.data.length === 0) {
                    break;
                }

                for (const item of data.data) {
                    const advertiserName = item.advertiser.nickName;
                    const price = item.adv.price;

                   //Checking
                    if (item.adv.tradeMethods.length == 1 && item.adv.tradeMethods[0].tradeMethodName === "Monobank") {
                        if (item.adv.maxSingleTransAmount >= 4999) {
                            rows.push([advertiserName, price]);
                            count += 1;
                        }
                    }
                    if (count === 5) {
                        break;
                    }
                }
            }

            for (const row of rows) {
                const [advertiserName, price] = row;
                await connection.execute(
                    `INSERT INTO ${tableName} (advertiserName, price) VALUES (?, ?)`,
                    [advertiserName, price]
                );
            }
        }

        // Testing
        const [resultsSell] = await connection.execute('SELECT * FROM binance_data_sell');
        const [resultsBuy] = await connection.execute('SELECT * FROM binance_data_buy');
        console.log('DATA (SELL):');
        console.log(resultsSell);
        console.log('DATA (BUY):');
        console.log(resultsBuy);
    } catch (error) {
        console.error('DB Error', error);
    } finally {
        await connection.end();
    }
}

main();
