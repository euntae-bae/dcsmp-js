/*
const MQTT_KEEPALIVE_VAL = 20;
const MQTT_QOS_LEVEL = 1;

const MQTT_SERVER_DOMAIN = 'buddybot.k8s.bns.co.kr';
const MQTT_SERVER_PORT = 51883;
const MQTT_AUTH_ID = 'mqtt';
const MQTT_AUTH_PSWD = 'BNSoftBUDDY';

const MQTT_ACTION_TOPIC = 'buddybot/action/';
const MQTT_ACTION_TEST_TOPIC = 'buddybot/action_test';
const MQTT_SENSOR_TOPIC = 'buddybot/sensordata/';
const MQTT_SENSOR_TEST_TOPIC = 'buddybot/sensordata_test';
*/

module.exports = {
    keepalive: 20,
    qoslevel: 1,
    serverDomain: 'buddybot.k8s.bns.co.kr',
    serverPort: 51883,
    authId: 'mqtt',
    authPasswd: 'BNSoftBUDDY',
    topic_action: 'buddybot/action/',
    topic_action_test: 'buddybot/action_test/',
    topic_sensor: 'buddybot/sensordata/',
    topic_sensor_test: 'buddybot/sensordata_test/',
    topic_eam: 'buddybot/eam/'
};