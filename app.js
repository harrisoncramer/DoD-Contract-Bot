const cron = require("node-cron");
const pupeteer = require("puppeteer");
const moment = require("moment");

const logger = require("./logger");
const contractBot = require("./bots/dodContractBot")

const { environment, schedule } = require("./keys/config.js");
logger.info(`Running bot in ${environment}`);

const launchDodChecks = async() => {
    logger.info(`Chrome Launched DoD-Checker...`); 
    const browser = await pupeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox']});
    const page = await browser.newPage(); // Create new instance of puppet
    let today = moment();

    await page.setRequestInterception(true) // Optimize (no stylesheets, images)...
    page.on('request', (request) => {
        if(['image', 'stylesheet'].includes(request.resourceType())){
            request.abort();
        } else {
            request.continue();
        }
    });

    try {
        await contractBot(page, today.format("MM-DD-YYYY"));
    } catch(err) {
        logger.debug(`DoD Bot -- ${err}`);
    }

    await page.close();
    await browser.close();
    logger.info(`Chrome Closed DoD-Checker.`);
}

if(environment === 'production'){
    cron.schedule(schedule, async () => {   
        launchDodChecks();
    });
} else if (environment === 'development') {
    launchDodChecks();
} else {
    logger.debug("Environment variable not set.")
}

