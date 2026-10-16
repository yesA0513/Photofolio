/** In-page map for photos in the current gallery selection. */
const photoMap = (() => {
    const dialog = document.getElementById('photo-map-dialog');
    const canvas = document.getElementById('photo-map-canvas');
    const status = document.getElementById('photo-map-status');
    const selection = document.getElementById('photo-map-selection');
    let map;
    let tiles;
    let clusters;
    let selectedPhoto;
    let selectPhoto;
    let photos = [];
    let markers = new Map();
    let tileFailed = false;

    function iconFor(photo, count = 1, selected = false) {
        const content = document.createElement('div');
        const thumbnail = document.createElement('img');
        thumbnail.src = photo.thumbSrc;
        thumbnail.alt = '';
        content.appendChild(thumbnail);
        if (count > 1) {
            const badge = document.createElement('span');
            badge.className = 'photo-map-marker-count';
            badge.textContent = count;
            content.appendChild(badge);
        }
        return L.divIcon({
            className: `photo-map-marker${selected ? ' is-selected' : ''}`,
            html: content,
            iconSize: [52, 52],
            iconAnchor: [26, 26],
            popupAnchor: [0, -28]
        });
    }

    function updateStatus() {
        status.textContent = tileFailed
            ? '배경 지도를 불러오지 못했습니다. 연결을 확인한 뒤 지도를 다시 열어 주세요. 사진 위치는 계속 확인할 수 있습니다.'
            : '썸네일을 눌러 사진을 선택하세요. 숫자가 있는 묶음은 누르면 펼쳐집니다.';
    }

    function initialize() {
        if (map) return;
        map = L.map(canvas, { scrollWheelZoom: true, maxZoom: 19 });
        tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
        });
        tiles.on('loading', () => { tileFailed = false; });
        tiles.on('tileerror', () => { tileFailed = true; updateStatus(); });
        tiles.on('load', updateStatus);
        tiles.addTo(map);
        clusters = L.markerClusterGroup({
            maxClusterRadius: 56,
            showCoverageOnHover: false,
            spiderfyDistanceMultiplier: 2,
            iconCreateFunction(cluster) {
                const children = cluster.getAllChildMarkers();
                const active = children.find(marker => marker.photo === selectedPhoto);
                const representative = active || children[0];
                return iconFor(representative.photo, children.length, Boolean(active));
            }
        }).addTo(map);
        new ResizeObserver(() => {
            if (dialog.open) map.invalidateSize({ pan: false });
        }).observe(canvas);
    }

    function select(photo) {
        selectedPhoto = photo;
        selection.hidden = false;
        const preview = document.getElementById('photo-map-preview');
        preview.src = photo.thumbSrc;
        preview.alt = photo.displayName;
        document.getElementById('photo-map-photo-name').textContent = photo.displayName;
        document.getElementById('photo-map-photo-address').textContent = photo.address;
        markers.forEach((marker, key) => {
            marker.setIcon(iconFor(marker.photo, 1, key === photo.fileName));
            marker.setZIndexOffset(key === photo.fileName ? 1000 : 0);
        });
        clusters.refreshClusters();
    }

    function showPhoto() {
        const photo = selectedPhoto;
        close();
        selectPhoto(photo);
    }

    function showSelected() {
        if (!map || !selectedPhoto) return;
        map.setView(selectedPhoto.coordinates, 16, { animate: false });
        const marker = markers.get(selectedPhoto.fileName);
        clusters.zoomToShowLayer(marker, () => {
            // Let the cluster finish its zoom/spiderfy cycle before opening.
            requestAnimationFrame(() => {
                if (dialog.open && marker.photo === selectedPhoto) marker.openPopup();
            });
        });
    }

    function open(photo, galleryPhotos, onSelect) {
        if (!photo.coordinates || dialog.open) return;
        photos = galleryPhotos.filter(candidate => candidate.coordinates);
        selectPhoto = onSelect;
        selectedPhoto = photo;
        dialog.showModal();
        history.pushState({ ...history.state, modalOpen: true, photoMapOpen: true }, '');
        document.getElementById('photo-map-close').focus();
        document.getElementById('photo-map-description').textContent = `현재 갤러리에서 위치가 있는 사진 ${photos.length}장`;
        const available = Boolean(window.L?.markerClusterGroup);
        document.getElementById('photo-map-show-all').disabled = !available;
        document.getElementById('photo-map-show-selected').disabled = !available;
        selection.hidden = !available;
        if (!available) {
            status.textContent = '지도를 불러오지 못했습니다. 페이지를 새로고침해 주세요.';
            return;
        }
        initialize();
        map.invalidateSize({ pan: false });
        map.setView(photo.coordinates, 16, { animate: false });
        if (tileFailed) tiles.redraw();
        clusters.clearLayers();
        markers = new Map();
        for (const candidate of photos) {
            const marker = L.marker(candidate.coordinates, {
                icon: iconFor(candidate),
                title: candidate.displayName,
                alt: `${candidate.displayName} 사진 위치`,
                keyboard: true
            });
            marker.photo = candidate;
            const popup = document.createElement('button');
            popup.type = 'button';
            popup.className = 'photo-map-popup-button';
            const thumbnail = document.createElement('img');
            thumbnail.src = candidate.thumbSrc;
            thumbnail.alt = '';
            const label = document.createElement('span');
            label.textContent = `${candidate.displayName} · 이 사진 보기`;
            popup.append(thumbnail, label);
            popup.addEventListener('click', showPhoto);
            marker.bindPopup(popup);
            marker.on('click', () => select(candidate));
            markers.set(candidate.fileName, marker);
            clusters.addLayer(marker);
        }
        select(photo);
        updateStatus();
    }

    function close(updateHistory = true) {
        if (!dialog.open) return;
        map?.closePopup();
        dialog.close();
        if (updateHistory && history.state?.photoMapOpen) history.back();
    }

    document.getElementById('photo-map-close').addEventListener('click', () => close());
    document.getElementById('photo-map-open-photo').addEventListener('click', showPhoto);
    document.getElementById('photo-map-show-selected').addEventListener('click', showSelected);
    document.getElementById('photo-map-show-all').addEventListener('click', () => {
        if (map && photos.length) map.fitBounds(photos.map(photo => photo.coordinates), {
            padding: [50, 50], maxZoom: 16, animate: false
        });
    });
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    dialog.addEventListener('click', e => { if (e.target === dialog) close(); });

    return { open, close, isOpen: () => dialog.open };
})();
