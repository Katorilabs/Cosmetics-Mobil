const express = require('express');
const router = express.Router();
const Product = require('../models/Product'); 


router.get('/', async (req, res) => {
    try {
        const products = await Product.find(); 
        res.json(products); 
    } catch (error) {
        res.status(500).json({ message: "Ürünler getirilirken hata oluştu" });
    }
});

module.exports = router;