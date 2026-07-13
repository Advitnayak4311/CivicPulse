const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const Complaint = require('../models/Complaint');
const SupportVote = require('../models/SupportVote');
const Timeline = require('../models/Timeline');

const seedDataInline = async () => {
  try {
    // Clear existing data
    console.log('Clearing old collections...');
    await User.deleteMany({});
    await Department.deleteMany({});
    await Complaint.deleteMany({});
    await SupportVote.deleteMany({});
    await Timeline.deleteMany({});
    console.log('Collections cleared.');

    // 1. Seed Departments
    console.log('Seeding Departments...');
    const departments = [
      {
        departmentName: 'Road Department',
        officerName: 'John Road-Officer',
        officerEmail: 'road@civic.gov',
        phone: '111-222-3333'
      },
      {
        departmentName: 'Sanitation Department',
        officerName: 'Sarah Clean-Officer',
        officerEmail: 'sanitation@civic.gov',
        phone: '444-555-6666'
      },
      {
        departmentName: 'Electrical Department',
        officerName: 'Electric Officer',
        officerEmail: 'electrical@civic.gov',
        phone: '777-888-9999'
      },
      {
        departmentName: 'Drainage Department',
        officerName: 'Drainage Officer',
        officerEmail: 'drainage@civic.gov',
        phone: '123-456-7890'
      },
      {
        departmentName: 'Water Supply Department',
        officerName: 'Water Officer',
        officerEmail: 'water@civic.gov',
        phone: '098-765-4321'
      }
    ];

    const seededDepts = await Department.create(departments);
    console.log(`${seededDepts.length} departments seeded successfully.`);

    // 2. Seed Admin User
    console.log('Seeding System Administrator...');
    await User.create({
      name: 'System Administrator',
      email: 'admin@civic.gov',
      phone: '8888888888',
      password: 'adminpassword',
      role: 'admin',
      address: 'Municipal Corporation HQ'
    });
    console.log('Admin user seeded: email: admin@civic.gov, password: adminpassword');

    // 3. Seed Authority Users
    console.log('Seeding Government Authorities...');
    for (const dept of seededDepts) {
      await User.create({
        name: dept.officerName,
        email: dept.officerEmail,
        phone: dept.phone.replace(/[^0-9]/g, '') || '0000000000',
        password: 'officerpassword',
        role: 'authority',
        address: `${dept.departmentName} Office`
      });
      console.log(`Authority seeded: ${dept.officerEmail} (password: officerpassword)`);
    }

    // 4. Seed Demo Citizen
    console.log('Seeding Demo Citizen...');
    await User.create({
      name: 'Jane Citizen',
      email: 'jane@citizen.com',
      phone: '9999999999',
      password: 'citizenpassword',
      role: 'citizen',
      address: '456 Citizen Lane, Bangalore'
    });
    console.log('Demo citizen seeded: email: jane@citizen.com, password: citizenpassword');

    console.log('Database seeding completed successfully! (Departments + Admin + Authority + Citizen accounts ready)');
    return true;
  } catch (error) {
    console.error('Seeding Error:', error);
    throw error;
  }
};

// Check if run directly
if (require.main === module) {
  require('dotenv').config();
  console.log('Connecting to database for seeding...');
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => seedDataInline())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedDataInline };
