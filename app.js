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
            lng: pin.lng
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
    if (workingHoursElem) {
        if (pin.opening && pin.closing) {
            workingHoursElem.innerText = `🕒 Работно време: ${pin.opening} - ${pin.closing}`;
            workingHoursElem.style.display = "block";
        } else {
            workingHoursElem.style.display = "none";
        }
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


    document.getElementById("newPinOpening").value = pin.opening || "";
    document.getElementById("newPinClosing").value = pin.closing || "";

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

    renderCategories();
    fillCategoryDropdown();
}


// sidebar
function renderCategories() {
    const sidebar = document.getElementById("sidebar");

    sidebar.innerHTML = `
        <div class="category-item" onclick="filterPins(null)">
            🌍 All
        </div>
    `;

    categories.forEach(cat => {
        const div = document.createElement("div");
        div.className = "category-item";
        div.innerText = cat.name;

        div.onclick = () => filterPins(cat.id);

        sidebar.appendChild(div);
    });
}


// dropdown
function fillCategoryDropdown() {
    const select = document.getElementById("newPinCategory");

    select.innerHTML = "";

    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.innerText = cat.name;
        select.appendChild(opt);
    });
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

    const payload = {
        name,
        description: desc,
        group_id: parseInt(groupId),
        lat: tempLat,
        lng: tempLng,
        opening: opening,    
        closing: closing
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


