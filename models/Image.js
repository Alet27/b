const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ImageSchema = new Schema({
    data: Buffer,
    contentType: String,
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    imageUrl: {
        type: String,
        default: ""
    }
});

module.exports = mongoose.model('Image', ImageSchema);
