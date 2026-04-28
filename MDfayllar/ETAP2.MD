Continue improving the same project.

SECOND TASK: Refactor backend API to production level.

Requirements:

1. API endpoints:

- GET /services?clinic_id=
- POST /book
- GET /appointments
- POST /arrived
- Admin CRUD endpoints

2. Ensure:

- Input validation
- Error handling
- Clean controller/service structure
- No duplicated logic

3. Booking logic must:

- Handle doctor_queue separately
- Handle diagnostic separately
- Handle home_service separately

4. Prevent:

- Overbooking
- Wrong service type usage

5. Add:

- Logging (console or basic logger)
- Consistent API responses

OUTPUT:

- Clean API structure
- Updated controllers/services
- Example requests/responses