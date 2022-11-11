const bunyan = require('bunyan');
const promClient = require('prom-client');
const express = require('express');
const WeatherLink = require('weatherlink');
const WunderGround = require('./lib/wunderground');

const server = express();

const requiredEnv = [
  'WEATHERLINK_API_KEY',
  'WEATHERLINK_API_SECRECT',
  'WEATHERLINK_STATION_ID',
  'WUNDERGROUND_ID',
  'WUNDERGROUND_KEY'
];

requiredEnv.forEach((env) => {
  if(!(process.env[env])){
    console.error(`Environment varible ${env} required.`)
    process.exit(1);
  }
});

let updateIntervalMins = 5;

if(process.env.UPDATE_INTERVAL_MINS) {
  updateIntervalMins = process.env.UPDATE_INTERVAL_MINS;
}

const updateIntervalMs = updateIntervalMins * 60 * 1000;

const weatherLink = WeatherLink({apiKey: process.env.WEATHERLINK_API_KEY, apiSecret: process.env.WEATHERLINK_API_SECRECT});
const weatherLinkStationId = process.env.WEATHERLINK_STATION_ID;

const wunderGround = WunderGround({id: process.env.WUNDERGROUND_ID, passwd: process.env.WUNDERGROUND_KEY});

const log = bunyan.createLogger({name: 'weatherlink-to-wundergound-pws'});

let sensorMap = require('./sensor_map.json')

// Prometheus Metrics
const weatherLinkApiReqLatency = new promClient.Gauge({
  name: 'weatherlink_api_request_latency',
  help: 'The time is takes in seconds to retrieve data from WeatherLink API',
  labelNames: ['status', 'station']
});

const weatherLinkApiReqCounter = new promClient.Counter({
  name: 'weatherlink_api_request_count',
  help: 'The number of requests recieved from WeatherLink API',
  labelNames: ['status', 'station']
});

const wunderGroundApiReqLatency = new promClient.Gauge({
  name: 'wunderground_api_request_latency',
  help: 'The time is takes in seconds to send data to WunderGround API',
  labelNames: ['status', 'station']
});

const wunderGroundApiReqCounter = new promClient.Counter({
  name: 'wunderground_api_request_count',
  help: 'The number of requests sent to WunderGround API',
  labelNames: ['status', 'station']
});

const updateCounter = new promClient.Counter({
  name: 'weather_update_count',
  help: 'Count of weather updates',
  labelNames: ['status']
}); 

const updateIntervalGauge = new promClient.Gauge({
  name: 'weather_update_interval_mins',
  help: 'The number of mins for expected update interval'
}); 

updateIntervalGauge.set(updateIntervalMins);

const updateTime = new promClient.Gauge({
  name: 'weather_update_run_time',
  help: 'The time in seconds it took to perform a weather update',
  labelNames: ['status']
});

const wundergroundWeatherStats = new promClient.Gauge({
  name: 'wunderground_weather_observations',
  help: 'The observations submitted to WunderGround',
  labelNames: ['name', 'station']
});

const weatherLinkWeatherStats = new promClient.Gauge({
  name: 'weatherlink_weather_observations',
  help: 'The observations submitted to WeatherLink',
  labelNames: ['name', 'station']
});



const getSensorData = async () => {

  const end = weatherLinkApiReqLatency.startTimer();

  try {

    const data = await weatherLink.getCurrent({stationId: weatherLinkStationId});
    end({status: 'success'});
    weatherLinkApiReqCounter.inc({status: 'success'});
    return data;

  } catch (err) {

    end({status: 'failed'});
    weatherLinkApiReqCounter.inc({status: 'failed'});
    throw new Error('Failed to retrieve WeatherLink weather station sensor information');

  }
};


const wlToWu = (sensorData) => {

  if('sensors' in sensorData && Array.isArray(sensorData.sensors) && sensorData.sensors.length > 0) {
    if('data' in sensorData.sensors[0] && Array.isArray(sensorData.sensors[0].data) && sensorData.sensors[0].data.length > 0){

      let wug = {};

      const observ = sensorData.sensors[0].data[0];

      Object.keys(observ).forEach((key) => {
        if(observ[key] !== null && typeof observ[key] == 'number') {
          weatherLinkWeatherStats.set({name: key}, observ[key]);
        }
      });

      Object.keys(sensorMap).forEach((key) => {
        if(Array.isArray(sensorMap[key])) {
          sensorMap[key].forEach((id) => {
            if(key in observ && observ[key] !== null) {
              wug[id] = observ[key];
              wundergroundWeatherStats.set({name: id}, observ[key]);
            }
          });
        } else {
          if(key in observ && observ[key] !== null) {
            wug[ sensorMap[key] ] = observ[key];
            wundergroundWeatherStats.set({name: sensorMap[key]}, observ[key]);
          }
        }
      });

      return wug;
     
    } else {
      throw new Error('WeatherLink weather station contains no sensors');
    }
  } else {
    throw new Error('WeatherLink weather station sensor information invalid');
  }
}; 


const runCollection = async () => {

  const end = updateTime.startTimer();

  try {

    log.info("Starting WeatherLink Collection");
    const sensorData = await getSensorData();
    log.info("WeatherLink Collection Complete");

    log.info("Converting WeatherLink Observation to Wundergound");
    const wug_observ = wlToWu(sensorData);
    log.info("Conversion Complete");

    log.info("Sending Observation to Wunderground");
    const wupdate_end = wunderGroundApiReqLatency.startTimer();

    try {
      await wunderGround.sendObservations(wug_observ);
      log.info("Successfully sent Observation to Wunderground");
      wupdate_end({status: 'success'});
      wunderGroundApiReqCounter.inc({status: 'success'});
    } catch (err) {
      wupdate_end({status: 'failed'});
      wunderGroundApiReqCounter.inc({status: 'failed'});
      throw err;
    }
    
    updateCounter.inc({status: 'success'});
    end({status: 'success'});

  } catch (err) {
    updateCounter.inc({status: 'failed'});
    end({status: 'failed'});
    log.error(err.message);
  }
};



server.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

const port = process.env.PORT || 3030;

server.listen(port);
log.info(
  `Server listening to ${port}, metrics exposed on /metrics endpoint`,
);

runCollection();

setInterval(() => {
  runCollection();
}, updateIntervalMs)
