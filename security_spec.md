# Security Specification — রক্তদেই (Rokto Dei)

## 1. Data Invariants

1. **Single Identity Canonical Source (`users/{uid}`)**: Every user profile is keyed strictly by `request.auth.uid`. Users can never inject `role`, `isAdmin`, or spoof another user's `uid`. Only verified emails (`request.auth.token.email_verified == true`) can write documents.
2. **PII Split-Collection Isolation (`donorPrivate/{uid}` & `bloodRequestPrivate/{requestId}`)**: Phone numbers never exist in `donors/{uid}` or `bloodRequests/{requestId}` search/list payloads. `donorPrivate` and `bloodRequestPrivate` strictly forbid `list` (`allow list: if false;`).
3. **Authorized Contact Disclosure Gate & Booked Request Call-Lock**:
   - A non-owner verified active user can `get` `donorPrivate/{donorUid}` ONLY if caller is active, target `donors/{donorUid}` has `isListed == true`, `accountStatus == 'active'`, `hasConsented == true`, `contactMethods.size() > 0`, and `contactAccessLogs/{callerUid}_{donorUid}` exists.
   - A non-owner verified active user can `get` `bloodRequestPrivate/{requestId}` ONLY when `bloodRequests/{requestId}.status == 'open'`. As soon as a request transitions to `'booked'` (`ডোনার চূড়ান্ত / বুকড`), Firestore Security Rules automatically lock `bloodRequestPrivate/{requestId}` so no additional callers can fetch the phone number or disturb the patient's family.
4. **Atomic Donor Listing Invariant (`existsAfter`)**: A donor cannot set `donors/{uid}.isListed == true` unless `hasConsented == true`, `contactMethods.size() >= 1`, and `existsAfter(/databases/$(database)/documents/donorPrivate/$(uid))` evaluates to `true`.
5. **Donation History Ownership (`donationRecords/{recordId}`)**: Only active verified owners (`donorUid == request.auth.uid`) can create/edit/delete their own donation records (bounded `volumeMl` 150–1500, `units` 1–4); `list` enforces `donorUid == request.auth.uid` for ordinary users and full visibility for bootstrapped super-admin.
6. **Request Pledge Integrity (`requestPledges/{pledgeId}`)**: Deterministic ID `requestId + '_' + donorUid` prevents duplicate pledge spam; `create` verifies `bloodRequests/{requestId}` exists, is `'open'`, and `requestCreatorUid == bloodRequests/{requestId}.createdBy` while forbidding self-pledging (`donorUid != requestCreatorUid`).
7. **Bangladesh E.164 Phone Format Enforcement**: Every stored phone number must strictly match `^\+8801[3-9][0-9]{8}$` (14 characters).
8. **Terminal State Locking**: Closed blood requests (`fulfilled`, `cancelled`, `expired`, `removed`) cannot be reopened or mutated by ordinary users (while `'booked'` requests can be marked `'fulfilled'`, `'cancelled'`, or reopened to `'open'` by the owner if the donor falls through).
9. **Immutable Audit & Contact Access Logs**: `auditLogs` and `contactAccessLogs` forbid `delete`; `auditLogs` also forbids `update`. All timestamps must match `request.time`.
10. **Zero-Trust RBAC**: Admin status is derived strictly from verified bootstrapped admin email (`info.redesignshield@gmail.com` with `email_verified == true`) or `exists(/databases/$(database)/documents/adminRoles/$(request.auth.uid))`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 01 — Shadow Admin Escalation (`users/{uid}`)**:
   `{ "uid": "u1", "fullName": "Attacker", "email": "a@b.com", "accountStatus": "active", "preferredLanguage": "bn", "isAdmin": true, "createdAt": "SERVER_TS", "updatedAt": "SERVER_TS" }`
   - *Defense*: Rejected by `data.keys().hasOnly(...)` in `isValidUserProfile`.
2. **Payload 02 — Unverified Email Spoof of Super Admin**:
   Auth token `{ email: "info.redesignshield@gmail.com", email_verified: false }` attempting `adminRoles` write.
   - *Defense*: Rejected by `request.auth.token.email_verified == true` in `isVerifiedEmail()` / `isBootstrappedAdmin()`.
3. **Payload 03 — Direct Scrape of `donorPrivate` Collection (`list`)**:
   Authenticated verified user running `getDocs(collection(db, 'donorPrivate'))`.
   - *Defense*: Rejected unconditionally (`allow list: if false;`).
4. **Payload 04 — Reading Phone of a `booked` Blood Request (Call-Lock Bypass)**:
   Non-owner verified user calling `getDoc(doc(db, 'bloodRequestPrivate', 'reqBooked'))` after `bloodRequests/reqBooked.status` became `'booked'`.
   - *Defense*: Rejected by `isBloodRequestContactable(requestId)` which strictly enforces `status == 'open'`.
5. **Payload 05 — Disabled Contact Method Bypass (`TC-014`)**:
   Donor only enabled `['whatsapp']`, caller attempts to create `contactAccessLogs/{callerUid}_{donorUid}` with `requestedMethod: 'call'`.
   - *Defense*: Rejected by `isDonorMethodEnabled(donorUid, requestedMethod)`.
6. **Payload 06 — Listing Donor Without Consent or Phone**:
   Donor creates `donors/{uid}` with `isListed: true, hasConsented: false` or without `donorPrivate/{uid}`.
   - *Defense*: Rejected by `(!data.isListed || (data.hasConsented == true && data.contactMethods.size() >= 1))` and `existsAfter(.../donorPrivate/$(uid))`.
7. **Payload 07 — Invalid Phone Format Injection**:
   Writing `phoneNumber: "01712345"` or a 50KB string to `donorPrivate/{uid}`.
   - *Defense*: Rejected by `data.phoneNumber.size() == 14 && data.phoneNumber.matches('^\\+8801[3-9][0-9]{8}$')`.
8. **Payload 08 — Forged Donation Record for Another User / Out-of-Bounds Volume**:
   Writing `donationRecords/rec1` with `donorUid: 'victimUid'` or `volumeMl: 999999`.
   - *Defense*: Rejected by `incoming().donorUid == request.auth.uid` and `volumeMl >= 150 && volumeMl <= 1500`.
9. **Payload 09 — Self-Unsuspension Attack**:
   Suspended user (`existing().accountStatus == 'suspended'`) attempting to update `users/{uid}` back to `'active'`.
   - *Defense*: Rejected because owner update requires `existing().accountStatus == 'active'`.
10. **Payload 10 — Reopening Fulfilled Blood Request (Terminal State Bypass)**:
    Owner attempting to update `bloodRequests/{id}` when `existing().status == 'fulfilled'`.
    - *Defense*: Rejected by terminal state lock `existing().status in ['open', 'booked']`.
11. **Payload 11 — Spoofed `requestCreatorUid` on `requestPledges`**:
    Attacker creating `requestPledges/{reqId}_{uid}` with `requestCreatorUid` set to a third party or when request is already `'booked'`.
    - *Defense*: Rejected by `get(.../bloodRequests/$(incoming().requestId)).data.status == 'open'` and `get(...).data.createdBy == incoming().requestCreatorUid`.
12. **Payload 12 — Unfiltered Donor List Scrape (Unlisted/Suspended Exposure)**:
    Verified user running `getDocs(collection(db, 'donors'))` without `where('isListed', '==', true)` and `where('accountStatus', '==', 'active')`.
    - *Defense*: Rejected by Pillar 8 Query Enforcer `existing().isListed == true && existing().accountStatus == 'active'` inside `allow list`.

---

## 3. Red Team Audit Summary

- **Shadow Update Test**: PASS — Every collection (all 11 collections) enforces `hasAll` + `hasOnly` in `isValid[Entity]` and `affectedKeys().hasOnly(...)` on every update branch.
- **Email Spoofing Test**: PASS — `isBootstrappedAdmin()` explicitly requires `request.auth.token.email_verified == true`.
- **PII Blanket Test & Booked Call-Lock Test**: PASS — `users/{uid}` is strictly owner/admin; `donorPrivate/{uid}` and `bloodRequestPrivate/{requestId}` deny `list` unconditionally, and `bloodRequestPrivate` blocks `get` immediately once `status` changes from `'open'` to `'booked'`.
- **Query Trust Test**: PASS — Zero `get()`/`exists()` inside `allow list` across all 11 collections; all `allow list` rules restrict `resource.data` directly.
- **Value Poisoning Test**: PASS — Every `allow update` wraps all branches inside `isValid[Entity](incoming())`.
