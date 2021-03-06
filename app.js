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
var UserData = require('./schemas/user-data');
var UserAccident = require('./schemas/user-accident');

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
    let topicEamTest = mqttProfile.topic_eam_test + '#';

    let topicList = [ topicSensor, topicSensorTest, topicAction, topicActionTest, topicEam, topicEamTest ];


    client.subscribe(topicList, function (err) {
        if (err) {
            console.log(err);
            process.exit(1);
        }
        console.log('subscribed topic: ', topicList);
    });
});

client.on('error', function (err) {
    console.log(err);
    process.exit(1);
});

// String userId로 식별
// 각 userId마다 저장하는 데이터:
// Boolean calcEnabled  // 보폭수 측정 여부
// String deviceId
// String sensorId
// Number dataCnt       // 측정된 데이터 수
// Number stepSum       // 측정된 보폭수의 총합
// Date stepStartTime
// Date stepEndTime
// avgStride
// walkingSpeed
// => deviceId, sensorId는 옵션, 일단은 항목으로 집어넣도록 한다.
var userList = {};

client.on('message', function (topic, message, packet) { // MQTT로 전송되는 데이터는 Buffer형이다.
    // 토픽 끝의 슬래시 기호(/)를 제거한다. -> 테스트 토픽에도 동시에 적용 가능
    // 테스트 토픽에는 _test가 붙으며, 마지막 슬래시 기호를 제거함으로써 토픽 문자열 포함 여부를 테스트 토픽과 일반 토픽을 따로 구현할 필요가 없어진다.
    let topicSensor = mqttProfile.topic_sensor.substr(0, mqttProfile.topic_sensor.length - 1);
    let topicAction = mqttProfile.topic_action.substr(0, mqttProfile.topic_action.length - 1);
    let topicEam = mqttProfile.topic_eam.substr(0, mqttProfile.topic_eam.length - 1);

    let msgObj = JSON.parse(message.toString());

    // TEST Code /////////////////////////////////////
    console.log('topic: ' + topic);
    // console.log('topicSensor: ' + topicSensor);
    // console.log('topicAction: '+ topicAction);
    // console.log('topicEam: '+ topicEam);
    // console.log(msgObj);
    //////////////////////////////////////////////////

    // 1. EAM 토픽을 통해 보폭수 측정 트리거 신호가 들어온다.
    // order_enable_calculate_step_length
    // order_disable_calculate_step_length
    // 2. EAM 토픽을 통해 액션과 관련된 상태 정보(낙상 시 정보)가 들어온다고 한다. (enum MQTT_ACTION_SIG_ENUM)
    /* topic: eam */
    if (topic.indexOf(topicEam) != -1) {
        console.log("** eam message received **");

        let userId = msgObj.userId; // EAM의 userId
        let datetime = getDate(msgObj.datetime);
        let enableStep = false;
        let disableStep = false;
        let accidentActionList = new Array();

        let userData;

        if (typeof msgObj.order_enable_calculate_step_length !== 'undefined') {
            enableStep = Boolean(Number(msgObj.order_enable_calculate_step_length));
        }
        if (typeof msgObj.order_disable_calculate_step_length !== 'undefined') {
            disableStep = Boolean(Number(msgObj.order_disable_calculate_step_length));
        }
        if (typeof msgObj.accident_action_list !== 'undefined') {
            console.log(' * accident! *');
            console.dir(msgObj.accident_action_list);
            accidentActionList = msgObj.accident_action_list; // 정수 배열 형태로 입력
        }
        if (typeof msgObj.calibrated_stride !== 'undefined') {
            userList[userId].avgStride = msgObj.calibrated_stride;
            userList[userId].FLAG |= 0x02;
        }
        if (typeof msgObj.calibrated_walking_speed !== 'undefined') {
            userList[userId].walkingSpeed = msgObj.calibrated_walking_speed;
            userList[userId].FLAG |= 0x01;
        }

        console.log('userId: ' + userId);
        console.log('datetime: ', datetime);
        console.log('enableStep: ', enableStep);
        console.log('disableStep: ', disableStep);
        console.log(accidentActionList);

        if (accidentActionList.length) {
            let userAccident = new UserAccident();
            userAccident.userId = userId;
            userAccident.fallingTime = datetime;
            userAccident.accidentActionList = accidentActionList;
            userAccident.save(function (err) {
                if (err) {
                    console.error(err);
                    client.end();
                    mongoose.disconnect();
                    process.exit(1);
                }
                console.log(' * accident data saved *');
            });
        }

        if (enableStep) { // 보폭수 측정 시작 신호
            if (typeof userList[userId] === 'undefined' || !userList[userId].calcEnabled) {
                console.log(' * 보폭수 측정 시작! *');
                userList[userId] = {};
                userList[userId].stepStartTime = datetime;
                userList[userId].dataCnt = 0;
                userList[userId].stepSum = 0;
                userList[userId].FLAG = 0;
                userList[userId].calcEnabled = true;
            }
        }
        else if (disableStep) { // 보폭 수 측정 종료 신호
            if (typeof userList[userId] !== 'undefined' && userList[userId].calcEnabled) {
                console.log(' * 보폭수 측정 종료 *');
                userList[userId].stepEndTime = datetime;
                // 측정 시간 시작과 끝의 구간을 초 단위로 계산
                //let elapsedTime = (userList[userId].stepEndTime - userList[userId].stepStartTime) / 1000;
                // 평균 보폭 계산
                //let avgStride = userList[userId].stepSum / userList[userId].dataCnt;
                // 이동 속도 계산
                //let speed = 0.0; // TODO
                // ** 평균 보폭과 이동 속도는 eam 토픽 메시지로 전달되는 것으로 결정 **
            }
        }

        if (typeof userList[userId] !== 'undefined' && userList[userId].FLAG == 0x03) {
            // DB 입력을 위한 스키마 인스턴스 생성
            userData = new UserData();
            userData.userId = userId;
            userData.deviceId = userList[userId].deviceId;
            userData.sensorId = userList[userId].sensorId;
            userData.avgStride = userList[userId].avgStride;
            userData.speed = userList[userId].walkingSpeed;
            userData.stepStartTime = userList[userId].stepStartTime;
            userData.stepEndTime = userList[userId].stepEndTime;
            userList[userId].calcEnabled = false;
            userData.save(function (err) {
                if (err) {
                    console.error(err);
                    client.end();
                    mongoose.disconnect();
                    process.exit(1);
                }
                console.log(' * data saved *');
            });
        }
    }
    /* topic: action */
    else if (topic.indexOf(topicAction) != -1) {
        console.log("** action message received **");
    }
    /* topic: sensor data */
    else if (topic.indexOf(topicSensor) != -1) {
        console.log("** sensordata message received **");
        let userId = msgObj.userId; // sensor의 userId

        console.log('userId: ' + userId);
        
        if (typeof userList[userId] !== 'undefined' && userList[userId].calcEnabled) {
            if (userList[userId].calcEnabled) { // 측정 중일 때만 테이블을 갱신한다.
                userList[userId].deviceId = msgObj.deviceId;
                userList[userId].sensorId = msgObj.sensorId;
                userList[userId].dataCnt++;
                userList[userId].stepSum = Number(msgObj.pedoCount); // pedoCount는 누적합으로 제공된다.
            }
        }
    }


    /*
    if (topic.indexOf(topicAction) != -1) {
        let userId = msgObj.userid; // action의 userid
        let calcEnabled = Boolean(Number(msgObj.enable_calculate_step_length));
        
        if (calcEnabled) { // 보폭 측정 시작
            userList[userId].calcEnabled = true;
            userList[userId].dataCnt = 0;
            userList[userId].stepSum = 0;
        }
        else { // 보폭 측정 종료
            if (userList[userId]) {
                // userId 항목이 존재하고 보폭 측정 종료 신호가 수신되면 평균 보폭을 계산하여 데이터베이스에 저장한다.
                userList[userId].calcEnabled = false;
                let avgStride = userList[userId].stepSum / userList[userId].dataCnt;
                let sensorData = new SensorData();
                sensorData.userId = userId;
                sensorData.deviceId = userList[userId].deviceId;
                sensorData.sensorId = userList[userId].sensorId;
                sensorData.avgStride = avgStride;
                sensorData.datetime = new Date();

                // 데이터베이스에 평균 보폭을 포함한 데이터를 입력한다.
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
            }
        }

    }
    else if (topic.indexOf(topicSensor) != -1) {
        let userId = msgObj.userId; // sensor의 userId
        if (userList[userId].calcEnabled) { // 측정 중일 때만 테이블을 갱신한다.
            userList[userId].deviceId = msgObj.deviceId;
            userList[userId].sensorId = msgObj.sensorId;
            userList[userId].dataCnt++;
            userList[userId].stepSum += Number(msgObj.pedoCount);
        }
    }
    */

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
