const sharp = require('sharp');
const fs = require('fs');

async function test() {
  const width = 100;
  const height = 100;

  // Create a red image
  const baseOriginal = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } }
  }).jpeg().toBuffer();

  // Create a blue tiles image (raw)
  const rawCanvas = await sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 255 } }
  }).raw().toBuffer();

  // OLD CODE (PNG intermediate)
  const tilesBuffer = await sharp(rawCanvas, { raw: { width, height, channels: 3 } }).png().toBuffer();
  
  let fullyBlendedBuffer = await sharp(baseOriginal)
    .composite([{ input: tilesBuffer, blend: 'multiply' }])
    .toBuffer();
    
  let transparentBlended = await sharp(fullyBlendedBuffer)
    .ensureAlpha()
    .composite([{
      input: Buffer.from([255, 255, 255, 128]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: 'dest-in'
    }]).png().toBuffer();

  const finalOld = await sharp(tilesBuffer)
    .composite([{ input: transparentBlended, blend: 'over' }])
    .jpeg({ quality: 95 })
    .toBuffer();

  // NEW CODE (RAW intermediate)
  const baseRaw = await sharp(baseOriginal).ensureAlpha().raw().toBuffer();
  const baseRawOptions = { raw: { width, height, channels: 4 } };
  const tilesRawOptions = { raw: { width, height, channels: 3 } };

  let fullyBlendedRaw = await sharp(baseRaw, baseRawOptions)
    .composite([{ input: rawCanvas, ...tilesRawOptions, blend: 'multiply' }])
    .ensureAlpha()
    .raw()
    .toBuffer();

  let transparentBlendedRaw = await sharp(fullyBlendedRaw, baseRawOptions)
    .composite([{
      input: Buffer.from([255, 255, 255, 128]),
      raw: { width: 1, height: 1, channels: 4 },
      tile: true,
      blend: 'dest-in'
    }])
    .ensureAlpha()
    .raw()
    .toBuffer();

  const finalNew = await sharp(rawCanvas, tilesRawOptions)
    .composite([{ input: transparentBlendedRaw, ...baseRawOptions, blend: 'over' }])
    .jpeg({ quality: 95 })
    .toBuffer();

  console.log("Old Buffer Length:", finalOld.length);
  console.log("New Buffer Length:", finalNew.length);
  
  // Compare pixels
  const oldRaw = await sharp(finalOld).raw().toBuffer();
  const newRaw = await sharp(finalNew).raw().toBuffer();
  
  let diffCount = 0;
  for(let i = 0; i < oldRaw.length; i++) {
    if (oldRaw[i] !== newRaw[i]) diffCount++;
  }
  
  console.log("Different pixels:", diffCount, "out of", oldRaw.length);
  console.log("Old pixel 0:", oldRaw.slice(0, 3));
  console.log("New pixel 0:", newRaw.slice(0, 3));
}

test().catch(console.error);
