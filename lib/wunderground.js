const fetch = require('node-fetch');

const wundergroundBaseUrl = 'http://weatherstation.wunderground.com';
const wundergroundPath = '/weatherstation/updateweatherstation.php';

const url =  `${wundergroundBaseUrl}${wundergroundPath}`;

const WunderGround = ({id, passwd}) => {

  const sendObservations = (observ) => {

    const map = new Map();

    map.set('ID', id);
    map.set('PASSWORD', passwd);
    map.set('dateutc', 'now');
    map.set('action', 'updateraw');

    Object.keys(observ).forEach((key) => {
      map.set(key, observ[key]);
    });

    const params = new URLSearchParams(map);

    return fetch(`${url}?${params.toString()}`);

  };

  return {
    sendObservations
  };
};


module.exports = WunderGround;