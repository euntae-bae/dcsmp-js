const mongoose = require('mongoose');

const { Schema } = mongoose;
const userSchema = new Schema({
    userId: {
        type: String,
        required: true
    },
    deviceId: {
        type: String,
        required: true
    },
    sensorId: {
        type: String,
        required: true
    },
    stepMean: {
        type: Number,
        required: true
    },
    speed: {
        type: Number,
        default: 0
    },
    stepStartTime: {
        type: Date,
        default: Date.now
    },
    stepEndTime: {
        type: Date,
        default: Date.now
    },
    fallenTime: { // 낙상 발생 시간
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('UserData', userSchema);