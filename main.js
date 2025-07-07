// InterRoute - main.js
let map;
let routeLayerGroup;
let selectedRouteIndex = -1;

// Configuración del mapa
function initMap() {
    map = L.map('mapContainer').setView([20.0, 0.0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    routeLayerGroup = L.layerGroup().addTo(map);
}

// Función para mostrar/ocultar el selector de contenedor
function toggleContainerType() {
    const cargoType = document.getElementById('cargoType').value;
    const containerGroup = document.getElementById('containerTypeGroup');
    
    if (cargoType === 'contenedor') {
        containerGroup.style.display = 'block';
    } else {
        containerGroup.style.display = 'none';
    }
}

// Función para encontrar la clave de ruta en rutasReales
function findRouteKey(origin, destination) {
    // Mapeo de nombres de países a abreviaciones
    const countryMapping = {
        'Mexico': 'MEX',
        'Estados_Unidos': 'USA',
        'China': 'CHN',
        'Alemania': 'GER',
        'Japon': 'JPN',
        'Paises_Bajos': 'NLD'
    };
    
    const originCode = countryMapping[origin];
    const destCode = countryMapping[destination];
    
    if (!originCode || !destCode) {
        return null;
    }
    
    const routeKey = `${originCode}-${destCode}`;
    return rutasReales[routeKey] ? routeKey : null;
}

// Función para obtener color por tipo de transporte
function getTransportColor(type) {
    const colors = {
        'terrestre': '#e65100',
        'maritima': '#1565c0',
        'aerea': '#7b1fa2'
    };
    return colors[type] || '#333';
}

// Función para obtener información de costos y tiempos estimados
function getRouteInfo(origin, destination, transportType, cargoType, containerType) {
    const distances = {
        'terrestre': { base: 2000, multiplier: 1.0 },
        'maritima': { base: 8000, multiplier: 1.5 },
        'aerea': { base: 12000, multiplier: 0.3 }
    };
    
    const baseCost = distances[transportType].base;
    const timeMultiplier = distances[transportType].multiplier;
    
    // Ajustar costos según tipo de carga
    let costMultiplier = 1.0;
    if (cargoType === 'contenedor') {
        costMultiplier = 1.5;
        if (containerType === 'reefer') {
            costMultiplier = 2.0;
        } else if (containerType === 'highcube') {
            costMultiplier = 1.3;
        }
    }
    
    const estimatedCost = Math.round(baseCost * costMultiplier);
    const estimatedTime = Math.round(timeMultiplier * 10);
    
    return {
        cost: estimatedCost,
        time: estimatedTime,
        impact: estimatedCost < 3000 ? 'low' : estimatedCost < 6000 ? 'medium' : 'high'
    };
}

// Función para dibujar ruta en el mapa
function drawRoute(coordinates, color, transportType) {
    if (!coordinates || coordinates.length < 2) return null;
    
    const polyline = L.polyline(coordinates, {
        color: color,
        weight: 4,
        opacity: 0.8
    }).addTo(routeLayerGroup);
    
    // Agregar marcadores de inicio y fin
    const startMarker = L.marker(coordinates[0], {
        icon: L.divIcon({
            html: '🚀',
            className: 'transport-marker',
            iconSize: [30, 30]
        })
    }).addTo(routeLayerGroup);
    
    const endMarker = L.marker(coordinates[coordinates.length - 1], {
        icon: L.divIcon({
            html: '🏁',
            className: 'transport-marker',
            iconSize: [30, 30]
        })
    }).addTo(routeLayerGroup);
    
    // Agregar marcadores de transporte en puntos intermedios
    const transportIcons = {
        'terrestre': '🚛',
        'maritima': '🚢',
        'aerea': '✈️'
    };
    
    if (coordinates.length > 2) {
        const midPoint = Math.floor(coordinates.length / 2);
        const transportMarker = L.marker(coordinates[midPoint], {
            icon: L.divIcon({
                html: transportIcons[transportType],
                className: 'animated-marker',
                iconSize: [30, 30]
            })
        }).addTo(routeLayerGroup);
    }
    
    return polyline;
}

// Función para mostrar rutas sugeridas
function showSuggestedRoutes(origin, destination, cargoType, containerType) {
    const routeKey = findRouteKey(origin, destination);
    
    if (!routeKey) {
        document.getElementById('routesContainer').innerHTML = 
            '<p>No se encontraron rutas disponibles para esta combinación de origen y destino.</p>';
        return;
    }
    
    const routeData = rutasReales[routeKey];
    const routesContainer = document.getElementById('routesContainer');
    routesContainer.innerHTML = '';
    
    let routeIndex = 0;
    
    // Crear tarjetas para cada tipo de transporte disponible
    Object.keys(routeData).forEach(transportType => {
        const coordinates = routeData[transportType];
        const routeInfo = getRouteInfo(origin, destination, transportType, cargoType, containerType);
        
        const routeCard = document.createElement('div');
        routeCard.className = 'route-card';
        routeCard.dataset.routeIndex = routeIndex;
        routeCard.dataset.transportType = transportType;
        
        routeCard.innerHTML = `
            <h3>Ruta ${transportType.charAt(0).toUpperCase() + transportType.slice(1)}</h3>
            <div class="route-details">
                <div class="route-type ${transportType}">${transportType.toUpperCase()}</div>
                <div><strong>Costo estimado:</strong> $${routeInfo.cost.toLocaleString()} USD</div>
                <div><strong>Tiempo estimado:</strong> ${routeInfo.time} días</div>
                <div><strong>Impacto ambiental:</strong> <span class="impact-${routeInfo.impact}">${
                    routeInfo.impact === 'low' ? 'Bajo' : 
                    routeInfo.impact === 'medium' ? 'Medio' : 'Alto'
                }</span></div>
            </div>
        `;
        
        routeCard.addEventListener('click', () => selectRoute(routeIndex, transportType, coordinates));
        routesContainer.appendChild(routeCard);
        routeIndex++;
    });
    
    // Mostrar la primera ruta por defecto
    if (Object.keys(routeData).length > 0) {
        const firstTransport = Object.keys(routeData)[0];
        selectRoute(0, firstTransport, routeData[firstTransport]);
    }
}

// Función para seleccionar una ruta específica
function selectRoute(index, transportType, coordinates) {
    // Remover selección anterior
    document.querySelectorAll('.route-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Seleccionar nueva ruta
    const selectedCard = document.querySelector(`[data-route-index="${index}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    // Limpiar mapa y dibujar nueva ruta
    routeLayerGroup.clearLayers();
    const color = getTransportColor(transportType);
    const polyline = drawRoute(coordinates, color, transportType);
    
    if (polyline) {
        // Ajustar vista del mapa para mostrar toda la ruta
        map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    }
    
    selectedRouteIndex = index;
}

// Función para manejar el envío del formulario
function handleFormSubmit(e) {
    e.preventDefault();
    
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    const cargoType = document.getElementById('cargoType').value;
    const containerType = document.getElementById('containerType').value;
    
    if (!origin || !destination || !cargoType) {
        alert('Por favor, complete todos los campos requeridos.');
        return;
    }
    
    if (origin === destination) {
        alert('El origen y destino no pueden ser el mismo país.');
        return;
    }
    
    // Mostrar sección de rutas
    document.getElementById('routesSection').style.display = 'block';
    
    // Inicializar mapa si no existe
    if (!map) {
        initMap();
    }
    
    // Mostrar rutas sugeridas
    showSuggestedRoutes(origin, destination, cargoType, containerType);
    
    // Scroll suave hacia las rutas
    document.getElementById('routesSection').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    // Configurar event listeners
    document.getElementById('routeForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('cargoType').addEventListener('change', toggleContainerType);
    
    // Verificar si rutasReales está disponible
    if (typeof rutasReales === 'undefined') {
        console.error('El archivo rutasReales.js no se ha cargado correctamente.');
    } else {
        console.log('rutasReales cargado correctamente:', Object.keys(rutasReales).length, 'rutas disponibles');
    }
});