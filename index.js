const functions = require('firebase-functions');
const { BigQuery } = require('@google-cloud/bigquery');
const webHook = require('@slack/webhook').IncomingWebhook;

const PROJECT_NAME = 'YOUR_PROJECT_NAME';
const BIGQUERY_DATASOURCE = 'YYOUR_BIGQUERY_DATASOURCE';
const BIGQUERY_TABLE = 'YOUR_BIGQUERY_TABLE';

const SLACK_BOT_APP_ID = 'YOUR_BOT_APP_ID';
const SLACK_WEBHOOK_URL = "YOUR_BOT_CHANNEL_URL";
const SLACK_WEBHOOK = new webHook(SLACK_WEBHOOK_URL);

exports.getIssueResponse = functions.https.onRequest(async (request, response) => {
  try {
    let request_body = request.body;
    functions.logger.info("Received Request!", { structuredData: true });
    functions.logger.info('request body', request_body, { structuredData: true });
    if (request_body.type && request_body.type == 'url_verification') {
      response.send(request_body.challenge);
    } else if (request_body.api_app_id === SLACK_BOT_APP_ID) {
      response.sendStatus(200);
      await processIssueBotRequest(request_body);
    } else {
      const error = new Error('Missing/undefined or unknown api app id: ' + request.api_app_id);
      error.code = 500;
      throw error;
    }
  } catch (err) {
    console.error(err);
    response.sendStatus(200);
  }
});
async function processIssueBotRequest(request_body) {
  console.log('processIssueBotRequest');
  if (request_body.type && request_body.type == 'event_callback') {
    let event_response = await getEventResponse(request_body.event);
    if (event_response) {
      await sendToSlack(event_response, SLACK_WEBHOOK);
    }
  }
  else {
    const error = new Error('IssueBot: Missing or unknown request.body.type');
    error.code = 500;
    throw error;
  }
}

async function getEventResponse(event) {
  let response = '';
  if (event.subtype !== 'bot_message') {
    if (event.type === 'message' && event.text) {
      let short_code = event.text;
      response = await getIssueResponse(short_code);
    }
  }

  return response;
}
async function getIssueResponse(short_code) {
  let query = 'SELECT response FROM `' + PROJECT_NAME + '.' + BIGQUERY_DATASOURCE + '.' + BIGQUERY_TABLE + '` WHERE short_code = "' + short_code + '" LIMIT 1;'
  let response = '';
  const responses = await getBigQueryRows(query);
  if (responses.length > 0) {
    response = responses[0].response;
  }
  return response;
}

/**
 * Returns the data retrieved from running a query on a BigQuery dataset.
 *
 * @param {String} query
 */
async function getBigQueryRows(query) {
  return new Promise((resolve, reject) => {
    console.log('Executing query: ' + query);
    const bigquery = new BigQuery();
    let rows = [];
    bigquery.createQueryStream(query)
      .on('error', function (err) {
        console.log(err);
        reject(err);
      })
      .on('data', function (row) {
        rows.push(row);
      })
      .on('end', function () {
        resolve(rows);
      });
  });
}

async function sendToSlack(message, webhook) {
  console.log('sendToSlack message: ' + message);
  await webhook.send({
    text: message
  });
}
