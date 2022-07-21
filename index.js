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
  if ( typeof shortCode != 'string' || shortCode.search( /^[a-z0-9.?;'"!&\\\/\|\@\s]+$/i ) == -1 ) {
    response.status( 400 ).send( 'Invalid input' );
  } else {
    const result = await getIssueResponse( shortCode );
    response.status( 200 ).send( result );
  }
})

exports.getIssueResponse = functions.https.onRequest( async ( request, response ) => {
  try {
    let request_body = request.body;
    functions.logger.info("Received Request!" );
    functions.logger.info('request.headers', request.headers );
    functions.logger.info('request body', request_body );

    if ( request_body.type && request_body.type == 'url_verification' ) {
      console.log( 'Received url_verification request, sending challenge back', request_body.challenge )
      response.send( request_body.challenge );
    } else if ( request.get( 'X-Slack-Retry-Num' ) ) {
      // This is a repeat request, ignore
      functions.logger.info( `REPEAT REQUEST. The request has been sent ${ request.get( 'X-Slack-Retry-Num' ) } times. Reason given: ${ request.get( 'X-Slack-Retry-Reason' ) }` );
      response.sendStatus( 200 );
    } else {
      functions.logger.info( 'NEW REQUEST, sending immediate response back, then continuing to process it...' );
      // Slack want's an immediate response back, and for the app to send the
      // message to the channel through their rest api using the webhook.
      response.write( '' );
      if ( isIssueBotRequest( request_body ) ) {
        await processIssueBotRequest( request_body );
      }

      response.end();
    }
  } catch ( err ) {
    functions.logger.error( err );
    response.end();
  }
});

function isIssueBotRequest( request_body ) {
  request_body = request_body || {};

  if ( request_body.api_app_id !== SLACK_BOT_APP_ID ) {
    const error = new Error( `Missing/undefined or unknown api app id: ${ request_body.api_app_id }` );
    error.code = 500;
    throw error;
  }

  if ( request_body.type != 'event_callback' ) {
    functions.logger.info( `Ignoring request: request body type is not "event_callback". request_body.type: ${ request_body.type }` )
    return false;
  }

  const event = request_body.event;
  if ( ! event ) {
    functions.logger.info( 'Ignoring request: request body is missing the event object.' );
    return false;
  }

  if ( event.subtype == 'bot_message' || event.bot_id ) {
    functions.logger.info( 'Ignoring request: request is from a bot' );
    return false;
  }

  if ( event.type != 'message' || ! event.text ) {
    functions.logger.info( `Ignoring request: event type isn't "message" or event text is missing ( event type: ${ event.type }, event text: ${ event.text } )` );
    return false;
  }

  return true

}

async function processIssueBotRequest( request_body ) {
  console.log( 'processIssueBotRequest' );
  const event_response = await getEventResponse( request_body.event );
  if ( event_response ) {
    await sendToSlack( event_response, SLACK_WEBHOOK );
  }
}

async function getEventResponse( event ) {
  let response = '';
  let shortCode = event.text;
  response = await getIssueResponse( shortCode );

  if ( ! response ) {
    functions.logger.info( `No entry for short code ${ shortCode }` );
  }

  return response;
}

async function getIssueResponse( shortCode ) {
  const issues = await getIssues();
  if ( ! issues ) {
    return false;
  }

  const normalizedCode = normalizedShortCode( shortCode );
  return issues[ normalizedCode ] || false;
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
    functions.logger.error( `no response or no data in response. res:`, res );
    const error = new Error( `Did not receive a response from Sheets API, or response did not contain a data property.` );
    error.code = 500;
    throw error;
  }

  const rows = res.data.values;
  const list = [ `\`list\` = This list` ];

  rows.forEach( row => {
    const shortCode = row[ 0 ];
    const description = row [ 1 ];
    const response = row[ 2 ];
    if ( shortCode && description && response ) {
      const normalizedCode = normalizedShortCode( shortCode );
      list.push( `\`${ shortCode }\` = ${ description }` )
      issues[ normalizedCode ] = response;
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

function normalizedShortCode( shortCode ) {
  if ( ! shortCode ) {
    return '';
  }
  return  shortCode.toLocaleLowerCase().replace(/\s+/g, '');
}

async function sendToSlack( message, webhook ) {
  console.log( `sendToSlack message ${ message }` );
  await webhook.send({
    text: message
  });
}
