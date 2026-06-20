const Database = require('better-sqlite3');
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/encarta';

async function migrate() {
  await mongoose.connect(MONGODB_URI);

  // Check all SQLite databases for articles and maps
  const dbs = [
    { path: '../../encarta.db', label: 'root' },
    { path: '../../data/seed.db', label: 'seed' },
    { path: 'encarta.db', label: 'server' },
  ];

  for (const dbInfo of dbs) {
    try {
      const d = new Database(dbInfo.path);
      const tables = d.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
      console.log(`\n${dbInfo.label} (${dbInfo.path}): tables=${tables.join(',')}`);

      if (tables.includes('articles')) {
        const rows = d.prepare('SELECT * FROM articles').all();
        console.log(`  articles: ${rows.length}`);
        for (const row of rows) {
          console.log(`    ${row.slug}: ${row.title} (${row.status})`);
        }
      }

      if (tables.includes('maps')) {
        const mapRows = d.prepare('SELECT slug, title, type FROM maps').all();
        console.log(`  maps: ${mapRows.length}`);
        for (const mr of mapRows) {
          console.log(`    ${mr.slug}: ${mr.title} (${mr.type})`);
        }
      }

      d.close();
    } catch (e) {
      console.log(`${dbInfo.label}: ${e.message}`);
    }
  }

  await mongoose.disconnect();
}

migrate().catch(console.error);
