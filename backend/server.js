require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
const productRoutes = require('./routes/productRoutes');
app.use('/api/products', productRoutes);

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB veritabanına başarıyla bağlanıldı");
    })
    .catch((err) => {
        console.log("Veritabanı bağlantı hatası:", err);
    });

app.get('/', (req, res) => {
    res.send('Sunucu Başarıyla Çalışıyor!');
});
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} numaralı portta ayağa kalktı `);
});