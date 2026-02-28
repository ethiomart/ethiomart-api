const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

async function optimizeExistingImages() {
  console.log('🚀 Starting image optimization for existing uploads...');
  
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('❌ Uploads directory not found.');
    return;
  }

  const files = fs.readdirSync(UPLOADS_DIR);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) && !file.includes('.tmp');
  });

  console.log(`Found ${imageFiles.length} images to process.`);

  let successCount = 0;
  let failCount = 0;
  let savedBytes = 0;

  for (const file of imageFiles) {
    const filePath = path.join(UPLOADS_DIR, file);
    const tempPath = `${filePath}.tmp`;

    try {
      const stats = fs.statSync(filePath);
      const originalSize = stats.size;

      await sharp(filePath)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80, progressive: true })
        .toFile(tempPath);

      const newStats = fs.statSync(tempPath);
      const newSize = newStats.size;

      if (newSize < originalSize) {
        fs.unlinkSync(filePath);
        fs.renameSync(tempPath, filePath);
        savedBytes += (originalSize - newSize);
        console.log(`✅ Optimized ${file}: ${(originalSize / 1024).toFixed(1)}KB -> ${(newSize / 1024).toFixed(1)}KB`);
      } else {
        fs.unlinkSync(tempPath);
        console.log(`ℹ️ Skipped ${file}: Already optimized`);
      }
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to optimize ${file}:`, error.message);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      failCount++;
    }
  }

  console.log('\n--- Optimization Summary ---');
  console.log(`Total images processed: ${imageFiles.length}`);
  console.log(`Successfully optimized/checked: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total space saved: ${(savedBytes / 1024 / 1024).toFixed(2)}MB`);
  console.log('----------------------------\n');
}

optimizeExistingImages();
