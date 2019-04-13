require('dotenv').config();

const twitConfig = {
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  access_token: process.env.ACCESS_TOKEN,
  access_token_secret: process.env.ACCESS_TOKEN_SECRET,
};

const environment = process.env.NODE_ENV;
const schedule = process.env.NODE_ENV === "development" ? '* * * * *' : '*/15 * * * *';

module.exports = {
  twitConfig, 
  environment,
  schedule
};

// From dotenv file...
// CONSUMER_KEY=
// CONSUMER_SECRET=
// ACCESS_TOKEN=
// ACCESS_TOKEN_SECRET= 
//
// And so forth...
//