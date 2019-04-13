const logger = require("../logger");
const cheerio = require("cheerio");
const fs = require("fs");
const util = require("util");
const moment = require("moment");
const path = require("path");
const _ = require("lodash");

const { formatNumber, tweet_crafter, post_promise } = require("../util");
const { environment } = require("../keys/config");

const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

const fetchContracts = async (url, page) => { 
    try { // Connect to page, get all links...        
        await page.goto(url, { waitUntil: 'networkidle2' }); // Ensure no network requests are happening (in last 500ms).        

        const teams = await page.evaluate(() => {

            // Helper function...
            const data = [];
            const DATES_SELECTOR = 'div.title';
            let dates = document.querySelectorAll(DATES_SELECTOR)
            dates.forEach(date => {
                data.push({ 
                    link: date.querySelector("a").href,
                    date: date.innerText.trim().substr(14, date.innerText.trim().length)
                })
            });
            return data;
        });

        return teams
    }
    catch(err){
        throw err;
    }
};

const bot = (page, today) => new Promise((resolve, reject) => {

    const url = `https://dod.defense.gov/News/Contracts/`; // Fetch today's data...

    fetchContracts(url, page)
    .then(async(contracts) => { // Get the links to all of the new contracts...
        contracts = contracts.filter(contract => moment(new Date(contract.date)).format("MM-DD-YYYY") === today).map(contract => {
            if(!_.isEmpty(contract)){
                let res = { date: moment(new Date(contract.date)).format("MM-DD-YYYY"), link: contract.link };
                return res;
            }
        });
        if(contracts.length !== 0){
            await page.goto(contracts[0].link, { waitUntil: 'networkidle2' }); // Go to today and get the info...
            let html = await page.content();
            return { html, link: contracts[0].link, date: contracts[0].date };
        } else {
            return Promise.reject(`No results found for ${today}`)
        }
        
    })
    .then(({ html, link, date }) => new Promise(async(resolve,reject) => {
        // Write to JSON, return array of lines + date name...
        if(html && link && date){
            const capturedFilePath = environment === "production" ? "../captured/contracts.json" : "../captured/contracts-test.json"
            let fileContent = await readFile(path.resolve(__dirname, capturedFilePath), { encoding: 'utf8' })
            let JSONfile = JSON.parse(fileContent); // Old data...
            link = link.replace(/^https?\:\/\//i, ""); // Dealing w/ different protocols...
            let isOld = JSONfile.filter(jsonObj => jsonObj.link.replace(/^https?\:\/\//i, "") === link).length; // If the object exists within our current array, === 1
            if(!isOld){ // If the object is new...
                let allData = JSON.stringify(JSONfile.concat({ link, date }));
                await writeFile(path.resolve(__dirname, capturedFilePath), allData, 'utf8');
                const $ = cheerio.load(html);
                
                let allDivs = [];
                await $("div.container div[itemProp='articleBody'] p").each(function(index, value){
                    var div = $(this).text();
                    allDivs.push(div);
                });

                if(allDivs.length === 0){
                    await $("div.container div[itemProp='articleBody'] div").each(function(index, value){
                        var div = $(this).text();
                        allDivs.push(div);
                    });
                }

                if(allDivs.length === 0){
                    reject("Problem scraping data.");
                }

                let lines = allDivs.filter(ln => (ln.trim() !== "" && ln.substr(0, 1) != "*")).map(ln => ln.trim());
                resolve({ link, lines });

            } else {
                reject("No updates found.");
            }
        } else {
            reject("Data from HTML is flawed.");
        }
    }))
    .then(async({ link, lines }) => { // Parse into a single twitter object...
        
        let results = {};
        let current = null;
        for(i = 0; i < lines.length; i++){
            if((lines[i].toUpperCase() === lines[i]) && lines[i].indexOf("CORRECTION") === -1){ // Getting rid of those...
                results[lines[i]] = [];
                current = lines[i];
                continue;
            }
            if(current && lines[i].indexOf("CORRECTION") === -1){ // Getting rid of those...
                results[current].push(lines[i]);
            }                
        };

        let agencies = Object.keys(results);
        for(agency of agencies){
            if(results[agency].length === 0){
                delete results[agency]
            }
        }


    return { results, link: "https://".concat(link) };
    })
    .then(async({ results, link }) => { // Write tweets...

        let agencies = Object.keys(results);
        let grandTotalContracts = 0;
        let grandNumContracts = 0;

        let subsequentTweets = agencies.map((agency) => {
            let contracts = results[agency];
            let biggest = 0;
            let agencyTotal = 0;
            let winner = null;
            let trueAgencyNumber = 0;

            for(const contract of contracts){
                let n = contract.match(/\$([0-9.,]+)/) // Find value of contract (must build failsafe if contract value is undefined...)
                if(n){
                    trueAgencyNumber++
                    let n2 = n[1].replace(/[,.]/g, "");
                    let nInt = parseInt(n2);
                    grandTotalContracts += nInt;  
                    agencyTotal += nInt;
                
                    // Determine biggest contract...
                    if(!contract.includes("will compete") && nInt > biggest){  // Determining largest contract...
                        winner = contract.substring(0, contract.indexOf(","));
                        biggest = nInt;
                    } else if (contract.includes("will compete") && nInt > biggest){
                        winner = "multiple vendors";
                        biggest = nInt;
                    }
                }
            }

            grandNumContracts += trueAgencyNumber;
            let isMultiple = trueAgencyNumber > 1 ? `The largest went to ${winner} for $${formatNumber(biggest)}.` : `It went to ${winner}.`;
            let isContracts = trueAgencyNumber > 1 ? "contracts" : "contract";
            let message = `${agency} has awarded ${trueAgencyNumber} ${isContracts} for $${formatNumber(agencyTotal)}. ${isMultiple}`;
            return message;
        });
            
        let firstTweetMsg = `The Pentagon has awarded ${grandNumContracts} contracts for $${formatNumber(grandTotalContracts)}. Get the details at ${link}.`;
        return { firstTweetMsg, subsequentTweets };     

    })
    .then(async({ firstTweetMsg, subsequentTweets }) => new Promise((resolve, reject) => { // Post tweets...

        if(environment === "production"){
            post_promise('statuses/update', { status: `${firstTweetMsg}` })
            .then((top_tweet) => {
                let starting_id = top_tweet[0].id_str; // Get top-line tweet ID...
                return tweet_crafter(subsequentTweets, starting_id); // Return once tweets posted...
            })
            .then((res) => {
                logger.info(`DoD Contracts Check –– Tweets sent.`);
                resolve(res);
            })
            .catch(err => {
                if(err.code == 187){
                    reject("Tweets already sent.")
                } else {
                    reject(err);
                }  
            });
        } else {
            reject("Not in production, not sending tweets.");
        }
    }))
    .then((res) => resolve(res)) // resolve the main promise...
    .catch(err => {
        if(["No results on page.", "No updates found.", "Tweets already sent.", "Problem scraping data.", "Not in production, not sending tweets.",`No results found for ${today}`].includes(err)){
            logger.info(`DoD Contracts Check –– ${err}`);
            resolve();
        } else {
            reject(err);
        }
    })
});

module.exports = bot;
