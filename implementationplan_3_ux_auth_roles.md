# Implementation Plan 3 — UX, Authentication & Role-Based Experience

## Project: Siyaram Mitra Mandal

This plan addresses the website's UX problems, especially the long onboarding sequence, unnecessary waiting, passcode system, returning-user flow, and role-based visibility. Work is divided into phases so each phase can be implemented and tested independently.

---

# 1. Current UX Problem

The current experience can make users pass through too many screens before reaching the actual website:

```text
Site loads
  ↓
Opening/title screen
  ↓
Long Mandal description
  ↓
Security/private screen
  ↓
Google Login
  ↓
Secret Passcode
  ↓
Hindi Welcome
  ↓
English Welcome
  ↓
Permission Granted
  ↓
Explore Our Memories
  ↓
Main Website
```

The current main page contains several intro/auth states including `isPasscodeVerified`, `introPhase`, `revealSequence`, and splash/reveal states. fileciteturn7file2L226-L244

`Welcome.tsx` currently has five phases plus passcode and attempt state. fileciteturn7file0L44-L87

The current passcode flow reads `secretPasscode` from `mandal_settings/system`, with a fallback passcode, so removing the passcode must be done in both UI and application logic. fileciteturn6file1L110-L126

---

# 2. Target UX

## A. User is NOT already logged in

```text
Website opens
  ↓
Google Login / Member Access Portal
  ↓
Sign in with Google
  ↓
Hindi Welcome
"Siyaram Mitra Mandal mein aapka swagat hai"
  ↓
English Welcome
"Welcome to Siyaram Mitra Mandal"
  ↓
Identity / Permission Welcome
User's Name
"Official Member of Siyaram Mitra Mandal"
  ↓
Explore Our Memories
  ↓
MAIN WEBSITE
```

Remove from this path:

```text
Opening splash
Long description splash
Security/private splash
Secret passcode
Passcode attempts
Passcode verification
```

## B. User is ALREADY logged in

```text
Website opens
  ↓
Firebase Auth detected
  ↓
English Welcome
"Welcome to Siyaram Mitra Mandal"
  ↓
MAIN WEBSITE
```

Do not show Google Login, Passcode, Hindi Welcome, Permission Granted, or Explore Our Memories again for a returning user.

---

# 3. Product Decision — Remove Private Passcode Gate

The website should no longer behave as a secret/private Mandal vault. People from other Mandals, visitors, friends/family, and devotees should be able to access the website experience.

Google authentication remains the identity mechanism for account-level features. Google login is not a Mandal secret.

Security becomes:

```text
Firebase Authentication
      +
Role Authorization
      +
Firestore Security Rules
      +
Banned-user checks
```

Removing the passcode must NOT remove moderation or role security.

---

# PHASE 1 — Authentication-First Boot

## Goal

Make authentication the first application decision.

Target:

```text
Auth check
  ├── Signed out → Login
  └── Signed in  → Returning-user flow
```

The existing app already uses `onAuthStateChanged(auth, ...)` and an auth-checking state. fileciteturn7file5L482-L521

Recommended state:

```ts
type AuthStatus = "checking" | "signed_out" | "signed_in";
```

While `checking`, render only a short branded loading state. Do not render the old intro sequence and then hide it after Firebase resolves.

### Acceptance criteria

- Signed-out users reach Login quickly.
- Signed-in users never see Login flash briefly.
- Refresh does not replay unnecessary intro screens.
- No wrong screen flashes while Firebase initializes.

---

# PHASE 2 — Completely Remove Passcode

## Goal

Delete the passcode as an authorization mechanism, not merely hide its screen.

Remove from frontend/state:

```text
passcode
attempts
showPasscode
verifyPasscode()
isPasscodeVerified
mandal_pass_auth_<uid>
```

The current code stores passcode-auth state in localStorage using `mandal_pass_auth_<uid>`. fileciteturn6file4L451-L457

Remove the Firestore dependency on:

```text
mandal_settings/system.secretPasscode
```

The current implementation reads that field during verification. fileciteturn6file1L121-L126

Remove passcode-based banning. The current implementation can ban a user after three wrong passcode attempts; that logic must disappear with the passcode. fileciteturn7file7L643-L680

Keep the real moderation field:

```text
isBanned
```

and keep `BannedPage`.

### Security requirement

Audit Firestore rules and guards for any assumption that a user must have `passcodeVerified === true`.

---

# PHASE 3 — New User Welcome Flow

After successful Google login for a new account, show only three intentional stages.

## Stage 1 — Hindi

```text
सियाराम मित्र मंडळ में आपका स्वागत है
```

Optional supporting line:

```text
बप्पा की यादों और मंडल की खूबसूरत यादों में आपका स्वागत है।
```

Keep it short: approximately 1.5–2.5 seconds, or allow tap-to-continue.

## Stage 2 — English

```text
Welcome to Siyaram Mitra Mandal
```

Again, approximately 1.5–2.5 seconds or tap-to-continue.

## Stage 3 — Identity

```text
PERMISSION GRANTED

{User Name}

OFFICIAL MEMBER OF SIYARAM MITRA MANDAL
```

The user's actual Google display name must be shown. The current implementation already renders the authenticated user's name on the Permission Granted screen. fileciteturn7file0L16-L33

CTA:

```text
EXPLORE OUR MEMORIES
```

Then enter the main website.

### Important wording

Because a new account is a `Viewer`, the phrase `OFFICIAL MEMBER` can be misleading. Preferred role-aware wording:

```text
Viewer  → WELCOME TO SIYARAM MITRA MANDAL
Member  → OFFICIAL MEMBER OF SIYARAM MITRA MANDAL
Admin   → MANDAL ADMINISTRATOR
```

If the owner wants the same visual phrase for everyone, it should be treated as branding, not as an authorization claim.

---

# PHASE 4 — Returning User Fast Entry

A returning authenticated user should see only:

```text
Welcome to Siyaram Mitra Mandal
  ↓
Main Website
```

The current code has a localStorage-based passcode fast-forward mechanism. fileciteturn7file6L589-L601

Replace that mechanism with a real onboarding flag such as:

```ts
hasCompletedOnboarding: boolean
```

Firebase Auth must remain the source of truth for authentication. LocalStorage may only store harmless UX preferences, never permission/authentication state.

---

# PHASE 5 — New User Role Assignment

There are three roles:

```text
Viewer
Member
Admin
```

Normalize them internally to:

```ts
type UserRole = "viewer" | "member" | "admin";
```

Existing Firestore values may use capitalized strings; normalize at the application boundary.

When a Google account has no existing user document:

```text
Google Login
  ↓
No users/{uid}
  ↓
Create user
  ↓
role = viewer
```

The current code already defaults a new user to `Viewer` when no existing role is present. fileciteturn6file1L143-L159

A new user must never automatically become Member or Admin.

Only authorized admins can promote users.

---

# PHASE 6 — Viewer Experience

Viewer is an authenticated visitor who has not been promoted to Member.

Viewer should see:

```text
3D / Sphere Public Memories
```

The current `ViewerDashboard` already queries `mandal_gallery` for records where `isPrivate == false` and renders the public images in the 3D sphere. fileciteturn7file4L418-L449

Viewer must NOT see:

```text
Member Feed
```

and must not be able to read member-only Firestore data merely by changing the client UI.

---

# PHASE 7 — Member Experience

Member gets everything a Viewer gets plus Member Feed.

```text
Member
 ├── 3D Memories
 ├── Member Feed
 ├── Gallery
 ├── Profile
 └── Authorized member features
```

The Member Feed must be protected at the Firestore/security layer, not only hidden from navigation.

---

# PHASE 8 — Admin Experience

Admin gets the complete authorized application:

```text
3D Memories
Member Feed
Gallery
Upload
Contributions
Profile
Admin Panel
Buildings
Members
Payments
Receipts
Chanda Seasons
Reports
Settings
Audit Logs
```

The existing profile flow already renders `AdminPanel` for the `admin` role and `UserProfile` otherwise. fileciteturn7file1L139-L145

Keep this behavior but centralize role checks.

---

# PHASE 9 — Role-Based Navigation

The current bottom navigation contains:

```text
Home
Vault
Upload
Donate
Profile
```

and currently attempts Viewer filtering, but the existing nav definitions do not robustly encode the required permissions. fileciteturn7file3L327-L369

Replace ad-hoc filtering with explicit permissions.

Example:

```ts
const permissions = {
  viewer: {
    canViewPublic3D: true,
    canViewMemberFeed: false,
    canUpload: false,
    canDonate: true,
    canManage: false,
  },
  member: {
    canViewPublic3D: true,
    canViewMemberFeed: true,
    canUpload: true,
    canDonate: true,
    canManage: false,
  },
  admin: {
    canViewPublic3D: true,
    canViewMemberFeed: true,
    canUpload: true,
    canDonate: true,
    canManage: true,
  },
};
```

These are the initial requested rules and should be verified against the rest of the application before implementation.

---

# PHASE 10 — Public vs Authenticated Content

Separate public browsing from account-level content.

## Public content

Potentially available without login in a later public-browsing phase:

```text
Mandal introduction
About Mandal
Public information
Selected public photos/videos
Contact information
```

## Authenticated Viewer

```text
3D public-memory experience
Viewer dashboard
```

## Member

```text
Member Feed
Member-only content
```

## Admin

```text
Administration
```

### Current product decision

For the immediate implementation requested in this plan, an unauthenticated user is sent to the Google Login screen first. If the product later decides that public photos/videos must be browsable without any login, change the route to a true public Home/3D experience with optional login.

---

# PHASE 11 — Loading and Animation UX

The current app has multiple animation/loading states:

```text
introPhase
loadingProgress
typedText
isTypingDone
isSplashExiting
isShieldExiting
revealSequence
showSphereView
```

The goal is not to remove all animation. The goal is:

```text
Animation = visual polish
Animation != mandatory waiting
```

Every transition should have a short maximum duration and a skip/tap option where appropriate.

The current Welcome flow includes automatic delays of 5.5 seconds and 4.5 seconds between phases. fileciteturn7file7L683-L697

Those forced waits are a major UX target and should be removed or reduced to the minimum needed for the visual effect.

---

# PHASE 12 — Fast Auth Boot

Recommended boot sequence:

```text
0ms
 ↓
Tiny branded loading state
 ↓
Firebase Auth initialization
 ↓
Signed out? → Login
Signed in?  → Load profile
 ↓
Check banned status
 ↓
Resolve role
 ↓
Render destination
```

Do not show Login and then suddenly replace it with another splash because the auth listener resolved later.

---

# PHASE 13 — Application State Machine

Replace scattered booleans with a simple high-level state machine:

```ts
type AppState =
  | "booting"
  | "login"
  | "newUserWelcome"
  | "returningWelcome"
  | "app"
  | "banned";
```

Transitions:

```text
booting
  ├── signedOut → login
  └── signedIn
        ├── banned → banned
        ├── firstLogin → newUserWelcome
        └── returning → returningWelcome

newUserWelcome → app
returningWelcome → app
login + Google success → newUserWelcome
```

This should replace the old five-phase passcode-oriented flow.

---

# PHASE 14 — First Login Detection

Do not use passcode state to decide whether someone is new.

Use real account state:

```ts
createdAt
lastLogin
hasCompletedOnboarding
```

Recommended user data:

```ts
{
  uid,
  name,
  email,
  role: "viewer",
  hasCompletedOnboarding: false,
  createdAt,
  lastLogin
}
```

After the new-user welcome completes:

```text
hasCompletedOnboarding = true
```

Future visits use the returning-user flow.

---

# PHASE 15 — Banned User Behavior

Removing the passcode must not remove moderation.

Flow:

```text
Firebase Auth
  ↓
User profile
  ↓
isBanned?
 ├── yes → BannedPage
 └── no  → normal role flow
```

The current app already checks `isBanned` and can route the user to `BannedPage`. fileciteturn7file6L603-L631

Only the passcode-based ban path is removed.

---

# PHASE 16 — Firestore Authorization

This phase is mandatory after passcode removal.

Security must be based on Firebase authentication and role authorization.

Conceptually:

```text
Public gallery
→ public read according to visibility

Viewer
→ public content

Member
→ public + member content

Admin
→ management access
```

Never allow a browser client to change:

```text
role
isBanned
admin permissions
member permissions
```

A Viewer changing `role: "admin"` in DevTools must not gain admin access.

---

# PHASE 17 — Upload Permissions

The current navigation exposes Upload. fileciteturn7file3L346-L352

Initial requested policy:

```text
Viewer → no upload
Member → upload according to member policy
Admin  → upload + manage/delete/edit
```

The backend/security rules must enforce the same policy.

---

# PHASE 18 — Gallery Visibility

Current gallery records contain fields including:

```text
isPrivate
category
uploadedBy
uploaderEmail
createdAt
likes
favorites
```

The current upload flow saves `isPrivate` and other metadata to `mandal_gallery`. fileciteturn6file0L11-L28

Use this visibility field consistently:

```text
isPrivate = false → public/Viewer-accessible
isPrivate = true  → protected according to Member/Admin policy
```

Do not change existing privacy data blindly; audit the current records first.

---

# PHASE 19 — Role Management

Admin Panel should expose user role management where appropriate:

```text
User | Role | Status | Actions
```

Actions:

```text
Promote to Member
Demote to Viewer
Promote to Admin
Demote from Admin
Ban
Unban
```

Role mutations must be admin-authorized and audited.

---

# PHASE 20 — Main Page by Role

The current home page can switch between `ViewerDashboard` and `Dashboard` using `showSphereView`. fileciteturn7file1L104-L118

Refactor so role/permissions determine access.

## Viewer

```text
Home
└── 3D Sphere / Public Memories
```

## Member

```text
Home
├── 3D Sphere
└── Member Feed
```

## Admin

```text
Home
├── 3D Sphere
├── Member Feed
└── Admin capabilities
```

---

# PHASE 21 — Error and Offline UX

Every major state needs a friendly fallback.

## Google login failure

```text
Google login nahi ho paya.
Please try again.
```

## Profile loading failure

```text
Your account could not be loaded.
Retry
```

## Network failure

```text
Internet connection check karein.
Retry
```

## Firebase initialization

```text
Loading Siyaram Mitra Mandal...
```

Never leave the user on a blank/broken screen.

---

# PHASE 22 — Mobile UX

The flow must be designed primarily for phones.

Requirements:

- Google Login button is easy to tap.
- Hindi/English welcome text fits small screens.
- No horizontal scrolling.
- CTA is thumb-friendly.
- 3D sphere does not unnecessarily block the interface.
- Bottom navigation remains usable.
- No hover-only interactions.
- Google auth popup/redirect works on mobile browsers.
- Transitions support reduced-motion preferences.

---

# PHASE 23 — Accessibility

Add/verify:

```text
ARIA labels
Semantic buttons
Keyboard navigation
Visible focus states
Reduced motion support
Adequate contrast
```

Animations must never block access to the website.

---

# PHASE 24 — UX Measurement

After deployment, optionally track only useful aggregate UX events:

```text
auth_screen_view
google_login_started
google_login_success
google_login_failed
new_user_welcome_started
new_user_welcome_completed
app_opened
viewer_home_opened
member_feed_opened
```

Primary metrics:

```text
Time to Login
Time to Main Website
Login completion rate
Welcome abandonment rate
Returning-user time-to-app
```

Do not collect unnecessary personal data.

---

# PHASE 25 — Testing Matrix

## A. New user

```text
Fresh Google account
→ Login
→ Viewer created
→ Hindi welcome
→ English welcome
→ Identity welcome
→ Explore
→ Main site
```

## B. Returning Viewer

```text
Already logged in
→ English welcome
→ Main site
→ 3D only
```

## C. Returning Member

```text
Already logged in
→ English welcome
→ Main site
→ 3D + Member Feed
```

## D. Returning Admin

```text
Already logged in
→ English welcome
→ Main site
→ Full authorized capabilities
```

## E. Banned user

```text
Already logged in
→ Banned Page
```

## F. Google login cancellation

```text
Login
→ Cancel Google popup
→ Remain on login
```

## G. Network failure

```text
Auth/profile request fails
→ Friendly error
→ Retry
```

## H. Refresh during welcome

```text
Refresh
→ Firebase resolves
→ No broken state
```

## I. Refresh while logged in

```text
Refresh
→ Short English welcome
→ Main site
```

## J. Role tampering

Attempt:

```text
Viewer → Admin
```

Expected:

```text
Access denied.
```

---

# PHASE 26 — Regression Testing

Verify that passcode removal does not break:

```text
Google Authentication
User creation
User profile
Role assignment
Banned users
Gallery
3D Viewer
Member Feed
Upload
Contribute
Admin Panel
Logout
Firebase listeners
```

Verify existing Member/Admin users keep their existing roles.

---

# PHASE 27 — Code Cleanup

Only after the new flow works, remove unused:

```text
passcode state
passcode UI
passcode verification function
passcode attempt state
passcode localStorage keys
old passcode settings reads
passcode-only comments
obsolete intro phases
obsolete splash timers
obsolete security splash states
```

Then run:

```text
TypeScript check
ESLint
Production build
```

Search the codebase to ensure no functional reference to the old passcode system remains.

---

# PHASE 28 — Final Target Architecture

```text
                         WEBSITE OPEN
                              │
                              ▼
                     Firebase Auth Check
                              │
                 ┌────────────┴────────────┐
                 │                         │
              SIGNED OUT               SIGNED IN
                 │                         │
                 ▼                         ▼
           Google Login              Load User Profile
                 │                         │
                 │                    Check isBanned
                 │                         │
                 │                  ┌──────┴──────┐
                 │                  │             │
                 │                Banned        Active
                 │                  │             │
                 │                  ▼             ▼
                 │             BannedPage     Resolve Role
                 │                                │
                 ▼                                ▼
          Create / Load User              Returning Welcome
                 │                                │
                 ▼                                ▼
          Default Role = Viewer             Main Website
                 │
                 ▼
          Hindi Welcome
                 │
                 ▼
         English Welcome
                 │
                 ▼
        Identity / Welcome
                 │
                 ▼
       Explore Our Memories
                 │
                 ▼
            Main Website
```

---

# PHASE 29 — Final Role Architecture

```text
                    MAIN WEBSITE
                         │
            ┌────────────┼────────────┐
            │            │            │
          VIEWER       MEMBER       ADMIN
            │            │            │
            ▼            ▼            ▼
        3D Sphere    3D Sphere    3D Sphere
                       │            │
                       ▼            ▼
                  Member Feed    Member Feed
                                    │
                                    ▼
                               Admin Panel
                                    │
                      ┌─────────────┼─────────────┐
                      ▼             ▼             ▼
                  Buildings      Members       Payments
                      │
                      ▼
                 Chanda Seasons
```

---

# PHASE 30 — Definition of Done

- [ ] Unauthenticated user is taken directly to Google Login.
- [ ] Old opening splash is removed from the login path.
- [ ] Long description splash is removed from the login path.
- [ ] Old security/private splash is removed from the login path.
- [ ] Secret passcode system is completely removed.
- [ ] Passcode attempt system is removed.
- [ ] Passcode-based banning is removed.
- [ ] Existing `isBanned` moderation remains functional.
- [ ] Google authentication remains functional.
- [ ] New Google users default to Viewer.
- [ ] New-user Hindi welcome remains.
- [ ] New-user English welcome remains.
- [ ] New-user identity transition remains.
- [ ] Explore Our Memories remains for new users.
- [ ] Returning users only see the short English welcome.
- [ ] Returning users reach the main site without unnecessary delays.
- [ ] Firebase Auth, not localStorage, determines authentication.
- [ ] Viewer can see the 3D/public-memory experience.
- [ ] Viewer cannot access Member Feed.
- [ ] Member can see 3D + Member Feed.
- [ ] Admin can access all authorized features.
- [ ] Viewer cannot gain Admin access through client-side state.
- [ ] Firestore rules enforce role permissions.
- [ ] Upload permissions are role-aware.
- [ ] Gallery privacy remains enforced.
- [ ] Banned users still reach BannedPage.
- [ ] Mobile UX works.
- [ ] Reduced-motion behavior works.
- [ ] No unnecessary forced 4–6 second waits remain.
- [ ] TypeScript/build checks pass.
- [ ] Existing member/admin roles are preserved.
- [ ] Payment/contribution functionality is not broken.

---

# PHASE 31 — Exact Developer Implementation Order

Do NOT implement everything in one large change.

```text
PHASE 1
Auth boot + Login-first routing
        ↓
TEST

PHASE 2
Remove passcode completely
        ↓
TEST

PHASE 3
New-user Hindi → English → Identity flow
        ↓
TEST

PHASE 4
Returning-user English → Main Site flow
        ↓
TEST

PHASE 5
Viewer / Member / Admin permissions
        ↓
TEST

PHASE 6
3D Viewer + Member Feed visibility
        ↓
TEST

PHASE 7
Firestore authorization/security
        ↓
TEST

PHASE 8
Loading/performance improvements
        ↓
TEST

PHASE 9
Mobile/accessibility polish
        ↓
TEST

PHASE 10
Full regression + production build
```

---

# 32. Product Principle

The website should feel like:

> **"I opened the Siyaram Mitra Mandal website and I can get where I want to go immediately."**

Not:

```text
Wait for splash
→ read message
→ wait
→ read another message
→ login
→ enter password
→ wait
→ watch welcome
→ wait
→ watch another welcome
→ click
→ finally enter website
```

The animations and welcome screens should preserve the emotion and cultural identity of the Mandal while removing unnecessary friction.

**Animation should feel like premium branding, not a gate that users have to survive before using the website.**
