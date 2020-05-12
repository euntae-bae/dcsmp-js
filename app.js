var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var app = express();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

// Mongoose
//var connect = require('./schemas');
//connect(); // schemas/index.js에 함수로 정의됨
const mongoose = require('mongoose');
const dbProfile = require('./db-profile');
var SensorData = require('./schemas/sensor-data');

mongoose.connect(dbProfile.host, { useNewUrlParser: true, useUnifiedTopology: true, dbName: dbProfile.dbName, user: dbProfile.username, pass: dbProfile.password });

// MQTT
const mqtt = require('mqtt');
const mqttProfile = require('./mqtt-profile');
const options = {
    host: mqttProfile.serverDomain,
    port: mqttProfile.serverPort,
    protocol: 'mqtt',
    username: mqttProfile.authId,
    password: mqttProfile.authPasswd,
    keepalive: mqttProfile.keepalive
};

var client = mqtt.connect(options); // MQTT 클라이언트 인스턴스 생성

//const client = mqtt.connect('mqtt://127.0.0.1');
//const client = mqtt.connect('mqtt://165.246.43.245');

// topic: buddybot/sensordata_test/userId/deviceId/

client.on('connect', function () {
    console.log('on connect');
    console.log('connect options: ');
    console.dir(options);
    console.log();

    let topicSensor = mqttProfile.topic_sensor + '#';
    let topicSensorTest = mqttProfile.topic_sensor_test + '#'; // '#': 서브 토픽의 와일드 카드
    let topicAction = mqttProfile.topic_action + '#';
    let topicActionTest = mqttProfile.topic_action_test + '#';
    let topicEam = mqttProfile.topic_eam + '#';

    //let topicList = [ topicSensor, topicSensorTest, topicAction, topicActionTest, topicEam ];
    let topicList = [ topicSensor, topicSensorTest ];


    client.subscribe(topicList, function (err) {
        if (err) {
            console.log(err);
            process.exit(1);
        }
        console.log('subscribed topic: ', topicList);
    });

    // client.subscribe(topicSensorTest, function (err) { // mqttProfile.topic_sensor
    //     if (err) {
    //         console.log(err);
    //         process.exit(1);
    //     }
    //     console.log('subscribed topic: ' + topicSensorTest);
    // });
});

client.on('error', function (err) {
    console.log(err);
    process.exit(1);
});

client.on('message', function (topic, message, packet) { // MQTT로 전송되는 데이터는 Buffer형이다.
    console.log('topic: ' + topic);
    let msgObj = JSON.parse(message.toString());
    let sensorData = new SensorData();
    sensorData.userId = msgObj.userId;
    sensorData.deviceId = msgObj.deviceId;
    sensorData.sensorId = msgObj.sensorId;
    sensorData.stepMean = Number(msgObj.pedoCount);
    sensorData.datetime = getDate(msgObj.datetime);

    console.log(sensorData);
    sensorData.save(function (err) {
        if (err) {
            console.error(err);
            client.end();
            mongoose.disconnect();
            process.exit(1);
        }
        console.log('=> saved data');
    });
});

function getDate(datetimeStr) {
    let datetime = datetimeStr.split('.');

    let year = Number(datetime[0].substr(0, 4));
    let month = Number(datetime[0].substr(4, 2)) - 1; // 달은 0부터 시작한다.
    let date = Number(datetime[0].substr(6, 2));
    let hour = Number(datetime[0].substr(8, 2));
    let min = Number(datetime[0].substr(10, 2));
    let sec = Number(datetime[0].substr(12, 2));
    let ms = Number(datetime[1]);
    //console.log(month.toString() + '/' + date.toString());
    //console.log(hour.toString() + ':' + min.toString() + ':' + sec.toString() + '.' + ms.toString());
    return new Date(year, month, date, hour, min, sec, ms); // UTC를 사용하기 때문에 한국 시간(KST)보다 9시간 느리다.
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
