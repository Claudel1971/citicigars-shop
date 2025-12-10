import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const QUALITY = 80;
const MAX_WIDTH = 1200;

const imageDirectories = [
  'client/public/cms-assets',
  'attached_assets',
  'attached_assets/generated_images'
];

async function optimizeImage(inputPath: string): Promise<void> {
  const ext = path.extname(inputPath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return;

  const outputPath = inputPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
  
  try {
    const metadata = await sharp(inputPath).metadata();
    const width = metadata.width && metadata.width > MAX_WIDTH ? MAX_WIDTH : undefined;

    await sharp(inputPath)
      .resize(width)
      .webp({ quality: QUALITY })
      .toFile(outputPath);

    const originalSize = fs.statSync(inputPath).size;
    const newSize = fs.statSync(outputPath).size;
    const savings = ((1 - newSize / originalSize) * 100).toFixed(1);

    console.log(`✅ ${path.basename(inputPath)} → ${path.basename(outputPath)} (${savings}% smaller)`);
  } catch (error) {
    console.error(`❌ Error processing ${inputPath}:`, error);
  }
}

async function processDirectory(dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    console.log(`⚠️ Directory not found: ${dirPath}`);
    return;
  }

  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isFile()) {
      await optimizeImage(filePath);
    }
  }
}

async function main() {
  console.log('🖼️ Starting image optimization...\n');
  
  for (const dir of imageDirectories) {
    console.log(`\n📁 Processing: ${dir}`);
    await processDirectory(dir);
  }
  
  console.log('\n✨ Image optimization complete!');
}

main().catch(console.error);
