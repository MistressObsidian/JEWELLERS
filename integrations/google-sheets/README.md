# Connect ambassador applications to Google Sheets

The Google web-app URL is configured in `assets/application-config.js`.
On **October 22, 2026**, a signed-out browser submitted an application from the
local website and received Google's successful save acknowledgment. Retrying
the same receipt confirmed the saved record without adding another row.
The updated website files still need to be published through your usual hosting workflow.

Destination: [your Google Sheet](https://docs.google.com/spreadsheets/d/12LnVhOXM858v6c6jZ6QIgpKYq-PsbfGX62tEuCH_rIg/edit).
The receiver creates an **Ambassador Applications** tab and leaves other tabs intact.
The Sheet can remain private; applicants do not need access to it.

One test row was retained for review: **TEST - connection check (2026-10-22)**,
receipt `c42b24a6bae792b4b81b9bfb67cb1a77`. It can be deleted after review.
Desktop (1280px) and mobile (390px) browser checks passed without horizontal overflow;
the form cleared only after its successful acknowledgment. All nine local tests passed.

## One-time Google setup

1. Open the destination Sheet using a Google account that can edit it.
2. Choose **Extensions → Apps Script**. Add the contents of the adjacent
   `Code.gs` file. If this project already contains scripts or `doPost`/`doGet`
   functions, create a separate project at https://script.google.com instead
   of replacing them. The destination Sheet ID is already in the code.
3. Save, select **setup**, then click **Run**. Authorize the script to access
   the spreadsheet. This creates the tab and headers without adding test applicants.
4. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and
   **Who has access: Anyone**, so applicants can submit without signing in.
   Deploy and copy the web-app URL ending in **/exec**. If your Workspace
   administrator prohibits anonymous web apps, this integration requires
   another approved hosting approach; do not make the Sheet publicly editable.
5. If replacing the deployment, update the URL in
   `assets/application-config.js` under `endpoint`. The Sheet's `/edit` link
   is not a submission endpoint. Publish the updated website files through
   your normal hosting workflow.

These steps use Google's [Apps Script web-app deployment](https://developers.google.com/apps-script/guides/web).
JSON acknowledgments use [Content Service](https://developers.google.com/apps-script/guides/content),
which redirects responses to a Google-hosted URL; the client follows that redirect.

## Verify the live connection

1. Reload the ambassador page. The submit button should be enabled.
2. Submit an application clearly named **TEST — delete after verification**
   with a test email you control, a category, the required explanation, and acknowledgment.
3. Confirm the page shows **Your application has been received** and the
   **Ambassador Applications** tab contains one matching row with all fields.
4. Test from the actual published website as well as the local preview.
   Check a signed-out browser session to verify anonymous access.
5. Remove the clearly marked test row when verification is finished.

The local website-to-Google submission has been verified. Verification from the
published website and direct visual review of the test row in the Sheet remain
post-publication checks.

## Submission behavior

- The browser confirms success and clears the form only after reading a successful
  response with the matching submission ID. It never treats an opaque `no-cors`
  response as proof of saving.
- Failed or timed-out requests retain the fields. Retrying unchanged details in
  the same page session reuses the receipt, avoiding a second row if the first
  response was lost. Reloading the page starts a new session.
- The receiver checks required fields, length limits, category, and acknowledgment.
  It stores text as text, including input that resembles spreadsheet formulas.
- A script lock coordinates concurrent writes. Unexpected existing column headers
  cause a failure instead of overwriting that tab's data.
- The endpoint accepts public applications and does not expose applicant records.
  The hidden field filters simple bots; it is not authentication or comprehensive
  spam protection. Keep the deployment URL public only as part of this form and
  monitor submissions and Google Apps Script quotas.
- No Google password, API key, or access token belongs in the website files.

## Troubleshooting

- **Applications are temporarily unavailable:** the web-app URL is missing or invalid.
- **Couldn’t confirm ... saved:** keep the entered details and retry. Check Apps
  Script permissions, deployment access, and the destination tab's headings.
  A network/CORS failure may occur after Google writes the row, so reuse the
  same form session when retrying.
- If you change `Code.gs`, publish a new version using **Deploy → Manage
  deployments → Edit**. The live `/exec` deployment does not automatically
  use unsaved or undeployed edits.

Local checks (no Google account or real submissions required):

```text
node --test tests/google-sheets.test.cjs
```
