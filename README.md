# Issue Bot

This is a Google Cloud Function that acts as a back-end to a Slack Chat Bot.

## Introduction

We needed an easy way to let organizers and volunteers look up a candidate’s
position on issues during text and phone banks. Field had an existing
Slack workspace that organizers and volunteers used to communicate with each
other during phone and text banking, so it made sense to have a Slack Chat Bot
to serve this purpose.

The back-end of the bot consists of this Google Cloud Function, and a Google
Sheet that Field and Communications staff use to add the issues and responses
to.

Users communicate with the bot by typing one-word messages in a Slack Channel
that the bot is added to. If a user types the word “list” in the channel,
the bot responds with a list containing the word/abbreviation for each issue,
along with a short description of the issue; typing an issue’s word results in
the bot replying within the channel with that issue's response.

You will need to enable billing on the Google Cloud Account, and add a credit
card to the account. I believe that the resources needed by this system falls
below Google Cloud's Free Tier limits, so it may not cost anything to run. If
there are costs, my guess is that they will be less than a dollar a month. Set
up billing alerts for $1 or less, so you are notified if you do exceed the
free-tier limits.

This how-to may help: <https://cloud.google.com/functions/docs/tutorials/slack>

## Setup

### Google Sheet

Create a Google Sheet and use the first three cells as a header for the columns.
You can name them whatever you want, as long as they are in the first row:
 "Short Code", "Description", and "Response"

Add some entries below the header row. If you don't have real entries, then just
create some test ones. Your Sheet should look something like this

  | Short Code  | Description    | Response                      |
  | ----------- | -------------- | ----------------------------- |
  | example1    | First example  | The first example's response  |
  | example2    | Second example | The second example's response |

You will return to this Sheet to finish setting up your the Google Cloud
Function, so don't close it yet. One of the things you will need is the Sheet's
ID, which is a bunch of random characters, and can be found in its URL:
https<nolink>://docs.google.com/spreadsheets/d/`SHEET_ID_IS_HERE`/edit#gid

### Cloud Functions

These instructions assume you are doing everything from within the Google Cloud
Console. However, if you are familiar with Google Firebase, you can use it to
develop, test, and deploy the functions. The package.json file already has the
dependencies for Firebase Functions, and the exports are written to work with
the Firebase Functions Emulator.

You will need the issuebot.zip file on your local computer. You can download
just that file from the repo, or download/clone the entire repo to your
local filesystem.

There are two endpoints defined in the source code. These are the functions that
begin with *exports*. You will need to create a different Cloud Function for
each endpoint you want to deploy.
testSheets: This optional endpoint lets you use your browser to test the Sheets
integration.
getIssueResponse: This is the endpoint that Slack will send requests to.

The steps to create them are almost exactly the same. The only difference is
what you enter for their *name* and the *endpoint* the name points to.

Go to Cloud Functions in the console, and click Create Function
<https://console.cloud.google.com/functions>

* *Environment*: 1st gen (hasn't been tested with gen2)
* *Function name*: The same name as the endpoint.
* *Trigger type*: HTTP
* *Authentication*: Allow unauthenticated invocations

Note the *Trigger URL*, and copy/paste it somewhere. If you are setting up the
function for the *getIssueResponse* endpoint, then this is the URL you will
tell Slack to send the Webhook Events to. If you are setting up the
*testSheets* endpoint, then this is the URL you will go to, to make sure the
Sheets integration works.

Click *Save* then *Next*, which will bring you to the *Code* page:

* *Runtime*: Node.js 16
* *Entry Point*: The exported function/endpoint (*testSheets* or
*getIssueResponse*)

Change *Source Code* to *Zip Upload*

Click *Browse* under *Zip file*, and select the *issuebot.zip* file you
downloaded previously.

Click *Browse* under *Stage bucket*, select an existing bucket or create a new
one, then click the *Select* button to make it the destination for the zip
file.

Click *Deploy*.

This will upload the zip file to the bucket, and copy the files within the zip
zip to the Cloud Function. It could take a few minutes for it to finish
deploying, but there are still some more things to do before it will work.

### Authorize the function with your Google Sheet

Go to *API & Services* and click *Enable APIs and Services* at the top. Find and
enable the *Google Sheets API*.

Go to *API & Services -> Credentials*, click the email address of the *App*
*Engine default service account*. Copy the email address, go to your Google
Sheet, and *Share* the sheet with that email address.

Go back to the page for the Service account, click *Keys* - *Add Key* - *Create
new key*. Choose *JSON* as the *Key type*, and then click the *Create* button.
This will cause your browser to download a .json file.

Open the file in a text editor and copy everything inside the
*{ curly brackets }*.

Go to the Functions page, click the name of your function, click *Edit* -
*Code*, and select the *env.json* file to edit it. If it hasn't finished
deploying, then you will need to wait for it to finish before you can edit it.

Find the property named *"GOOGLE_SERVICE_ACCOUNT_CREDENTIALS"*, and paste
everything you copied in the previous step within the *{ curly brackets }*
of that property.

Find the *"SPREADSHEET_ID"* property and paste the Google Sheet ID between the
two *"quote marks"*. The section above for setting up the Google Sheet has info
about how to get the ID for your Sheet.

When you are done, the env.json file will look something like this:

```json
{
  "SPREADSHEET_ID": "your_google_sheet_id",
  "SHEETS_SCOPES": [ "https://www.googleapis.com/auth/spreadsheets" ],
  "GOOGLE_SERVICE_ACCOUNT_CREDENTIALS": {
    "type": "what_you",
    "project_id": "copied_from",
    "private_key_id": "the_json_file",
    "etc..."
  },
  "SLACK_BOT_APP_ID": "",
  "SLACK_WEBHOOK_URL": ""
}
```

Click *Deploy* to save your changes and have Google update the function. When it
is done deploying, you can use the URL for the *testSheets* endpoint to check
that the Sheets integration is working.

If you browse to the URL you should see the same content you'd get if you typed
*list* in the bot's Slack channel. You can get the response for a specific code
by adding `?code=SHORT_CODE` to the end of the URL, where *SHORT_CODE* is the
code you want to see the response for.

### Set up the Endpoint for Slack

Once you know the Sheets integration is working, you can create the function for
the Slack integration. The quickest way to do this is to go the the *Functions*
page, click the three dots for the *testSheets* function, and click *Copy*
*Function*.

Under the *Configuration* tab change the *Function Name* to *getIssueResponse*,
make sure that *Authentication* is set to *Allow unauthenticated*
*invocations*, and copy the URL for the Trigger.

Under the *Code* tab, change the *Entry point* to *getIssueResponse*.
Open the *slack_app_manifest.json* file, change the *name* and *display_name* of
the Slack bot to whatever you want, and for the *request_url* property, replace
*URL_FOR_getIssueResponse_ENDPOINT* with the URL for the Trigger.

### Slack

Create a Slack Channel for the Bot.

Create a Slack app <https://api.slack.com/apps/new> using *From an app manifest*
as the way to configure the app's scopes and settings.

Choose the workspace that you will deploy the bot to as the workspace to develop
the app on and click *Next*.

The next step is to paste the app manifest. Make sure that you are on the *JSON*
tab, paste the entire contents of the *slack_app_manifest.json* file, click
*Next*, and the *Create*.

Once your app is created, you will be taken to the *Basic Information* page for
the app. Click *Install to Workspace*, select the channel you created for the
bot, and click *Allow*

You will be taken back to the *Basic Information* page. Scroll down to the
*App Credentials* section, copy the *App ID*, go to the *env.json* file for the
Google Function, and paste it between the *"double quotes"* for the
*"SLACK_BOT_APP_ID"* property.

Go to the *Incoming Webhooks* tab for the Slack app, copy the *Webhook URL* for
the channel, paste it between the *"double quotes"* for the
*"SLACK_WEBHOOK_URL"* in the Function's *env.json* file, and click the *Deploy*
button.

When the Function has been deployed, go to the *Event Subscriptions* tab for
your Slack app. You will see an error about Slack not being able to verify the
URL for your app. Click the *Retry* button, and if everything goes well, the
error will be replaced with the word "Verified".

Click *Save Changes* at the bottom of the Slack app.

If there's a problem verifying, then go to the Log Explorer on Google Cloud
Platform to see if you can tell what the issue is.
<https://console.cloud.google.com/logs>

Go to the Slack channel for the bot. You will see a message in the channel about
the bot being added *as an integration*. Click the name of the bot in that
message, select *Add this bot to a channel*, and add the bot itself to the same
channel.

Finally, test the bot by writing *list* in the Channel, and see if the bot
responds with the list of short codes. Hopefully it does so. If not, you can
use the Google *Log Explorer* to see if there are any errors, or other
indications about what the problem is.

Note: This currently does not authenticate the request
<https://cloud.google.com/functions/docs/tutorials/slack#receiving_the_webhook>
