# weatherlink-to-wundergound-pws
Connects to the WeatherLink v2 API and forwards current weather observations to Weather Underground PWS

## Setup

You will need a few pieces of information.

1. WeatherLink API Key V2
2. WeatherLink API Secret
3. WeatherLink Station ID (this is different than the one in the Web UI)
4. Weather Underground Station ID
5. Weather Underground Station Password 

You will need to create the following Environmental Variable. 

```
WEATHERLINK_API_KEY=<your_weatherlink_api_key>
WEATHERLINK_API_SECRECT=<your_weatherlink_api_secret>
WEATHERLINK_STATION_ID=<your_weatherlink_station_id>
WUNDERGROUND_ID=<your_wunderground_station_id>
WUNDERGROUND_KEY=<your_wunderground_station_key>
```

Then run
```
npm install
npm start
```

## Running in Docker
Edit docker-compose file with Environmental variables.

Run docker build
```docker build -t weatherlink-to-wundergound-pws .```

Run docker-compose
```docker-compose up```

## Basics
This will collect WeatherLink Station data and forward it to Weather Underground PWS every 5 mins.  The default sensor mapping is in the sensor_map.json file.  You may edit the sensor map file for any personal preferences.

```
cat sensor_map.json
{
  "temp_out": "tempf",
  "hum_out": "humidity",
  "bar": "baromin",
  "wind_speed": "windspeedmph",
  "wind_gust_10_min": ["windgustmph", "windgustmph_10m"],
  "wind_dir": "winddir",
  "rain_rate_in": "rainin",
  "rain_day_in": "dailyrainin",
  "uv": "UV",
  "solar_rad": "solarradiation",
  "dew_point": "dewptf",
  "temp_soil_1": "soiltempf"
}
```
## Monitoring
There is a Prometheus metrics endpoint you can scrap.  This will provide metrics on how the collection process is running.  It will also provide the raw WeatherLink observations as well as the observations in the Weather Underground format.
``` http://<server>:3030/metrics```