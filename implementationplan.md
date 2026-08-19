# Implementation Plan — Siyaram Mitra Mandal
## Building/Wing/Flat Management + Fully Verified Online Chanda Payments + Digital Pavti

**Project:** Siyaram Mitra Mandal  
**Primary stack found in the supplied source:** Next.js 16, React 19, TypeScript, Firebase/Firestore, Firebase Auth, Cloudflare Worker backend, Google Sheets integration.  
**Payment direction:** Use a real payment gateway with server-side verification and webhooks. Razorpay is the recommended first implementation because its current documentation supports UPI checkout/intent, UPI QR codes, payment links, `order.paid` / `payment.captured` webhooks, and server-side verification.

---

## 1. Current-State Audit

### 1.1 Frontend architecture

The supplied project snapshot shows:

- Next.js App Router with a client-side main application in `src/app/page.tsx`.
- Firebase Auth and Firestore are already used directly from the frontend.
- The authenticated user document is stored under `users/{uid}` and the app distinguishes `admin`, `member`, and `viewer` roles.
- The main page imports `AdminPanel`, `Dashboard`, and `Contribute`, but those component files are not present in the supplied text snapshot. This means the implementation should first be reconciled with the actual working repository before editing those components.
- Existing Firestore collections include `users`, `mandal_gallery`, `chanda_payments`, and `mandal_chanda`.
- The profile flow already synchronizes user-name/photo changes into `chanda_payments` and `mandal_chanda`.

Source audit references:
- Main application/auth/admin routing: supplied source around `src/app/page.tsx`.
- Existing `chanda_payments` synchronization: the profile code queries payments by `userId` and updates `userName`/`userPhoto`.
- Existing admin rendering: admins are routed to `AdminPanel` from the profile tab.

### 1.2 Existing Cloudflare bot/backend

The supplied Cloudflare Worker already contains financial logic:

- `building_chanda` is used for building/flat chanda.
- Building documents currently use an ID derived from `wing + room`, e.g. `A_101`.
- The parser currently understands wing/room values and specifically defaults to A/B-style parsing.
- Online entries can be marked with an `O` suffix and are recorded into the existing online ledger flow.
- Google Sheets is also updated by the worker.

This backend is useful, but it should not become the source of truth for browser payment confirmation. Real online payment confirmation must come from the payment gateway's server-to-server webhook/API verification.

---

# 2. Feature A — Building View Must Become Fully Dynamic

## Goal

Replace the hard-coded/limited building view with a real hierarchy:

**Building → Wing → Flat → Resident/Chanda status**

The admin must be able to:

- Add building
- Edit building
- Delete/archive building
- Add wing
- Edit wing
- Delete/archive wing
- Add flats
- Edit flat number/details
- Delete/archive flat
- Bulk-create flats
- View collected/due/remaining chanda per flat
- Search/filter by building, wing, flat, resident and payment status

### Important topology requirement

The user-provided current setup says:

- A Wing: 16 flats
- B Wing: 16 + 16 flats

Do **not** permanently hard-code this as application logic.

Instead, seed the current configuration after confirming the exact flat-number ranges with the admin. The database must support any future number of wings and any number of flats per wing.

---

# 3. Building Data Model

## Recommended Firestore structure

### `buildings/{buildingId}`

```ts
{
  name: "Siyaram Building",
  code: "SMM",
  description: "",
  status: "active",
  sortOrder: 1,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: string,
  updatedBy: string
}
```

### `buildings/{buildingId}/wings/{wingId}`

```ts
{
  name: "A Wing",
  code: "A",
  status: "active",
  sortOrder: 1,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `buildings/{buildingId}/wings/{wingId}/flats/{flatId}`

```ts
{
  flatNumber: "101",
  displayNumber: "A-101",
  residentName: "",
  residentUserId: null,
  residentEmail: null,
  status: "active",
  expectedChanda: 0,
  notes: "",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Why this structure

Do not use only `A_101` as the permanent identity.

The current worker's `building_chanda` documents are effectively keyed by wing + room. That works for a single/simple building but becomes ambiguous when another building also contains `A-101`.

Use a globally unique flat ID such as:

`{buildingId}_{wingId}_{flatId}`

or a Firestore path under the building hierarchy.

---

# 4. Building CRUD Admin UI

## Admin Panel — New "Buildings" section

Add a dedicated section/tab:

**Admin Panel → Building Management**

### Header

Show:

- Total buildings
- Total wings
- Total flats
- Collected chanda
- Pending chanda

### Building cards/table

Each building row should show:

- Building name
- Number of wings
- Number of flats
- Collected amount
- Pending amount
- Status
- Edit
- Manage wings
- Archive/delete

### Add Building modal

Fields:

- Building name
- Building code
- Description
- Active/inactive

Validation:

- Building name required
- Code required and unique
- Prevent duplicate active building codes

### Manage Wings

Inside a building:

```text
Siyaram Building
 ├── A Wing
 │    ├── A-101
 │    ├── A-102
 │    └── ...
 └── B Wing
      ├── B-101
      ├── B-102
      └── ...
```

Actions:

- Add wing
- Rename wing
- Change wing code
- Archive wing
- Add flats
- Edit flats
- Archive flats

### Bulk Add Flats

Admin should be able to select:

- Starting number
- Ending number
- Prefix
- Optional floor pattern

Example:

```text
Wing: A
Start: 101
End: 116
Generate 16 flats
```

For the B-wing configuration, allow multiple ranges instead of assuming a single continuous sequence.

Example:

```text
B Wing
Range 1: 101–116
Range 2: 201–216
```

The exact ranges should be confirmed before production seeding.

---

# 5. Building Page for Members

The public/member-facing building view should not expose admin controls.

Show:

```text
Select Building
        ↓
Select Wing
        ↓
Select Flat
        ↓
Flat Details
```

Flat card:

- Flat number
- Resident name (according to privacy policy)
- Chanda target
- Paid
- Due
- Payment history
- Pay Chanda button

Status badges:

- Paid
- Partially Paid
- Due
- No Record

Use real-time Firestore listeners so admin changes appear without requiring a full page refresh.

---

# 6. Chanda Data Migration

The existing worker uses:

`building_chanda`

with fields such as:

```ts
{
  wing,
  room,
  name,
  amount,
  status,
  lastUpdated
}
```

Do not delete this collection immediately.

### Migration phase

1. Export current `building_chanda`.
2. Map each record to:
   - buildingId
   - wingId
   - flatId
3. Create the new normalized building/wing/flat records.
4. Preserve historical paid amounts.
5. Add `legacyBuildingChandaId` to migrated records.
6. Verify totals against Google Sheets.
7. Only after verification, switch the UI to the new structure.
8. Keep a rollback/export copy.

### Backward compatibility

The Cloudflare worker should temporarily support both:

- New building/wing/flat IDs
- Legacy `wing_room` identifiers

Do not break WhatsApp/bot collection during migration.

---

# 7. Feature B — Make Online Payment Actually Real

## Critical requirement

The browser must **never decide that payment succeeded just because the user clicked a button, returned to the page, or entered an amount.**

The authoritative sequence must be:

```text
User creates payment request
        ↓
Server creates gateway order/payment session
        ↓
Gateway shows UPI / QR / payment options
        ↓
User pays
        ↓
Gateway confirms payment
        ↓
Gateway webhook reaches server
        ↓
Server verifies webhook signature
        ↓
Server verifies payment/order + exact amount
        ↓
Firestore payment marked CAPTURED
        ↓
Receipt/Pavti generated from verified record
        ↓
Frontend receives real-time success state
        ↓
Success flash animation
        ↓
Receipt auto-download
```

Razorpay's current documentation specifically recommends webhooks for server-side automation and API verification as an additional immediate check for critical user-facing status. It also documents UPI intent, UPI QR, payment links, and `order.paid` / `payment.captured` events.

---

# 8. Do Not Use a Plain Static UPI Link as the Payment Source of Truth

A plain:

```text
upi://pay?pa=...
```

link can launch a UPI app, but the website cannot safely assume that the payment happened merely because the UPI app opened or because the user returned to the website.

For fully automatic verification, use a gateway-controlled payment session/order or gateway QR that generates a transaction identity which the backend can verify.

Recommended UX:

### Mobile

```text
Pay Chanda
   ↓
Open UPI App
   ↓
Complete payment
   ↓
Return to website
   ↓
"Verifying payment..."
   ↓
Backend confirms
   ↓
Pavti generated
```

### Desktop

```text
Pay Chanda
   ↓
Display dynamic QR
   ↓
Scan with PhonePe / Google Pay / other UPI app
   ↓
Payment completes
   ↓
Webhook arrives
   ↓
Desktop screen automatically changes to Paid
```

Razorpay's QR documentation supports dynamic QR codes and real-time payment notifications through webhooks.

---

# 9. Recommended Payment Architecture

## Frontend

Create:

`src/components/Contribute.tsx`

and payment UI helpers.

Frontend should only call your own API:

```text
POST /api/payments/create-order
```

It should never contain:

- Gateway secret
- Webhook secret
- Private API key
- Signature secret

## Server/API

Because the supplied frontend is Next.js and the existing bot is Cloudflare Worker, choose one authoritative payment backend.

### Recommended option

Keep payment endpoints in the deployed server/backend layer that can safely hold secrets.

Possible endpoints:

```text
POST /api/payments/create-order
POST /api/payments/verify
POST /api/payments/webhook
GET  /api/payments/:paymentId
```

If payment APIs are implemented in the Cloudflare Worker instead, use Worker secrets and make the Next.js frontend call that Worker.

Do not split payment ownership between two independent backends.

---

# 10. Payment Order Creation

When user clicks:

**Pay ₹500**

the client sends:

```ts
{
  buildingId,
  wingId,
  flatId,
  amount
}
```

The server must obtain the authenticated user identity from the Firebase authentication context/token rather than trusting a client-supplied name.

Server validates:

- User is authenticated
- User is allowed to contribute
- Building exists
- Wing exists
- Flat exists
- Amount is positive
- Amount is within configured limits
- Currency is INR

Then create a gateway order.

Store a Firestore record such as:

### `chanda_payments/{paymentId}`

```ts
{
  userId: "firebase_uid",
  userName: "Verified User Name",
  userEmail: "user@example.com",

  buildingId: "...",
  buildingName: "Siyaram Building",
  wingId: "...",
  wingCode: "A",
  flatId: "...",
  flatNumber: "101",

  requestedAmount: 500,
  verifiedAmount: null,
  currency: "INR",

  gateway: "razorpay",
  gatewayOrderId: "...",
  gatewayPaymentId: null,

  status: "created",

  receiptNumber: null,
  receiptGeneratedAt: null,

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

# 11. Payment Status State Machine

Use explicit states.

```text
created
   ↓
payment_pending
   ↓
authorized
   ↓
captured
   ↓
receipt_generated
```

Failure paths:

```text
created → failed
payment_pending → failed
payment_pending → expired
authorized → failed
```

Never allow:

```text
frontend click → captured
```

Only server verification can move a payment to `captured`.

---

# 12. Exact Amount Verification

This is extremely important.

When a payment event arrives:

1. Find the local payment record by gateway order/payment ID.
2. Verify webhook signature.
3. Fetch/verify gateway payment details when needed.
4. Confirm gateway status is captured/paid.
5. Confirm currency is INR.
6. Convert gateway amount from paise to rupees correctly.
7. Compare gateway amount with the order's expected amount.
8. Reject/quarantine mismatched amounts.
9. Make the operation idempotent.

Example rule:

```text
Expected: ₹500
Gateway:   ₹500
→ CAPTURED

Expected: ₹500
Gateway:   ₹450
→ DO NOT issue normal ₹500 receipt

Expected: ₹500
Gateway:   ₹550
→ DO NOT silently assign ₹500
→ mark amount_mismatch and require reconciliation
```

The receipt's paid amount must come from the verified gateway transaction, not from the browser input.

---

# 13. Webhook Security

Webhook endpoint:

```text
POST /api/payments/webhook
```

Requirements:

- HTTPS only
- Read raw request body
- Validate gateway signature using webhook secret
- Reject invalid signatures
- Store event ID
- Ignore duplicate event deliveries
- Return HTTP 2xx quickly after durable processing/queueing
- Never trust browser success callbacks as the authoritative payment record

Razorpay documents webhook signature validation and recommends idempotency because webhook delivery can be retried.

---

# 14. Idempotency / Duplicate Payment Protection

Create a unique gateway payment identifier.

Example:

```ts
gatewayPaymentId
```

Before marking a payment captured:

```text
if gatewayPaymentId already processed:
    return success
```

This prevents:

- duplicate receipts
- duplicate chanda ledger entries
- duplicate Google Sheet rows
- duplicate payment totals

Also use a unique `receiptNumber`.

Suggested format:

```text
SMM-2026-000001
SMM-2026-000002
...
```

The receipt number must be generated server-side.

---

# 15. Firestore Transaction for Successful Payment

After gateway verification:

### Transaction

1. Read `chanda_payments/{paymentId}`.
2. If already captured, stop safely.
3. Read flat record.
4. Add verified amount to the flat's chanda ledger.
5. Update payment status to `captured`.
6. Store gateway payment ID.
7. Store gateway order ID.
8. Store verified amount.
9. Generate/store receipt number.
10. Mark receipt as ready.

Prefer a transaction or server-side atomic workflow so the payment cannot be counted twice.

---

# 16. Keep Payment Ledger Separate from Current Balance

Do not simply overwrite:

```text
flat.amount = 500
```

Use immutable payment records.

Example:

### `chanda_payments/{paymentId}`

Every successful transaction is retained.

Then calculate:

```text
totalPaid = SUM(captured verified payments)
due = expectedChanda - totalPaid
```

This gives proper auditability.

For corrections/refunds, create a reversal/refund record rather than silently deleting the original payment.

---

# 17. Digital Ganpati Chanda Pavti

## Receipt requirements

After the payment is **server-verified**, generate a digital Pavti containing:

- Siyaram Mitra Mandal branding
- Ganpati/Bappa branding
- Receipt number
- Date
- Time
- User name
- Building
- Wing
- Flat number
- Paid amount
- Payment method: UPI
- Gateway payment ID/reference
- Transaction status: PAID
- Optional masked contact/email
- Optional Marathi/Hindi wording
- Verification/footer text

Example:

```text
श्री गणपती बाप्पा मोरया

SIYARAM MITRA MANDAL
GANPATI CHANDA PAVTI

Receipt No: SMM-2026-000123

Name: Rishi Uttam Sahu
Building: Siyaram Building
Wing: A
Flat: A-101

Amount Paid: ₹500
Payment Mode: UPI
Status: PAID

Transaction Ref: pay_xxxxxxxxx
Date: 18/08/2026

Thank you for your contribution.
गणपती बाप्पा मोरया!
```

---

# 18. Receipt Generation Architecture

Generate the receipt on the server from the verified payment document.

Do not generate the official receipt from only frontend state.

Recommended approach:

```text
captured payment
      ↓
server creates receipt data
      ↓
generate PDF/image
      ↓
store receipt URL/reference
      ↓
update payment:
receiptGenerated = true
receiptNumber = ...
receiptUrl = ...
```

The receipt should be reproducible later from the stored payment record.

---

# 19. Auto Flash + Auto Download UX

When Firestore changes:

```ts
status === "captured"
```

the contribution screen should:

1. Stop payment polling.
2. Show a full-screen/large success flash.
3. Animate:
   - check mark
   - "Payment Successful"
   - "₹500 Paid"
4. Show receipt number.
5. Start receipt download automatically.
6. Also provide:
   - View Pavti
   - Download Again
   - Share

### Important browser behavior

Some mobile browsers block automatic downloads that happen long after the original user gesture.

Therefore implement both:

- automatic download attempt
- highly visible **Download Pavti** fallback button

Do not treat a blocked browser download as a payment failure.

---

# 20. Real-Time Success Detection

After order creation, the frontend should subscribe to the user's payment record:

```text
chanda_payments/{paymentId}
```

When the server webhook updates:

```text
status = captured
```

the client immediately receives the Firestore update.

This is preferable to trusting only a redirect.

For an extra-fast UX, the frontend can also call:

```text
GET /api/payments/{paymentId}
```

while waiting, but the server must still verify against the gateway.

---

# 21. UPI QR UX

## Desktop

Show:

```text
+--------------------------+
|      Scan to Pay         |
|                          |
|       [ QR CODE ]        |
|                          |
|       ₹500               |
|                          |
| Waiting for payment...   |
+--------------------------+
```

After successful webhook:

```text
✓ Payment Successful
₹500 received

Generating Pavti...
```

Then flash and download.

## Mobile

Prefer:

**Pay with UPI**

which launches the supported UPI flow where available.

Also offer:

**Show QR**

for cases where the user wants to scan from another phone.

---

# 22. Direct UPI Link

If a direct UPI link is offered, treat it as a convenience/launch mechanism only.

Do not do:

```text
UPI link opened
→ mark paid
```

Do:

```text
UPI link opened
→ wait
→ gateway/backend verifies actual payment
→ captured
→ receipt
```

If the requirement is truly "website must detect that payment is done", use the gateway's transaction identity + webhook/API verification rather than relying on a generic UPI deep link.

---

# 23. Payment Settings in Admin Panel

Add:

**Admin → Payment Settings**

Fields:

- Gateway enabled
- Live/Test mode indicator
- Accepted currency
- Minimum chanda
- Maximum chanda
- UPI enabled
- QR enabled
- Payment-link enabled
- Receipt prefix
- Mandal receipt footer
- Receipt logo
- Support/contact text

Never store gateway secret keys in Firestore or client-side environment variables.

Use deployment secret storage.

---

# 24. Gateway Configuration

Recommended initial gateway:

**Razorpay**

Required production setup:

1. Create/verify business account.
2. Complete required KYC.
3. Generate Test API credentials.
4. Configure Test webhook.
5. Implement and test payment flow.
6. Generate Live credentials.
7. Configure Live webhook.
8. Store secrets in server/Cloudflare secret storage.
9. Confirm UPI/QR features are enabled for the account.
10. Run a real low-value production transaction.
11. Verify webhook, ledger and receipt.
12. Refund/reconcile the test transaction if appropriate.

Razorpay's documentation states that live integrations require account setup/KYC and separate live/test keys.

---

# 25. Cloudflare Worker Integration

The supplied worker already has:

- Google service-account authentication
- Google Sheets integration
- Firestore REST access
- `building_chanda`
- online ledger handling
- transaction logging

Therefore it can be extended with payment endpoints instead of introducing another backend, if that is the desired deployment architecture.

Recommended worker routes:

```text
POST /payments/create-order
POST /payments/webhook
GET  /payments/status/:paymentId
POST /payments/reconcile/:paymentId
```

### Worker secrets

Store:

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
```

as server-side secrets.

Do not expose them through:

```text
NEXT_PUBLIC_*
```

or browser JavaScript.

---

# 26. Google Sheets Synchronization

The current worker already writes financial records to Google Sheets.

After a verified payment:

```text
Gateway
 ↓
Payment DB
 ↓
Verified chanda ledger
 ↓
Google Sheet
```

The Sheet row should contain:

- Date
- Time
- Type
- Name
- Building
- Wing
- Flat
- Amount
- Payment mode
- Gateway payment ID
- Receipt number
- Status

Only **captured/verified** online payments should be counted as actual income.

Pending/failed payments should never increase the collected total.

---

# 27. Admin Payment Ledger

Create:

**Admin → Online Payments**

Columns:

- Receipt
- User
- Building
- Wing
- Flat
- Requested amount
- Verified amount
- Status
- Gateway
- Gateway payment ID
- Date/time
- Receipt
- Refund/reconcile action

Filters:

- Today
- This week
- This month
- Building
- Wing
- Flat
- Paid
- Failed
- Pending
- Amount mismatch

---

# 28. Reconciliation

Add an admin reconciliation page.

Use it to identify:

- Gateway payment exists but Firestore is pending
- Firestore says captured but gateway lookup disagrees
- Duplicate webhook
- Amount mismatch
- Receipt missing
- Google Sheet sync failed

Admin should be able to retry non-financial synchronization.

Do not provide a casual "Mark as Paid" button that bypasses gateway verification.

If manual reconciliation is necessary, require:

- admin role
- reason
- audit log
- original gateway reference
- explicit `manually_reconciled` status

---

# 29. Security Rules

Firestore rules should prevent ordinary users from:

- changing payment status
- changing verified amount
- changing gateway payment ID
- changing receipt number
- changing captured timestamps
- creating fake captured payments
- changing another user's payments
- editing building structure

Admin-only writes:

```text
buildings
wings
flats
payment settings
reconciliation
```

Server-only writes:

```text
payment status
verified amount
gateway IDs
receipt number
receipt URL
capturedAt
webhook event records
```

---

# 30. Audit Logs

Create:

### `admin_audit_logs/{logId}`

```ts
{
  adminUid,
  action,
  targetType,
  targetId,
  before,
  after,
  reason,
  createdAt
}
```

Track:

- building creation
- building edit
- building archive
- wing changes
- flat changes
- payment reconciliation
- receipt regeneration
- payment settings changes

---

# 31. Testing Plan

## Building tests

- Add building
- Duplicate building code rejected
- Edit building
- Archive building
- Add wing
- Edit wing
- Delete/archive wing
- Add 16 A-wing flats
- Add two B-wing ranges
- Edit flat
- Archive flat
- Search flat
- Payment status displayed correctly
- Old `building_chanda` records remain accessible during migration

## Payment tests

### Test mode

- Create order
- Open UPI flow
- Simulate successful payment
- Receive webhook
- Verify signature
- Verify amount
- Mark captured
- Generate receipt
- Auto-download receipt
- Fire success animation
- Refresh page and confirm receipt remains available

### Failure tests

- Failed payment
- Cancelled payment
- Expired payment
- Invalid webhook signature
- Duplicate webhook
- Missing payment record
- Wrong amount
- Wrong order ID
- User closes browser after payment
- Network disconnect during payment
- Webhook arrives after user returns
- Webhook arrives twice
- Receipt generation fails
- Google Sheet sync fails

---

# 32. Production Acceptance Tests

The feature is not considered complete until these exact scenarios work.

### Scenario A — Mobile UPI

```text
User selects A-101
→ enters ₹500
→ Pay
→ UPI app opens
→ user pays ₹500
→ returns to site
→ site verifies payment
→ green success flash
→ receipt shows verified ₹500
→ Pavti downloads
```

### Scenario B — Desktop QR

```text
User selects B-201
→ enters ₹1000
→ QR displayed
→ user scans with phone
→ pays ₹1000
→ webhook arrives
→ desktop instantly shows success
→ Pavti downloads
```

### Scenario C — User lies/refreshes

```text
User enters ₹500
→ closes payment
→ refreshes
→ no receipt
→ no collected amount
```

### Scenario D — Amount mismatch

```text
Expected ₹500
Gateway reports ₹450
→ payment not treated as normal ₹500 chanda
→ admin reconciliation required
```

### Scenario E — Duplicate webhook

```text
Same webhook arrives twice
→ only one payment ledger entry
→ only one receipt
→ totals unchanged by second event
```

---

# 33. Implementation Order

## Phase 1 — Repository reconciliation

- [ ] Compare the supplied snapshot with the actual working repository.
- [ ] Confirm actual `AdminPanel`, `Dashboard`, and `Contribute` implementations.
- [ ] Confirm Firebase security rules and deployment architecture.
- [ ] Confirm whether Cloudflare Worker or Next.js server endpoints will own payment secrets.
- [ ] Back up Firestore and Google Sheet data.

## Phase 2 — Building foundation

- [ ] Create building/wing/flat types.
- [ ] Create Firestore schema.
- [ ] Create migration script.
- [ ] Add admin CRUD APIs/helpers.
- [ ] Add Building Management admin UI.
- [ ] Add bulk flat generator.
- [ ] Add member building/flat view.
- [ ] Add live status calculations.

## Phase 3 — Payment foundation

- [ ] Create gateway test account.
- [ ] Create server-side order endpoint.
- [ ] Create payment document before checkout.
- [ ] Integrate UPI checkout.
- [ ] Integrate QR flow.
- [ ] Add webhook endpoint.
- [ ] Validate webhook signature.
- [ ] Add idempotency.
- [ ] Add gateway API verification fallback.
- [ ] Implement exact amount validation.

## Phase 4 — Chanda ledger

- [ ] Connect captured payments to the selected flat.
- [ ] Update verified totals.
- [ ] Preserve immutable payment history.
- [ ] Sync verified income to Google Sheets.
- [ ] Add reconciliation state.
- [ ] Add admin online-payment ledger.

## Phase 5 — Pavti

- [ ] Create server-side receipt generator.
- [ ] Generate unique receipt number.
- [ ] Store receipt metadata.
- [ ] Store receipt file/reference.
- [ ] Add receipt preview.
- [ ] Add automatic download attempt.
- [ ] Add manual download fallback.
- [ ] Add success flash animation.

## Phase 6 — Security and production

- [ ] Lock Firestore writes.
- [ ] Move all gateway secrets to server-side secret storage.
- [ ] Add audit logs.
- [ ] Test duplicate webhook behavior.
- [ ] Test payment-after-browser-close.
- [ ] Test reconciliation.
- [ ] Test live UPI transaction.
- [ ] Verify production receipt.
- [ ] Verify Google Sheet reconciliation.
- [ ] Monitor webhook failures.

---

# 34. Definition of Done

The implementation is complete only when:

- Admin can add/update/archive buildings.
- Admin can add/update/archive wings.
- Admin can add/update/archive flats.
- A/B and future wings are data-driven rather than hard-coded.
- Existing building chanda data is migrated safely.
- Users can select their building → wing → flat.
- Users can initiate a real UPI payment.
- Users can pay using a QR flow.
- The backend receives and verifies the gateway webhook.
- The backend verifies the actual paid amount.
- A browser callback alone cannot create a successful payment.
- Duplicate webhooks cannot create duplicate payments.
- Only verified captured payments increase chanda totals.
- The verified user's name is printed on the Pavti.
- The verified gateway amount is printed on the Pavti.
- Every Pavti has a unique receipt number.
- A successful payment triggers a visible success flash.
- The receipt automatically attempts to download on the phone.
- A manual download fallback is always available.
- Admin can see payment status and gateway reference.
- Admin can reconcile exceptional cases.
- Security rules prevent users from fabricating successful payments.

---

# 35. Important Implementation Decision

**Do not build payment confirmation by checking a static UPI QR, matching screenshots, asking the user to press "I Paid", or trusting a frontend callback.**

The correct architecture is:

```text
                    ┌──────────────────────┐
                    │      User Browser    │
                    │ Building / Flat / Pay│
                    └──────────┬───────────┘
                               │
                         Create Order
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Server / Worker API  │
                    │ Gateway Secret Lives │
                    │       Here           │
                    └──────────┬───────────┘
                               │
                         Gateway Order
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Payment Gateway      │
                    │ UPI / QR / Intent    │
                    └──────────┬───────────┘
                               │
                         User Pays
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Gateway Webhook      │
                    │ Signed Server Event  │
                    └──────────┬───────────┘
                               │
                    Verify + Amount Check
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Firestore Payment    │
                    │ status = captured    │
                    └──────────┬───────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
          Chanda Ledger   Google Sheet   Pavti Generator
                │                             │
                └──────────────┬──────────────┘
                               ▼
                    ┌──────────────────────┐
                    │ Browser Real-time    │
                    │ Success Flash        │
                    │ Auto Download Pavti  │
                    └──────────────────────┘
```

---

# 36. Recommended First Build

Implement the following first, before polishing the UI:

1. **Building CRUD + Wing CRUD + Flat CRUD**
2. **Normalized building data model**
3. **Payment order creation**
4. **UPI/QR gateway integration**
5. **Webhook verification**
6. **Exact amount verification**
7. **Firestore payment ledger**
8. **Real-time payment status**
9. **Pavti generation**
10. **Success flash + download**
11. **Admin payment/reconciliation panel**
12. **Migration + production testing**

This order prevents the UI from being built around a payment flow that later has to be replaced for security reasons.
