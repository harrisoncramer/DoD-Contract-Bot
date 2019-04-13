const util = require("util");
const { twitBot } = require("./modules");

const asyncForEach = async(array, callback) => {
    let results = [];
    for (let index = 0; index < array.length; index++) {
        let result = await callback(array[index]);
        results.push(result);
    }
    return results;
};

const formatNumber = (number) => {
    var splitNum;
    number = Math.abs(number);
    number = number.toFixed(0);
    splitNum = number.split('.');
    splitNum[0] = splitNum[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return splitNum.join(".");
};

const tweet_crafter = async (array, id) => new Promise(async(resolve) => {
    for(let i = 1; i < array.length; i++){
        let content = await post_promise('statuses/update', { status: array[i], in_reply_to_status_id: id });
        id = content[0].id_str;
        if(i === array.length - 1){
            resolve(`All tweets posted!`); // When loop has finished, resolve promise...
        }
    };
});

const post_promise = util.promisify( // Wrap post function w/ promisify to allow for sequential posting.
    (options, data, cb) => twitBot.post(
      options,
      data,
      (err, ...results) => cb(err, results)
    )
);

module.exports = {
    asyncForEach,
    formatNumber,
    tweet_crafter,
    post_promise
}