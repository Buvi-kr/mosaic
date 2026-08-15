const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const guidesDir = path.join(__dirname, '../public/guides');
const outputGuidesDir = path.join(__dirname, '../public/output_guides');

if (!fs.existsSync(guidesDir)) fs.mkdirSync(guidesDir, { recursive: true });
if (!fs.existsSync(outputGuidesDir)) fs.mkdirSync(outputGuidesDir, { recursive: true });

// 1. [1단계] QR 코드 스캔 가이드
const svg1 = Buffer.from(`
<svg width="600" height="700" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#090d1f"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="glow1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg1)"/>
  
  <!-- 스마트폰 프레임 -->
  <rect x="180" y="100" width="240" height="420" rx="36" fill="#0f172a" stroke="url(#glow1)" stroke-width="8"/>
  <rect x="205" y="145" width="190" height="310" rx="16" fill="#020617"/>
  
  <!-- 스마트폰 안의 QR 코드 아이콘 -->
  <rect x="235" y="185" width="130" height="130" rx="12" fill="#ffffff"/>
  <rect x="250" y="200" width="35" height="35" fill="#020617"/>
  <rect x="315" y="200" width="35" height="35" fill="#020617"/>
  <rect x="250" y="265" width="35" height="35" fill="#020617"/>
  
  <!-- 스캔 레이저 라인 -->
  <line x1="220" y1="250" x2="380" y2="250" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>
  
  <!-- 하단 텍스트 -->
  <rect x="40" y="560" width="520" height="90" rx="20" fill="rgba(99,102,241,0.25)" stroke="#6366f1" stroke-width="2"/>
  <text x="300" y="605" font-family="'Pretendard', sans-serif" font-size="32" font-weight="900" fill="#ffffff" text-anchor="middle">1단계: QR 코드 스캔</text>
  <text x="300" y="635" font-family="'Pretendard', sans-serif" font-size="20" font-weight="600" fill="#93c5fd" text-anchor="middle">기본 카메라로 QR을 비춰 접속하세요</text>
</svg>
`);

// 2. [2단계] 포토스팟 셀카 촬영 가이드
const svg2 = Buffer.from(`
<svg width="600" height="700" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#140d30"/>
      <stop offset="100%" stop-color="#311042"/>
    </linearGradient>
    <linearGradient id="neon2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#f43f5e"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg2)"/>
  
  <!-- 상반신 실루엣 -->
  <circle cx="300" cy="220" r="100" fill="url(#neon2)" opacity="0.9"/>
  <path d="M 120 520 C 120 360, 480 360, 480 520 Z" fill="url(#neon2)" opacity="0.8"/>
  <circle cx="300" cy="220" r="80" fill="#ffffff" opacity="0.95"/>
  <path d="M 150 520 C 150 380, 450 380, 450 520 Z" fill="#ffffff" opacity="0.95"/>
  
  <!-- 카메라 프레임 마크 -->
  <path d="M 80 120 L 140 120 M 80 120 L 80 180" stroke="#f43f5e" stroke-width="6" stroke-linecap="round"/>
  <path d="M 520 120 L 460 120 M 520 120 L 520 180" stroke="#f43f5e" stroke-width="6" stroke-linecap="round"/>
  <path d="M 80 500 L 140 500 M 80 500 L 80 440" stroke="#f43f5e" stroke-width="6" stroke-linecap="round"/>
  <path d="M 520 500 L 460 500 M 520 500 L 520 440" stroke="#f43f5e" stroke-width="6" stroke-linecap="round"/>

  <!-- 하단 텍스트 -->
  <rect x="40" y="560" width="520" height="90" rx="20" fill="rgba(244,63,94,0.25)" stroke="#f43f5e" stroke-width="2"/>
  <text x="300" y="605" font-family="'Pretendard', sans-serif" font-size="32" font-weight="900" fill="#ffffff" text-anchor="middle">2단계: 포토스팟 셀카 촬영</text>
  <text x="300" y="635" font-family="'Pretendard', sans-serif" font-size="20" font-weight="600" fill="#fca5a5" text-anchor="middle">상반신이 화면에 큼직하게 나오도록 촬영!</text>
</svg>
`);

// 3. [3단계] 모자이크 완성 결과 확인 가이드
const svg3 = Buffer.from(`
<svg width="600" height="700" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg3" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#022c22"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
    <linearGradient id="neon3" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg3)"/>
  
  <!-- 모자이크 타일 그리드 그래픽 -->
  <g transform="translate(100, 110)">
    <rect x="0" y="0" width="400" height="380" rx="20" fill="#0f172a" stroke="url(#neon3)" stroke-width="6"/>
    <!-- 타일들 -->
    <rect x="20" y="20" width="100" height="100" rx="10" fill="#6366f1" opacity="0.8"/>
    <rect x="150" y="20" width="100" height="100" rx="10" fill="#c084fc" opacity="0.8"/>
    <rect x="280" y="20" width="100" height="100" rx="10" fill="#38bdf8" opacity="0.8"/>
    <rect x="20" y="140" width="100" height="100" rx="10" fill="#f43f5e" opacity="0.8"/>
    <rect x="150" y="140" width="100" height="100" rx="10" fill="#34d399" opacity="0.9"/>
    <rect x="280" y="140" width="100" height="100" rx="10" fill="#fb923c" opacity="0.8"/>
    <rect x="20" y="260" width="100" height="100" rx="10" fill="#818cf8" opacity="0.8"/>
    <rect x="150" y="260" width="100" height="100" rx="10" fill="#e879f9" opacity="0.8"/>
    <rect x="280" y="260" width="100" height="100" rx="10" fill="#22d3ee" opacity="0.8"/>
  </g>

  <!-- 하단 텍스트 -->
  <rect x="40" y="560" width="520" height="90" rx="20" fill="rgba(16,185,129,0.25)" stroke="#10b981" stroke-width="2"/>
  <text x="300" y="605" font-family="'Pretendard', sans-serif" font-size="32" font-weight="900" fill="#ffffff" text-anchor="middle">3단계: 초대형 모자이크 완성</text>
  <text x="300" y="635" font-family="'Pretendard', sans-serif" font-size="20" font-weight="600" fill="#a7f3d0" text-anchor="middle">좌측 대형 화면에서 내 우주를 확인하세요</text>
</svg>
`);

// 4. [데모 모자이크 샘플 1 & 2] (public/output_guides/)
const demoMosaic1Svg = Buffer.from(`
<svg width="1200" height="1200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="demo1Grad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="40%" stop-color="#4f46e5"/>
      <stop offset="80%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#050816"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#demo1Grad)"/>
  <!-- 우주 별무리 -->
  <circle cx="600" cy="450" r="280" fill="#f8fafc" opacity="0.85"/>
  <path d="M 200 1100 C 200 700, 1000 700, 1000 1100 Z" fill="#f8fafc" opacity="0.85"/>
  <!-- 모자이크 타일 패턴 오버레이 -->
  <g opacity="0.25">
    ${Array.from({ length: 15 }, (_, r) => 
      Array.from({ length: 15 }, (_, c) => 
        `<rect x="${c*80}" y="${r*80}" width="76" height="76" rx="6" fill="#ffffff"/>`
      ).join('')
    ).join('')}
  </g>
  <rect x="250" y="1020" width="700" height="90" rx="45" fill="rgba(0,0,0,0.6)" stroke="#818cf8" stroke-width="3"/>
  <text x="600" y="1080" font-family="'Pretendard', sans-serif" font-size="38" font-weight="900" fill="#ffffff" text-anchor="middle">🌌 코즈믹 앰버서더 데모 모자이크</text>
</svg>
`);

const demoMosaic2Svg = Buffer.from(`
<svg width="1200" height="1200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="demo2Grad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f43f5e"/>
      <stop offset="40%" stop-color="#9f1239"/>
      <stop offset="80%" stop-color="#311042"/>
      <stop offset="100%" stop-color="#050816"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#demo2Grad)"/>
  <!-- 우주 별무리 인물 2 -->
  <circle cx="600" cy="450" r="280" fill="#f8fafc" opacity="0.85"/>
  <path d="M 200 1100 C 200 700, 1000 700, 1000 1100 Z" fill="#f8fafc" opacity="0.85"/>
  <!-- 모자이크 타일 패턴 오버레이 -->
  <g opacity="0.25">
    ${Array.from({ length: 15 }, (_, r) => 
      Array.from({ length: 15 }, (_, c) => 
        `<rect x="${c*80}" y="${r*80}" width="76" height="76" rx="6" fill="#ffffff"/>`
      ).join('')
    ).join('')}
  </g>
  <rect x="250" y="1020" width="700" height="90" rx="45" fill="rgba(0,0,0,0.6)" stroke="#f43f5e" stroke-width="3"/>
  <text x="600" y="1080" font-family="'Pretendard', sans-serif" font-size="38" font-weight="900" fill="#ffffff" text-anchor="middle">✨ NASA 우주 비행사 데모 모자이크</text>
</svg>
`);

Promise.all([
  sharp(svg1).png().toFile(path.join(guidesDir, 'guide_step1_qr.png')),
  sharp(svg2).png().toFile(path.join(guidesDir, 'guide_step2_photo.png')),
  sharp(svg3).png().toFile(path.join(guidesDir, 'guide_step3_result.png')),
  sharp(demoMosaic1Svg).jpeg({ quality: 90 }).toFile(path.join(outputGuidesDir, 'demo_mosaic_1.jpg')),
  sharp(demoMosaic2Svg).jpeg({ quality: 90 }).toFile(path.join(outputGuidesDir, 'demo_mosaic_2.jpg')),
]).then(() => {
  console.log('✅ Guide samples (1,2,3) & Demo mosaics created successfully');
}).catch(console.error);
