import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Location } from './models/Location.js';
import { Store } from './models/Store.js';
import { StoreManagerAssignment } from './models/StoreManagerAssignment.js';
import { User } from './models/User.js';
import { UserRole } from './types/index.js';

async function upsertUser(data: { name: string; email: string; password: string; role: UserRole }) {
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    console.log(`  User "${data.email}" already exists — skipping.`);
    return existing;
  }
  const hashed = await bcrypt.hash(data.password, 12);
  const user = await User.create({ ...data, password: hashed });
  console.log(`  Created user: ${data.email} (${data.role})`);
  return user;
}

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined');

  await mongoose.connect(uri);
  console.log('MongoDB connected\n');

  // --- Locations ---
  console.log('Seeding locations...');
  const locationNames = ['Cebu', 'Baybay'];
  const locations: Record<string, mongoose.Document & { _id: mongoose.Types.ObjectId }> = {};
  for (const name of locationNames) {
    let loc = await Location.findOne({ name });
    if (!loc) {
      loc = await Location.create({ name });
      console.log(`  Created location: ${name}`);
    } else {
      console.log(`  Location "${name}" already exists — skipping.`);
    }
    locations[name] = loc;
  }

  // --- Stores ---
  console.log('\nSeeding stores...');
  const storeData = [
    { name: 'Cebu Main Store', locationKey: 'Cebu' },
    { name: 'Cebu Branch 2', locationKey: 'Cebu' },
    { name: 'Baybay Store', locationKey: 'Baybay' },
    { name: 'Baybay Outlet', locationKey: 'Baybay' },
  ];
  const stores: Record<string, mongoose.Document & { _id: mongoose.Types.ObjectId }> = {};
  for (const sd of storeData) {
    let store = await Store.findOne({ name: sd.name });
    if (!store) {
      store = await Store.create({
        name: sd.name,
        locationId: locations[sd.locationKey]._id,
      });
      console.log(`  Created store: ${sd.name}`);
    } else {
      console.log(`  Store "${sd.name}" already exists — skipping.`);
    }
    stores[sd.name] = store;
  }

  // --- Users ---
  console.log('\nSeeding users...');
  const admin = await upsertUser({
    name: 'Admin',
    email: 'admin@agora.com',
    password: 'admin123',
    role: UserRole.ADMIN,
  });

  const manager1 = await upsertUser({
    name: 'Juan Manager',
    email: 'juan@agora.com',
    password: 'manager123',
    role: UserRole.STORE_MANAGER,
  });

  const manager2 = await upsertUser({
    name: 'Maria Manager',
    email: 'maria@agora.com',
    password: 'manager123',
    role: UserRole.STORE_MANAGER,
  });

  const customer1 = await upsertUser({
    name: 'Pedro Customer',
    email: 'pedro@agora.com',
    password: 'customer123',
    role: UserRole.CUSTOMER,
  });

  const customer2 = await upsertUser({
    name: 'Ana Customer',
    email: 'ana@agora.com',
    password: 'customer123',
    role: UserRole.CUSTOMER,
  });

  // --- Store Manager Assignments ---
  console.log('\nSeeding store manager assignments...');
  const assignments = [
    { userId: manager1._id, storeId: stores['Cebu Main Store']._id },
    { userId: manager1._id, storeId: stores['Cebu Branch 2']._id },
    { userId: manager2._id, storeId: stores['Baybay Store']._id },
    { userId: manager2._id, storeId: stores['Baybay Outlet']._id },
  ];

  for (const a of assignments) {
    const exists = await StoreManagerAssignment.findOne(a);
    if (!exists) {
      await StoreManagerAssignment.create(a);
      console.log(`  Assigned manager ${a.userId} -> store ${a.storeId}`);
    } else {
      console.log(`  Assignment already exists — skipping.`);
    }
  }

  await mongoose.disconnect();
  console.log('\nSeed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
