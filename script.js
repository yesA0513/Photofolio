/**
 * Photofolio - Client Side Script
 */

let validResults = [];
let currentImageIndex = 0;
let touchstartX = 0;
let touchendX = 0;
let currentColumns = 0;

document.addEventListener("DOMContentLoaded", async () => {
    const section = document.getElementById('gallery-section');
    const loadingOverlay = document.getElementById('loading-overlay');

    try {
        const response = await fetch('photo_data.xml');
        const xmlText = await response.text();
        const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
        const photos = xmlDoc.getElementsByTagName("photo");

        validResults = Array.from(photos).map(photo => {
            const getVal = (tag) => photo.getElementsByTagName(tag)[0]?.textContent || "N/A";
            const fileName = photo.getAttribute("name");

            // --- 1. 화각 소수점 제거 및 정수화 처리 (반올림) ---
            const formatFocal = (val) => {
                const num = parseFloat(val);
                return !isNaN(num) ? `${Math.round(num)} mm` : val;
            };

            const focalLength = formatFocal(getVal("focalLength"));
            const focal35mm = formatFocal(getVal("focal35mm"));

            // --- 2. 촬영 시간 및 시간대 포맷팅 ---
            const rawDate = getVal("dateTime");
            const timeZoneVal = getVal("timeZone");
            let fullDateTime = "정보 없음";
            let displayDate = "날짜 정보 없음";

            if (rawDate && rawDate !== "N/A" && rawDate !== "1970:01:01 00:00:00") {
                const d = new Date(rawDate);
                // 상세 포맷: 0000년 00월 00일 00시 00분
                fullDateTime = `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 ` +
                               `${String(d.getHours()).padStart(2, '0')}시 ${String(d.getMinutes()).padStart(2, '0')}분`;
                
                // 갤러리 메타용: YYYY.MM.DD
                displayDate = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
            }

            // --- 3. 위치 정보 및 주소 처리 ---
            const address = getVal("address");
            const lat = getVal("lat");
            const lon = getVal("lon");
            const locationLink = (lat !== "" && lon !== "" && lat !== "N/A") 
                ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` 
                : null;

            const w = parseInt(getVal("width"));
            const h = parseInt(getVal("height"));
            const extension = fileName.split('.').pop().toUpperCase();
            const aspectRatio = h / w;

            return {
                fileName,
                extension,
                aspectRatio,
                displayName: fileName.split('.').slice(0, -1).join('.').replace(/_/g, ' '),
                originalSrc: `./img/${fileName}`,
                thumbSrc: `./img/thumb/${fileName}`,
                rgb: getVal("rgb") || "17,17,17",
                theme: getVal("theme") || "dark",
                make: getVal("make"),
                model: getVal("model"),
                iso: getVal("iso"),
                fNumber: getVal("fNumber"),
                exposureTime: getVal("exposureTime"),
                focalLength: focalLength,
                focal35mm: focal35mm,
                timeZone: (timeZoneVal !== "N/A" && timeZoneVal !== "") ? `UTC ${timeZoneVal}` : "N/A",
                displayDate,
                fullDateTime,
                dateTime: rawDate,
                fileSize: getVal("fileSize"),
                resolution: `${w} x ${h}`,
                megapixels: (w * h / 1000000).toFixed(1) + "M",
                software: getVal("software"),
                address: (address !== "N/A" && address !== "") ? address : "위치 정보 없음",
                locationLink
            };
        });

        validResults.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
        renderGallery(section);

    } catch (error) {
        console.error("데이터 로드 중 오류 발생:", error);
    } finally {
        loadingOverlay.classList.add('fade-out');
    }

    initGlobalEvents();

    window.addEventListener('resize', () => {
        const width = window.innerWidth;
        let cols = 3;
        if (width <= 600) cols = 1;
        else if (width <= 1024) cols = 2;
        else if (width <= 1440) cols = 3;
        else if (width <= 1920) cols = 4;
        else cols = 5;

        if (cols !== currentColumns) {
            renderGallery(section);
        }
    });
});

function renderGallery(container) {
    container.innerHTML = '';
    const width = window.innerWidth;
    if (width <= 600) currentColumns = 1;
    else if (width <= 1024) currentColumns = 2;
    else if (width <= 1440) currentColumns = 3;
    else if (width <= 1920) currentColumns = 4;
    else currentColumns = 5;

    const columns = [];
    const colHeights = new Array(currentColumns).fill(0);

    for (let i = 0; i < currentColumns; i++) {
        const col = document.createElement('div');
        col.className = 'gallery-column';
        columns.push(col);
        container.appendChild(col);
    }

    validResults.forEach((data, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `
            <div class="img-container">
                <img src="${data.thumbSrc}" alt="${data.displayName}" loading="lazy">
                <div class="hover-overlay">
                    <h3>${data.displayName}</h3>
                    <p class="meta-info">${data.make} ${data.model} • ${data.megapixels} • ${data.fileSize}</p>
                    <div class="exif-grid">
                        <div class="exif-item"><i class="fa-solid fa-crosshairs"></i> ${data.focal35mm}</div>
                        <div class="exif-item"><i class="fa-solid fa-circle-dot"></i> f/${data.fNumber}</div>
                        <div class="exif-item"><i class="fa-regular fa-clock"></i> ${data.exposureTime}s</div>
                        <div class="exif-item"><i class="fa-solid fa-film"></i> ISO ${data.iso}</div>
                    </div>
                </div>
            </div>
        `;
        item.addEventListener('click', () => openModal(index));

        const shortestColIndex = colHeights.indexOf(Math.min(...colHeights));
        columns[shortestColIndex].appendChild(item);
        colHeights[shortestColIndex] += data.aspectRatio;
    });
}

function openModal(index) {
    currentImageIndex = index;
    const modal = document.getElementById('info-modal');
    const data = validResults[index];

    document.body.classList.add('no-scroll');
    updateModalUI(data);
    modal.classList.add('show');
}

function updateModalUI(data) {
    const modal = document.getElementById('info-modal');
    const modalBody = document.getElementById('modal-body');

    modal.className = `modal show ${data.theme}-theme`;
    modal.style.backgroundColor = `rgba(${data.rgb}, 1)`;

    // 주소 텍스트 자체에 링크를 걸고 아이콘을 제거함
    const locationHTML = data.locationLink 
        ? `<a href="${data.locationLink}" target="_blank" style="color:inherit; text-decoration:underline;">${data.address}</a>` 
        : data.address;

    modalBody.innerHTML = `
        <div class="modal-image-container">
            <img class="placeholder" id="modal-img-low" src="${data.thumbSrc}">
            <img class="full-image" id="modal-img-high">
            <div class="nav-btn prev-btn" onclick="changeImage(-1)"><i class="fa-solid fa-angle-left"></i></div>
            <div class="nav-btn next-btn" onclick="changeImage(1)"><i class="fa-solid fa-angle-right"></i></div>
            <div class="nav-btn info-btn"><i class="fa-solid fa-info"></i></div>
        </div>
        <div class="modal-info-container">
            <h2>${data.displayName}</h2>
            <div class="modal-basic-info">
                <span><i class="fa-solid fa-camera"></i> ${data.make} ${data.model}</span>
                <span><i class="fa-regular fa-image"></i> ${data.megapixels} • ${data.extension}</span>
                <span><i class="fa-solid fa-location-dot"></i> ${locationHTML}</span>
            </div>
            <div class="modal-details">
                ${renderDetailItem("Date & Time", data.fullDateTime)}
                ${renderDetailItem("Time Zone", data.timeZone)}
                ${renderDetailItem("35mm Equiv.", data.focal35mm)}
                ${renderDetailItem("Focal Length", data.focalLength)}
                ${renderDetailItem("Aperture", `f/${data.fNumber}`)}
                ${renderDetailItem("Shutter Speed", `${data.exposureTime}s`)}
                ${renderDetailItem("ISO", data.iso)}
                ${renderDetailItem("Resolution", data.resolution)}
                ${renderDetailItem("File Size", data.fileSize)}
                ${renderDetailItem("Software", data.software)}
            </div>
        </div>
    `;

    const infoBtn = modalBody.querySelector('.info-btn');
    const infoBox = modalBody.querySelector('.modal-info-container');
    if (infoBtn) {
        infoBtn.onclick = (e) => {
            e.stopPropagation();
            infoBox.classList.toggle('show-info');
        };
    }

    const highImg = document.getElementById('modal-img-high');
    const lowImg = document.getElementById('modal-img-low');

    highImg.style.opacity = '0';
    highImg.src = data.originalSrc;
    highImg.onload = () => {
        highImg.style.opacity = '1';
        setTimeout(() => { if (lowImg) lowImg.style.opacity = '0'; }, 100);
    };
}

function renderDetailItem(label, value) {
    if(!value || value === "N/A" || value.trim() === "") return ""; 
    return `<div class="detail-item"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div>`;
}

function changeImage(step) {
    currentImageIndex = (currentImageIndex + step + validResults.length) % validResults.length;
    updateModalUI(validResults[currentImageIndex]);
}

function initGlobalEvents() {
    const modal = document.getElementById('info-modal');
    const closeBtn = document.querySelector('.close-btn');

    const closeModal = () => {
        modal.classList.remove('show');
        document.body.classList.remove('no-scroll');
    };

    closeBtn.onclick = closeModal;
    window.onclick = (e) => { if (e.target === modal) closeModal(); };

    document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('show')) return;
        if (e.key === 'ArrowLeft') changeImage(-1);
        else if (e.key === 'ArrowRight') changeImage(1);
        else if (e.key === 'Escape') closeModal();
    });

    modal.addEventListener('touchstart', e => touchstartX = e.changedTouches[0].screenX, { passive: true });
    modal.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        const infoBox = document.querySelector('.modal-info-container');
        if (!infoBox?.classList.contains('show-info')) {
            if (touchendX < touchstartX - 50) changeImage(1);
            if (touchendX > touchstartX + 50) changeImage(-1);
        }
    }, { passive: true });
}