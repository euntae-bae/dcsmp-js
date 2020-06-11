const mongoose = require('mongoose');

const { Schema } = mongoose;
const userSchema = new Schema({
    userId: {
        type: String,
        required: true
    },
    deviceId: String,
    sensorId: String,
    stepMean: {
        type: Number,
        default: 0
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
    }
});

module.exports = mongoose.model('UserData', userSchema);