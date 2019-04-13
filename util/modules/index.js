// Set up Twit twitBot...
const Twit = require('twit');
const { twitConfig } = require('../../keys/config');
const twitBot = new Twit(twitConfig);

// Export full twitBot...
module.exports = {
    twitBot
};