# API Reference

## Supabase Client
`getSupabaseClient()` from `@/template` — singleton Supabase client.

## Service Modules (35 files)
Each service exports functions that take `schoolId` first and return `{ data, error: string | null }`.

### Core Services
| Service | Key Functions |
|---|---|
| audit.service | logAuditEvent, isRateLimited, recordRateLimitedAction |
| auth.security.service | signInWithLockout, requestPasswordReset, enableMfa, verifyTOTP |
| registration.service | registerSchool, resolveSchoolByHostname |
| invitation.service | sendInvitation, acceptInvitation, listPendingInvitations |
| domain.service | addCustomDomain, verifyDomain, removeDomain |

### Module Services
| Service | Key Functions |
|---|---|
| ai.service | invokeAI, generateAssignment, aiGradeSubmission, studentTutorChat |
| finance.service | getInvoices, createInvoice, recordPayment, getFinancialReport |
| hr.service | getStaffRecords, generatePayrollRun, requestLeave, approveLeave |
| communication.service | getAnnouncements, sendMessage, getVisitors, checkInVisitor |
| lms.service | getAssignments, submitAssignment, gradeSubmission, submitQuizAttempt |
| library.service | getBooks, borrowBook, returnBook, getLibraryStats |
| medical.service | getMedicalRecord, createMedicalVisit, administerMedication |
| transport.service | getRoutes, getVehicles, getDrivers, getTransportStats |
| boarding.service | getDormitories, assignBed, markBoardingAttendance |
| analytics.service | getSchoolOverview, getFinanceAnalytics, getAIAnalytics |
| subscription.service | getPlans, changePlan, checkUsage |
| school_management.service | getAcademicYears, createClass, generateReportCard |
| notification.service | getNotifications, markAsRead, markAllAsRead |
| search.service | globalSearch |
| email.service | sendEmail, sendBulkEmail |
| sms.service | sendSMS, sendBulkSMS |
| push.service | sendPush, pushToStaff, pushEmergencyAlert |
| pdf.service | generateReceiptPDF, generateReportCardPDF |

## Edge Functions (10)
| Function | Endpoint | Purpose |
|---|---|---|
| ai-assistant | POST /functions/v1/ai-assistant | AI dispatch (OpenAI/Anthropic/Gemini) |
| send-notifications | POST /functions/v1/send-notifications | Email/SMS queue drainer |
| verify-domain | POST /functions/v1/verify-domain | DNS TXT verification |
| send-push-notification | POST /functions/v1/send-push-notification | Expo push |
| seed-demo | POST /functions/v1/seed-demo | Platform admin onboarding |
| stripe-checkout | POST /functions/v1/stripe-checkout | Stripe Checkout session |
| stripe-webhook | POST /functions/v1/stripe-webhook | Stripe event handler |
| mpesa-stk | POST /functions/v1/mpesa-stk | M-Pesa STK push |
| mpesa-callback | POST /functions/v1/mpesa-callback | M-Pesa callback |
