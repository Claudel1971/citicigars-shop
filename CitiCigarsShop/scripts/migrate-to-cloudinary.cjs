const { Client } = require('pg');
const cloudinary = require('cloudinary').v2;

const DATABASE_URL = process.env.DATABASE_URL;
const CLOUDINARY_URL = process.env.CLOUDINARY_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

if (!CLOUDINARY_URL) {
  console.error('CLOUDINARY_URL is required');
  process.exit(1);
}

async function migrateImages() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  
  console.log('Connected to database');
  console.log('Cloudinary configured:', cloudinary.config().cloud_name);
  
  const result = await client.query(
    'SELECT id, sku, type, data FROM product_images WHERE url IS NULL AND data IS NOT NULL'
  );
  
  console.log(`Found ${result.rows.length} images to migrate`);
  
  let success = 0;
  let failed = 0;
  
  for (const row of result.rows) {
    try {
      const publicId = `citicigars/${row.sku}/${row.type}`;
      
      const uploadResult = await cloudinary.uploader.upload(row.data, {
        public_id: publicId,
        folder: 'products',
        overwrite: true,
        resource_type: 'image'
      });
      
      await client.query(
        'UPDATE product_images SET url = $1 WHERE id = $2',
        [uploadResult.secure_url, row.id]
      );
      
      success++;
      if (success % 10 === 0) {
        console.log(`Migrated ${success}/${result.rows.length} images...`);
      }
    } catch (error) {
      console.error(`Failed to migrate ${row.sku}/${row.type}:`, error.message);
      failed++;
    }
  }
  
  console.log(`\nMigration complete!`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  
  await client.end();
}

migrateImages().catch(console.error);
