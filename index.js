const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();
const app = express();
app.use(cors());

const port = 3000;
const server = app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});

const wssPrice = new WebSocket.Server({ noServer: true });
const wssOrderBook = new WebSocket.Server({ noServer: true });

let stocks = JSON.parse(fs.readFileSync('stocks.json'));
stocks.forEach((stock) => {
    stock.originalPrice = stock.price;
});
// 模擬股票價格
function simulateStockPriceChanges() {
    const updatedStocks = [];
    const changeCount = Math.floor(Math.random() * Math.ceil(stocks.length / 2)) + 1;
    const selectedIndexes = new Set();
    while (selectedIndexes.size < changeCount) {
        const randomIndex = Math.floor(Math.random() * stocks.length);
        selectedIndexes.add(randomIndex);
    }
    selectedIndexes.forEach((index) => {
        const stock = stocks[index];
        const minPrice = stock.originalPrice * 0.9;
        const maxPrice = stock.originalPrice * 1.1;

        let change = (Math.random() * 2 - 1) * 0.01;
        let newPrice = stock.price + stock.price * change;
        if (newPrice < minPrice) newPrice = minPrice;
        if (newPrice > maxPrice) newPrice = maxPrice;

        stock.price = parseFloat(newPrice.toFixed(stock.price >= 500 ? 0 : stock.price >= 50 ? 1 : 2));
        stock.amountChange = parseFloat((stock.price - stock.originalPrice).toFixed(2));
        stock.change = parseFloat(((stock.amountChange / stock.originalPrice) * 100).toFixed(2));

        updatedStocks.push({
            symbol: stock.symbol,
            price: stock.price,
            amountChange: stock.amountChange,
            change: stock.change,
        });
    });
    if (updatedStocks.length > 0) {
        wssPrice.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(updatedStocks));
            }
        });
    }
    const orderBookData = generateRandomOrderBook();
    wssOrderBook.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(orderBookData));
        }
    });
}
setInterval(simulateStockPriceChanges, 1000);

function generateRandomOrderBook() {
    const orderBook = { buy: [], sell: [] };
    for (let i = 1; i <= 5; i++) {
        orderBook.buy.push({
            price: parseFloat((Math.random() * 100 + 50).toFixed(2)), // 50 ~ 150 間
            volume: Math.floor(Math.random() * 1000 + 1),
        });
        orderBook.sell.push({
            price: parseFloat((Math.random() * 100 + 150).toFixed(2)), // 150 ~ 250 間
            volume: Math.floor(Math.random() * 1000 + 1),
        });
    }
    return orderBook;
}

server.on('upgrade', (request, socket, head) => {
    const pathname = request.url;

    if (pathname === '/ws/prices') {
        wssPrice.handleUpgrade(request, socket, head, (ws) => {
            wssPrice.emit('connection', ws, request);
        });
    } else if (pathname === '/ws/orderbook') {
        wssOrderBook.handleUpgrade(request, socket, head, (ws) => {
            wssOrderBook.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

// 即時股價
wssPrice.on('connection', (ws) => {
    console.log('📈 前端連接至即時股價');
    const simplifiedStocks = stocks.map(({ symbol, price, amountChange, change }) => ({ symbol, price, amountChange, change }));
    ws.send(JSON.stringify(simplifiedStocks));
    ws.on('close', () => console.log('📉 即時股價連線結束'));
});

wssOrderBook.on('connection', (ws) => {
    console.log('🛒 前端連接至買賣五檔');
    ws.send(JSON.stringify(generateRandomOrderBook()));
    ws.on('close', () => console.log('🚫 買賣五檔連線結束'));
});

// 股票API
app.get('/stockInfo', (req, res) => {
    res.status(200).json(stocks);
});
app.get('/', (req, res) => {
    res.send('📊 Stock Server Running');
});

module.exports = app;
