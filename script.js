/**
 * Photofolio - Client Side Script
 * 미리 계산된 XML 데이터를 바탕으로 갤러리를 구성하고 모달을 제어합니다.
 */

let validResults = [];
let currentImageIndex = 0;
let touchstartX = 0;
let touchendX = 0;

document.addEventListener("DOMContentLoaded", async () => {
    const section = document.getElementById('gallery-section');
    const loadingOverlay = document.getElementById('loading-overlay');

    try {
        // 1. 데이터 로드 및 파싱
        const response = await fetch('photo_data.xml');
        const xmlText = await response.text();
        const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
        const photos = xmlDoc.getElementsByTagName("photo");

        // 2. 데이터 매핑 (XML -> Object)
        validResults = Array.from(photos).map(photo => {
            const getVal = (tag) => photo.getElementsByTagName(tag)[0]?.textContent || "N/A";
            const fileName = photo.getAttribute("name");

            // 날짜 포맷팅 (YYYY-MM-DD...)
            const rawDate = getVal("dateTime");
            const displayDate = (rawDate && rawDate.trim() !== "" && rawDate !== "1970:01:01 00:00:00")
                ? rawDate.split('T')[0].replace(/-/g, '.').replace(/:/g, '.')
                : "날짜 정보 없음";

            const w = parseInt(getVal("width"));
            const h = parseInt(getVal("height"));

            return {
                fileName,
                displayName: fileName.split('.').slice(0, -1).join('.').replace(/_/g, ' '),
                originalSrc: `./img/${fileName}`,
                thumbSrc: `./img/thumb/${fileName}`,
                // 서버에서 미리 계산된 색상 데이터
                rgb: getVal("rgb") || "17,17,17",
                theme: getVal("theme") || "dark",
                // EXIF 정보
                make: getVal("make"),
                model: getVal("model"),
                iso: getVal("iso"),
                fNumber: getVal("fNumber"),
                exposureTime: getVal("exposureTime"),
                focalLength: getVal("focalLength"),
                displayDate,
                dateTime: rawDate,
                fileSize: getVal("fileSize"),
                resolution: `${w} x ${h}`,
                megapixels: (w * h / 1000000).toFixed(1) + "M",
                expBiasStr: getVal("exposureBias"),
                wbStr: getVal("whiteBalance"),
                meterStr: getVal("meteringMode"),
                flashStr: getVal("flash"),
                software: getVal("software")
            };
        });

        // 3. 날짜 역순 정렬
        validResults.sort((a, b) => b.dateTime.localeCompare(a.dateTime));

        // 4. 갤러리 렌더링
        renderGallery(section);

    } catch (error) {
        console.error("데이터 로드 중 오류 발생:", error);
    } finally {
        loadingOverlay.classList.add('fade-out');
    }

    // 5. 전역 이벤트 리스너 설정
    initGlobalEvents();
});

/**
 * 갤러리 아이템 생성 및 화면 출력
 */
function renderGallery(container) {
    validResults.forEach((data, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `
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
        item.addEventListener('click', () => openModal(index));
        container.appendChild(item);
    });
}

/**
 * 모달 열기 및 내용 업데이트
 */
function openModal(index) {
    currentImageIndex = index;
    const modal = document.getElementById('info-modal');
    const data = validResults[index];

    document.body.classList.add('no-scroll');
    updateModalUI(data); // 💡 여기서 UI와 이미지를 모두 업데이트합니다.
    modal.classList.add('show');
}

/**
 * 모달의 텍스트, 배경색 및 고해상도 이미지 업데이트
 */
function updateModalUI(data) {
    const modal = document.getElementById('info-modal');
    const modalBody = document.getElementById('modal-body');

    // 서버에서 가져온 RGB/테마 즉시 적용
    modal.className = `modal show ${data.theme}-theme`;
    modal.style.backgroundColor = `rgba(${data.rgb}, 1)`;

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
                <span><i class="fa-regular fa-calendar"></i> ${data.displayDate}</span>
                <span><i class="fa-solid fa-camera"></i> ${data.make} ${data.model}</span>
            </div>
            <div class="modal-details">
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

    // 모바일 정보 버튼 이벤트 재설정
    const infoBtn = modalBody.querySelector('.info-btn');
    const infoBox = modalBody.querySelector('.modal-info-container');
    if (infoBtn) {
        infoBtn.onclick = (e) => {
            e.stopPropagation();
            infoBox.classList.toggle('show-info');
        };
    }

    // 💡 원래 openModal에 있던 이미지 로드 로직을 이곳으로 이동시켰습니다!
    const highImg = document.getElementById('modal-img-high');
    const lowImg = document.getElementById('modal-img-low');

    highImg.style.opacity = '0';
    highImg.src = data.originalSrc; // 방향키를 누를 때마다 새로운 고해상도 소스를 요청
    highImg.onload = () => {
        // 로드가 완료되면 블러 처리된 이미지를 서서히 숨기고 고해상도를 보여줌
        highImg.style.opacity = '1';
        setTimeout(() => { if (lowImg) lowImg.style.opacity = '0'; }, 100);
    };
}
function renderDetailItem(label, value) {
    return `<div class="detail-item"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div>`;
}

/**
 * 이미지 변경 (이전/다음)
 */
function changeImage(step) {
    currentImageIndex = (currentImageIndex + step + validResults.length) % validResults.length;
    updateModalUI(validResults[currentImageIndex]);
}

/**
 * 전역 이벤트 (닫기, 키보드, 스와이프)
 */
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

    // 스와이프 감지
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