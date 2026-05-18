TASK: FIX WEBAPP DASHBOARD NOT SHOWING

STOP changing bot buttons.

Problem is NOT in bot.

---

STEP 1 — VERIFY TELEGRAM CONTEXT

Log:

window.Telegram.WebApp.initDataUnsafe

IF empty → fix WebApp initialization

---

STEP 2 — VERIFY USER FETCH

Log:

telegramId
user
user.phone

Ensure:

- telegramId exists
- user is found in DB
- phone exists

---

STEP 3 — FORCE DASHBOARD TEST

Temporarily:

always showDashboard()

If works → condition is wrong

---

STEP 4 — FIX CONDITION

Correct logic:

if (user && user.phone) {
showDashboard()
} else {
showBooking()
}

NO OTHER CONDITIONS

---

STEP 5 — REMOVE URL DEPENDENCY

DO NOT use:

tgid from URL

USE ONLY:

Telegram WebApp initData

---

STEP 6 — VALIDATION

- Open from bot → dashboard must show
- No fallback to booking

---

OUTPUT

Return:

- logs
- fixed condition
- user fetch fix

NO EXCUSES