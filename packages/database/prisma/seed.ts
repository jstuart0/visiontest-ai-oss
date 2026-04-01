// VisionTest AI - Database Seed Script
// Creates initial data for development and testing

import { PrismaClient, Role, TestStatus, BaselineType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedDeviceProfiles } from './seed-devices';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data (development only)
  if (process.env.NODE_ENV !== 'production') {
    console.log('Cleaning existing data...');
    await prisma.auditLog.deleteMany();
    await prisma.checkpoint.deleteMany();
    await prisma.approvalRequest.deleteMany();
    await prisma.comparison.deleteMany();
    await prisma.screenshot.deleteMany();
    await prisma.execution.deleteMany();
    await prisma.flakyTest.deleteMany();
    await prisma.ignoreMask.deleteMany();
    await prisma.baseline.deleteMany();
    await prisma.test.deleteMany();
    await prisma.testSuite.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.project.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.session.deleteMany();
    await prisma.organizationUser.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();
  }

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123!', 12);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@visiontest.local',
      passwordHash: adminPassword,
      name: 'Admin User',
      emailVerified: true,
    },
  });
  console.log(`✅ Created admin user: ${admin.email}`);

  // Create demo user
  const demoPassword = await bcrypt.hash('demo123!', 12);
  const demo = await prisma.user.create({
    data: {
      email: 'demo@visiontest.local',
      passwordHash: demoPassword,
      name: 'Demo User',
      emailVerified: true,
    },
  });
  console.log(`✅ Created demo user: ${demo.email}`);

  // Create organization
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Healthcare',
      slug: 'acme-healthcare',
      settings: {
        features: {
          flakyQuarantine: true,
          smartSelection: true,
          approvalDelegation: true,
        },
      },
    },
  });
  console.log(`✅ Created organization: ${org.name}`);

  // Add users to organization
  await prisma.organizationUser.createMany({
    data: [
      { userId: admin.id, orgId: org.id, role: Role.OWNER },
      { userId: demo.id, orgId: org.id, role: Role.MEMBER },
    ],
  });

  // Create project
  const project = await prisma.project.create({
    data: {
      orgId: org.id,
      name: 'Patient Portal',
      slug: 'patient-portal',
      description: 'Patient-facing healthcare portal for appointments and records',
      repoUrl: 'https://github.com/acme-healthcare/patient-portal',
      settings: {
        defaultBrowser: 'chromium',
        defaultViewport: { width: 1920, height: 1080 },
        screenshotOnFailure: true,
        videoOnFailure: true,
        flakyThreshold: 35,
        ciBlockQuarantined: false,
      },
    },
  });
  console.log(`✅ Created project: ${project.name}`);

  // Create test suites
  const smokeSuite = await prisma.testSuite.create({
    data: {
      projectId: project.id,
      name: 'Smoke Tests',
      description: 'Critical path tests for CI/CD',
      tags: ['smoke', 'critical'],
      order: 1,
    },
  });

  const regressionSuite = await prisma.testSuite.create({
    data: {
      projectId: project.id,
      name: 'Regression Suite',
      description: 'Full regression test suite',
      tags: ['regression'],
      order: 2,
    },
  });

  const vrtSuite = await prisma.testSuite.create({
    data: {
      projectId: project.id,
      name: 'Visual Regression',
      description: 'Visual regression tests for all pages',
      tags: ['vrt', 'visual'],
      order: 3,
    },
  });
  console.log(`✅ Created ${3} test suites`);

  // Create tests
  const tests = await prisma.test.createMany({
    data: [
      // Smoke tests
      {
        projectId: project.id,
        suiteId: smokeSuite.id,
        name: 'Login - Valid credentials',
        description: 'Verify user can login with valid credentials',
        steps: JSON.stringify([
          { type: 'navigate', url: '/login' },
          { type: 'type', selector: '[data-testid="email"]', value: '{{email}}' },
          { type: 'type', selector: '[data-testid="password"]', value: '{{password}}' },
          { type: 'click', selector: '[data-testid="login-button"]' },
          { type: 'assert', selector: '[data-testid="dashboard"]', assertion: 'visible' },
        ]),
        tags: ['smoke', 'auth', 'critical'],
        status: TestStatus.ACTIVE,
        coveredFiles: ['src/pages/Login.tsx', 'src/services/auth.ts'],
      },
      {
        projectId: project.id,
        suiteId: smokeSuite.id,
        name: 'Login - Invalid credentials',
        description: 'Verify error message for invalid credentials',
        steps: JSON.stringify([
          { type: 'navigate', url: '/login' },
          { type: 'type', selector: '[data-testid="email"]', value: 'invalid@test.com' },
          { type: 'type', selector: '[data-testid="password"]', value: 'wrongpassword' },
          { type: 'click', selector: '[data-testid="login-button"]' },
          { type: 'assert', selector: '[data-testid="error-message"]', assertion: 'visible' },
        ]),
        tags: ['smoke', 'auth'],
        status: TestStatus.ACTIVE,
        coveredFiles: ['src/pages/Login.tsx', 'src/services/auth.ts'],
      },
      {
        projectId: project.id,
        suiteId: smokeSuite.id,
        name: 'Dashboard - Load',
        description: 'Verify dashboard loads correctly after login',
        steps: JSON.stringify([
          { type: 'navigate', url: '/dashboard' },
          { type: 'assert', selector: '[data-testid="welcome-message"]', assertion: 'visible' },
          { type: 'assert', selector: '[data-testid="appointments-widget"]', assertion: 'visible' },
        ]),
        tags: ['smoke', 'dashboard'],
        status: TestStatus.ACTIVE,
        coveredFiles: ['src/pages/Dashboard.tsx', 'src/components/AppointmentsWidget.tsx'],
      },
      // Regression tests
      {
        projectId: project.id,
        suiteId: regressionSuite.id,
        name: 'Appointments - Book new',
        description: 'Verify user can book a new appointment',
        steps: JSON.stringify([
          { type: 'navigate', url: '/appointments/new' },
          { type: 'click', selector: '[data-testid="select-doctor"]' },
          { type: 'click', selector: '[data-testid="doctor-option-1"]' },
          { type: 'click', selector: '[data-testid="select-date"]' },
          { type: 'click', selector: '[data-testid="available-slot-1"]' },
          { type: 'click', selector: '[data-testid="confirm-booking"]' },
          { type: 'assert', selector: '[data-testid="booking-success"]', assertion: 'visible' },
        ]),
        tags: ['regression', 'appointments'],
        status: TestStatus.ACTIVE,
        coveredFiles: ['src/pages/Appointments.tsx', 'src/services/booking.ts'],
      },
      {
        projectId: project.id,
        suiteId: regressionSuite.id,
        name: 'Profile - Update info',
        description: 'Verify user can update profile information',
        steps: JSON.stringify([
          { type: 'navigate', url: '/profile' },
          { type: 'click', selector: '[data-testid="edit-profile"]' },
          { type: 'clear', selector: '[data-testid="phone-input"]' },
          { type: 'type', selector: '[data-testid="phone-input"]', value: '+1234567890' },
          { type: 'click', selector: '[data-testid="save-profile"]' },
          { type: 'assert', selector: '[data-testid="success-toast"]', assertion: 'visible' },
        ]),
        tags: ['regression', 'profile'],
        status: TestStatus.ACTIVE,
        coveredFiles: ['src/pages/Profile.tsx', 'src/services/user.ts'],
      },
      // VRT tests
      {
        projectId: project.id,
        suiteId: vrtSuite.id,
        name: 'VRT - Login Page',
        description: 'Visual regression test for login page',
        steps: JSON.stringify([
          { type: 'navigate', url: '/login' },
          { type: 'screenshot', name: 'login-page', fullPage: true },
        ]),
        tags: ['vrt', 'login'],
        status: TestStatus.ACTIVE,
        coveredFiles: ['src/pages/Login.tsx'],
      },
      {
        projectId: project.id,
        suiteId: vrtSuite.id,
        name: 'VRT - Dashboard',
        description: 'Visual regression test for dashboard',
        steps: JSON.stringify([
          { type: 'navigate', url: '/dashboard' },
          { type: 'waitFor', selector: '[data-testid="dashboard-loaded"]' },
          { type: 'screenshot', name: 'dashboard', fullPage: true },
        ]),
        tags: ['vrt', 'dashboard'],
        status: TestStatus.ACTIVE,
        coveredFiles: ['src/pages/Dashboard.tsx'],
      },
      {
        projectId: project.id,
        suiteId: vrtSuite.id,
        name: 'VRT - Appointments List',
        description: 'Visual regression test for appointments list',
        steps: JSON.stringify([
          { type: 'navigate', url: '/appointments' },
          { type: 'waitFor', selector: '[data-testid="appointments-list"]' },
          { type: 'screenshot', name: 'appointments-list', fullPage: true },
        ]),
        tags: ['vrt', 'appointments'],
        status: TestStatus.ACTIVE,
        coveredFiles: ['src/pages/Appointments.tsx'],
      },
    ],
  });
  console.log(`✅ Created ${tests.count} tests`);

  // Create baselines
  const baseline = await prisma.baseline.create({
    data: {
      projectId: project.id,
      name: 'main-baseline',
      branch: 'main',
      type: BaselineType.PROJECT,
      screenshots: JSON.stringify([
        { name: 'login-page', url: 'baselines/login-page.png', width: 1920, height: 1080 },
        { name: 'dashboard', url: 'baselines/dashboard.png', width: 1920, height: 1080 },
        { name: 'appointments-list', url: 'baselines/appointments-list.png', width: 1920, height: 1080 },
      ]),
    },
  });
  console.log(`✅ Created baseline: ${baseline.name}`);

  // Create ignore masks (example)
  await prisma.ignoreMask.createMany({
    data: [
      {
        projectId: project.id,
        type: 'SELECTOR',
        value: '.timestamp, .date-display',
        reason: 'Dynamic timestamps',
        createdBy: admin.id,
      },
      {
        projectId: project.id,
        type: 'SELECTOR',
        value: '[data-testid="user-avatar"]',
        reason: 'User-specific avatar',
        createdBy: admin.id,
      },
      {
        projectId: project.id,
        type: 'RECTANGLE',
        value: JSON.stringify({ x: 0, y: 0, width: 300, height: 60 }),
        reason: 'Header notification badge',
        createdBy: admin.id,
      },
    ],
  });
  console.log(`✅ Created 3 ignore masks`);

  // Create a flaky test example
  const flakyTestData = await prisma.test.findFirst({
    where: { name: 'Appointments - Book new' },
  });
  
  if (flakyTestData) {
    await prisma.flakyTest.create({
      data: {
        testId: flakyTestData.id,
        projectId: project.id,
        flakinessScore: 42.5,
        status: 'QUARANTINED',
        quarantinedAt: new Date(),
        runHistory: JSON.stringify([
          { timestamp: Date.now() - 86400000 * 7, passed: true, duration: 5200 },
          { timestamp: Date.now() - 86400000 * 6, passed: false, duration: 5800 },
          { timestamp: Date.now() - 86400000 * 5, passed: true, duration: 5100 },
          { timestamp: Date.now() - 86400000 * 4, passed: false, duration: 6200 },
          { timestamp: Date.now() - 86400000 * 3, passed: true, duration: 5300 },
          { timestamp: Date.now() - 86400000 * 2, passed: false, duration: 5900 },
          { timestamp: Date.now() - 86400000, passed: true, duration: 5000 },
          { timestamp: Date.now(), passed: false, duration: 6100 },
        ]),
      },
    });
    
    // Update test status
    await prisma.test.update({
      where: { id: flakyTestData.id },
      data: { status: TestStatus.QUARANTINED },
    });
    console.log(`✅ Created flaky test record`);
  }

  // Create schedule
  await prisma.schedule.create({
    data: {
      projectId: project.id,
      suiteId: regressionSuite.id,
      name: 'Nightly Regression',
      cron: '0 2 * * *',
      timezone: 'America/New_York',
      config: JSON.stringify({
        platforms: ['chromium', 'firefox'],
        environments: ['staging'],
        notifications: {
          slack: '#qa-alerts',
          email: ['qa-team@acme-healthcare.com'],
        },
      }),
      isActive: true,
    },
  });
  console.log(`✅ Created schedule: Nightly Regression`);

  // Create audit log entry
  await prisma.auditLog.create({
    data: {
      orgId: org.id,
      userId: admin.id,
      action: 'seed',
      resource: 'database',
      details: { message: 'Database seeded successfully' },
    },
  });

  // Seed built-in device profiles for mobile testing
  await seedDeviceProfiles();

  console.log('');
  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('📋 Summary:');
  console.log(`   Users: 2 (admin@visiontest.local / admin123!)`);
  console.log(`   Organizations: 1`);
  console.log(`   Projects: 1`);
  console.log(`   Test Suites: 3`);
  console.log(`   Tests: ${tests.count}`);
  console.log(`   Baselines: 1`);
  console.log(`   Ignore Masks: 3`);
  console.log(`   Flaky Tests: 1`);
  console.log(`   Schedules: 1`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
