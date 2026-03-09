import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from './models/User.js';
import { UserRole } from './types/index.js';

const customers = [
  { name: 'Alexa Mae Carreon', email: 'acarreon@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Angelito Ranes', email: 'angelito@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Arlie Josol', email: 'arlie@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Arselin Vangel Layese', email: 'alayese@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Bob Denzel Allosada', email: 'denzel@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Catherine Codiñera', email: 'catherine.lumongsod@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Charesse Ann Catubig', email: 'ccatubig@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Churchill Mateo', email: 'churchill@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Clifford Tero', email: 'clifford@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Corine Suyat', email: 'corine@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Diane Abapo', email: 'dianeabapo@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Diane Sagun', email: 'dianesagun@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Don Patrick Cubar', email: 'dcubar@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Donalyn Carisma', email: 'donalyn@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Egie Arradaza', email: 'egie@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Elmar Serna', email: 'elmar@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Ezequel Tapang Matus', email: 'ezequel@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Florante Vienes', email: 'florante@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Francis Escaros', email: 'francis@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Francis Niño Mejos', email: 'fmejos@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Fred Naingue', email: 'fred@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Gregorio Jr. Ciruela', email: 'gregorio@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Guia Vercel Louvain Navaja', email: 'gnavaja@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Gypsy Rose Jasmin', email: 'gjasmin@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Hannah Marie Sinangote', email: 'hsinangote@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Harvey Nabonita', email: 'harvey@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'James Camoro', email: 'james@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Janine Desiree Colegado', email: 'jcolegado@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Janroe Vincent Bermoy', email: 'jbermoy@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Jennifer Caño', email: 'jennifer.cano@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Jennifer Sosas', email: 'jennifersosas@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Jerald Sarte', email: 'jerald@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Jessa Montejo', email: 'jessa@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Jheny Lausa', email: 'jhenylausa@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Jhon Vincent Cuizon', email: 'jcuizon@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Jhonmar Maxino Membrano', email: 'jhonmar@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Joanne Christie Tampos', email: 'jtampos@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Jogie Balansag', email: 'jogie@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'John Christian Fariola', email: 'jfariola@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'John Christopher Cudera', email: 'jcudera@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'John Louie Mendez', email: 'jmendez@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Jomael Gemota', email: 'jomael@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Jonisa Rebagos', email: 'jonisa@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Joren Kate Apiladas', email: 'japiladas@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Joshua Aro', email: 'joshuaaro@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Joven Carl Evin', email: 'jevin@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Juddy Abanilla Cabije', email: 'juddy@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Judie Arriba', email: 'judie@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Judy Clark Rosasena', email: 'jrosasena@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Julia Nebhel Bariquit', email: 'jbariquit@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Justine Reblora', email: 'justine@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Kenneth Calvo', email: 'kcalvo@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Khyla Grace Dijeno', email: 'kdijeno@channelprecision.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Learners Disprz', email: 'tlauron@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Lettice Tordillo', email: 'lettice@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Lira Agbon', email: 'lira@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Lord Raven Dublin', email: 'ldublin@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Ma. Theresa Galang', email: 'mtgalang@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Maria Chielo Sayson', email: 'msayson@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Marisa Macatunog', email: 'marisa@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Mark John Sevilleno', email: 'msevilleno@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Mark Lee C. Aronales', email: 'maronales@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Marvin Flores', email: 'marvin@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Mary Anne Niones', email: 'mniones@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Melvin Sagnoy', email: 'melvin@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Mirasol Candido', email: 'mirasol@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Missy Fernandez', email: 'missy@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Nikki Lukes Decierdo', email: 'ndecierdo@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Niño Jose Tura', email: 'nj.tura@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Nova Mae Baloyos', email: 'nbaloyos@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Odith Torreta', email: 'odith@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Omar Pacilan', email: 'omar@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Peter Louie Jimenez', email: 'pjimenez@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Rap Harold Armstrong', email: 'harold@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Reignheart Bazarte', email: 'reignheart@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Remon Capile', email: 'remon@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Rey Ryan Suico', email: 'rsuico@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Rocsan Ebrado', email: 'rocsan@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Romar Amallo', email: 'romar@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Ronel Torres', email: 'ronel@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Sanvie Palomares', email: 'sanvie@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Sedney Marie Acogido', email: 'sacogido@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Shenna Marie Z. Puebla', email: 'spuebla@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Stanley Blair Manatad', email: 'smanatad@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Stephanie Villafuerte', email: 'stephanie@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Steve Bryan Jr. Suico', email: 'ssuico@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Timothy Nielzen Lauron', email: 'tlauron@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Trisha Mitch Bantecil', email: 'tbantecil@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Trixza Mae Tero Petralba', email: 'tpetralba@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Vanessa Medel', email: 'vanessa@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Vincent Matthew Mancao', email: 'vmancao@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
  { name: 'Wyndell Joshua Del Corro', email: 'wjdelcorro@outdoorequipped.com', password: 'password123', role: UserRole.CUSTOMER },
];

async function seedCustomers() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined');

  await mongoose.connect(uri);
  console.log('MongoDB connected\n');

  console.log(`Seeding ${customers.length} customers...\n`);

  let created = 0;
  let skipped = 0;

  for (const customer of customers) {
    const existing = await User.findOne({ email: customer.email });
    if (existing) {
      console.log(`  SKIP: "${customer.email}" already exists`);
      skipped++;
      continue;
    }

    const hashed = await bcrypt.hash(customer.password, 12);
    await User.create({ ...customer, password: hashed });
    console.log(`  CREATED: ${customer.name} (${customer.email})`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
  await mongoose.disconnect();
}

seedCustomers().catch((err) => {
  console.error('Customer seed failed:', err);
  process.exit(1);
});
