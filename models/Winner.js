const mongoose = require('mongoose');

const winnerSchema = new mongoose.Schema({
    name: String,
    amount: Number,
    chance: Number, 
    date: {
        type: Date,
        default: Date.now
    },
    winChance: Number,
    imageUrl: String 
});

module.exports = mongoose.model('Winner', winnerSchema);
