# Implementation Plan V2 — Multi-Year / Multi-Season Chanda System

## 1. Critical Missing Feature

The current Mandal website needs a proper **Chanda Season / Year Management system**.

The monthly contribution amount is not a permanent value. It is configured for a particular Mandal year/season. For example:

- 2025–26 → each month has a configured fixed amount
- 2026–27 → each month can have different fixed amounts
- 2027–28 → should be creatable by the admin without changing source code

The current architecture must not assume that the current year's monthly schedule will continue forever.

The existing source already describes the portal as tracking monthly chanda contributions and contains `chanda_payments` / `mandal_chanda` financial records. The profile update flow also synchronizes user changes into those records. fileciteturn3file1L181-L200 fileciteturn3file7L641-L699

---

# 2. Core Architecture

Do NOT store the rule simply as:

```text
member.monthlyAmount
```

Instead:

```text
Chanda Season
 ├── Monthly Due Schedule
 ├── Member/Flat Overrides
 ├── Members
 ├── Buildings
 ├── Payments
 └── Reports
```

Every payment must belong to:

```text
seasonId + monthKey + member/flat
```

This prevents 2025–26 and 2026–27 payments from being mixed.

---

# 3. Season Entity

Create:

`chanda_seasons/{seasonId}`

Example:

```ts
{
  name: "2026–27",
  displayName: "Ganpati Chanda Season 2026–27",
  startDate,
  endDate,
  status: "active",
  createdAt,
  updatedAt,
  createdBy,
  updatedBy
}
```

Supported statuses:

```text
draft
upcoming
active
closing
closed
archived
```

There should normally be exactly one active production season.

Do not hard-code:

```ts
CURRENT_YEAR = "2025-26"
```

---

# 4. Admin Panel — Chanda Seasons

Add a new section:

```text
ADMIN PANEL

Dashboard
Chanda Seasons       ← NEW
Buildings
Members
Payments
Receipts
Reports
Settings
Audit Logs
```

The Chanda Seasons page should show:

- Season name
- Start/end date
- Status
- Number of members
- Number of months configured
- Expected collection
- Actual collection
- Outstanding amount
- Actions

Actions:

```text
Manage
Edit
Publish
Activate
Close
Archive
```

Do NOT provide normal permanent deletion for historical seasons.

---

# 5. Create New Season

Admin must have:

**`+ Create New Season`**

Fields:

```text
Season Name
Start Date
End Date
Description
Copy previous season? Yes/No
Copy from: [previous season]
```

New seasons start as:

```text
DRAFT
```

The new season must not automatically replace the active season.

---

# 6. Copy Previous Season

This is essential for yearly maintenance.

Example:

```text
2026–27 ACTIVE
       ↓
Copy configuration
       ↓
2027–28 DRAFT
```

Copy:

- Monthly schedule
- Physical building/wing/flat references
- Member/flat mappings
- Default chanda rules
- Carry-forward settings
- Receipt settings where appropriate

DO NOT copy:

- Historical payments
- Gateway payment IDs
- Receipt numbers
- Paid amounts
- Payment timestamps
- Old collection totals
- Old payment statuses

The new season must start financially fresh.

---

# 7. Monthly Fixed Due Schedule

Create:

`chanda_seasons/{seasonId}/monthly_dues/{monthId}`

Example:

```ts
{
  monthKey: "2026-06",
  monthName: "June",
  dueAmount: 150,
  status: "open",
  locked: false,
  createdAt,
  updatedAt
}
```

Example schedule:

```text
April       ₹100
May         ₹100
June        ₹150
July        ₹150
August      ₹200
September   ₹200
October     ₹100
November    ₹100
December    ₹100
January     ₹150
February    ₹150
March       ₹200
```

These amounts must come from Firestore/database configuration, never from hard-coded React values.

---

# 8. Admin Monthly Schedule UI

Inside:

**Season → Monthly Schedule**

Show:

| Month | Fixed Due | Status | Action |
|---|---:|---|---|
| April | ₹100 | Configured | Edit |
| May | ₹100 | Configured | Edit |
| June | ₹150 | Configured | Edit |
| July | ₹150 | Configured | Edit |

Actions:

- Edit amount
- Copy amount to selected months
- Bulk edit
- Lock month
- Review affected members

---

# 9. Editing a Month

If June is:

```text
₹150
```

and admin changes it to:

```text
₹200
```

the system must warn:

```text
This month may already contain financial records.

Changing the expected amount can affect outstanding balances.

Choose:
○ Apply to future unpaid balance
○ Change expected amount for all applicable members
○ Cancel
```

Never rewrite historical payment amounts.

Example:

```text
Expected = ₹200
Previously paid = ₹150

Payment remains ₹150.
Due becomes ₹50.
```

---

# 10. Expected vs Paid vs Due

These must be separate concepts.

Example:

```text
June 2026

Expected: ₹150
Paid:     ₹100
Due:       ₹50
```

Never store only one generic `amount` field and use it for all three meanings.

---

# 11. Partial Payments

Support:

```text
Expected = ₹500

Payment 1 = ₹200
Payment 2 = ₹300

Total Paid = ₹500
Due = ₹0
```

Each successful payment remains an immutable transaction.

---

# 12. Overpayments

Support:

```text
Expected = ₹500
Paid = ₹700
```

Show:

```text
Expected: ₹500
Paid: ₹700
Extra: ₹200
```

Admin can configure whether the extra amount:

- carries forward
- becomes an additional donation
- is assigned to the next month
- requires reconciliation

Never silently lose the difference.

---

# 13. Member-Specific Overrides

Default:

```text
Everyone → ₹150
```

but a specific member/flat may need a different amount.

Create:

`chanda_seasons/{seasonId}/member_overrides/{overrideId}`

Example:

```ts
{
  userId,
  buildingId,
  wingId,
  flatId,
  monthKey: "2026-06",
  defaultAmount: 150,
  overrideAmount: 100,
  reason: "Special contribution arrangement",
  createdBy,
  createdAt
}
```

Priority:

```text
Season Default
      ↓
Building Override
      ↓
Flat Override
      ↓
Member Override
```

Do not change the global monthly amount just to accommodate one member.

---

# 14. Carry-Forward Dues

Support an optional season setting:

```ts
carryForwardEnabled: true
```

Example:

```text
April expected ₹100
Paid ₹50
Due ₹50

May expected ₹100
Previous due ₹50

Total payable = ₹150
```

Member screen:

```text
May Chanda
Current month: ₹100
Previous due:   ₹50
--------------------
Payable:       ₹150
```

This should be configurable. Some Mandals may want each month independent.

Also optionally support:

```ts
overpaymentCarryForwardEnabled: true
```

---

# 15. Season-Aware Payment Model

Extend `chanda_payments` so every payment contains:

```ts
{
  seasonId: "season_2026_27",
  monthKey: "2026-06",

  userId,
  userName,

  buildingId,
  wingId,
  flatId,

  expectedAmount,
  requestedAmount,
  verifiedAmount,

  status: "captured",

  gateway,
  gatewayOrderId,
  gatewayPaymentId,

  receiptNumber,

  paidAt,
  createdAt,
  updatedAt
}
```

The gateway order must be tied to the season and month before payment starts.

---

# 16. Active Season Selection

Admin dashboard should have:

```text
Chanda Season
[ 2026–27 ▼ ]
```

Every financial widget must respect this selection:

- Total collection
- Outstanding
- Monthly collection
- Member dues
- Building collection
- Payments
- Reports

Switching to 2025–26 must show historical 2025–26 numbers only.

---

# 17. Future-Year Preparation

This is the main fix requested.

Admin should be able to create:

```text
2027–28
```

while:

```text
2026–27 = ACTIVE
```

Example:

```text
2026–27
ACTIVE

Admin prepares:

2027–28
DRAFT
   ↓
Sets monthly amounts
   ↓
Reviews
   ↓
Publishes
   ↓
Schedules activation
```

The developer should never have to edit code merely because Ganpati/year changed.

---

# 18. Scheduled Activation

Support:

```text
Activate on: 01 April 2027
```

or whatever date the Mandal chooses.

At activation:

```text
2026–27 → closing/closed
2027–28 → active
```

Require confirmation and prevent two normal active seasons.

---

# 19. Closing a Season

When admin closes a season, show:

```text
You are closing 2026–27.

Members: 128
Expected: ₹153,600
Collected: ₹146,200
Outstanding: ₹7,400

Continue?
```

After closing:

- Normal new payments are blocked.
- Historical payments remain visible.
- Receipts remain downloadable.
- Monthly configuration becomes read-only.
- Controlled reconciliation remains possible with an audit log.

---

# 20. Historical Seasons

Members and admins should be able to select old seasons:

```text
2027–28
2026–27
2025–26
```

Closed seasons are read-only.

Members can view:

- old monthly dues
- payments
- payment dates
- receipts
- yearly total
- outstanding amount

Never delete historical financial data.

---

# 21. Building + Season Integration

Physical structure and financial structure should remain separate.

```text
Physical:
Building
  └── Wing
       └── Flat

Financial:
Season
  └── Monthly Due
       └── Member/Flat payment
```

The same building can exist across many seasons.

Do not create a completely unrelated building every year.

Instead, maintain historical membership/configuration records where necessary.

---

# 22. Membership Changes

Support:

- new member
- member leaves
- flat vacancy
- resident changes
- member changes flat

Use effective dates:

```text
startDate
endDate
status
```

Do not delete old assignments.

Example:

```text
A-101

2026:
Resident A

2027:
Resident B
```

A 2026 receipt must still show Resident A.

---

# 23. Snapshot Receipt Data

Payment/receipt records should store the historical values used at payment time:

```text
userName
address
buildingName
wingCode
flatNumber
```

Do not regenerate old receipts from the current user profile.

If the user changes their address later, old receipts must remain unchanged.

---

# 24. Address

Because the Pavti requirement includes address when supplied:

User profile:

```ts
address
```

Payment/receipt snapshot:

```ts
receiptAddress
```

If no address was supplied:

```text
omit address field
```

Do not invent an address.

---

# 25. Payment Flow With Season

Final flow:

```text
Member
 ↓
Active Season
 ↓
Selected Month
 ↓
Monthly Fixed Due
 ↓
Member/Flat Override
 ↓
Previous Due / Carry Forward
 ↓
Total Payable
 ↓
Create Gateway Order
 ↓
UPI / QR
 ↓
Server Verification
 ↓
Captured Payment
 ↓
seasonId + monthKey ledger entry
 ↓
Pavti
```

This prevents payments from being assigned to the wrong year.

---

# 26. Pavti / Receipt Numbering

Receipt numbers must never collide.

Possible format:

```text
SMM-26-000001
SMM-26-000002
```

or:

```text
SMM-2026-000001
```

The numbering strategy should be stored in season configuration.

Do not generate official receipt numbers only on the client.

---

# 27. Season Reports

For each season show:

```text
2026–27

Total Members: 128
Expected: ₹153,600
Collected: ₹146,200
Outstanding: ₹7,400
Collection Rate: 95.2%
```

Monthly report:

```text
April
Expected ₹12,800
Collected ₹12,000
Due ₹800

May
Expected ₹12,800
Collected ₹12,500
Due ₹300
```

Member report:

```text
Member
Expected
Paid
Due
Months Paid
Months Due
```

Building/wing report must also support season filtering.

---

# 28. Member Dashboard

For active season:

```text
Chanda 2026–27

April       ₹100   ✓ Paid
May         ₹100   ✓ Paid
June        ₹150   ₹100 Paid
July        ₹150   Due
August      ₹200   Due
```

Summary:

```text
Expected: ₹600
Paid: ₹300
Due: ₹300
```

Allow switching to historical seasons.

---

# 29. Payment Gateway Integration

The earlier real UPI/QR gateway implementation must use:

```text
seasonId
monthKey
expectedAmount
userId
flatId
```

The backend validates all of these before creating the gateway order.

A frontend callback alone must never mark a payment successful.

Only verified gateway payment events can move the payment to:

```text
captured
```

Then:

```text
captured
 ↓
season/month ledger
 ↓
Pavti
 ↓
success flash
 ↓
auto download
```

---

# 30. Monthly Locking

Once a month contains payments:

```text
June 2026
Payments exist
→ LOCKED
```

Do not allow casual amount changes.

If an adjustment is required:

```text
Reason:
[________________]

Old expected: ₹150
New expected: ₹200

[Create Adjustment]
```

Store the change in the audit log.

---

# 31. Admin Setup Wizard

Recommended flow:

### Step 1
Choose:

```text
Create 2027–28
```

### Step 2
Copy:

```text
2026–27
```

### Step 3
Review monthly amounts.

### Step 4
Edit monthly amounts.

### Step 5
Review member overrides.

### Step 6
Review projected expected collection.

### Step 7
Publish.

### Step 8
Schedule activation.

This makes yearly setup safe and easy.

---

# 32. Migration From Existing System

The supplied source already uses `chanda_payments` and `mandal_chanda`; profile changes are synchronized into those records by UID/email. fileciteturn3file7L671-L699

Migration steps:

1. Back up Firestore.
2. Export existing chanda records.
3. Identify the current 2025–26 records.
4. Create the 2025–26 season.
5. Create its monthly schedule.
6. Add `seasonId` and `monthKey` to existing payment records.
7. Verify totals against the current ledger/Google Sheet.
8. Only then switch production queries to season-aware queries.
9. Preserve legacy IDs during migration.

Do not delete the old data during migration.

---

# 33. Backward Compatibility

Some old records may not have:

```text
seasonId
monthKey
```

temporarily.

Create a migration process that maps them.

After migration is verified, all new payment records must require:

```text
seasonId
monthKey
```

---

# 34. Audit Logs

Track:

```text
CREATE_SEASON
EDIT_SEASON
PUBLISH_SEASON
ACTIVATE_SEASON
CLOSE_SEASON
ARCHIVE_SEASON

EDIT_MONTH_AMOUNT
LOCK_MONTH
UNLOCK_MONTH

CREATE_OVERRIDE
EDIT_OVERRIDE
REMOVE_OVERRIDE

MANUAL_ADJUSTMENT
```

Example:

```ts
{
  adminUid,
  action: "EDIT_MONTH_AMOUNT",
  seasonId,
  monthKey,
  before: 150,
  after: 200,
  reason: "Committee-approved revision",
  createdAt
}
```

---

# 35. Security Rules

Users must never be allowed to change:

```text
seasonId
monthKey
expectedAmount
verifiedAmount
payment status
receiptNumber
gatewayOrderId
gatewayPaymentId
```

from the browser.

Admin-only operations:

```text
create season
edit season
publish
activate
close
edit monthly dues
create overrides
```

Server-only operations:

```text
verifiedAmount
captured status
gateway IDs
receipt number
receipt generation
```

---

# 36. Final Admin Panel Structure

```text
ADMIN PANEL
│
├── Dashboard
│
├── Chanda Seasons
│   ├── All Seasons
│   ├── Create Season
│   ├── Monthly Schedule
│   ├── Member Overrides
│   └── Season Reports
│
├── Buildings
│   ├── Buildings
│   ├── Wings
│   └── Flats
│
├── Members
│   ├── Members
│   ├── Membership
│   └── Assignments
│
├── Payments
│   ├── Online Payments
│   ├── Manual Entries
│   └── Reconciliation
│
├── Receipts
│   ├── Pavtis
│   └── Receipt Settings
│
├── Reports
├── Payment Settings
└── Audit Logs
```

---

# 37. Definition of Done

This feature is complete only when:

- Admin can create a new year/season.
- Admin can edit a draft season.
- Admin can copy the previous season.
- Admin can set monthly fixed amounts.
- Admin can edit monthly amounts.
- Admin can bulk-edit monthly amounts.
- Admin can set member/flat-specific overrides.
- Admin can publish a season.
- Admin can schedule activation.
- Only one normal production season is active.
- Admin can close a season.
- Closed seasons are read-only for normal financial operations.
- Historical seasons remain accessible.
- Historical payments remain unchanged.
- Historical Pavtis remain valid.
- New seasons start with fresh collection totals.
- Every new payment contains `seasonId`.
- Every monthly payment contains `monthKey`.
- Expected, paid and due amounts are separate.
- Partial payments work.
- Overpayments are explicitly handled.
- Carry-forward is configurable.
- Member/flat changes do not rewrite old receipts.
- Building reports can be filtered by season.
- Member dashboards can switch seasons.
- Gateway orders are tied to season + month.
- Only verified payments count toward collection.
- Pavti uses the historical payment snapshot.
- Receipt numbers cannot collide.
- Important admin changes are audited.
- No developer change is required when a new Ganpati year begins.

---

# 38. Most Important Result

The old system would effectively behave like:

```text
Current website
      ↓
2025–26 settings
      ↓
Ganpati ends
      ↓
Problem: no way to create 2027 configuration
```

The new system must behave like:

```text
                    CHANDA SEASONS
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
       2025–26        2026–27        2027–28
       CLOSED          ACTIVE          DRAFT
          │              │              │
      Historical      Current       Admin prepares
       payments       payments       future rules
                         │
                  Monthly Schedule
                         │
                  Member Overrides
                         │
                     Payments
                         │
                  Gateway Verify
                         │
                       Pavti
```

**The key requirement is that the Mandal admin must be able to prepare the next year's entire chanda configuration from the Admin Panel without a developer touching the source code.**
