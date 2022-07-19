const functions = require('firebase-functions');
const webHook = require('@slack/webhook').IncomingWebhook;

const { google } = require('googleapis');
const env = require('./env.json');
const SHEETS_SCOPES = env.SHEETS_SCOPES;
const SPREADSHEET_ID = env.SPREADSHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_CREDENTIALS = env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS;
const SLACK_BOT_APP_ID = env.SLACK_BOT_APP_ID;
const SLACK_WEBHOOK_URL = env.SLACK_WEBHOOK_URL;
const SLACK_WEBHOOK = new webHook( SLACK_WEBHOOK_URL );

exports.testSheets = functions.https.onRequest( async ( request, response ) => {
  const shortCode = request.query.code || request.body.code || 'list';
  if ( typeof shortCode != 'string' || shortCode.search( /^[a-z0-9]+$/i ) == -1 ) {
    response.status( 400 ).send( 'Invalid input' );
  }
  const result = await getIssueResponse( shortCode );
  response.status( 200 ).send( result );
})

exports.getIssueResponse = functions.https.onRequest( async ( request, response ) => {
  try {
    let request_body = request.body;
    functions.logger.info("Received Request!", { structuredData: true });
    functions.logger.info('request body', request_body, { structuredData: true });
    if ( request_body.type && request_body.type == 'url_verification' ) {
      response.send( request_body.challenge );
    } else if ( request_body.api_app_id === SLACK_BOT_APP_ID ) {
      response.sendStatus( 200 );
      await processIssueBotRequest( request_body );
    } else {
      const error = new Error( 'Missing/undefined or unknown api app id: ' + request.api_app_id );
      error.code = 500;
      throw error;
    }
  } catch ( err ) {
    console.error( err );
    response.sendStatus( 200 );
  }
});

async function processIssueBotRequest( request_body ) {
  console.log( 'processIssueBotRequest' );
  if ( request_body.type && request_body.type == 'event_callback' ) {
    let event_response = await getEventResponse( request_body.event );
    if ( event_response ) {
      await sendToSlack( event_response, SLACK_WEBHOOK );
    }
  }
  else {
    const error = new Error( 'IssueBot: Missing or unknown request.body.type' );
    error.code = 500;
    throw error;
  }
}

async function getEventResponse( event ) {
  let response = '';
  if ( event.subtype !== 'bot_message' ) {
    if ( event.type === 'message' && event.text ) {
      let shortCode = event.text;
      response = await getIssueResponse( shortCode );
    }
  }

  return response;
}

async function getIssueResponse( shortCode ) {
  const issues = await getIssues();
  if ( ! issues ) {
    return false;
  }
  return issues[ shortCode ] || false;
}

async function getIssues() {
  const auth = await getAuthToken();
  const sheets = google.sheets( { version: 'v4', auth } );
  const res = await sheets.spreadsheets.values.get( {
    spreadsheetId: SPREADSHEET_ID,
    range: 'A2:C'
  } );

  const issues = {};
  if ( ! res || ! res.data ) {
    console.log( `no response or no data in response. res:`, res );
    return issues;
  }

  const rows = res.data.values;
  const list = [ `\`list\` = This list` ];

  rows.forEach( row => {
    const shortCode = row[ 0 ];
    const description = row [ 1 ];
    const response = row[ 2 ];
    if ( shortCode && description && response ) {
      list.push( `\`${ shortCode }\` = ${ description }` )
      issues[ shortCode ] = response;
    }
  })

  issues.list = list.join( `\n` );

  return issues;
}

async function getAuthToken() {
  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_SERVICE_ACCOUNT_CREDENTIALS,
    scopes: SHEETS_SCOPES,
  });
  return auth;
}

async function sendToSlack( message, webhook ) {
  console.log('sendToSlack message: ' + message);
  await webhook.send({
    text: message
  });
}
