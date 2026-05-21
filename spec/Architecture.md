# Skolo Backend — Architecture

**Version:** 2.0.0 | **Status:** Active

---

## Folder Map

```
src/
├── modules/                         ← all feature code lives here
│   │
│   ├── auth/                        ← flat module (single concern)
│   │
│   ├── users/                       ← parent module (multiple user roles)
│   │   ├── parent/
│   │   ├── driver/
│   │   ├── student/
│   │   └── school_driver/
│   │
│   ├── trips/                       ← parent module (trip lifecycle entities)
│   │   ├── trip/
│   │   ├── trip_student/
│   │   ├── driver_student_assignment/
│   │   ├── school_assignment/
│   │   └── daily_qr_otp/
│   │
│   ├── billing/                     ← parent module (payment flow entities)
│   │   ├── subscription_plan/
│   │   ├── parent_subscription/
│   │   ├── payment/
│   │   ├── razorpay/
│   │   └── redemption/
│   │
│   ├── admin/                       ← parent module (admin-only features)
│   │   ├── admin_management/
│   │   ├── role/
│   │   └── audit_log/
│   │
│   ├── school/                      ← flat module
│   ├── notification/                ← flat module
│   ├── notification_preferences/    ← flat module
│   ├── reviews/                     ← flat module
│   ├── tracking/                    ← flat module
│   ├── support_tickets/             ← flat module
│   ├── device_token/                ← flat module
│   ├── file-upload/                 ← flat module
│   └── googlemaps/                  ← flat module (external integration)
│
├── shared/                          ← cross-cutting code only, no feature logic
│   ├── config/                      ← env · database · redis · swagger
│   ├── constants/                   ← enums · messages · httpStatus · collections
│   ├── database/                    ← base repository class
│   ├── middlewares/                 ← auth · error · validate · rateLimit · asyncHandler
│   ├── services/                    ← token.service · redis.service
│   ├── types/                       ← global TS declarations
│   └── utils/                       ← apiError · apiResponse · logger · helpers
│
├── routes/
│   ├── index.ts                     ← aggregates all gateway routes
│   ├── admin/                       ← auth, users, schools, school-drivers, school-assignments,
│   │                                   students, assignments, trips, payments, subscriptions,
│   │                                   subscription-plans, school-subscriptions, tracking,
│   │                                   googlemaps, audit-logs, support-tickets
│   ├── driver/                      ← profile, availability, address, documents, onboarding,
│   │                                   trips, trip-students, assignments, qr-otp, tracking, googlemaps
│   ├── parent/                      ← profile, trips, students, assignments, qr-otp,
│   │                                   payments, subscriptions, redemptions, reviews
│   ├── shared/                      ← notifications, device-tokens, tracking, googlemaps,
│   │                                   schools, support-tickets, upload
│   ├── auth/                        ← register, login
│   ├── public/                      ← subscription-plans, razorpay, reviews, redemptions
│   ├── superadmin/                  ← admins, roles, audit-logs
│   └── school-admin/                ← school, drivers
├── app.ts
└── server.ts
```

---

## Per-Module File Structure

Every module (flat or submodule) follows the same 5-file pattern:

```
[module]/
├── [module].controller.ts   ← HTTP handling + business logic
├── [module].repository.ts   ← DB queries / CRUD only
├── [module].routes.ts       ← route definitions + middleware wiring
├── [module].types.ts        ← TypeScript interfaces for this domain
├── [module].validation.ts   ← request validation schemas
└── index.ts                 ← barrel export
```

---

## Module Placement Rules

```
New entity/feature?
│
├─ Belongs exclusively to an existing domain?
│   ├─ YES → submodule inside that parent module
│   └─ NO  → its own module
│               ├─ Multiple sub-entities under it? → parent module
│               └─ Single entity?                  → flat module
│
└─ Used by 2+ modules, no domain logic? → shared/
```

### SUBMODULE (inside an existing parent) when:
- Sub-concern of one specific domain
- Cannot exist without the parent (e.g. `trip_student` only makes sense inside `trips`)
- Routes naturally sit under the parent prefix (e.g. `/trips/assignments`)

### PARENT MODULE (with submodules) when all 3 are true:
- Entities share a domain name
- Each has its own separate MongoDB collection
- Each has its own independent route prefix + CRUD set

### FLAT MODULE when:
- Single entity, single concern
- Stands alone — other domains reference it but don't own it (e.g. `school`)

### `shared/` when:
- Used by 2+ different modules
- No domain-specific business logic
