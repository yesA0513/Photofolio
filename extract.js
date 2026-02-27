const fs = require('fs');
const path = require('path');
const { exiftool } = require('exiftool-vendored');
const sharp = require('sharp');

const imageDir = path.join(__dirname, 'img');
const outputFile = 'photo_data.xml';

// 주소 추출을 위한 헬퍼 함수
async function getAddress(lat, lon) {
    if (!lat || !lon) return "";
    try {
        // OpenStreetMap Nominatim API 사용
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`, {
            headers: { 'User-Agent': 'Photofolio-App' }
        });
        const data = await response.json();
        if (data.address) {
            const addr = data.address;
            // 도시, 국가 순으로 텍스트 구성 (필요에 따라 수정 가능)
            const city = addr.city || addr.town || addr.village || addr.county || "";
            const country = addr.country || "";
            return city && country ? `${city}, ${country}` : city || country || "Unknown Location";
        }
        return "";
    } catch (err) {
        return "";
    }
}

// API 호출 간격을 위한 대기 함수
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getDominantColor(filePath) {
    try {
        const { data } = await sharp(filePath).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
        const r = data[0], g = data[1], b = data[2];
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return { rgb: `${r},${g},${b}`, theme: brightness > 128 ? 'light' : 'dark' };
    } catch (err) {
        return { rgb: "17,17,17", theme: "dark" };
    }
}

async function processImages() {
    console.log("🚀 사진 데이터 및 주소 추출을 시작합니다...");

    if (!fs.existsSync(imageDir)) {
        console.error(`에러: ${imageDir} 폴더를 찾을 수 없습니다.`);
        return;
    }

    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<photofolio>\n';
    const files = fs.readdirSync(imageDir).filter(file => 
        ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase())
    );

    for (const file of files) {
        const filePath = path.join(imageDir, file);
        try {
            const tags = await exiftool.read(filePath);
            const stats = fs.statSync(filePath);
            const fileSize = (stats.size / (1024 * 1024)).toFixed(2) + " MB";
            
            // 좌표 및 주소 추출
            const lat = tags.GPSLatitude;
            const lon = tags.GPSLongitude;
            const address = await getAddress(lat, lon);
            if (lat && lon) await sleep(1000); // API 정책 준수를 위한 1초 대기

            const colorData = await getDominantColor(filePath);

            xmlContent += `  <photo name="${file}">\n`;
            xmlContent += `    <make>${tags.Make || 'Unknown'}</make>\n`;
            xmlContent += `    <model>${tags.Model || ''}</model>\n`;
            xmlContent += `    <iso>${tags.ISO || 'N/A'}</iso>\n`;
            xmlContent += `    <fNumber>${tags.FNumber || 'N/A'}</fNumber>\n`;
            xmlContent += `    <exposureTime>${tags.ExposureTime || 'N/A'}</exposureTime>\n`;
            xmlContent += `    <focalLength>${tags.FocalLength || 'N/A'}</focalLength>\n`;
            xmlContent += `    <focal35mm>${tags.FocalLengthIn35mmFormat ? tags.FocalLengthIn35mmFormat + "mm" : 'N/A'}</focal35mm>\n`;
            xmlContent += `    <dateTime>${tags.DateTimeOriginal ? tags.DateTimeOriginal.toString() : '1970:01:01 00:00:00'}</dateTime>\n`;
            xmlContent += `    <timeZone>${tags.OffsetTimeOriginal || ""}</timeZone>\n`;
            xmlContent += `    <fileSize>${fileSize}</fileSize>\n`;
            xmlContent += `    <width>${tags.ImageWidth || 0}</width>\n`;
            xmlContent += `    <height>${tags.ImageHeight || 0}</height>\n`;
            xmlContent += `    <software>${tags.Software || ''}</software>\n`;
            xmlContent += `    <rgb>${colorData.rgb}</rgb>\n`;
            xmlContent += `    <theme>${colorData.theme}</theme>\n`;
            xmlContent += `    <lat>${lat || ""}</lat>\n`;
            xmlContent += `    <lon>${lon || ""}</lon>\n`;
            xmlContent += `    <address>${address}</address>\n`; // 주소 태그 추가
            xmlContent += `  </photo>\n`;

            console.log(`✅ 처리 완료: ${file} (${address || "No Address"})`);
        } catch (err) {
            console.error(`❌ 추출 실패: ${file} - ${err.message}`);
        }
    }

    xmlContent += '</photofolio>';
    fs.writeFileSync(outputFile, xmlContent);
    await exiftool.end();
    console.log(`\n✨ 모든 작업 완료! ${outputFile} 파일이 갱신되었습니다.`);
}

processImages();