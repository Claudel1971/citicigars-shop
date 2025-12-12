import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function exportImages() {
  const result = await pool.query('SELECT id, sku, type, data FROM product_images');
  
  let sql = '';
  for (const row of result.rows) {
    const id = row.id.replace(/'/g, "''");
    const sku = row.sku.replace(/'/g, "''");
    const type = (row.type || '').replace(/'/g, "''");
    const data = (row.data || '').replace(/'/g, "''");
    sql += `INSERT INTO product_images (id, sku, type, data) VALUES ('${id}', '${sku}', '${type}', '${data}');\n`;
  }
  
  fs.writeFileSync('images_export.sql', sql);
  console.log(`Exported ${result.rows.length} images`);
  pool.end();
}

exportImages();
