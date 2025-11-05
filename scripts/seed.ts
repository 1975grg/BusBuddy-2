import { db } from "../server/db";
import { organizations, users, routes, inviteTokens, userRouteAssignments } from "../shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    // Create system admin
    const systemAdminEmail = "1975grg@gmail.com";
    const existingSystemAdmin = await db.query.users.findFirst({
      where: eq(users.email, systemAdminEmail),
    });

    let systemAdmin;
    if (!existingSystemAdmin) {
      [systemAdmin] = await db.insert(users).values({
        email: systemAdminEmail,
        name: "System Administrator",
        role: "system_admin",
      }).returning();
      console.log("✅ Created system admin:", systemAdminEmail);
    } else {
      systemAdmin = existingSystemAdmin;
      console.log("ℹ️  System admin already exists:", systemAdminEmail);
    }

    // Create test organization
    const existingOrg = await db.query.organizations.findFirst({
      where: eq(organizations.name, "University High School"),
    });

    let org;
    if (!existingOrg) {
      [org] = await db.insert(organizations).values({
        name: "University High School",
        type: "school",
        description: "Test school organization for bus tracking",
      }).returning();
      console.log("✅ Created organization:", org.name);
    } else {
      org = existingOrg;
      console.log("ℹ️  Organization already exists:", org.name);
    }

    // Create org admin
    const orgAdminEmail = "admin@universityhs.edu";
    const existingOrgAdmin = await db.query.users.findFirst({
      where: eq(users.email, orgAdminEmail),
    });

    let orgAdmin;
    if (!existingOrgAdmin) {
      [orgAdmin] = await db.insert(users).values({
        email: orgAdminEmail,
        name: "Sarah Johnson",
        role: "org_admin",
        organizationId: org.id,
      }).returning();
      console.log("✅ Created org admin:", orgAdminEmail);
    } else {
      orgAdmin = existingOrgAdmin;
      console.log("ℹ️  Org admin already exists:", orgAdminEmail);
    }

    // Create test routes
    const route1Data = {
      name: "Route 101 - North Campus",
      type: "bus",
      organizationId: org.id,
      vehicleNumber: "BUS-101",
    };

    const route2Data = {
      name: "Route 202 - South Campus",
      type: "bus",
      organizationId: org.id,
      vehicleNumber: "BUS-202",
    };

    const existingRoute1 = await db.query.routes.findFirst({
      where: eq(routes.name, route1Data.name),
    });

    let route1;
    if (!existingRoute1) {
      [route1] = await db.insert(routes).values(route1Data).returning();
      console.log("✅ Created route:", route1.name);
    } else {
      route1 = existingRoute1;
      console.log("ℹ️  Route already exists:", route1.name);
    }

    const existingRoute2 = await db.query.routes.findFirst({
      where: eq(routes.name, route2Data.name),
    });

    let route2;
    if (!existingRoute2) {
      [route2] = await db.insert(routes).values(route2Data).returning();
      console.log("✅ Created route:", route2.name);
    } else {
      route2 = existingRoute2;
      console.log("ℹ️  Route already exists:", route2.name);
    }

    // Create test driver
    const driverEmail = "driver@universityhs.edu";
    const existingDriver = await db.query.users.findFirst({
      where: eq(users.email, driverEmail),
    });

    let driver;
    if (!existingDriver) {
      [driver] = await db.insert(users).values({
        email: driverEmail,
        phoneNumber: "+15551234567",
        name: "Mike Thompson",
        role: "driver",
        organizationId: org.id,
      }).returning();
      console.log("✅ Created driver:", driverEmail);

      // Assign driver to route 1
      await db.insert(userRouteAssignments).values({
        userId: driver.id,
        routeId: route1.id,
        assignedByUserId: orgAdmin.id,
        isDefault: true,
      });
      console.log("✅ Assigned driver to:", route1.name);
    } else {
      driver = existingDriver;
      console.log("ℹ️  Driver already exists:", driverEmail);
    }

    // Create test rider (parent with multiple routes)
    const riderEmail = "parent@email.com";
    const existingRider = await db.query.users.findFirst({
      where: eq(users.email, riderEmail),
    });

    let rider;
    if (!existingRider) {
      [rider] = await db.insert(users).values({
        email: riderEmail,
        phoneNumber: "+15559876543",
        name: "Jennifer Martinez",
        role: "rider",
        organizationId: org.id,
        defaultRouteId: route1.id,
      }).returning();
      console.log("✅ Created rider:", riderEmail);

      // Assign rider to both routes (multi-route scenario)
      await db.insert(userRouteAssignments).values([
        {
          userId: rider.id,
          routeId: route1.id,
          assignedByUserId: orgAdmin.id,
          isDefault: true,
        },
        {
          userId: rider.id,
          routeId: route2.id,
          assignedByUserId: orgAdmin.id,
          isDefault: false,
        },
      ]);
      console.log("✅ Assigned rider to both routes (multi-route user)");
    } else {
      rider = existingRider;
      console.log("ℹ️  Rider already exists:", riderEmail);
    }

    console.log("\n🎉 Seed completed successfully!");
    console.log("\n📧 Test Accounts Created:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("System Admin: ", systemAdminEmail);
    console.log("Org Admin:    ", orgAdminEmail);
    console.log("Driver:       ", driverEmail);
    console.log("Rider:        ", riderEmail);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n💡 To login:");
    console.log("1. Go to /login");
    console.log("2. Enter one of the emails above");
    console.log("3. Check the toast notification for the magic link");
    console.log("4. Click the link to login");
    console.log("\n📝 Note: Magic links are shown in toast notifications in development mode");

  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }

  process.exit(0);
}

seed();
