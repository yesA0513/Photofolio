const fs = require('fs');
const path = require('path');
const { exiftool } = require('exiftool-vendored');
const sharp = require('sharp'); //

const imageDir = path.join(__dirname, 'img'); //
const outputFile = 'photo_data.xml'; //

async function getDominantColor(filePath) {
    try {
        // 이미지를 1x1로 줄여서 평균 RGB 값을 가져옴 (매우 빠름)
        const { data } = await sharp(filePath)
            .resize(1, 1)
            .raw()
            .toBuffer({ resolveWithObject: true });

        const r = data[0];
        const g = data[1];
        const b = data[2];

        // 밝기 계산 (YIQ 공식: 0.299R + 0.587G + 0.114B)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        const theme = brightness > 128 ? 'light' : 'dark';

        return {
            rgb: `${r},${g},${b}`,
            theme: theme
        };
    } catch (err) {
        console.error(`색상 추출 실패 (${path.basename(filePath)}):`, err.message);
        return { rgb: "17,17,17", theme: "dark" }; // 실패 시 기본값
    }
}

async function processImages() {
    console.log("🚀 사진 데이터 추출을 시작합니다...");

    if (!fs.existsSync(imageDir)) {
        console.error(`에러: ${imageDir} 폴더를 찾을 수 없습니다.`);
        return;
    }

    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<photofolio>\n';
    const files = fs.readdirSync(imageDir).filter(file => 
        ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase())
    ); //

    for (const file of files) {
        const filePath = path.join(imageDir, file);
        
        try {
            // 1. EXIF 데이터 읽기
            const tags = await exiftool.read(filePath);
            
            // 2. 파일 정보 및 해상도 계산
            const stats = fs.statSync(filePath);
            const fileSize = (stats.size / (1024 * 1024)).toFixed(2) + " MB";
            const width = tags.ImageWidth || tags.ExifImageWidth || 0;
            const height = tags.ImageHeight || tags.ExifImageHeight || 0;

            // 3. 색상 및 테마 추출 (Sharp 사용)
            const colorData = await getDominantColor(filePath);

            // 4. XML 태그 생성
            xmlContent += `  <photo name="${file}">\n`;
            xmlContent += `    <make>${tags.Make || 'Unknown'}</make>\n`;
            xmlContent += `    <model>${tags.Model || ''}</model>\n`;
            xmlContent += `    <iso>${tags.ISO || 'N/A'}</iso>\n`;
            xmlContent += `    <fNumber>${tags.FNumber || 'N/A'}</fNumber>\n`;
            xmlContent += `    <exposureTime>${tags.ExposureTime || 'N/A'}</exposureTime>\n`;
            xmlContent += `    <focalLength>${tags.FocalLength || 'N/A'}</focalLength>\n`;
            xmlContent += `    <dateTime>${tags.DateTimeOriginal ? tags.DateTimeOriginal.toString() : '1970:01:01 00:00:00'}</dateTime>\n`;
            xmlContent += `    <fileSize>${fileSize}</fileSize>\n`;
            xmlContent += `    <width>${width}</width>\n`;
            xmlContent += `    <height>${height}</height>\n`;
            xmlContent += `    <exposureBias>${tags.ExposureCompensation || "0 EV"}</exposureBias>\n`;
            xmlContent += `    <whiteBalance>${tags.WhiteBalance || "Auto"}</whiteBalance>\n`;
            xmlContent += `    <meteringMode>${tags.MeteringMode || "N/A"}</meteringMode>\n`;
            xmlContent += `    <flash>${tags.Flash || "N/A"}</flash>\n`;
            xmlContent += `    <software>${tags.Software || "N/A"}</software>\n`;
            xmlContent += `    <rgb>${colorData.rgb}</rgb>\n`;
            xmlContent += `    <theme>${colorData.theme}</theme>\n`;
            xmlContent += `    <lat>${tags.GPSLatitude || ""}</lat>\n`;
            xmlContent += `    <lon>${tags.GPSLongitude || ""}</lon>\n`;
            xmlContent += `  </photo>\n`;

            console.log(`✅ 처리 완료: ${file} (Theme: ${colorData.theme})`);
        } catch (err) {
            console.error(`❌ 추출 실패: ${file} - ${err.message}`);
        }
    }

    xmlContent += '</photofolio>';
    fs.writeFileSync(outputFile, xmlContent); //
    
    await exiftool.end(); //
    console.log(`\n✨ 모든 작업이 끝났습니다! ${outputFile} 파일이 생성되었습니다.`);
}

processImages();