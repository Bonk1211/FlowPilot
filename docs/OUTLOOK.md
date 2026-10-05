# Outlook drafts

The handoff's **Outlook draft** panel saves the current saved subject and message
into the signed-in user's real Outlook Drafts folder. Recipients are optional.
**Open draft in Outlook** opens the returned mailbox link to review and send.
FlowPilot never sends through this connector and does not request `Mail.Send`.

## Configure once

1. In [Microsoft Entra app registrations](https://entra.microsoft.com/), register
   an application. Choose organizational accounts and personal Microsoft accounts
   if you want both Microsoft 365 and Outlook.com support.
2. Add a **Web** platform redirect URI:
   `http://localhost:5173/api/incident-outlook/callback` for local development.
   For deployment, use the site's HTTPS origin with the same callback path.
3. Add Microsoft Graph **delegated** permissions `User.Read` and `Mail.ReadWrite`.
   Draft creation requires `Mail.ReadWrite`, which also grants mailbox read/edit
   access. Consent may require an administrator under your tenant's policy.
4. Create a client secret. Copy its **value**, application client ID, and these
   settings into the ignored root `.env`:

   ```dotenv
   FLOWPILOT_OUTLOOK_CLIENT_ID=your-application-client-id
   FLOWPILOT_OUTLOOK_CLIENT_SECRET=your-client-secret-value
   FLOWPILOT_OUTLOOK_TENANT=common
   FLOWPILOT_OUTLOOK_REDIRECT_URI=http://localhost:5173/api/incident-outlook/callback
   ```

   Use your tenant ID instead of `common` for a single-tenant registration.
   Keep credentials on the backend; never put them in `VITE_*` variables.
5. Restart `npm run dev`. Open FlowPilot at **http://localhost:5173** so the
   browser cookie and redirect use the same host. If using a different port,
   update both the registered redirect and the environment setting.

## Save a draft

Open an incident's **Handoff** page, review the message and save any edits.
Select **Connect Outlook**, sign in to Microsoft in the pop-up, and consent.
Close the sign-in window and return to FlowPilot. **Check connection** refreshes
the account status if needed. Enter comma-separated recipients or leave them
blank, then choose **Save to Outlook** and **Open draft in Outlook**.

The server requires incident `edit` permission for connecting and exporting;
`view` alone cannot create a draft. The demo can export synthetic handoffs after
explicit Microsoft sign-in. The existing external-data policy also applies:
`disabled` blocks exports, `synthetic_only` requires all active evidence and
observations to be synthetic, and `permitted` allows real incident content.
New evidence or unsaved edits require reviewing and saving the current handoff.
Recipients for this draft connector are independent of the SMTP send allowlist,
since Outlook handles final review and sending.

## Session behavior

Access tokens stay in server memory, bound to an opaque HttpOnly browser cookie
and the FlowPilot identity that started sign-in. Authorization uses a one-time
state and PKCE. Tokens are not returned to the frontend or stored in the database.
Reconnect after token expiry or an API restart. Disconnect removes FlowPilot's
session; it leaves existing Outlook drafts intact and does not revoke Microsoft
consent. Consent can be removed through the Microsoft account's app settings.

An identical saved handoff and recipient list returns its existing draft link
within the current connection, without overwriting edits made in Outlook. A new
handoff version or changed recipient list creates a new draft. Reloading the page
and clicking save for the same snapshot retrieves the current connection's link.
If creation times out or Microsoft returns an uncertain response, inspect Outlook
Drafts before reconnecting or exporting another version. The connector does not
automatically retry creation.

This implementation supports one API process. Connections and remembered draft
links expire with their tokens and are lost on restart; Outlook drafts remain.
A deployment with multiple API workers needs a shared, encrypted session store
before enabling this connector.

References: [create draft message](https://learn.microsoft.com/en-us/graph/api/user-post-messages?view=graph-rest-1.0)
and [authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).
