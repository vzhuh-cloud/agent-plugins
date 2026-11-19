# Event registration with Worker + D1

Use for an event page, signup form or capacity-limited registration request. Copy `../assets/event-registration/` into the project. Full Russian guide: https://vzhuh.cloud/docs/event-registration.

The example is a responsive landing page “Кофе и разговоры” with 12 seats, a name/email form, consent checkbox and reference number on success. `GET /api/event` exposes only capacity and remaining seats. `POST /api/register` validates input and inserts into D1. There is no public attendee list and no outbound email.

1. Get real event title, date/time/timezone, venue, capacity, organizer contact and consent/retention text from the user. Keep demo labels if those facts are not provided; never invent a real event. Update `worker.mjs`, `index.html`, `privacy.html` consistently.
2. Run `node build.mjs`; upload only `artifact/` using the publishing skill's normal MCP workflow. It includes `.openai/hosting.json`, `dist/server/index.js`, assets and `drizzle/0000_registrations.sql`.
3. Deploy privately for review. Public registrations need explicitly authorized public visibility. Private registrations require Yandex and access to the site. The API validates Origin and JSON; it does not treat Yandex site access as email verification or provide an app user profile.
4. Verify two concurrent requests for the same email create one row, many requests cannot exceed capacity, malformed/absent consent is rejected, and `/api/registrations` is not available. Check a new code deployment retains prior registrations. Access attendee data only through the owner dashboard/MCP; never build a public list route as a shortcut.
5. Success returns a reference number to save. No email is sent; entered email is not verified. Repeated emails get a generic message without disclosing who is registered. A network error after commit can be retried without consuming another seat, but the original reference is not reissued to arbitrary claimants. Organizer handles lookup/cancellation after verifying identity.

Capacity check and INSERT are one conditional SQL statement; unique email handles duplicates. Do not implement count-then-insert as separate operations. Capacity is in the Worker constant; avoid lowering it below already accepted registrations. Email lowercasing is a deliberate simple matching rule, not proof of identity. The honeypot and Origin check are not bot protection or rate limiting; before opening a high-traffic public campaign, add server-side abuse limits and verification appropriate to it. No payments, waiting list, cancellation tokens, email delivery or verified identity is claimed by this template.

Persist only the needed fields. The included privacy page is explicitly an unfinished demo, not ready legal language. Replace it and decide a deletion date before collecting actual personal data. Preview has separate D1; preview signups are not migrated into production when promoting code.

## Published reference application

`../assets/event-registration-public/` contains the exact public gallery application's source, distinct from the base template above. It uses real Worker + D1, permits cancellation by the registration reference returned after creation, and expires sample records on requests after 24 hours. It is an example of a working registration site, not an actual scheduled event. Use synthetic data when testing it. Do not replace its backend with localStorage in product-facing galleries.
