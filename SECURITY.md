# Bus Buddy Security Overview

*Last Updated: November 2025*

This document outlines the security measures implemented in Bus Buddy to protect student data, ensure privacy, and maintain trust with schools, parents, and transportation staff.

---

## Table of Contents

1. [Authentication & Login Security](#1-authentication--login-security)
2. [Organization Data Isolation](#2-organization-data-isolation)
3. [Role-Based Access Control](#3-role-based-access-control)
4. [SMS Privacy & TCPA Compliance](#4-sms-privacy--tcpa-compliance)
5. [Password Management & Annual Resets](#5-password-management--annual-resets)
6. [Data Protection](#6-data-protection)
7. [Infrastructure Security (Replit)](#7-infrastructure-security-replit)

---

## 1. Authentication & Login Security

### What This Means (Plain Language)
When someone logs into Bus Buddy, we verify their identity and give them a secure "pass" that proves who they are. This pass expires after a set time, and we store it in a way that hackers can't easily steal.

### Technical Details

| Feature | Implementation | Why It Matters |
|---------|---------------|----------------|
| **Password Hashing** | bcrypt with salt rounds | Passwords are never stored in readable form. Even if someone accessed our database, they couldn't read passwords. |
| **Web Sessions** | HttpOnly cookies (90-day expiry) | Cookies marked "HttpOnly" can't be read by JavaScript, protecting against XSS (cross-site scripting) attacks. |
| **Mobile App Tokens** | Bearer tokens in Capacitor Preferences | Native iOS/Android apps use secure device storage, not browser localStorage (which is vulnerable to attacks). |
| **Session Refresh** | Automatic token refresh | Users don't get logged out unexpectedly; sessions extend seamlessly while remaining secure. |
| **Platform Detection** | Automatic via `Capacitor.isNativePlatform()` | The app automatically uses the right security method for web vs. mobile. |

### What "HttpOnly Cookie" Means
Imagine your login "badge" is kept in a locked drawer that only the security guard (the browser) can open. Even if a malicious script runs on the page, it can't reach into that drawer to steal your badge.

---

## 2. Organization Data Isolation

### What This Means (Plain Language)
Each school or organization using Bus Buddy has completely separate data. School A cannot see School B's routes, students, or messages—period. It's like each school has their own filing cabinet with their own lock.

### Technical Details

| Feature | Implementation | Why It Matters |
|---------|---------------|----------------|
| **Multi-Tenant Architecture** | Every database query filtered by `organizationId` | Data isolation is enforced at the database level, not just the UI. |
| **Query Scoping** | All API endpoints validate organization membership | Even if someone tried to guess another organization's data IDs, the system would reject the request. |
| **User Binding** | Users are permanently linked to one organization | A user from Westwood Academy cannot switch to or view University High School data. |

### How We Verified This
We tested with two organizations (University High School and Westwood Academy) with unique test data:
- UHS has stops: "100 Canyon Drive", "200 Canyon Drive"
- Westwood has: "50 Main Street (WA Only)"

When logged in as a UHS admin, you cannot see Westwood's stops—and vice versa. This has been verified in both the admin interface and at the database query level.

### What "Multi-Tenant" Means
Think of an apartment building where each tenant has their own unit. They share the building's infrastructure (plumbing, electricity), but each unit is private. One tenant can't walk into another's apartment. Bus Buddy works the same way—schools share the platform but their data is completely private.

---

## 3. Role-Based Access Control

### What This Means (Plain Language)
Different people have different jobs, so they see different things. A parent doesn't need to start bus trips. A driver doesn't need to manage user accounts. Everyone gets exactly the access they need—nothing more, nothing less.

### The Three Roles

| Role | What They Can Do | What They Can't Do |
|------|------------------|-------------------|
| **Rider** (Parent/Student) | Track their assigned bus, receive notifications, message admins | See other routes, start trips, manage users |
| **Driver** | Start/stop trips, share GPS location, message admins, see assigned route | See other routes, manage users, access other drivers' data |
| **Admin** | Manage routes, stops, users, view all messages, send alerts | Access other organizations' data |

### Technical Implementation
- **Route Assignments**: Riders and drivers are assigned to specific routes. They can only see data for their assigned routes.
- **API Validation**: Every API request checks the user's role before returning data or allowing actions.
- **UI Enforcement**: The interface only shows options appropriate for each role.

### What "Least Privilege" Means
This is a security principle that says: give people only the minimum access they need to do their job. A parent tracking their child's bus doesn't need admin powers. By limiting access, we reduce the risk of accidents or misuse.

---

## 4. SMS Privacy & TCPA Compliance

### What This Means (Plain Language)
We take phone notifications seriously. We never text someone without their permission, and we make it easy to stop receiving texts at any time. This follows U.S. laws about text messaging (TCPA).

### Technical Details

| Feature | Implementation | Why It Matters |
|---------|---------------|----------------|
| **Opt-In Required** | Explicit consent captured before first SMS | We never text anyone who hasn't agreed to receive messages. |
| **Opt-Out Keywords** | STOP, UNSUBSCRIBE, CANCEL, END, QUIT | Standard keywords work instantly to stop messages. |
| **Consent Tracking** | Database records with timestamps | We have proof of when someone agreed to receive texts. |
| **Welcome Message** | Sent after opt-in with opt-out instructions | Users know immediately how to unsubscribe. |

### What "TCPA" Means
The Telephone Consumer Protection Act is a U.S. law that protects people from unwanted calls and texts. It requires businesses to get permission before texting and to honor opt-out requests immediately. Violating TCPA can result in significant fines, so we take it very seriously.

---

## 5. Password Management & Annual Resets

### What This Means (Plain Language)
At the end of each school year (July 1st), all parent/student passwords automatically expire. This ensures that families who leave the school lose access, and returning families must re-verify. Staff passwords don't expire unless manually revoked.

### Technical Details

| Feature | Implementation | Why It Matters |
|---------|---------------|----------------|
| **Rider Password Expiration** | Automatic expiry on July 1st annually | Ensures clean slate each school year; departed families lose access automatically. |
| **Admin/Driver Passwords** | Never expire (unless manually revoked) | Staff accounts remain stable; reduces friction for authorized personnel. |
| **Bulk Renewal** | Admins can renew all rider passwords in one click | Easy to re-enable access for returning families. |
| **Login Enforcement** | Expired users redirected to "Request Access" flow | Clear messaging explains why access is blocked and how to regain it. |

### Why Annual Expiration Matters for Schools
- **Automatic cleanup**: Families who leave don't retain access
- **Re-verification**: Returning families must actively re-engage
- **Audit trail**: Clean records of who has access each year
- **FERPA alignment**: Helps maintain appropriate access controls for student data

### What "Password Expiration" Means
Like a parking permit that expires at the end of the school year, passwords stop working after a set date. This is a safety measure—it ensures that only current, active families can track buses.

---

## 6. Data Protection

### What This Means (Plain Language)
We protect your data while it's being sent (in transit) and while it's stored (at rest). We don't expose sensitive information in error messages, and we validate all data before processing it.

### Technical Details

| Feature | Implementation | Why It Matters |
|---------|---------------|----------------|
| **HTTPS/TLS** | All connections encrypted | Data can't be intercepted between your device and our servers. |
| **Database Encryption** | PostgreSQL on Neon (encrypted at rest) | Stored data is protected even if physical storage is compromised. |
| **Input Validation** | Zod schemas validate all API requests | Prevents injection attacks and malformed data. |
| **Error Handling** | Generic error messages to users | Detailed errors are logged internally but not exposed to potential attackers. |

### What "Encryption" Means
Encryption scrambles data so only authorized parties can read it. Imagine writing a letter in a secret code that only you and the recipient know. Even if someone intercepts the letter, they can't understand it.

- **In Transit**: Data is encrypted while traveling between your phone/computer and our servers.
- **At Rest**: Data is encrypted while stored in our database.

---

## 7. Infrastructure Security (Replit)

### What This Means (Plain Language)
Bus Buddy is hosted on Replit, a professional development and hosting platform. Questions about physical data centers, compliance certifications (like SOC 2), and infrastructure-level security should be directed to Replit.

### Questions to Ask Replit

For your pilot customer's due diligence, here are the key questions to ask Replit directly:

**Compliance & Certifications**
- Do you have SOC 2 Type II certification?
- Do you have ISO 27001 certification?
- Can you provide a security whitepaper?

**Data Hosting & Protection**
- Which cloud provider and regions host the data?
- Is all data encrypted at rest and in transit?
- How are backups handled and retained?

**Privacy & Education Compliance**
- Can you provide a Data Processing Agreement (DPA)?
- What guidance do you have for FERPA/COPPA compliance?
- Who are your sub-processors?

**Incident Response**
- What is your incident notification process?
- Do you offer uptime SLAs for production deployments?

### How to Contact Replit
- **Sales/Enterprise**: Contact through replit.com for enterprise agreements
- **Documentation**: Replit publishes security documentation for business customers

---

## Summary: Security at a Glance

| Category | Protection Level | Key Feature |
|----------|-----------------|-------------|
| **Login Security** | Strong | HttpOnly cookies, bcrypt hashing, 90-day sessions |
| **Data Isolation** | Complete | Every query scoped by organization |
| **Access Control** | Role-Based | Admin, Driver, Rider with specific permissions |
| **SMS Privacy** | TCPA Compliant | Opt-in required, instant opt-out |
| **Password Management** | Annual Reset | Rider passwords expire July 1st |
| **Data Protection** | Encrypted | HTTPS in transit, encrypted at rest |

---

## Questions?

If you have additional security questions about Bus Buddy, please contact your organization's administrator or reach out to our support team.

*This document is intended for informational purposes and reflects the security measures in place as of the date listed above.*
