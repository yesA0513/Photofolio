const imageList = [
    "Airplane.JPG",
    "Beauty of Hanok.JPG",
    "Boat.jpg",
    "Branch.jpg",
    "Fukuoka Tower.jpg",
    "Gyeongbokgung.JPG",
    "Gwanggyo Lake Park.jpg",
    "History of Joseon.JPG",
    "Holy.jpg",
    "LifeBoat.JPG",
    "Meow.jpg",
    "Paldang Mulangae Park.JPG",
    "Roatry Tiller.JPG",
    "Seongsan Ilchulbong.jpg",
    "Seoul.JPG",
    "Shelter.JPG",
    "Shoreline Park.JPG",
    "Stanford.jpg",
    "Sunrise.JPG",
    "Wish.jpg",
    "Sapporo TV Tower.jpg",
    "Otaru Canal.JPG",
    "Ginkaku-ji.jpg",
    "Night City.JPG"
];

let validResults = [];
let currentImageIndex = 0;

document.addEventListener("DOMContentLoaded", async function() {
    const section = document.getElementById('gallery-section');
    const loadingOverlay = document.getElementById('loading-overlay');
    const modal = document.getElementById('info-modal');
    const closeBtn = document.querySelector('.close-btn');

    const closeModal = () => {
        modal.classList.remove('show');
        document.body.classList.remove('no-scroll'); // 모달 닫을 때 스크롤 복구
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.style.backgroundColor = '';
            modalContent.classList.remove('light-theme', 'dark-theme');
        }
        modal.classList.remove('light-theme', 'dark-theme');
        // reset overlay background
        modal.style.backgroundColor = '';
    };

    closeBtn.onclick = closeModal;

    window.onclick = function(event) {
        if (event.target == modal) closeModal();
    }

    // prev/next buttons are injected into modal content per-image, attach listeners after rendering

    document.addEventListener('keydown', function(e) {
        if (!modal.classList.contains('show')) return; 
        if (e.key === 'ArrowLeft') showPrevImage();
        else if (e.key === 'ArrowRight') showNextImage();
        else if (e.key === 'Escape') closeModal();
    });

    const colorThief = new ColorThief();

    const imageDataPromises = imageList.map(fileName => {
        return new Promise(async (resolve) => {
            const originalSrc = `./img/${fileName}`;
            const thumbSrc = `./img/thumb/${fileName}`;
            let fileSize = "확인 불가";
            
            try {
                const response = await fetch(originalSrc, { method: 'HEAD' });
                const bytes = response.headers.get('content-length');
                if (bytes) fileSize = (bytes / (1024 * 1024)).toFixed(2) + " MB";
            } catch (e) {}

            // 로딩 속도 최적화: 용량이 작은 썸네일에서 주요 색상을 먼저 추출합니다.
            const thumbImg = new Image();
            thumbImg.src = thumbSrc;
            
            thumbImg.onload = function() {
                let dominantRgb = [17, 17, 17];
                let theme = 'dark';
                
                try {
                    dominantRgb = colorThief.getColor(thumbImg);
                    const brightness = 0.2126 * dominantRgb[0] + 0.7152 * dominantRgb[1] + 0.0722 * dominantRgb[2];
                    theme = brightness > 150 ? 'light' : 'dark';
                } catch(e) {}

                // 색상 추출 후 EXIF를 읽기 위해 원본을 불러옵니다.
                const origImg = new Image();
                origImg.src = originalSrc;
                origImg.onload = function() {
                    EXIF.getData(origImg, async function() {
                        const make = EXIF.getTag(this, "Make") || "Unknown";
                        const model = EXIF.getTag(this, "Model") || "";
                        const iso = EXIF.getTag(this, "ISOSpeedRatings") || "N/A";
                        
                        let fNumber = EXIF.getTag(this, "FNumber");
                        let exposureTime = EXIF.getTag(this, "ExposureTime");
                        let focalLength = EXIF.getTag(this, "FocalLength");
                        let dateTime = EXIF.getTag(this, "DateTimeOriginal") || EXIF.getTag(this, "DateTime") || "1970:01:01 00:00:00";

                        if (fNumber) fNumber = (fNumber.numerator / fNumber.denominator).toFixed(1);
                        if (exposureTime) exposureTime = exposureTime < 1 ? "1/" + Math.round(1 / exposureTime) : exposureTime;
                        else exposureTime = "N/A";
                        if (focalLength) focalLength = Math.round(focalLength.numerator / focalLength.denominator) + "mm";
                        else focalLength = "N/A";

                        let displayDate = "날짜 정보 없음";
                        if (dateTime !== "1970:01:01 00:00:00") {
                            const dateParts = dateTime.split(" ")[0].split(":");
                            displayDate = `${dateParts[0]}.${dateParts[1]}.${dateParts[2]}`;
                        }

                        const resolution = `${origImg.naturalWidth} x ${origImg.naturalHeight}`;
                        const megapixels = (origImg.naturalWidth * origImg.naturalHeight / 1000000).toFixed(1) + "M";

                        let flash = EXIF.getTag(this, "Flash");
                        let flashStr = flash !== undefined ? ((flash % 2 !== 0) ? "On" : "Off") : "N/A";

                        let expBias = EXIF.getTag(this, "ExposureBiasValue");
                        let expBiasStr = "0 EV";
                        if (expBias) {
                            let val = expBias.numerator / expBias.denominator;
                            expBiasStr = (val > 0 ? "+" : "") + val.toFixed(2) + " EV";
                        }

                        let wb = EXIF.getTag(this, "WhiteBalance");
                        let wbStr = wb === 1 ? "Manual" : (wb === 0 ? "Auto" : "N/A");

                        let meter = EXIF.getTag(this, "MeteringMode");
                        let meterStr = "N/A";
                        if (meter === 2) meterStr = "Center-weighted";
                        else if (meter === 3) meterStr = "Spot";
                        else if (meter === 5) meterStr = "Pattern";

                        let lensModel = EXIF.getTag(this, "LensModel") || "N/A";
                        let software = EXIF.getTag(this, "Software") || "N/A";

                        let addressHtml = ``;
                        const lat = EXIF.getTag(this, "GPSLatitude");
                        const latRef = EXIF.getTag(this, "GPSLatitudeRef");
                        const lon = EXIF.getTag(this, "GPSLongitude");
                        const lonRef = EXIF.getTag(this, "GPSLongitudeRef");

                        if (lat && lon) {
                            const latitude = convertDMSToDD(lat[0], lat[1], lat[2], latRef);
                            const longitude = convertDMSToDD(lon[0], lon[1], lon[2], lonRef);
                            const address = await getAddress(latitude, longitude);
                            addressHtml = `
                                <span><i class="fa-solid fa-location-dot"></i> <a href="https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}" target="_blank">${address}</a></span>
                            `;
                        }

                        resolve({
                            fileName, originalSrc, thumbSrc,
                            displayName: fileName.substring(0, fileName.lastIndexOf('.')).replace(/_/g, ' '),
                            make, model, iso, fNumber, exposureTime, focalLength, dateTime, displayDate, resolution, megapixels, fileSize,
                            flashStr, expBiasStr, wbStr, meterStr, lensModel, software, addressHtml,
                            dominantRgb, theme
                        });
                    });
                };
                origImg.onerror = () => resolve(null);
            };
            thumbImg.onerror = () => resolve(null);
        });
    });

    const results = await Promise.all(imageDataPromises);
    validResults = results.filter(res => res !== null);

    validResults.sort((a, b) => b.dateTime.localeCompare(a.dateTime));

    validResults.forEach((data, index) => {
        const wrapperDiv = document.createElement('div');
        wrapperDiv.className = 'gallery-item';
        
        wrapperDiv.innerHTML = `
            <div class="img-container">
                <img src="${data.thumbSrc}" alt="${data.displayName}" loading="lazy">
                <div class="hover-overlay">
                    <h3>${data.displayName}</h3>
                    <p class="meta-info">JPG • ${data.megapixels} • ${data.fileSize}</p>
                    <div class="exif-grid">
                        <div class="exif-item"><i class="fa-solid fa-crosshairs"></i> ${data.focalLength}</div>
                        <div class="exif-item"><i class="fa-solid fa-circle-dot"></i> f/${data.fNumber}</div>
                        <div class="exif-item"><i class="fa-regular fa-clock"></i> ${data.exposureTime}s</div>
                        <div class="exif-item"><i class="fa-solid fa-film"></i> ISO ${data.iso}</div>
                    </div>
                </div>
            </div>
        `;

        wrapperDiv.addEventListener('click', () => {
            currentImageIndex = index;
            updateModalContent();
        });

        section.appendChild(wrapperDiv);
    });

    loadingOverlay.classList.add('fade-out');
});

function updateModalContent() {
    const modal = document.getElementById('info-modal');
    const modalBody = document.getElementById('modal-body');
    const data = validResults[currentImageIndex];

    // 모달을 열 때 뒤 배경화면 스크롤 잠금
    document.body.classList.add('no-scroll');

    // apply single-color overlay (modal) and keep modal-content transparent so it's a single tone
    modal.classList.remove('light-theme', 'dark-theme');
    modal.classList.add(`${data.theme}-theme`);
    modal.style.backgroundColor = `rgba(${data.dominantRgb[0]}, ${data.dominantRgb[1]}, ${data.dominantRgb[2]}, 0.95)`;
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) modalContent.style.backgroundColor = 'transparent';

    modalBody.innerHTML = `
        <div class="modal-image-container" id="panzoom-parent">
            <img class="placeholder" id="modal-img-low" src="${data.thumbSrc}" alt="${data.displayName}">
            <img class="full-image" id="modal-img-high" src="" alt="${data.displayName}">
            <div class="nav-btn prev-btn"><i class="fa-solid fa-angle-left"></i></div>
            <div class="nav-btn next-btn"><i class="fa-solid fa-angle-right"></i></div>
        </div>
        <div class="modal-info-container">
            <h2>${data.displayName}</h2>
            <div class="modal-basic-info">
                <span><i class="fa-regular fa-calendar"></i> ${data.displayDate}</span>
                <span><i class="fa-solid fa-camera"></i> ${data.make} ${data.model}</span>
                ${data.addressHtml}
            </div>
            <div class="modal-details">
                <div class="detail-item"><span class="detail-label">Focal Length</span><span class="detail-value">${data.focalLength}</span></div>
                <div class="detail-item"><span class="detail-label">Aperture</span><span class="detail-value">f/${data.fNumber}</span></div>
                <div class="detail-item"><span class="detail-label">Shutter Speed</span><span class="detail-value">${data.exposureTime}s</span></div>
                <div class="detail-item"><span class="detail-label">ISO</span><span class="detail-value">${data.iso}</span></div>
                <div class="detail-item"><span class="detail-label">Exposure Bias</span><span class="detail-value">${data.expBiasStr}</span></div>
                <div class="detail-item"><span class="detail-label">Flash</span><span class="detail-value">${data.flashStr}</span></div>
                <div class="detail-item"><span class="detail-label">White Balance</span><span class="detail-value">${data.wbStr}</span></div>
                <div class="detail-item"><span class="detail-label">Metering Mode</span><span class="detail-value">${data.meterStr}</span></div>
                <div class="detail-item"><span class="detail-label">Resolution</span><span class="detail-value">${data.resolution}</span></div>
                <div class="detail-item"><span class="detail-label">File Size</span><span class="detail-value">${data.fileSize}</span></div>
                <div class="detail-item"><span class="detail-label">Software</span><span class="detail-value">${data.software}</span></div>
            </div>
        </div>
    `;

    modal.classList.add('show');

    // attach nav button listeners (they were just injected)
    const prevBtnEl = modal.querySelector('.prev-btn');
    const nextBtnEl = modal.querySelector('.next-btn');
    if (prevBtnEl) prevBtnEl.onclick = showPrevImage;
    if (nextBtnEl) nextBtnEl.onclick = showNextImage;

    const lowImg = document.getElementById('modal-img-low');
    const highImg = document.getElementById('modal-img-high');
    // 부드러운 크로스페이드: 미리보기(블러) 위에 고해상도 이미지를 로드 후 서서히 보여줌
    const highResImg = new Image();
    highResImg.src = data.originalSrc;
    highResImg.onload = () => {
        highImg.src = highResImg.src;
        // force reflow to ensure transition
        void highImg.offsetWidth;
        highImg.style.opacity = '1';
        // fade out placeholder slightly later
        setTimeout(() => {
            if (lowImg) lowImg.style.opacity = '0';
        }, 60);
        // after transition, remove blur on low image for crisp fallback
        setTimeout(() => {
            if (lowImg) lowImg.style.filter = 'none';
        }, 500);
    };
    // set modal (overlay) background to dominant color for full-screen cover
    modal.style.backgroundColor = `rgba(${data.dominantRgb[0]}, ${data.dominantRgb[1]}, ${data.dominantRgb[2]}, 1)`;
}

function showNextImage() {
    currentImageIndex = (currentImageIndex + 1) % validResults.length;
    updateModalContent();
}

function showPrevImage() {
    currentImageIndex = (currentImageIndex - 1 + validResults.length) % validResults.length;
    updateModalContent();
}

function convertDMSToDD(degrees, minutes, seconds, direction) {
    let deg = degrees.numerator / degrees.denominator;
    let min = minutes.numerator / minutes.denominator;
    let sec = seconds.numerator / seconds.denominator;
    let dd = deg + (min / 60) + (sec / 3600);
    if (direction === "S" || direction === "W") dd = dd * -1;
    return dd;
}

async function getAddress(lat, lon) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=en`);
        const data = await response.json();
        if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.province || data.address.state || "";
            const country = data.address.country || "";
            return [city, country].filter(Boolean).join(", ") || "Unknown Location";
        }
        return "Unknown Location";
    } catch (error) {
        return "Location Info Unavailable";
    }
}