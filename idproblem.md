CRITICAL DATA INTEGRATION BUG

Problem:
Bot generates tibId correctly.
Reception UI shows "-" instead of tibId.

Root cause:
Appointments are not linked to users.

Fix:

1. In bot booking logic:
- Always find or create user by phone or telegramId
- Use user.id when creating appointment

2. Ensure:
appointments.userId is NEVER null

3. Fix reception query:
JOIN users ON appointments.userId = users.id

4. Add fallback (temporary):
If userId is null → match by phone

5. Validate:
- New booking → tibId must appear in reception UI
- Existing users unaffected

DO NOT change UI
ONLY FIX DATA LINKING