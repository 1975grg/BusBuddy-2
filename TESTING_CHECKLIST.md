# Bus Buddy Testing Checklist

This checklist helps you verify that the notification system and message isolation work correctly across multiple routes.

---

## Test Environment Setup

You have two test routes configured:

### Route 1: "Test Road 1"
- **Driver:** Mike Thompson (driver@universityhs.edu)
- **Riders:** Evan Ghorayeb, Ryan Ghorayeb

### Route 2: "Test Road 2"
- **Driver:** Sarah Davis (driver2@universityhs.edu)
- **Riders:** Alex Smith, Jordan Lee

### Admin
- **Email:** admin@universityhs.edu
- **Organization:** University High School

---

## Testing Checklist

### 1. Route Isolation Tests

**Goal:** Verify riders and drivers only see their own route data

#### Test 1.1: Rider Route Isolation
- [ ] **Login as Evan** (Test Road 1 rider)
  - Visit: `/rider`
  - **Expected:** Should only see "Test Road 1"
  - **Expected:** Should NOT see "Test Road 2" or Alex/Jordan

- [ ] **Login as Alex** (Test Road 2 rider)
  - Visit: `/rider`
  - **Expected:** Should only see "Test Road 2"
  - **Expected:** Should NOT see "Test Road 1" or Evan/Ryan

#### Test 1.2: Driver Route Isolation
- [ ] **Login as Mike Thompson** (Test Road 1 driver)
  - Visit: `/driver`
  - **Expected:** Should only see "Test Road 1"
  - **Expected:** Should only see Evan and Ryan as riders

- [ ] **Login as Sarah Davis** (Test Road 2 driver)
  - Visit: `/driver`
  - **Expected:** Should only see "Test Road 2"
  - **Expected:** Should only see Alex and Jordan as riders

---

### 2. Message Isolation Tests

**Goal:** Verify messages don't leak between routes

#### Test 2.1: Rider Messages
- [ ] **Send message from Evan** (Test Road 1 rider)
  - Go to `/rider`
  - Send a message: "This is from Evan on Route 1"
  - **Login as admin** → Go to `/admin/support`
  - **Expected:** Message shows up with "Test Road 1" label
  - **Expected:** Sidebar shows updated count for Route 1

- [ ] **Send message from Alex** (Test Road 2 rider)
  - Go to `/rider`
  - Send a message: "This is from Alex on Route 2"
  - **Login as admin** → Go to `/admin/support`
  - **Expected:** Message shows up with "Test Road 2" label
  - **Expected:** Both Route 1 and Route 2 messages visible (no cross-contamination)

#### Test 2.2: Driver Messages
- [ ] **Send message from Mike** (Test Road 1 driver)
  - Go to `/driver`
  - Send a message: "Route 1 driver message"
  - **Login as admin** → Go to `/admin/support`
  - **Expected:** Message shows under "Driver Messages" tab
  - **Expected:** Associated with "Test Road 1"

- [ ] **Send message from Sarah** (Test Road 2 driver)
  - Go to `/driver`
  - Send a message: "Route 2 driver message"
  - **Login as admin** → Go to `/admin/support`
  - **Expected:** Message shows under "Driver Messages" tab
  - **Expected:** Both driver messages visible, each labeled with correct route

---

### 3. Notification Log Tests

**Goal:** Verify notification tracking works and displays correctly

#### Test 3.1: View Notification Logs
- [ ] **Login as admin** → Go to `/admin/notifications`
  - **Expected:** Page loads with summary card
  - **Expected:** Shows total notification count
  - **Expected:** Filter options available (Route, Type, Date, Search)

#### Test 3.2: Filter by Route
- [ ] **Select "Test Road 1" from route filter**
  - **Expected:** Only notifications for Test Road 1 display
  - **Expected:** Evan and Ryan appear in results (if they received notifications)

- [ ] **Select "Test Road 2" from route filter**
  - **Expected:** Only notifications for Test Road 2 display
  - **Expected:** Alex and Jordan appear in results (if they received notifications)

#### Test 3.3: Filter by Notification Type
- [ ] **Select "Service Alert" from type filter**
  - **Expected:** Only service alert notifications display

- [ ] **Select "Route Started" from type filter**
  - **Expected:** Only route start notifications display

#### Test 3.4: Search Functionality
- [ ] **Search for "Evan"**
  - **Expected:** Only Evan's notifications appear

- [ ] **Search for specific phone number**
  - **Expected:** Only that recipient's notifications appear

- [ ] **Clear all filters**
  - **Expected:** All notifications reappear

---

### 4. Admin View Tests

**Goal:** Verify admin can see all routes but data stays isolated

#### Test 4.1: Support Center View
- [ ] **Login as admin** → Go to `/admin/support`
  - **Expected:** Sidebar shows counts for both Route 1 and Route 2
  - **Expected:** Can switch between routes in sidebar
  - **Expected:** Clicking Route 1 shows only Route 1 messages
  - **Expected:** Clicking Route 2 shows only Route 2 messages

#### Test 4.2: Routes Management
- [ ] **Login as admin** → Go to `/admin/routes`
  - **Expected:** Both "Test Road 1" and "Test Road 2" visible
  - **Expected:** Each route shows correct rider/driver counts

---

### 5. Data Leak Prevention Tests

**Goal:** Ensure no accidental data cross-contamination

#### Test 5.1: Verify Route Assignment
- [ ] **Check Route 1 riders can't see Route 2**
  - Login as Evan (Route 1)
  - **Expected:** Cannot access Route 2 data in any way

- [ ] **Check Route 2 riders can't see Route 1**
  - Login as Alex (Route 2)
  - **Expected:** Cannot access Route 1 data in any way

#### Test 5.2: Verify Message Responses
- [ ] **Admin responds to Evan's message**
  - Go to `/admin/support` → Open Evan's message
  - Send response: "Admin response to Route 1"
  - **Expected:** Response only visible to Evan
  - **Expected:** Alex (Route 2) cannot see this response

- [ ] **Admin responds to Alex's message**
  - Go to `/admin/support` → Open Alex's message
  - Send response: "Admin response to Route 2"
  - **Expected:** Response only visible to Alex
  - **Expected:** Evan (Route 1) cannot see this response

---

### 6. Push Notification Tests (iOS/Android Only)

**Goal:** Verify native push notifications work on mobile devices

#### Test 6.1: Device Registration
- [ ] **Install TestFlight app on iPhone** (follow XCODE_BUILD_GUIDE.md)
  - Open Bus Buddy app
  - **Expected:** Prompt to allow notifications
  - Tap "Allow"
  - **Expected:** Device token registered in database

- [ ] **Check database for push token**
  - Run SQL: `SELECT * FROM push_tokens WHERE user_id = '<your-user-id>';`
  - **Expected:** Token entry exists with platform = 'ios'

#### Test 6.2: Send Test Notification
- [ ] **Send service alert on Route 1**
  - Login as admin → Go to `/admin/support` → Alerts tab
  - Create alert for "Test Road 1"
  - **Expected:** Evan and Ryan receive push notification on their devices
  - **Expected:** Alex and Jordan do NOT receive this notification

---

## Sign-Off

Once all tests pass:

- [ ] **No route leaks detected** - Riders/drivers only see their assigned routes
- [ ] **No message leaks detected** - Messages stay within their route context
- [ ] **Notification logging works** - All notifications tracked and filterable
- [ ] **Admin visibility correct** - Admin can see all routes but data stays isolated
- [ ] **Push notifications work** - Native notifications delivered to correct users

---

## Troubleshooting

### Messages Not Appearing
1. **Hard refresh the page** (Ctrl+Shift+R or Cmd+Shift+R)
2. **Check browser console** for errors
3. **Verify you're logged in as correct user**

### Notifications Not Showing
1. **Check Notification Logs page** (`/admin/notifications`)
2. **Verify device token registered** (check database `push_tokens` table)
3. **Ensure notification permissions granted** (iOS Settings → Bus Buddy → Notifications)

### Route Isolation Issues
1. **Check user's route assignment** in database:
   ```sql
   SELECT u.name, u.role, r.name as route_name
   FROM users u
   LEFT JOIN user_route_assignments ura ON u.id = ura.user_id
   LEFT JOIN routes r ON ura.route_id = r.id
   WHERE ura.is_active = true;
   ```
2. **Verify organization ID matches** across users and routes

---

**Testing Complete!** Once all items are checked off, your Bus Buddy system is verified and ready for production use.
