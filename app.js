let map;
let userLat = null;
let userLng = null;

let markers = [];
let routeLayer = null;
let activeLabel = null;
let activePin = null;

let categories = [];
let allPins = [];

// add pin state
let tempMarker = null;
let tempLat = null;
let tempLng = null;
let addMode = false;
let justOpenedCard = false;


// =====================
// 1. INIT MAP
// =====================
function initMap() {
const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');

const satellite = L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
);

map = L.map('map', {
    center: [41.9981, 21.4254],
    zoom: 13,
    layers: [street]
});

L.control.layers({
    "🗺️ Street": street,
    "🛰️ Satellite": satellite
}).addTo(map);

}


// =====================
// 2. USER LOCATION
// =====================
function getUserLocation() {
    navigator.geolocation.getCurrentPosition((position) => {
        userLat = position.coords.latitude;
        userLng = position.coords.longitude;

        L.marker([userLat, userLng])
            .addTo(map)
            .bindPopup("You are here")
            .openPopup();

        map.setView([userLat, userLng], 14);

    }, (err) => {
        console.error("Location error", err);
    });
}


// =====================
// 3. LOAD PINS
// =====================
async function loadPins() {
    const res = await fetch("https://oracleapex.com/ords/map_project/api/pins/list");
    const data = await res.json();

    allPins = data.items;
    drawPins(allPins);
}


// =====================
// 4. DRAW PINS
// =====================
function drawPins(pins) {

    // clear map
    markers.forEach(obj => {
        map.removeLayer(obj.marker);
        map.removeLayer(obj.label);
    });

    markers = [];

    pins.forEach(pin => {
        addPinToMap({
            id: pin.id,
            name: pin.name,
            description: pin.description,
            groupId: pin.group_id,
            groupName: pin.group_name,
            lat: pin.lat,
            lng: pin.lng,
            opening_time: pin.opening_time,
            closing_time: pin.closing_time,
            working_days: pin.working_days
        });
    });
}


// =====================
// 5. FILTER PINS
// =====================
function filterPins(categoryId) {
    if (!categoryId) {
        drawPins(allPins);
        return;
    }

    const filtered = allPins.filter(p => p.group_id === categoryId);
    drawPins(filtered);
}


// =====================
// 6. ADD PIN TO MAP
// =====================
function addPinToMap(pin) {

    const marker = L.marker([pin.lat, pin.lng]).addTo(map);

    const label = L.marker([pin.lat, pin.lng], {
        icon: L.divIcon({
            className: 'pin-label',
            html: pin.name,
            iconSize: [100, 20],
            iconAnchor: [50, -10]
        })
    }).addTo(map);

    marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e); // 🔥 FIX

        showCard(pin);

        if (activeLabel) {
            map.removeLayer(activeLabel);
        }

        activeLabel = label;
        activePin = pin;
    });


    markers.push({ marker, label, pin });
}


// =====================
// 7. INFO CARD
// =====================
function showCard(pin) {
    const card = document.getElementById("infoCard");
    card.style.display = "block";

    justOpenedCard = true; // 🔥 KEY FIX

    setTimeout(() => {
        justOpenedCard = false;
    }, 200);

    document.getElementById("cardTitle").innerText = pin.name;
    document.getElementById("cardDesc").innerText = pin.description;
    document.getElementById("cardGroup").innerText = pin.groupName;

    const workingHoursElem = document.getElementById("cardWorkingHours");
    if (workingHoursElem && pin.opening_time && pin.closing_time) {
        let daysText = pin.working_days ? `${pin.working_days} · ` : '';
        
        const closeStatus = checkClosingSoon(pin.opening_time, pin.closing_time);
        
        workingHoursElem.classList.remove('info-hours-warning');
        
        let warningHtml = '';
        if (closeStatus && closeStatus.isClosingSoon) {
            workingHoursElem.classList.add('info-hours-warning');
            warningHtml = `<br><span class="info-hours-warning-text">⚠️ ${closeStatus.message}</span>`;
        }
        workingHoursElem.innerHTML = `🕒 ${daysText}${pin.opening_time} - ${pin.closing_time}${warningHtml}`;
        workingHoursElem.style.display = "block";
    } else if (workingHoursElem) {
        workingHoursElem.style.display = "none";
    }

    document.getElementById("directionBtn").onclick = () => {
        getDirections(pin.lat, pin.lng);
    };

    document.getElementById("editBtn").addEventListener("click", function(e) {
        e.stopPropagation();

        if (!activePin) return;

        openEditModal(activePin);
    });

    document.getElementById("deleteBtn").addEventListener("click", function(e) {
        e.stopPropagation();

        if (!activePin) return;

        deletePin(activePin);
    });

    document.getElementById("cancelRouteBtn").addEventListener("click", function(e) {
        e.stopPropagation();

        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
    });
}

async function deletePin(pin) {

    if (!confirm("Delete this pin?")) return;

    await fetch(`https://oracleapex.com/ords/map_project/api/pins/${pin.id}`, {
        method: "DELETE"
    });

    document.getElementById("infoCard").style.display = "none";

    loadPins();
}

function openEditModal(pin) {
    console.log("EDIT CLICKED", pin); // 👈 check

    document.getElementById("addPinModal").style.display = "block";

    document.getElementById("newPinName").value = pin.name;
    document.getElementById("newPinDesc").value = pin.description;
    document.getElementById("newPinCategory").value = pin.groupId;
    document.getElementById("newPinOpening").value = pin.opening_time || "";
    document.getElementById("newPinClosing").value = pin.closing_time || "";

    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => chip.classList.remove('active'));

    if (pin.working_days) {
        setSelectedDaysFromText(pin.working_days);
    }

    tempLat = pin.lat;
    tempLng = pin.lng;

    activePin = pin;
}




// =====================
// 8. DISTANCE
// =====================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}


// =====================
// 9. ROUTING
// =====================
async function getDirections(destLat, destLng) {

    if (!userLat) {
        alert("User location not available!");
        return;
    }

    const distance = calculateDistance(userLat, userLng, destLat, destLng);
    alert("Distance: " + distance.toFixed(2) + " km");

    if (routeLayer) {
        map.removeLayer(routeLayer);
    }

    const apiKey = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjdmMzQ0NzNhMjJkODQ0ZGM4N2YwNTAzOGY1MTM2ZmQ3IiwiaCI6Im11cm11cjY0In0=";

    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${userLng},${userLat}&end=${destLng},${destLat}`;

    const res = await fetch(url);
    const data = await res.json();

    const coords = data.features[0].geometry.coordinates;

    const latLngs = coords.map(c => [c[1], c[0]]);

    routeLayer = L.polyline(latLngs, {
        color: 'black',
        weight: 4
    }).addTo(map);

    map.fitBounds(routeLayer.getBounds());
}


// =====================
// 10. CATEGORIES
// =====================
async function loadCategories() {
    const res = await fetch("https://oracleapex.com/ords/map_project/categories/list");
    const data = await res.json();

    categories = data.items;

    fillCategoryDropdown();
}

// dropdown
function fillCategoryDropdown() {
    const select = document.getElementById("categoryFilter");

    if (!select) {
        console.error("Dropdown not found!");
        return;
    }

    select.innerHTML = `<option value="">🌍 Сите категории</option>`;

    categories.forEach(cat => {
        console.log("Adding category:", cat); // 👈 DEBUG

        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.innerText = cat.name;
        select.appendChild(opt);
    });

    select.onchange = function() {
        const selected = this.value;
        filterPins(selected ? parseInt(selected) : null);
    };
}




// =====================
// 11. ADD PIN FLOW
// =====================
document.getElementById("addPinBtn").onclick = () => {
    addMode = true;

    alert("Click anywhere on the map and drag pin if needed");
};



function openModal() {
    document.getElementById("addPinModal").style.display = "block";
}

function closeModal() {
    document.getElementById("addPinModal").style.display = "none";

    document.getElementById("newPinName").value = "";
    document.getElementById("newPinDesc").value = "";

    document.getElementById("newPinOpening").value = "";
    document.getElementById("newPinClosing").value = "";

    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
}


// =====================
// 12. SAVE PIN
// =====================
async function savePin() {

    const name = document.getElementById("newPinName").value;
    const desc = document.getElementById("newPinDesc").value;
    const groupId = document.getElementById("newPinCategory").value;
    const opening = document.getElementById("newPinOpening").value;
    const closing = document.getElementById("newPinClosing").value;

    const selectedDays = getSelectedDays();
    const workingDaysText = getWorkingDaysText(selectedDays);

    const payload = {
        name,
        description: desc,
        group_id: parseInt(groupId),
        lat: tempLat,
        lng: tempLng,
        opening_time: opening,    
        closing_time: closing,
        working_days: workingDaysText
    };

    if (activePin) {
        // EDIT
        await fetch(`https://oracleapex.com/ords/map_project/api/pins/${activePin.id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        activePin = null;

    } else {
        // CREATE
        await fetch("https://oracleapex.com/ords/map_project/api/pins/list", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
    }

    closeModal();
    loadPins();
}


// =====================
// INIT APP
// =====================
initMap();
getUserLocation();
loadCategories();
loadPins();

// =====================
// 13. LABEL ZOOM CONTROL
// =====================
map.on('zoomend', () => {
    const zoom = map.getZoom();

    markers.forEach(obj => {
        if (zoom >= 14) {
            map.addLayer(obj.label);
        } else {
            map.removeLayer(obj.label);
        }
    });
});

map.on('click', function(e) {

    if (justOpenedCard) return;

    // ADD MODE
    if (addMode) {

        tempLat = e.latlng.lat;
        tempLng = e.latlng.lng;

        if (tempMarker) {
            map.removeLayer(tempMarker);
        }

        tempMarker = L.marker([tempLat, tempLng], {
            draggable: true
        }).addTo(map);

        tempMarker.on('dragend', function(event) {
            const pos = event.target.getLatLng();
            tempLat = pos.lat;
            tempLng = pos.lng;
        });

        // 🔥 NEW CONFIRM FLOW
        setTimeout(() => {
            const confirmAdd = confirm("Place pin here?");

            if (confirmAdd) {
                openModal();
                addMode = false;
            }
        }, 100);

        return;
    }

    // NORMAL CLICK → CLOSE CARD
    document.getElementById("infoCard").style.display = "none";
});

// Convert selected days array to readable text (e.g. "Пон - Пет")
function getWorkingDaysText(selectedDays) {
    const dayMap = {
        'mon': 'Пон', 'tue': 'Вто', 'wed': 'Сре',
        'thu': 'Чет', 'fri': 'Пет', 'sat': 'Саб', 'sun': 'Нед'
    };
    
    const daysOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const selected = daysOrder.filter(day => selectedDays.includes(day));
    
    if (selected.length === 0) return '❌ Не е наведено';
    if (selected.length === 7) return 'Секој ден';
    
    let ranges = [];
    let start = selected[0];
    let end = selected[0];
    
    for (let i = 1; i < selected.length; i++) {
        const prevIndex = daysOrder.indexOf(selected[i-1]);
        const currIndex = daysOrder.indexOf(selected[i]);
        
        if (currIndex === prevIndex + 1) {
            end = selected[i];
        } else {
            ranges.push({ start: dayMap[start], end: dayMap[end] });
            start = selected[i];
            end = selected[i];
        }
    }
    ranges.push({ start: dayMap[start], end: dayMap[end] });
    
    return ranges.map(range => range.start === range.end ? range.start : `${range.start} - ${range.end}`).join(', ');
}

// Set active chips based on saved working days text
function setSelectedDaysFromText(workingDaysText) {
    if (!workingDaysText) return;
    
    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => chip.classList.remove('active'));
    
    const dayMap = {
        'пон': 'mon', 'понеделник': 'mon',
        'вто': 'tue', 'вторник': 'tue',
        'сре': 'wed', 'среда': 'wed',
        'чет': 'thu', 'четврток': 'thu',
        'пет': 'fri', 'петок': 'fri',
        'саб': 'sat', 'сабота': 'sat',
        'нед': 'sun', 'недела': 'sun'
    };
    
    const lowerText = workingDaysText.toLowerCase();
    
    const rangeMatch = lowerText.match(/([а-я]+)\s*-\s*([а-я]+)/);
    if (rangeMatch) {
        const startDay = dayMap[rangeMatch[1]];
        const endDay = dayMap[rangeMatch[2]];
        const daysOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        const startIndex = daysOrder.indexOf(startDay);
        const endIndex = daysOrder.indexOf(endDay);
        
        if (startIndex !== -1 && endIndex !== -1) {
            for (let i = startIndex; i <= endIndex; i++) {
                const chip = document.querySelector(`.chip[data-day="${daysOrder[i]}"]`);
                if (chip) chip.classList.add('active');
            }
        }
    }
    
    updateSelectedDays();
}

// Update hidden input with selected days
function updateSelectedDays() {
    const activeChips = document.querySelectorAll('.chip.active');
    const days = Array.from(activeChips).map(chip => chip.dataset.day);
    const selectedDaysInput = document.getElementById('selectedDays');
    if (selectedDaysInput) {
        selectedDaysInput.value = days.join(',');
    }
}

// Get selected days from hidden input
function getSelectedDays() {
    const selectedDaysInput = document.getElementById('selectedDays');
    if (selectedDaysInput) {
        const days = selectedDaysInput.value;
        return days ? days.split(',') : [];
    }
    return [];
}

function checkClosingSoon(openingTime, closingTime) {
    if (!openingTime || !closingTime) return null;

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotal = currentHours * 60 + currentMinutes;
    
    const [openHours, openMinutes] = openingTime.split(':').map(Number);
    const [closeHours, closeMinutes] = closingTime.split(':').map(Number);
    
    const openTotal = openHours * 60 + openMinutes;
    const closeTotal = closeHours * 60 + closeMinutes;
    
    if (currentTotal < openTotal || currentTotal > closeTotal) {
        return {
            isClosingSoon: false,
            message: null,
            status: "closed"
        };
    }
    
    const minutesUntilClose = closeTotal - currentTotal;
    
    if (minutesUntilClose >= 0 && minutesUntilClose <= 60) {
        return {
            isClosingSoon: true,
            minutesLeft: minutesUntilClose,
            message: `⚠️ Затвора за ${minutesUntilClose} минути!`
        };
    }
    
    return {
        isClosingSoon: false,
        message: null,
        status: "open"
    };
}

document.addEventListener('DOMContentLoaded', function() {
    const chips = document.querySelectorAll('.chip');
    if (chips.length > 0) {
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chip.classList.toggle('active');
                updateSelectedDays();
            });
        });
    }
    
    const timeInputs = document.querySelectorAll('.time-simple');
    timeInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            let value = this.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.slice(0,2) + ':' + value.slice(2,4);
            }
            this.value = value.slice(0,5);
        });
    });
});