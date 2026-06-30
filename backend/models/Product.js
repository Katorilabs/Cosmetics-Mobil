const mongoose = require('mongoose');


const productSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    brand: { 
        type: String, 
        required: true 
    },
    category: { 
        type: String, 
        required: true 
    },
    ingredients: [{ 
        type: String 
    }],
    skinType: [{
        type: String 
    }]
}, { timestamps: true }); 

module.exports = mongoose.model('Product', productSchema);