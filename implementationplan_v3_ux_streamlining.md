# Implementation Plan 3: UX Streamlining, Passcode Removal & Clean Onboarding Flow

## Overview
Currently, the website has excessive loading screens, duplicate intros, long typing animations, and a secret passcode barrier that makes onboarding slow and frustrates visitors. 

This plan addresses all UX issues by:
1. **Removing the secret passcode system completely** so anyone (from other mandals, visitors, devotees) can sign in and explore photos and videos.
2. **Streamlining the new user flow**: Unauthenticated users directly see the Google Sign-in screen. After signing in, they experience the Hindi & English welcome sequence (Screens 6, 7, 8) and enter the portal.
3. **Fast-tracking returning users**: Already logged-in users bypass long intros and only see a brief, elegant English welcome transition (Screen 7) before entering the main portal.
4. **Role-Based Experience**:
   - `Viewer` (Default for all new logins): Views 3D Vault, Gallery, and Public features (Members Feed is hidden).
   - `Member`: Views both 3D Vault and Members Feed (toggle enabled).
   - `Admin`: Full God Mode access (Admin Panel, Chanda Seasons & Finance, Vault Management, Member Manager).

---

## Phases Overview

### Phase 1: Passcode Decommission & Clean Auth Handling
- Remove passcode verification, attempt counters, and ban-on-failed-attempts in `src/components/Welcome.tsx`.
- Remove `secretPasscode` management controls from `src/components/AdminPanel.tsx`.
- Remove `mandal_pass_auth_*` localStorage checks in `src/app/page.tsx`.

### Phase 2: Refined Welcome & Onboarding Flows
- **For Guests (Not Logged In)**:
  - Land directly on Google Sign-in (Screen 4).
  - On Google Sign-in:
    - Save user in Firestore (default `role: 'Viewer'`).
    - Screen 6: Hindi Welcome ("सियाराम मित्र मंडल में आपका स्वागत है").
    - Screen 7: English Welcome ("Welcome to Siyaram Mitra Mandal").
    - Screen 8: Permission Granted card with user photo, name, and "Explore Our Memories" button.
    - Click "Explore Our Memories" -> Enters portal.

### Phase 3: Fast-Track Return Flow in Main Page
- **For Returning Users (Already Logged In)**:
  - Detect active session -> Show only Screen 7 (English Welcome splash) as a quick transition -> Enters main page directly.

### Phase 4: Role-Based Content & Feed Visibility
- **Viewer**: Lands on 3D Vault (`ViewerDashboard`). Members Feed toggle is hidden.
- **Member**: Has toggle between 3D Vault and Members Feed (`Dashboard.tsx`).
- **Admin**: Full God Mode access across all tabs.
