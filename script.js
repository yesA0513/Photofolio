/**
 * Photofolio - Client Side Script
 */

let validResults = [];
let visibleResults = [];
let locationGroups = [];
let galleryView = 'all';
let selectedLocation = '';
let currentImageIndex = 0;
let currentColumns = 0;
let imageZoom = 1;
let imagePanX = 0;
let imagePanY = 0;

document.addEventListener("DOMContentLoaded", async () => {
    const section = document.getElementById('gallery-section');
    const loadingOverlay = document.getElementById('loading-overlay');

    try {
        const response = await fetch('photo_data.xml');
        if (!response.ok) throw new Error(`사진 정보를 불러오지 못했습니다 (${response.status})`);
        const xmlText = await response.text();
        const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
        if (xmlDoc.querySelector('parsererror')) throw new Error('사진 정보 XML을 읽을 수 없습니다.');
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

            // 💡 수정됨: rawDate.trim() !== "" 조건 추가 및 유효한 날짜인지 검사 로직 추가
            if (rawDate && rawDate !== "N/A" && rawDate !== "1970:01:01 00:00:00" && rawDate.trim() !== "") {
                const d = new Date(rawDate);
                
                // 💡 날짜 객체가 유효한 경우(NaN이 아닌 경우)에만 문자열 조립
                if (!isNaN(d.getTime())) {
                    // 상세 포맷: 0000년 00월 00일 00시 00분
                    fullDateTime = `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일 ` +
                                   `${String(d.getHours()).padStart(2, '0')}시 ${String(d.getMinutes()).padStart(2, '0')}분`;
                    
                    // 갤러리 메타용: YYYY.MM.DD
                    displayDate = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
                }
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
                locationGroup: getLocationGroup(address),
                locationLink
            };
        });

        validResults.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
        document.getElementById('photo-count').textContent = validResults.length;
        initLocationControls(section);
        renderGallery(section);

    } catch (error) {
        console.error("데이터 로드 중 오류 발생:", error);
        document.getElementById('gallery-summary').textContent = '사진 정보를 불러오지 못했습니다. 페이지를 새로고침해 주세요.';
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

function getLocationGroup(address) {
    const normalized = address.trim().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ');
    return !normalized || /^(n\/a|unknown(?: location)?)$/i.test(normalized)
        ? '위치 정보 없음'
        : normalized;
}

function initLocationControls(container) {
    const groups = new Map();
    for (const photo of validResults) {
        if (!groups.has(photo.locationGroup)) groups.set(photo.locationGroup, []);
        groups.get(photo.locationGroup).push(photo);
    }
    locationGroups = Array.from(groups, ([name, photos]) => ({ name, photos })).sort((a, b) => {
        if (a.name === '위치 정보 없음') return 1;
        if (b.name === '위치 정보 없음') return -1;
        return b.photos.length - a.photos.length || a.name.localeCompare(b.name, 'ko');
    });

    const filter = document.getElementById('location-filter');
    filter.replaceChildren(new Option(`전체 지역 (${validResults.length}장)`, ''));
    for (const group of locationGroups) {
        filter.add(new Option(`${group.name} (${group.photos.length}장)`, group.name));
    }
    filter.addEventListener('change', () => {
        selectedLocation = filter.value;
        renderGallery(container);
    });
    document.querySelectorAll('[data-gallery-view]').forEach(button => {
        button.addEventListener('click', () => {
            galleryView = button.dataset.galleryView;
            document.querySelectorAll('[data-gallery-view]').forEach(control => {
                control.setAttribute('aria-pressed', String(control === button));
            });
            document.querySelector('.location-filter').hidden = galleryView !== 'location';
            renderGallery(container);
        });
    });
}

function renderGallery(container) {
    container.innerHTML = '';
    const width = window.innerWidth;
    if (width <= 600) currentColumns = 1;
    else if (width <= 1024) currentColumns = 2;
    else if (width <= 1440) currentColumns = 3;
    else if (width <= 1920) currentColumns = 4;
    else currentColumns = 5;

    const grouped = galleryView === 'location';
    container.classList.toggle('gallery-grouped', grouped);
    const groups = locationGroups.filter(group => !selectedLocation || group.name === selectedLocation);
    visibleResults = grouped ? groups.flatMap(group => group.photos) : validResults;
    const summary = document.getElementById('gallery-summary');
    if (!visibleResults.length) {
        summary.textContent = '표시할 사진이 없습니다.';
        return;
    }
    if (!grouped) {
        summary.textContent = `전체 ${visibleResults.length}장`;
        renderPhotoColumns(container, visibleResults);
        return;
    }

    const knownGroups = groups.filter(group => group.name !== '위치 정보 없음');
    const unknownCount = groups.find(group => group.name === '위치 정보 없음')?.photos.length || 0;
    summary.textContent = selectedLocation
        ? `${selectedLocation} · ${visibleResults.length}장`
        : `${knownGroups.length}개 지역 · 전체 ${visibleResults.length}장${unknownCount ? ` · 위치 정보 없음 ${unknownCount}장` : ''}`;
    let startIndex = 0;
    for (const group of groups) {
        const section = document.createElement('div');
        section.className = 'location-group';
        const heading = document.createElement('h2');
        heading.className = 'location-heading';
        heading.textContent = group.name;
        const count = document.createElement('span');
        count.className = 'location-count';
        count.textContent = `${group.photos.length}장`;
        heading.appendChild(count);
        const grid = document.createElement('div');
        grid.className = 'gallery-grid';
        section.append(heading, grid);
        container.appendChild(section);
        renderPhotoColumns(grid, group.photos, startIndex);
        startIndex += group.photos.length;
    }
}

function renderPhotoColumns(container, photos, startIndex = 0) {
    const columns = [];
    const colHeights = new Array(currentColumns).fill(0);

    for (let i = 0; i < currentColumns; i++) {
        const col = document.createElement('div');
        col.className = 'gallery-column';
        columns.push(col);
        container.appendChild(col);
    }

    photos.forEach((data, index) => {
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
        item.addEventListener('click', () => openModal(startIndex + index));

        const shortestColIndex = colHeights.indexOf(Math.min(...colHeights));
        columns[shortestColIndex].appendChild(item);
        colHeights[shortestColIndex] += data.aspectRatio;
    });
}

function openModal(index) {
    currentImageIndex = index;
    const modal = document.getElementById('info-modal');
    const data = visibleResults[index];

    document.body.classList.add('no-scroll');
    updateModalUI(data);
    modal.classList.add('show');

    // 💡 핵심: 모달이 열릴 때 브라우저 히스토리에 가짜 기록(상태)을 하나 추가합니다.
    history.pushState({ modalOpen: true }, "");
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
            <div class="modal-placeholder">
                <img class="placeholder" id="modal-img-low" src="${data.thumbSrc}">
            </div>
            <img class="full-image" id="modal-img-high">
            
            <div id="high-res-loader" class="high-res-loader">
                고화질로 불러오는 중...
            </div>

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
                ${renderDetailItem("촬영 일시", data.fullDateTime)}
                ${renderDetailItem("시간대", data.timeZone)}
                ${renderDetailItem("35mm 환산 화각", data.focal35mm)}
                ${renderDetailItem("화각", data.focalLength)}
                ${renderDetailItem("조리개", `f/${data.fNumber}`)}
                ${renderDetailItem("셔터 속도", `${data.exposureTime}s`)}
                ${renderDetailItem("ISO", data.iso)}
                ${renderDetailItem("크기", data.resolution)}
                ${renderDetailItem("파일 크기", data.fileSize)}
                ${renderDetailItem("소프트웨어", data.software)}
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
    const loader = document.getElementById('high-res-loader');

    // Each photo opens at its natural size so a zoom does not carry over.
    setImageZoom(1);

    highImg.style.opacity = '0';
    if (loader) loader.style.opacity = '1';

    const showOriginal = () => {
        if (!highImg.isConnected || !highImg.naturalWidth) return;
        highImg.style.opacity = '1';
        lowImg.style.opacity = '0';
        
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);
        }
        
    };

    // Register before assigning src, including when the original is cached.
    highImg.onload = async () => {
        try {
            await highImg.decode();
            showOriginal();
        } catch {
            showLoadError();
        }
    };
    const showLoadError = () => {
        if (loader && highImg.isConnected) {
            loader.textContent = '원본 사진을 불러오지 못했습니다. 사진을 다시 열어 주세요.';
        }
    };
    highImg.onerror = showLoadError;
    highImg.src = data.originalSrc;
}

function setImageZoom(scale) {
    imageZoom = Math.min(Math.max(scale, 1), 3);
    if (imageZoom === 1) {
        imagePanX = 0;
        imagePanY = 0;
    }
    setImageTransform();
}

function setImagePan(x, y) {
    const imageContainer = document.querySelector('.modal-image-container');
    if (!imageContainer) return;

    const image = [document.getElementById('modal-img-high'), document.getElementById('modal-img-low')]
        .find(candidate => candidate?.naturalWidth && candidate?.naturalHeight);
    const aspectRatio = image?.naturalWidth && image?.naturalHeight
        ? image.naturalWidth / image.naturalHeight
        : imageContainer.clientWidth / imageContainer.clientHeight;
    const containerRatio = imageContainer.clientWidth / imageContainer.clientHeight;
    const displayedWidth = aspectRatio > containerRatio
        ? imageContainer.clientWidth
        : imageContainer.clientHeight * aspectRatio;
    const displayedHeight = aspectRatio > containerRatio
        ? imageContainer.clientWidth / aspectRatio
        : imageContainer.clientHeight;

    // Limit movement to the enlarged photo itself, including letterboxed images.
    const maxX = (displayedWidth * (imageZoom - 1)) / 2;
    const maxY = (displayedHeight * (imageZoom - 1)) / 2;
    imagePanX = Math.min(Math.max(x, -maxX), maxX);
    imagePanY = Math.min(Math.max(y, -maxY), maxY);
    setImageTransform();
}

function setImageTransform() {
    document.querySelector('.modal-image-container')?.classList.toggle('is-zoomed', imageZoom > 1);
    document.querySelectorAll('#modal-img-low, #modal-img-high').forEach(img => {
        img.style.transform = `translate(${imagePanX}px, ${imagePanY}px) scale(${imageZoom})`;
    });
}

function touchDistance(touches) {
    const [first, second] = touches;
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
}

function renderDetailItem(label, value) {
    if(!value || value === "N/A" || value.trim() === "") return ""; 
    return `<div class="detail-item"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div>`;
}

function changeImage(step) {
    if (!visibleResults.length) return;
    currentImageIndex = (currentImageIndex + step + visibleResults.length) % visibleResults.length;
    updateModalUI(visibleResults[currentImageIndex]);
}

function initGlobalEvents() {
    const modal = document.getElementById('info-modal');
    const closeBtn = document.querySelector('.close-btn');

    // 💡 isFromPopState: 뒤로가기 버튼에 의해 실행된 것인지 확인하는 플래그
    const closeModal = (isFromPopState = false) => {
        if (!modal.classList.contains('show')) return;
        
        modal.classList.remove('show');
        document.body.classList.remove('no-scroll');
        
        // 정보 창이 띄워져 있다면 함께 닫아줍니다.
        const infoBox = document.querySelector('.modal-info-container');
        if (infoBox) infoBox.classList.remove('show-info');

        // 직접 닫기 버튼을 누른 경우, 꼬이지 않게 히스토리(뒤로가기 기록)도 한 칸 지워줍니다.
        if (!isFromPopState && history.state?.modalOpen) {
            history.back();
        }
    };

    closeBtn.onclick = () => closeModal();
    window.onclick = (e) => { if (e.target === modal) closeModal(); };

    // 💡 핵심: 안드로이드/기기의 뒤로가기 버튼을 눌렀을 때 실행되는 이벤트
    window.addEventListener('popstate', () => {
        if (modal.classList.contains('show')) {
            closeModal(true); // 뒤로가기에 의해 닫혔다고 알려줌
        }
    });

    document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('show')) return;
        if (e.key === 'ArrowLeft') changeImage(-1);
        else if (e.key === 'ArrowRight') changeImage(1);
        else if (e.key === 'Escape') closeModal();
    });

    modal.addEventListener('wheel', e => {
        const container = e.target.closest('.modal-image-container');
        if (!modal.classList.contains('show') || !container) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? modal.clientHeight : 1;
        const delta = Math.max(-300, Math.min(300, e.deltaY * unit));
        const bounds = container.getBoundingClientRect();
        const pointerX = e.clientX - bounds.left - bounds.width / 2;
        const pointerY = e.clientY - bounds.top - bounds.height / 2;
        const previousZoom = imageZoom;
        const previousPanX = imagePanX;
        const previousPanY = imagePanY;
        setImageZoom(imageZoom * Math.exp(-delta * 0.002));
        // Keep the image point under the cursor fixed as the scale changes.
        const ratio = imageZoom / previousZoom;
        setImagePan(
            pointerX - (pointerX - previousPanX) * ratio,
            pointerY - (pointerY - previousPanY) * ratio
        );
    }, { passive: false });

    let mouseDrag = null;
    const stopMouseDrag = () => {
        if (!mouseDrag) return;
        const { container, pointerId } = mouseDrag;
        mouseDrag = null;
        container.classList.remove('is-dragging');
        if (container.hasPointerCapture(pointerId)) container.releasePointerCapture(pointerId);
    };

    modal.addEventListener('pointerdown', e => {
        const container = e.target.closest('.modal-image-container');
        if (e.pointerType !== 'mouse' || e.button !== 0 || imageZoom <= 1 ||
            !modal.classList.contains('show') || !container || e.target.closest('.nav-btn')) return;
        e.preventDefault();
        mouseDrag = {
            container, pointerId: e.pointerId,
            startX: e.clientX, startY: e.clientY,
            startPanX: imagePanX, startPanY: imagePanY
        };
        container.setPointerCapture(e.pointerId);
        container.classList.add('is-dragging');
    });
    modal.addEventListener('pointermove', e => {
        if (!mouseDrag || e.pointerId !== mouseDrag.pointerId) return;
        if (!e.buttons || imageZoom <= 1 || !modal.classList.contains('show')) {
            stopMouseDrag();
            return;
        }
        setImagePan(
            mouseDrag.startPanX + e.clientX - mouseDrag.startX,
            mouseDrag.startPanY + e.clientY - mouseDrag.startY
        );
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        modal.addEventListener(event, e => {
            if (e.pointerId === mouseDrag?.pointerId) stopMouseDrag();
        });
    }
    window.addEventListener('blur', stopMouseDrag);
    modal.addEventListener('dragstart', e => {
        if (e.target.closest('.modal-image-container img')) e.preventDefault();
    });

    let gesture = null;

    modal.addEventListener('touchstart', e => {
        if (!e.target.closest('.modal-image-container') || e.target.closest('.nav-btn')) return;

        if (e.touches.length === 2) {
            gesture = {
                isPinching: true,
                startDistance: touchDistance(e.touches),
                startZoom: imageZoom
            };
        } else if (e.touches.length === 1) {
            const touch = e.touches[0];
            gesture = {
                isPinching: false,
                startX: touch.clientX,
                startY: touch.clientY,
                startPanX: imagePanX,
                startPanY: imagePanY
            };
        }
    }, { passive: true });

    modal.addEventListener('touchmove', e => {
        if (!gesture || !e.target.closest('.modal-image-container')) return;

        if (e.touches.length === 2) {
            gesture.isPinching = true;
            setImageZoom(gesture.startZoom * (touchDistance(e.touches) / gesture.startDistance));
            e.preventDefault();
        } else if (e.touches.length === 1 && imageZoom > 1) {
            const touch = e.touches[0];
            setImagePan(
                gesture.startPanX + touch.clientX - gesture.startX,
                gesture.startPanY + touch.clientY - gesture.startY
            );
            e.preventDefault();
        }
    }, { passive: false });

    modal.addEventListener('touchend', e => {
        if (!gesture) return;

        // Continue panning smoothly when a pinch ends with one finger still down.
        if (e.touches.length === 1 && imageZoom > 1) {
            const touch = e.touches[0];
            gesture = {
                isPinching: true,
                startX: touch.clientX,
                startY: touch.clientY,
                startPanX: imagePanX,
                startPanY: imagePanY
            };
            return;
        }

        if (e.touches.length > 0) return;

        const infoBox = document.querySelector('.modal-info-container');
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - gesture.startX;
        const deltaY = touch.clientY - gesture.startY;

        // Pinches and enlarged images are reserved for image inspection,
        // so neither can accidentally trigger the next/previous photo.
        if (!gesture.isPinching && imageZoom === 1 && !infoBox?.classList.contains('show-info') &&
            Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
            changeImage(deltaX < 0 ? 1 : -1);
        }

        gesture = null;
    }, { passive: true });

    modal.addEventListener('touchcancel', () => { gesture = null; }, { passive: true });
}
