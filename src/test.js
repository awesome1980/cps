const moment = require('moment');

const timestamp = new Date();
console.log(timestamp.toISOString());

const date = moment(timestamp);
console.log(date.toISOString());
console.log(date.format('YYYY-MM-DD'));
console.log(date.format('YY-MM-DD'));
console.log(date.format('hh:mm:ss'));
