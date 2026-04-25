/**
 * One-off helper: seed sample expenses for a given user email.
 * Usage:  node src/scripts/seed_expenses.js <email>
 * Default email: nigam@gmail.com
 */

const prisma = require('../lib/prisma');

const TARGET_EMAIL = process.argv[2] || 'nigam@gmail.com';

const today = new Date();
const d = (offsetDays) => {
  const x = new Date(today);
  x.setDate(x.getDate() + offsetDays);
  return x;
};

const SEED = [
  { title: 'Electricity Bill',     category: 'Utilities',       amount: 1240,  date: d(-2),  description: 'Monthly EB bill' },
  { title: 'Office Internet',      category: 'Utilities',       amount: 899,   date: d(-5),  description: '100 Mbps fiber' },
  { title: 'Adobe Creative Cloud', category: 'Software',        amount: 4999,  date: d(-8),  description: 'Annual sub' },
  { title: 'Slack Premium',        category: 'Software',        amount: 2400,  date: d(-12), description: '12 seats' },
  { title: 'Team Lunch',           category: 'Food & Drinks',   amount: 2300,  date: d(-3),  description: 'Sprint kickoff' },
  { title: 'Coffee Beans',         category: 'Food & Drinks',   amount: 850,   date: d(-9),  description: 'Office pantry' },
  { title: 'Cab to Client Site',   category: 'Travel',          amount: 620,   date: d(-1),  description: 'Onsite meeting' },
  { title: 'Travel - Bangalore',   category: 'Travel',          amount: 8500,  date: d(-32), description: 'Client visit' },
  { title: 'Office Rent',          category: 'Rent',            amount: 28000, date: d(-6),  description: 'April rent' },
  { title: 'Office Stationery',    category: 'Office Supplies', amount: 1450,  date: d(-14), description: 'Printer paper, pens' },
  { title: 'GST Filing Fees',      category: 'Taxes',           amount: 1500,  date: d(-20), description: 'Q4 filing' },
  { title: 'Old Hosting Bill',     category: 'Software',        amount: 1500,  date: d(-65), description: 'AWS' },
  { title: 'Facebook Ads',         category: 'Marketing',       amount: 3500,  date: d(-40), description: 'Festive campaign' },
  { title: 'Google Ads',           category: 'Marketing',       amount: 4200,  date: d(-7),  description: 'Search campaign' },
];

async function main() {
  const user = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });
  if (!user) {
    console.error(`User not found for email: ${TARGET_EMAIL}`);
    process.exit(1);
  }

  const existing = await prisma.expense.count({ where: { userId: user.id } });
  if (existing > 0) {
    console.log(
      `User ${TARGET_EMAIL} already has ${existing} expenses — skipping seed.`
    );
    process.exit(0);
  }

  const data = SEED.map((s) => ({ ...s, userId: user.id }));
  const result = await prisma.expense.createMany({ data });
  console.log(`Seeded ${result.count} expenses for ${TARGET_EMAIL}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
