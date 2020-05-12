const mongoose = require('mongoose');

const { Schema } = mongoose;
const sensorSchema = new Schema({
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
    pedoCount: {
        type: Number,
        required: true
    },
    datetime: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('SensorData', sensorSchema);