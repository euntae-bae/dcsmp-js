const mongoose = require('mongoose');

const { Schema } = mongoose;
const accidentSchema = new Schema({
    userId: {
        type: String,
        required: true
    },
    fallingTime: { // 낙상 발생 시간
        type: Date,
        default: Date.now
    },
    accidentActionList: { // 낙상 정보
        type: [Number],
        default: []
    }
});

module.exports = mongoose.model('UserAccident', accidentSchema);