# Issue Bot

This is a Google Cloud Function that acts as a back-end to a Slack Chat Bot.

## Introduction

We needed an easy way to let organizers and volunteers look up a candidate’s
position on issues during text and phone banks. Field had an existing
Slack workspace that organizers and volunteers used to communicate with each
other during phone and text banking, so it made sense to have a Slack Chat Bot
to serve this purpose.

The back-end of the bot consists of this Google Cloud Function, a Google
Sheet that Field and Communications staff use to add the issues and response
to, and a BigQuery Table whose source is the Sheet. The Cloud Function looks up
issues/responses by querying the Table.

Users communicate with the bot by typing one-word messages in a Slack Channel
that the bot is added to. If a user types the word “list” in the channel,
the bot responds with a list containing the word/abbreviation for each issue,
along with a short description of the issue; typing an issue’s word results in
the bot replying within the channel with that issue's response.

You will need to enable billing on the Google Cloud Account, and add a credit
card to the account. But Google gives new accounts $300 credit for a year, so it
won't cost your campaign anything. I also think that the resources needed by
this system falls below Google Cloud's Free Tier limits, so it may not cost
anything even without the credit. If there are costs, my guess they will be less
than a dollar a month.

## Setup

### Google Sheet

Create a Google Sheet with four columns, with the first row containing headers
like the following. These can be whatever you want, the only thing that matters
is that they are in the same order as the fields in the BigQuery table. My Sheet
included the text in the parenthesis, to remind users not to edit cell C2, or
anything in column D.

* Short code
  * Type the following in cell A2: `list`
* Description
  * Type the following in cell B2: `This list`
* Response ("list" / C2 is a formula do not edit)
  * Formula for cell C2: `=join("   ", SORT(FILTER(D3:D, NOT(A3:A = ""))))`
* List Response (do not edit)
  * Formula beginning in cell D2, then copy/paste to all cells in column D:
```
="`" & A2 & "`" & " = " & B2
```

Add some entries by entering Short codes, Descriptions and Responses. If you don't
have real entries, then just create some test ones. After you are done, your
Sheet should look something like

  | Short Code  | Description    | Response                                                    | List Response                 |
  | ----------- | -------------- | ----------------------------------------------------------- | ----------------------------- |
  | list        | This list      | \`example1\` = First example   \`example2\` = Second example| \`list\` = list               |
  | example1    | First example  | This is the response for the first example                  | \`example1\` = First example  |
  | example2    | Second example | This is the response for the second example                 | \`example2\` = Second example |

Finally, Share the Sheet with everyone who will need to add entries to it, as well as the
user account that will create the BigQuery table.

### BigQuery Table

Create a new Google Cloud project if you don't already have an existing one you
want to use for this project.
<https://cloud.google.com/resource-manager/docs/creating-managing-projects>

Create a BigQuery Data Source, or use an existing data source.
<https://support.google.com/datastudio/answer/6295968>

Create a table with the Google Sheet as its source.
<https://cloud.google.com/bigquery/external-data-drive>

The Table should have the following characteristics

* Source: Drive
* File format: Google Sheet
* Select Drive URI: The URL of the Sheet, which you get by opening it and
copy/pasting the URL in the address bar. It should look something like
  `https://docs.google.com/spreadsheets/d/XXXXX/edit#gid=XXXXX`
* Add four fields to the table that correspond to the columns in the Sheet. They
should be in the same order they are in the Sheet, have the data type of String,
and be Nullable
  * short_code
  * description
  * response
  * list_response
* Click Advanced options and set *Header rows to skip* to 1

Click the *Create table button* when done.

<https://cloud.google.com/bigquery/docs/tables>

### Cloud Function

Create a node.js Google Cloud Function, with an HTTP trigger. It will need to
allow "unauthenticated invocations" so that Slack can send the request to it.
Here is a how-to that may help: <https://cloud.google.com/functions/docs/tutorials/slack>

You can actually do everything using the Google Cloud Console, and copy paste
the contents of the index.js and package.json files:
<https://cloud.google.com/functions/docs/quickstart-nodejs>

Be sure to change the constants at the top of index.js that deal with Google
Cloud values:

* PROJECT_NAME
* BIGQUERY_DATASOURCE
* BIGQUERY_TABLE

When you are done creating the Cloud Function, the URL it will respond to, and
where Slack will send the channel's message events to, will be something like:
<https://us-central1-PROJECT_NAME.cloudfunctions.net/getIssueResponse>

Note: This currently does not authenticate the request
<https://cloud.google.com/functions/docs/tutorials/slack#receiving_the_webhook>

### Slack

Create a Slack Channel for the Bot.

Create a Slack Bot that can write messages to the channel using Incoming
Webhooks. Copy/Paste the Webhook URL into the function's `SLACK_WEBHOOK_URL`
constant, and the App ID into the `SLACK_BOT_APP_ID` constant.
<https://api.slack.com/messaging/webhooks>

Go to Event Subscriptions, and "Enable Events" using the Cloud Function's URL
as the "Request URL". Slack will attempt to verify the URL, which the Cloud
Function is programmed to do.

Under "Subscribe to bot events" add *message.channels* and
*message.groups* events.

I think at this point the Bot has already been added/installed to your
Workspace. If not, then do so now. Add/invite the Bot to the Channel. One way to
do this is to go into the channel and @ the bot. Slack should ask you if you
want to add the bot to the channel.

Finally, test the bot by writing *list* in the Channel, and see if the bot
responds with the list of short codes. Hopefully it does so. If not, you can
use go to the "Logs" tab of the Cloud Function in Google Cloud Platform UI, and
see if there are any errors, or other indications about what the problem is.
