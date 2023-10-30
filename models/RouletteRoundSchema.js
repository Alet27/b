const mongoose = require('mongoose');

const RouletteRoundSchema = new mongoose.Schema({
    participants: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            betAmount: {
                type: Number,
                required: true
            },
            winChance: {
                type: Number,
                required: true
            },
            avatarUrl: String
        }
    ],
    winner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['waiting', 'in-progress', 'completed'],
        default: 'waiting'
    },
    gameBank: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('RouletteRound', RouletteRoundSchema);
