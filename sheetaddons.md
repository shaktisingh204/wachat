
# Building a Google Sheets Add-on for SabNode Webhooks

This guide provides the complete code and instructions to build a simple Google Sheets add-on. This add-on allows users to send data from a Google Sheet to a SabNode SabFlow webhook URL whenever a row is edited.

## Table of Contents

1.  [Project Setup](#1-project-setup)
2.  [The Code](#2-the-code)
    - [Manifest File (`appsscript.json`)](#manifest-file-appsscriptjson)
    - [Server-side Code (`Code.gs`)](#server-side-code-codegs)
    - [Client-side HTML (`Sidebar.html`)](#client-side-html-sidebarhtml)
3.  [Deployment](#3-deployment)
4.  [Usage](#4-usage)

---

## 1. Project Setup

1.  **Open Google Apps Script**: Go to `script.google.com` or open any Google Sheet and navigate to `Extensions` > `Apps Script`.
2.  **Create a New Project**: If you are not already in a new project, create one and give it a name like "SabFlow Webhooks".
3.  **Show the Manifest File**: In the Apps Script editor, go to `Project Settings` (the gear icon ⚙️) and check the box for `Show "appsscript.json" manifest file in editor`.

You will now have two default files: `Code.gs` and `appsscript.json`. We will also create a new HTML file for the user interface.

---

## 2. The Code

You will need to replace the content of the default files and create one new HTML file.

### Manifest File (`appsscript.json`)

This file defines the add-on's metadata and permissions. Replace the entire content of `appsscript.json` with the following:

```json
{
  "timeZone": "America/New_York",
  "dependencies": {
  },
  "exceptionLogging": "STACKDRIVER",
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets.currentonly"
  ],
  "runtimeVersion": "V8",
  "addOns": {
    "common": {
      "name": "SabFlow Webhooks",
      "logoUrl": "https://sabnode.com/logo.png",
      "layoutProperties": {
        "primaryColor": "#2196F3",
        "secondaryColor": "#42A5F5"
      },
      "homepageTrigger": {
        "runFunction": "onHomepage"
      }
    },
    "sheets": {
      "onFileScopeGrantedTrigger": {
        "runFunction": "onFileScopeGranted"
      }
    }
  }
}
```

### Server-side Code (`Code.gs`)

This is the main server-side logic that handles the add-on menu, sidebar, triggers, and webhook POST requests. Replace the entire content of `Code.gs` with this:

```javascript
/**
 * @OnlyCurrentDoc
 *
 * The above comment directs Apps Script to limit the scope of file
 * access for this add-on. It specifies that the add-on will only
 * attempt to read or modify the files in which it is used, and not
 * all of the user's files. The authorization request presented to users
 * will reflect this restriction.
 */

/**
 * Creates a menu entry in the Google Sheets UI when the document is opened.
 * This function is part of a simple trigger, meaning it runs automatically
 * when a user opens the spreadsheet.
 *
 * @param {object} e The event parameter for a simple onOpen trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode.
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
      .createAddonMenu()
      .addItem('Initial Setup', 'showInitialSetup')
      .addSeparator()
      .addItem('Send on Edit', 'enableOnEditTrigger')
      .addItem('Disable Trigger', 'disableTrigger')
      .addToUi();
}

/**
 * Runs when the add-on is installed.
 *
 * @param {object} e The event parameter for a simple onInstall trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode. (In practice, onInstall triggers always
 *     run in AuthMode.FULL, but onOpen triggers may be AuthMode.LIMITED or
 *     AuthMode.NONE.)
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Opens a sidebar for initial setup.
 */
function showInitialSetup() {
  const ui = HtmlService.createHtmlOutputFromFile('Sidebar')
      .setTitle('Webhook Setup');
  SpreadsheetApp.getUi().showSidebar(ui);
}

/**
 * Saves the webhook URL and trigger column to the document's properties.
 *
 * @param {string} webhookUrl The URL to send data to.
 * @param {string} triggerColumn The column letter that triggers the webhook.
 */
function saveSettings(webhookUrl, triggerColumn) {
  const properties = PropertiesService.getDocumentProperties();
  properties.setProperty('WEBHOOK_URL', webhookUrl);
  properties.setProperty('TRIGGER_COLUMN', triggerColumn);
  return { success: true, message: 'Settings saved!' };
}

/**
 * Retrieves the currently saved settings.
 */
function getSettings() {
  const properties = PropertiesService.getDocumentProperties();
  return {
    webhookUrl: properties.getProperty('WEBHOOK_URL'),
    triggerColumn: properties.getProperty('TRIGGER_COLUMN')
  };
}

/**
 * Creates an installable 'on edit' trigger for the active spreadsheet.
 */
function enableOnEditTrigger() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('handleEdit')
      .forSpreadsheet(sheet)
      .onEdit()
      .create();
  SpreadsheetApp.getUi().alert('"Send on Edit" trigger has been enabled.');
}

/**
 * Deletes all 'on edit' triggers for the active spreadsheet.
 */
function disableTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getEventType() === ScriptApp.EventType.ON_EDIT) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
   SpreadsheetApp.getUi().alert('All "Send on Edit" triggers have been disabled.');
}

/**
 * Responds to the edit event to send data to a webhook.
 *
 * @param {object} e The event object.
 */
function handleEdit(e) {
  const properties = PropertiesService.getDocumentProperties();
  const webhookUrl = properties.getProperty('WEBHOOK_URL');
  const triggerColumnLetter = properties.getProperty('TRIGGER_COLUMN');
  
  if (!webhookUrl || !triggerColumnLetter) {
    return;
  }
  
  const range = e.range;
  const editedColumn = range.getColumn();
  const triggerColumn = range.getSheet().getRange(triggerColumnLetter + '1').getColumn();

  // Only trigger if the edited column is the one specified in settings.
  if (editedColumn === triggerColumn) {
    const sheet = range.getSheet();
    const row = range.getRow();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    let payload = {};
    for (let i = 0; i < headers.length; i++) {
      payload[headers[i]] = rowData[i];
    }
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload)
    };
    
    try {
      UrlFetchApp.fetch(webhookUrl, options);
    } catch (error) {
      Logger.log('Error sending webhook: ' + error.toString());
    }
  }
}
```

### Client-side HTML (`Sidebar.html`)

Create a new file by clicking `File` > `New` > `HTML file`. Name it `Sidebar.html`. This file contains the HTML and JavaScript for the user interface that will appear in the sidebar.

```html
<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <!-- Use a simple CDN for styling. For a real app, consider bundling CSS. -->
    <link rel="stylesheet" href="https://ssl.gstatic.com/docs/script/css/add-ons1.css">
  </head>
  <body>
    <div class="sidebar">
      <div class="block">
        <label for="webhook-url">Webhook URL</label>
        <input type="url" id="webhook-url" placeholder="Paste your SabFlow webhook URL here">
      </div>
      <div class="block">
        <label for="trigger-column">Trigger Column</label>
        <input type="text" id="trigger-column" placeholder="e.g., A" maxlength="2">
        <p class="description">
          Enter the column letter (e.g., 'A', 'B', 'C') that will trigger the webhook when a cell in that column is edited.
        </p>
      </div>
      <div class="block">
        <button class="action" id="save-button">Save Settings</button>
        <button id="test-button">Send Test</button>
      </div>
       <div id="message" class="block" style="display: none;"></div>
    </div>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        // Load saved settings when the sidebar opens
        google.script.run
          .withSuccessHandler(function(settings) {
            if (settings.webhookUrl) {
              document.getElementById('webhook-url').value = settings.webhookUrl;
            }
            if (settings.triggerColumn) {
              document.getElementById('trigger-column').value = settings.triggerColumn;
            }
          })
          .getSettings();
      });

      document.getElementById('save-button').addEventListener('click', function() {
        const webhookUrl = document.getElementById('webhook-url').value;
        const triggerColumn = document.getElementById('trigger-column').value.toUpperCase();
        
        if (!webhookUrl || !triggerColumn) {
          showMessage('Webhook URL and Trigger Column are required.', true);
          return;
        }

        google.script.run
          .withSuccessHandler(function(response) {
            if (response.success) {
                showMessage(response.message, false);
            }
          })
          .saveSettings(webhookUrl, triggerColumn);
      });

      document.getElementById('test-button').addEventListener('click', function() {
        const webhookUrl = document.getElementById('webhook-url').value;
        if (!webhookUrl) {
           showMessage('Please save a Webhook URL first.', true);
           return;
        }
        
        const testPayload = { "test": "Hello from Google Sheets!", "status": "Success" };
        const options = {
          'method': 'post',
          'contentType': 'application/json',
          'payload': JSON.stringify(testPayload)
        };
        
        // This fetch is client-side and just for the user's test button click.
        // It's separate from the server-side UrlFetchApp.
        fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors', // Important for client-side fetches to avoid CORS issues
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload)
        }).then(response => {
          showMessage('Test signal sent! Check your flow history in SabNode.', false);
        }).catch(error => {
          showMessage('Error sending test: ' + error.message, true);
        });
      });

      function showMessage(text, isError) {
          const messageDiv = document.getElementById('message');
          messageDiv.textContent = text;
          messageDiv.style.color = isError ? 'red' : 'green';
          messageDiv.style.display = 'block';
          setTimeout(function() {
              messageDiv.style.display = 'none';
          }, 5000);
      }
    </script>
  </body>
</html>
```

---

## 3. Deployment

To use the add-on in your own sheets, you need to create a deployment.

1.  **Open Deployment Dialog**: In the top right of the Apps Script editor, click `Deploy` > `New deployment`.
2.  **Select Type**: Click the gear icon next to "Select type" and choose `Add-on`.
3.  **Description**: Give your deployment a description (e.g., "Version 1").
4.  **Deploy**: Click `Deploy`.
5.  **Authorize**: The first time you deploy, you will need to authorize the script's permissions. Follow the prompts.

Your add-on is now installed for your account and will be available under the `Extensions` menu in any Google Sheet you open.

---

## 4. Usage

1.  **Open a Google Sheet**.
2.  Go to `Extensions` > `SabFlow Webhooks` > `Initial Setup`.
3.  A sidebar will open. Paste the webhook URL from your SabFlow trigger node.
4.  Enter the column letter that should trigger the flow (e.g., `A`). An edit in any cell in this column will send the entire row's data.
5.  Click `Save Settings`.
6.  Go to `Extensions` > `SabFlow Webhooks` > `Send on Edit` to activate the trigger.

Now, whenever you edit a cell in your designated trigger column, the add-on will automatically send that entire row's data as a JSON payload to your SabFlow webhook.
```