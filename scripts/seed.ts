import { db } from "../server/db";
import { organizations, users, routes, userRouteAssignments } from "../shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Starting database seed...");
  console.log("📝 Creating clean 2-organization test environment...\n");

  try {
    // ============================================
    // SYSTEM ADMIN (Cross-organization superuser)
    // ============================================
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

    // ============================================
    // ORGANIZATION 1: University High School (UHS)
    // Location: Morgantown, WV
    // ============================================
    console.log("\n🏫 Setting up Organization 1: University High School (Morgantown, WV)...");
    
    const existingUHS = await db.query.organizations.findFirst({
      where: eq(organizations.name, "University High School"),
    });

    let uhsOrg;
    if (!existingUHS) {
      [uhsOrg] = await db.insert(organizations).values({
        name: "University High School",
        type: "school",
      }).returning();
      console.log("✅ Created organization:", uhsOrg.name);
    } else {
      uhsOrg = existingUHS;
      console.log("ℹ️  Organization already exists:", uhsOrg.name);
    }

    // UHS Admin
    const uhsAdminEmail = "admin@universityhs.edu";
    const existingUHSAdmin = await db.query.users.findFirst({
      where: eq(users.email, uhsAdminEmail),
    });

    let uhsAdmin;
    if (!existingUHSAdmin) {
      [uhsAdmin] = await db.insert(users).values({
        email: uhsAdminEmail,
        name: "Sarah Johnson",
        role: "org_admin",
        organizationId: uhsOrg.id,
      }).returning();
      console.log("  ✅ Admin: ", uhsAdminEmail);
    } else {
      uhsAdmin = existingUHSAdmin;
      console.log("  ℹ️  Admin already exists:", uhsAdminEmail);
    }

    // UHS Route
    const uhsRouteData = {
      name: "Route 101 - Morgantown Campus",
      type: "bus" as const,
      organizationId: uhsOrg.id,
      vehicleNumber: "BUS-101",
    };

    const existingUHSRoute = await db.query.routes.findFirst({
      where: eq(routes.name, uhsRouteData.name),
    });

    let uhsRoute;
    if (!existingUHSRoute) {
      [uhsRoute] = await db.insert(routes).values(uhsRouteData).returning();
      console.log("  ✅ Route:", uhsRoute.name);
    } else {
      uhsRoute = existingUHSRoute;
      console.log("  ℹ️  Route already exists:", uhsRoute.name);
    }

    // UHS Driver
    const uhsDriverEmail = "driver@universityhs.edu";
    const existingUHSDriver = await db.query.users.findFirst({
      where: eq(users.email, uhsDriverEmail),
    });

    let uhsDriver;
    if (!existingUHSDriver) {
      [uhsDriver] = await db.insert(users).values({
        email: uhsDriverEmail,
        phoneNumber: "+13045551001",
        name: "Mike Thompson",
        role: "driver",
        organizationId: uhsOrg.id,
      }).returning();
      console.log("  ✅ Driver:", uhsDriverEmail);

      // Assign driver to route
      await db.insert(userRouteAssignments).values({
        userId: uhsDriver.id,
        routeId: uhsRoute.id,
        assignedByUserId: uhsAdmin.id,
        isDefault: true,
      });
      console.log("  ✅ Assigned driver to route");
    } else {
      uhsDriver = existingUHSDriver;
      console.log("  ℹ️  Driver already exists:", uhsDriverEmail);
    }

    // UHS Student Rider 1
    const uhsStudent1Email = "student1@universityhs.edu";
    const existingUHSStudent1 = await db.query.users.findFirst({
      where: eq(users.email, uhsStudent1Email),
    });

    let uhsStudent1;
    if (!existingUHSStudent1) {
      [uhsStudent1] = await db.insert(users).values({
        email: uhsStudent1Email,
        phoneNumber: "+13045551101",
        name: "Emma Davis",
        role: "rider",
        organizationId: uhsOrg.id,
        defaultRouteId: uhsRoute.id,
      }).returning();
      console.log("  ✅ Student Rider 1:", uhsStudent1Email);

      // Assign student to route
      await db.insert(userRouteAssignments).values({
        userId: uhsStudent1.id,
        routeId: uhsRoute.id,
        assignedByUserId: uhsAdmin.id,
        isDefault: true,
      });
    } else {
      uhsStudent1 = existingUHSStudent1;
      console.log("  ℹ️  Student Rider 1 already exists:", uhsStudent1Email);
    }

    // UHS Student Rider 2
    const uhsStudent2Email = "student2@universityhs.edu";
    const existingUHSStudent2 = await db.query.users.findFirst({
      where: eq(users.email, uhsStudent2Email),
    });

    let uhsStudent2;
    if (!existingUHSStudent2) {
      [uhsStudent2] = await db.insert(users).values({
        email: uhsStudent2Email,
        phoneNumber: "+13045551102",
        name: "Liam Chen",
        role: "rider",
        organizationId: uhsOrg.id,
        defaultRouteId: uhsRoute.id,
      }).returning();
      console.log("  ✅ Student Rider 2:", uhsStudent2Email);

      // Assign student to route
      await db.insert(userRouteAssignments).values({
        userId: uhsStudent2.id,
        routeId: uhsRoute.id,
        assignedByUserId: uhsAdmin.id,
        isDefault: true,
      });
    } else {
      uhsStudent2 = existingUHSStudent2;
      console.log("  ℹ️  Student Rider 2 already exists:", uhsStudent2Email);
    }

    // ============================================
    // ORGANIZATION 2: Westwood Academy
    // Location: Westwood, MA
    // ============================================
    console.log("\n🏫 Setting up Organization 2: Westwood Academy (Westwood, MA)...");
    
    const existingWestwood = await db.query.organizations.findFirst({
      where: eq(organizations.name, "Westwood Academy"),
    });

    let westwoodOrg;
    if (!existingWestwood) {
      [westwoodOrg] = await db.insert(organizations).values({
        name: "Westwood Academy",
        type: "school",
      }).returning();
      console.log("✅ Created organization:", westwoodOrg.name);
    } else {
      westwoodOrg = existingWestwood;
      console.log("ℹ️  Organization already exists:", westwoodOrg.name);
    }

    // Westwood Admin
    const westwoodAdminEmail = "admin@westwoodacademy.org";
    const existingWestwoodAdmin = await db.query.users.findFirst({
      where: eq(users.email, westwoodAdminEmail),
    });

    let westwoodAdmin;
    if (!existingWestwoodAdmin) {
      [westwoodAdmin] = await db.insert(users).values({
        email: westwoodAdminEmail,
        name: "Jennifer Martinez",
        role: "org_admin",
        organizationId: westwoodOrg.id,
      }).returning();
      console.log("  ✅ Admin:", westwoodAdminEmail);
    } else {
      westwoodAdmin = existingWestwoodAdmin;
      console.log("  ℹ️  Admin already exists:", westwoodAdminEmail);
    }

    // Westwood Route
    const westwoodRouteData = {
      name: "Route 201 - Westwood Circle",
      type: "bus" as const,
      organizationId: westwoodOrg.id,
      vehicleNumber: "BUS-201",
    };

    const existingWestwoodRoute = await db.query.routes.findFirst({
      where: eq(routes.name, westwoodRouteData.name),
    });

    let westwoodRoute;
    if (!existingWestwoodRoute) {
      [westwoodRoute] = await db.insert(routes).values(westwoodRouteData).returning();
      console.log("  ✅ Route:", westwoodRoute.name);
    } else {
      westwoodRoute = existingWestwoodRoute;
      console.log("  ℹ️  Route already exists:", westwoodRoute.name);
    }

    // Westwood Driver
    const westwoodDriverEmail = "driver@westwoodacademy.org";
    const existingWestwoodDriver = await db.query.users.findFirst({
      where: eq(users.email, westwoodDriverEmail),
    });

    let westwoodDriver;
    if (!existingWestwoodDriver) {
      [westwoodDriver] = await db.insert(users).values({
        email: westwoodDriverEmail,
        phoneNumber: "+17815551201",
        name: "Alex Johnson",
        role: "driver",
        organizationId: westwoodOrg.id,
      }).returning();
      console.log("  ✅ Driver:", westwoodDriverEmail);

      // Assign driver to route
      await db.insert(userRouteAssignments).values({
        userId: westwoodDriver.id,
        routeId: westwoodRoute.id,
        assignedByUserId: westwoodAdmin.id,
        isDefault: true,
      });
      console.log("  ✅ Assigned driver to route");
    } else {
      westwoodDriver = existingWestwoodDriver;
      console.log("  ℹ️  Driver already exists:", westwoodDriverEmail);
    }

    console.log("\n📝 Note: Westwood Academy has no riders yet - you'll add Ryan & Evan via QR codes later");

    // ============================================
    // SUMMARY
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("🎉 Seed completed successfully!");
    console.log("=".repeat(60));
    
    console.log("\n📧 Test Accounts Summary:");
    console.log("\n🔧 System Admin (Global):");
    console.log("  Email: " + systemAdminEmail);
    
    console.log("\n🏫 Organization 1: University High School (Morgantown, WV)");
    console.log("  Admin:     " + uhsAdminEmail);
    console.log("  Driver:    " + uhsDriverEmail);
    console.log("  Student 1: " + uhsStudent1Email);
    console.log("  Student 2: " + uhsStudent2Email);
    console.log("  Route:     Route 101 - Morgantown Campus");
    
    console.log("\n🏫 Organization 2: Westwood Academy (Westwood, MA)");
    console.log("  Admin:     " + westwoodAdminEmail);
    console.log("  Driver:    " + westwoodDriverEmail);
    console.log("  Riders:    (None yet - add via QR codes)");
    console.log("  Route:     Route 201 - Westwood Circle");

    console.log("\n💡 To login:");
    console.log("1. Go to /login");
    console.log("2. Enter one of the emails above");
    console.log("3. Check the toast notification for the magic link");
    console.log("4. Click the magic link to login");
    console.log("\n📝 Note: Magic links are shown in toast notifications in development mode");
    console.log("=".repeat(60) + "\n");

  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }

  process.exit(0);
}

seed();
