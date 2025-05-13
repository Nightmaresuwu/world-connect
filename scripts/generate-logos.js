const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');

// Ensure output directories exist
const scriptDir = __dirname;
const publicDir = path.join(scriptDir, '..', 'public');

// Read SVG file
const svgPath = path.join(scriptDir, '..', 'src', 'logo.svg');
const svgString = fs.readFileSync(svgPath, 'utf8');

// Use sharp to convert SVG to PNG
async function generateLogos() {
    try {
        console.log('Generating logo PNG files...');

        // Generate logo192.png
        await sharp(Buffer.from(svgString))
            .resize(192, 192)
            .toFile(path.join(publicDir, 'logo192.png'));
        console.log('Generated logo192.png');

        // Generate logo512.png
        await sharp(Buffer.from(svgString))
            .resize(512, 512)
            .toFile(path.join(publicDir, 'logo512.png'));
        console.log('Generated logo512.png');

        // Generate favicon.ico (actually PNG for simplicity)
        await sharp(Buffer.from(svgString))
            .resize(64, 64)
            .toFile(path.join(publicDir, 'favicon.png'));
        console.log('Generated favicon.png');

        console.log('Logo generation complete!');
    } catch (error) {
        console.error('Error generating logos:', error);
    }
}

generateLogos(); 