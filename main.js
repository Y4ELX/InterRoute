// InterRoute - main.js
let map;
let routeLayerGroup;
let currentRoute = null;
let currentTransportType = null;

// Configuración del mapa
function initMap() {
    map = L.map('mapContainer', {
        maxBounds: [[-90, -360], [90, 360]], // Limita estrictamente a dos copias del mundo
        maxBoundsViscosity: 1.0, // Hace que los límites sean completamente estrictos
        minZoom: 2, // Zoom mínimo para evitar ver demasiadas copias
        maxZoom: 11 // Zoom máximo para mantener el contexto global
    }).setView([20.0, 0.0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        noWrap: false, // Permite que los tiles se repitan
        bounds: [[-90, -360], [90, 360]] // Limita los tiles estrictamente a dos copias del mundo
    }).addTo(map);
    
    // Evento para prevenir pan más allá de los límites estrictos
    map.on('moveend', function() {
        const center = map.getCenter();
        const lng = center.lng;
        
        // Si se ha movido más allá de los límites permitidos, corregir la posición
        if (lng < -360 || lng > 360) {
            // Normalizar la longitud al rango permitido
            let normalizedLng = lng;
            if (lng < -360) {
                normalizedLng = -360 + (lng % 360);
            } else if (lng > 360) {
                normalizedLng = 360 - (lng % 360);
            }
            
            // Corregir la posición del mapa
            map.setView([center.lat, normalizedLng], map.getZoom());
        }
    });
    
    routeLayerGroup = L.layerGroup().addTo(map);
    
    // Corregir problema de tiles blancos cuando se redimensiona
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

// Función para corregir el tamaño del mapa
function fixMapSize() {
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
}

// Observar cambios de tamaño del contenedor del mapa
function setupMapResizeObserver() {
    if (window.ResizeObserver) {
        const mapContainer = document.getElementById('mapContainer');
        if (mapContainer) {
            const resizeObserver = new ResizeObserver(entries => {
                fixMapSize();
            });
            resizeObserver.observe(mapContainer);
        }
    }
    
    // Fallback para navegadores más antiguos
    window.addEventListener('resize', fixMapSize);
}

// Función para encontrar la clave de ruta en rutasReales
function findRouteKey(origin, destination) {
    const countryMapping = {
        'Mexico': 'MEX',
        'Estados_Unidos': 'USA',
        'China': 'CHN',
        'Alemania': 'GER',
        'Paises_Bajos': 'NLD',
        'Corea': 'KOR'
    };
    
    const originCode = countryMapping[origin];
    const destCode = countryMapping[destination];
    
    if (!originCode || !destCode) {
        return null;
    }
    
    const routeKey = `${originCode}-${destCode}`;
    return rutasReales[routeKey] ? routeKey : null;
}

// Función para determinar si una ruta terrestre es viable
function isLandRouteViable(origin, destination) {
    return (origin === 'Mexico' && destination === 'Estados_Unidos') || 
           (origin === 'Estados_Unidos' && destination === 'Mexico');
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

// Función para calcular la distancia entre dos puntos (fórmula de Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en kilómetros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Función para calcular la distancia total de una ruta
function calculateRouteDistance(coordinates) {
    if (!coordinates || coordinates.length < 2) return 0;
    
    // Función auxiliar para extraer coordenadas (manejar tanto arrays como objetos)
    function extractCoords(coord) {
        if (Array.isArray(coord)) {
            return coord;
        } else if (coord.coords) {
            return coord.coords;
        } else {
            return coord;
        }
    }
    
    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        const coord1 = extractCoords(coordinates[i]);
        const coord2 = extractCoords(coordinates[i + 1]);
        
        totalDistance += calculateDistance(
            coord1[0], coord1[1],
            coord2[0], coord2[1]
        );
    }
    return totalDistance;
}

// Función para calcular el impacto ambiental
function calculateEnvironmentalImpact(transportType, coordinates) {
    const distance = calculateRouteDistance(coordinates);
    
    // Factores de emisión de CO2 por kilómetro (basados en datos reales)
    const emissionFactors = {
        'terrestre': 0.12,  // kg CO2/km (camiones)
        'maritima': 0.015,  // kg CO2/km (barcos cargueros)
        'aerea': 0.25       // kg CO2/km (aviones de carga)
    };
    
    // Calcular emisiones totales
    const totalEmissions = emissionFactors[transportType] * distance;
    
    // Clasificar impacto según emisiones
    let impact, impactText;
    if (totalEmissions < 500) {
        impact = 'low';
        impactText = 'Bajo';
    } else if (totalEmissions < 1500) {
        impact = 'medium';
        impactText = 'Medio';
    } else {
        impact = 'high';
        impactText = 'Alto';
    }
    
    return {
        level: impact,
        text: impactText,
        emissions: Math.round(totalEmissions),
        distance: Math.round(distance)
    };
}

// Función para mostrar opciones de transporte disponibles
function showTransportOptions(origin, destination) {
    const routeKey = findRouteKey(origin, destination);
    
    if (!routeKey) {
        document.getElementById('transportButtons').innerHTML = 
            '<p>No se encontraron rutas disponibles para esta combinación.</p>';
        return;
    }
    
    const routeData = rutasReales[routeKey];
    const transportButtons = document.getElementById('transportButtons');
    transportButtons.innerHTML = '';
    
    // Crear botones para cada tipo de transporte disponible
    Object.keys(routeData).forEach(transportType => {
        // Verificar si la ruta terrestre es viable
        if (transportType === 'terrestre') {
            if (!isLandRouteViable(origin, destination)) {
                return;
            }
            // Verificar coordenadas válidas
            const coordinates = routeData[transportType];
            if (coordinates.length === 1 && coordinates[0][0] === 0 && coordinates[0][1] === 0) {
                return;
            }
        }
        
        const coordinates = routeData[transportType];
        const environmentalImpact = calculateEnvironmentalImpact(transportType, coordinates);
        const transportInfo = getTransportInfo(coordinates, transportType);
        
        const button = document.createElement('button');
        button.className = 'transport-button';
        button.dataset.transportType = transportType;
        
        const transportNames = {
            'terrestre': '🚛 Terrestre',
            'maritima': '🚢 Marítimo', 
            'aerea': '✈️ Aéreo'
        };
        
        button.innerHTML = `
            <div class="transport-header">
                <span class="transport-icon">${transportNames[transportType]}</span>
            </div>
            <span class="transport-route">${transportInfo.origin} → ${transportInfo.destination}</span>
            <div class="environmental-info">
                <span class="environmental-indicator ${environmentalImpact.level}"></span>
                <span class="environmental-text">Impacto: ${environmentalImpact.text}</span>
            </div>
            <span class="environmental-details">${environmentalImpact.emissions} kg CO2</span>
        `;
        
        button.addEventListener('click', () => selectTransportType(origin, destination, transportType));
        transportButtons.appendChild(button);
    });
    
    // Mostrar la sección de opciones de transporte
    document.getElementById('transportOptions').style.display = 'block';
}

// Función para mostrar ruta en el mapa
function showRouteOnMap(origin, destination, transportType) {
    const routeKey = findRouteKey(origin, destination);
    if (!routeKey) return;
    
    const routeData = rutasReales[routeKey];
    const coordinates = routeData[transportType];
    
    if (!coordinates || coordinates.length < 2) return;
    
    // Limpiar capas anteriores
    routeLayerGroup.clearLayers();
    
    // Dibujar la ruta
    const color = getTransportColor(transportType);
    const result = drawRoute(coordinates, color, transportType);
    
    // Ajustar vista del mapa
    if (result && result.polylines && result.polylines.length > 0) {
        // Para rutas que cruzan el antimeridiano, centrar en el Pacífico
        if (transportType === 'aerea' && shouldCrossPacific(coordinates[0], coordinates[coordinates.length - 1])) {
            // Determinar la mejor vista según la dirección de la ruta
            const startLng = coordinates[0][1];
            const endLng = coordinates[coordinates.length - 1][1];
            
            if (startLng > 0 && endLng < 0) {
                // Ruta Asia → América: centrar en el Pacífico Norte
                map.setView([40, 180], 3);
            } else if (startLng < 0 && endLng > 0) {
                // Ruta América → Asia: centrar en el Pacífico Norte
                map.setView([40, -180], 3);
            } else {
                // Vista por defecto del Pacífico
                map.setView([30, -150], 3);
            }
        } else {
            // Para rutas normales, ajustar a los límites
            map.fitBounds(result.polylines[0].getBounds(), { padding: [20, 20] });
        }
    } else if (result && result.getBounds) {
        // Compatibilidad con el formato anterior
        map.fitBounds(result.getBounds(), { padding: [20, 20] });
    }
}

// Función para dibujar ruta en el mapa
function drawRoute(coordinates, color, transportType) {
    if (!coordinates || coordinates.length < 2) return null;
    
    // Función auxiliar para extraer coordenadas (manejar tanto arrays como objetos)
    function extractCoords(coord) {
        if (Array.isArray(coord)) {
            return coord;
        } else if (coord.coords) {
            return coord.coords;
        } else {
            return coord;
        }
    }
    
    let routeCoordinates = coordinates;
    let polylineOptions = {
        color: color,
        weight: 4,
        opacity: 0.8
    };
    
    // Aplicar curvas para rutas aéreas y marítimas
    if (transportType === 'aerea') {
        routeCoordinates = createCurvedRoute(coordinates);
        polylineOptions.dashArray = '10, 5'; // Línea punteada para aviones
        polylineOptions.weight = 3;
    } else if (transportType === 'maritima') {
        routeCoordinates = createMaritimeSpline(coordinates);
        polylineOptions.weight = 4; // Línea más gruesa para rutas marítimas
        polylineOptions.dashArray = '15, 5, 5, 5'; // Patrón dash-dot para rutas marítimas
        polylineOptions.opacity = 0.9;
    } else if (transportType === 'terrestre') {
        polylineOptions.dashArray = '5, 10'; // Línea discontinua para terrestre
    }
    
    // Para rutas aéreas transpacíficas, usar el sistema de mundo duplicado
    let polylines = [];
    let allBounds = [];
    
    const polyline = L.polyline(routeCoordinates, polylineOptions).addTo(routeLayerGroup);
    polylines.push(polyline);
    allBounds.push(polyline.getBounds());
    
    // Definir iconos de transporte
    const transportIcons = {
        'terrestre': '🚛',
        'maritima': '🚢',
        'aerea': '✈️'
    };
    
    // Obtener coordenadas originales para los marcadores
    const startCoords = extractCoords(coordinates[0]);
    const endCoords = extractCoords(coordinates[coordinates.length - 1]);
    
    // Para rutas transpacíficas, ajustar la posición del marcador de meta
    let finalEndCoords = endCoords;
    
    // Detectar si es una ruta transpacífica aérea
    if (transportType === 'aerea' && shouldCrossPacific(startCoords, endCoords)) {
        const startLng = startCoords[1];
        const endLng = endCoords[1];
        
        // Si es ruta Asia → América (longitud positiva → negativa)
        if (startLng > 0 && endLng < 0) {
            // El destino debe aparecer en la copia derecha del mundo
            finalEndCoords = [endCoords[0], endCoords[1] + 360];
        }
        // Si es ruta América → Asia (longitud negativa → positiva) 
        else if (startLng < 0 && endLng > 0) {
            // El destino debe aparecer en la copia izquierda del mundo
            finalEndCoords = [endCoords[0], endCoords[1] - 360];
        }
    }
    
    // Agregar marcadores de inicio y fin con iconos apropiados
    const startMarker = L.marker(startCoords, {
        icon: L.divIcon({
            html: transportIcons[transportType],
            className: 'transport-marker',
            iconSize: [30, 30]
        })
    }).addTo(routeLayerGroup);
    
    const endMarker = L.marker(finalEndCoords, {
        icon: L.divIcon({
            html: '🏁',
            className: 'transport-marker',
            iconSize: [30, 30]
        })
    }).addTo(routeLayerGroup);
    
    // Agregar marcador de transporte en punto intermedio (usar coordenadas de la ruta curvada)
    if (routeCoordinates.length > 2) {
        const midPoint = Math.floor(routeCoordinates.length / 2);
        const midCoords = extractCoords(routeCoordinates[midPoint]);
        const transportMarker = L.marker(midCoords, {
            icon: L.divIcon({
                html: transportIcons[transportType],
                className: 'animated-marker',
                iconSize: [30, 30]
            })
        }).addTo(routeLayerGroup);
    }
    
    // Devolver información sobre las polylines creadas
    return {
        polylines: polylines,
        bounds: allBounds,
        // Mantener compatibilidad con código anterior
        getBounds: function() {
            return polylines.length > 0 ? polylines[0].getBounds() : null;
        }
    };
}

// Función para mostrar opciones de carga específicas según el tipo de transporte
function showCargoOptions(transportType) {
    const cargoTypeContainer = document.getElementById('cargoTypeContainer');
    const cargoDetailsContainer = document.getElementById('cargoDetailsContainer');
    
    cargoTypeContainer.innerHTML = '';
    cargoDetailsContainer.innerHTML = '';
    
    // Crear opciones según el tipo de transporte
    let cargoOptions = [];
    
    if (transportType === 'terrestre') {
        cargoOptions = [
            { value: 'suelta', text: 'Carga Suelta' },
            { value: 'unitarizada', text: 'Unitarizada (Pallets)' }
        ];
    } else if (transportType === 'maritima') {
        cargoOptions = [
            { value: 'suelta', text: 'Carga Suelta' },
            { value: 'contenedor', text: 'Contenerizada' }
        ];
    } else if (transportType === 'aerea') {
        cargoOptions = [
            { value: 'unitarizada', text: 'Unitarizada (Pallets)' }
        ];
    }
    
    // Crear selector de tipo de carga
    const cargoTypeSelect = document.createElement('select');
    cargoTypeSelect.id = 'cargoType';
    cargoTypeSelect.innerHTML = '<option value="">Seleccione tipo de carga</option>';
    
    cargoOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        cargoTypeSelect.appendChild(optionElement);
    });
    
    cargoTypeSelect.addEventListener('change', () => showCargoDetails(cargoTypeSelect.value));
    
    const label = document.createElement('label');
    label.textContent = 'Tipo de carga:';
    label.appendChild(cargoTypeSelect);
    
    cargoTypeContainer.appendChild(label);
}

// Función para mostrar detalles específicos de carga
function showCargoDetails(cargoType) {
    const cargoDetailsContainer = document.getElementById('cargoDetailsContainer');
    cargoDetailsContainer.innerHTML = '';
    
    if (cargoType === 'suelta') {
        // Verificar si es transporte marítimo para agregar campo de volumen
        const isMaritimeTransport = currentTransportType === 'maritima';
        
        cargoDetailsContainer.innerHTML = `
            <div class="form-group">
                <label for="netWeight">Peso neto (kg):</label>
                <input type="number" id="netWeight" min="1" required>
            </div>
            <div class="form-group">
                <label for="grossWeight">Peso bruto (kg):</label>
                <input type="number" id="grossWeight" min="1" required>
            </div>
            ${isMaritimeTransport ? `
            <div class="form-group">
                <label for="cargoVolume">Volumen (m³):</label>
                <input type="number" id="cargoVolume" min="0.1" step="0.1" required>
                <small class="help-text">Requerido para calcular el factor de estiba (FE)</small>
            </div>
            ` : ''}
        `;
    } else if (cargoType === 'contenedor') {
        cargoDetailsContainer.innerHTML = `
            <div class="form-group">
                <label for="containerType">Tipo de contenedor:</label>
                <select id="containerType" required>
                    <option value="">Seleccione tipo</option>
                    <option value="dryvan">Dry Van</option>
                    <option value="highcube">High Cube</option>
                    <option value="reefer">Reefer</option>
                </select>
            </div>
            <div class="form-group" id="containerSizeGroup" style="display:none;">
                <label for="containerSize">Tamaño del contenedor:</label>
                <select id="containerSize" required>
                    <option value="">Seleccione tamaño</option>
                    <option value="20">20 pies</option>
                    <option value="40">40 pies</option>
                </select>
            </div>
            <div class="form-group" id="containerQuantityGroup" style="display:none;">
                <label for="containerQuantity">Cantidad de contenedores:</label>
                <input type="number" id="containerQuantity" min="1" required>
                <div id="capacityInfo" class="capacity-info"></div>
            </div>
        `;
        
        // Agregar event listeners para actualizar opciones dinámicamente
        const containerTypeSelect = document.getElementById('containerType');
        const containerSizeSelect = document.getElementById('containerSize');
        const containerQuantityInput = document.getElementById('containerQuantity');
        
        containerTypeSelect.addEventListener('change', function() {
            const containerType = this.value;
            const sizeGroup = document.getElementById('containerSizeGroup');
            const quantityGroup = document.getElementById('containerQuantityGroup');
            
            if (containerType) {
                sizeGroup.style.display = 'block';
                // Actualizar opciones de tamaño según el tipo
                updateContainerSizeOptions(containerType);
            } else {
                sizeGroup.style.display = 'none';
                quantityGroup.style.display = 'none';
            }
        });
        
        containerSizeSelect.addEventListener('change', function() {
            const containerSize = this.value;
            const quantityGroup = document.getElementById('containerQuantityGroup');
            
            if (containerSize) {
                quantityGroup.style.display = 'block';
                updateContainerCapacity();
            } else {
                quantityGroup.style.display = 'none';
            }
        });
        
        containerQuantityInput.addEventListener('input', function() {
            updateContainerCapacity();
        });
    } else if (cargoType === 'unitarizada') {
        cargoDetailsContainer.innerHTML = `
            <div class="form-group">
                <label for="palletQuantity">Cantidad de pallets:</label>
                <input type="number" id="palletQuantity" min="1" required>
            </div>
            <div class="form-group">
                <label for="palletWeight">Peso por pallet (kg):</label>
                <input type="number" id="palletWeight" min="1" required>
            </div>
        `;
    }
}

// Función para seleccionar tipo de transporte y mostrar detalles
function selectTransportType(origin, destination, transportType) {
    currentRoute = { origin, destination, transportType };
    currentTransportType = transportType;
    
    // Resaltar botón seleccionado
    document.querySelectorAll('.transport-button').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.querySelector(`[data-transport-type="${transportType}"]`).classList.add('selected');
    
    // Mostrar sección de detalles
    document.getElementById('transportDetails').style.display = 'block';
    
    // Inicializar mapa si no existe
    if (!map) {
        initMap();
        setupMapResizeObserver();
    }
    
    // Corregir tamaño del mapa cuando se muestra
    fixMapSize();
    
    // Mostrar ruta en el mapa
    showRouteOnMap(origin, destination, transportType);
    
    // Mostrar opciones de carga específicas
    showCargoOptions(transportType);
    
    // Scroll suave hacia los detalles
    document.getElementById('transportDetails').scrollIntoView({ 
        behavior: 'smooth' 
    });
    
    // Corregir mapa después del scroll
    setTimeout(() => {
        fixMapSize();
    }, 500);
}

// Función para calcular costos y mostrar información de ruta
function calculateRouteInfo() {
    if (!currentRoute) return;
    
    const cargoType = document.getElementById('cargoType').value;
    if (!cargoType) {
        alert('Por favor seleccione un tipo de carga');
        return;
    }
    
    let cargoDetails = '';
    let costMultiplier = 1.0;
    let cargoWeight = 1000; // Peso por defecto en kg
    
    // Validar datos según tipo de carga
    if (cargoType === 'suelta') {
        const netWeight = parseFloat(document.getElementById('netWeight').value);
        const grossWeight = parseFloat(document.getElementById('grossWeight').value);
        
        if (!netWeight || !grossWeight) {
            alert('Por favor complete todos los campos de peso');
            return;
        }
        
        if (netWeight > grossWeight) {
            alert('El peso neto no puede ser mayor al peso bruto');
            return;
        }
        
        // Validar volumen para transporte marítimo
        if (currentRoute.transportType === 'maritima') {
            const cargoVolume = parseFloat(document.getElementById('cargoVolume').value);
            if (!cargoVolume) {
                alert('Por favor ingrese el volumen de la carga');
                return;
            }
            cargoDetails = `Peso neto: ${netWeight.toLocaleString()} kg, Peso bruto: ${grossWeight.toLocaleString()} kg, Volumen: ${cargoVolume} m³`;
        } else {
            cargoDetails = `Peso neto: ${netWeight.toLocaleString()} kg, Peso bruto: ${grossWeight.toLocaleString()} kg`;
        }
        
        const weightTons = grossWeight / 1000;
        costMultiplier = Math.max(1.0, weightTons * 0.8);
        cargoWeight = grossWeight;
        
    } else if (cargoType === 'contenedor') {
        const containerType = document.getElementById('containerType').value;
        const containerSize = document.getElementById('containerSize').value;
        const containerQuantity = parseInt(document.getElementById('containerQuantity').value);
        
        if (!containerType || !containerSize || !containerQuantity) {
            alert('Por favor complete todos los campos del contenedor');
            return;
        }
        
        // Validar capacidad máxima
        const maxCapacity = getMaxContainerCapacity(containerType, containerSize);
        if (containerQuantity > maxCapacity) {
            alert(`La cantidad máxima permitida para contenedores ${containerType} de ${containerSize} pies es ${maxCapacity.toLocaleString()}`);
            return;
        }
        
        // Calcular multiplicador de costo
        const baseMultiplier = containerSize === '20' ? 1.0 : 1.8; // 40 pies cuesta más
        costMultiplier = baseMultiplier * containerQuantity;
        
        if (containerType === 'reefer') {
            costMultiplier *= 2.2; // Reefer es más caro
        } else if (containerType === 'highcube') {
            costMultiplier *= 1.4; // High Cube es más caro que Dry Van
        }
        
        // Calcular peso estimado (TEU)
        const teuPerContainer = containerSize === '20' ? 1 : 2;
        const totalTEU = containerQuantity * teuPerContainer;
        
        const containerNames = {
            'dryvan': 'DC/GP',    // Dry Cargo / General Purpose
            'highcube': 'HQ',     // High Cube
            'reefer': 'RF'        // Reefer
        };
        
        cargoDetails = `${containerQuantity.toLocaleString()}x${containerSize}' ${containerNames[containerType]} (${totalTEU.toLocaleString()} TEU)`;
        
        // Ajustar peso para cálculo ambiental (estimado)
        cargoWeight = totalTEU * 12000; // Aproximadamente 12 toneladas por TEU
        
    } else if (cargoType === 'unitarizada') {
        const palletQuantity = parseInt(document.getElementById('palletQuantity').value);
        const palletWeight = parseFloat(document.getElementById('palletWeight').value);
        
        if (!palletQuantity || !palletWeight) {
            alert('Por favor complete todos los campos de pallets');
            return;
        }
        
        const totalWeight = palletQuantity * palletWeight;
        const weightTons = totalWeight / 1000;
        costMultiplier = Math.max(1.0, weightTons * 0.6);
        cargoDetails = `${palletQuantity} pallets, ${palletWeight} kg c/u (Total: ${totalWeight.toLocaleString()} kg)`;
        cargoWeight = totalWeight;
    }
      // Obtener coordenadas de la ruta actual
    const routeKey = findRouteKey(currentRoute.origin, currentRoute.destination);
    const routeData = rutasReales[routeKey];
    const coordinates = routeData[currentRoute.transportType];
    
    // Calcular impacto ambiental basado en la ruta real
    const environmentalImpact = calculateEnvironmentalImpact(currentRoute.transportType, coordinates);
    
    // Calcular costo según tipo de transporte
    let estimatedCost;
    let costBreakdown = '';
    
    if (currentRoute.transportType === 'maritima' && cargoType === 'suelta') {
        // Cálculo específico para flete marítimo con carga suelta
        const cargoVolume = parseFloat(document.getElementById('cargoVolume').value);
        const result = calculateMaritimeFreight(cargoWeight, cargoVolume, cargoDetails);
        estimatedCost = result.totalCost;
        costBreakdown = result.breakdown;
    } else {
        // Cálculo estándar para otros tipos de transporte
        const baseCosts = {
            'terrestre': 2000,
            'maritima': 8000,
            'aerea': 12000
        };
        
        const baseCost = baseCosts[currentRoute.transportType];
        estimatedCost = Math.round(baseCost * costMultiplier);
    }
    
    const timeMultipliers = {
        'terrestre': 1.0,
        'maritima': 1.5,
        'aerea': 0.3
    };
    
    const timeMultiplier = timeMultipliers[currentRoute.transportType];
    const estimatedTime = Math.round(timeMultiplier * 10);
    
    // Mostrar resultados
    const routeInfo = document.getElementById('routeInfo');
    routeInfo.innerHTML = `
        <div class="route-summary">
            <h4>Resumen de la ruta</h4>
            <p><strong>Origen:</strong> ${getCountryName(currentRoute.origin)}</p>
            <p><strong>Destino:</strong> ${getCountryName(currentRoute.destination)}</p>
            <p><strong>Tipo de transporte:</strong> ${currentRoute.transportType.toUpperCase()}</p>
            <p><strong>Tipo de carga:</strong> ${cargoDetails}</p>
            <p><strong>Distancia:</strong> ${environmentalImpact.distance.toLocaleString()} km</p>
        </div>
        
        <div class="cost-details">
            <h4>Información de costos</h4>
            <p><strong>Costo estimado:</strong> $${estimatedCost.toLocaleString()} USD</p>
            <p><strong>Tiempo estimado:</strong> ${estimatedTime} días</p>
            ${costBreakdown}
        </div>
        
        <div class="environmental-impact">
            <h4>Impacto ambiental</h4>
            <p><strong>Nivel de impacto:</strong> <span class="impact-${environmentalImpact.level}">${environmentalImpact.text}</span></p>
            <p><strong>Emisiones de CO2:</strong> ${environmentalImpact.emissions.toLocaleString()} kg</p>
            <p><strong>Emisiones por km:</strong> ${(environmentalImpact.emissions / environmentalImpact.distance).toFixed(2)} kg CO2/km</p>
        </div>
    `;
    
    document.getElementById('costResult').style.display = 'block';
    document.getElementById('costResult').scrollIntoView({ behavior: 'smooth' });
}

// Función para obtener nombre del país
function getCountryName(countryCode) {
    const countryNames = {
        'Mexico': 'México',
        'Estados_Unidos': 'Estados Unidos',
        'China': 'China',
        'Alemania': 'Alemania',
        'Paises_Bajos': 'Países Bajos',
        'Corea': 'Corea del Sur'
    };
    return countryNames[countryCode] || countryCode;
}

// Función para manejar el envío del formulario
function handleFormSubmit(e) {
    e.preventDefault();
    
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    
    if (!origin || !destination) {
        alert('Por favor, seleccione origen y destino.');
        return;
    }
    
    if (origin === destination) {
        alert('El origen y destino no pueden ser el mismo país.');
        return;
    }
    
    // Validar que al menos uno de los países sea México
    if (origin !== 'Mexico' && destination !== 'Mexico') {
        alert('Al menos uno de los países debe ser México.');
        return;
    }
    
    // Limpiar secciones anteriores
    document.getElementById('transportOptions').style.display = 'none';
    document.getElementById('transportDetails').style.display = 'none';
    document.getElementById('costResult').style.display = 'none';
    
    // Mostrar opciones de transporte
    showTransportOptions(origin, destination);
    
    // Scroll suave hacia las opciones de transporte
    document.getElementById('transportOptions').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

// Función para actualizar las opciones de destino según el origen seleccionado
function updateDestinationOptions() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination');
    const currentDestination = destination.value;
    
    // Limpiar opciones de destino
    destination.innerHTML = '<option value="">Seleccione país de destino</option>';
    
    // Lista de países disponibles con emojis
    const countries = [
        { value: 'Mexico', text: '🇲🇽 México' },
        { value: 'Estados_Unidos', text: '🇺🇸 Estados Unidos' },
        { value: 'China', text: '🇨🇳 China' },
        { value: 'Alemania', text: '🇩🇪 Alemania' },
        { value: 'Paises_Bajos', text: '🇳🇱 Países Bajos' },
        { value: 'Corea', text: '🇰🇷 Corea del Sur' }
    ];
    
    // Si el origen es México, mostrar todos los demás países
    if (origin === 'Mexico') {
        countries.forEach(country => {
            if (country.value !== 'Mexico') {
                const option = document.createElement('option');
                option.value = country.value;
                option.textContent = country.text;
                destination.appendChild(option);
            }
        });
    }
    // Si el origen NO es México, solo mostrar México como destino
    else if (origin && origin !== '') {
        const option = document.createElement('option');
        option.value = 'Mexico';
        option.textContent = '🇲🇽 México';
        destination.appendChild(option);
    }
    // Si no hay origen seleccionado, mostrar todos
    else {
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.value;
            option.textContent = country.text;
            destination.appendChild(option);
        });
    }
    
    // Mantener la selección anterior si es válida
    if (currentDestination && [...destination.options].some(opt => opt.value === currentDestination)) {
        destination.value = currentDestination;
    }
}

// Función para actualizar las opciones de origen según el destino seleccionado
function updateOriginOptions() {
    const destination = document.getElementById('destination').value;
    const origin = document.getElementById('origin');
    const currentOrigin = origin.value;
    
    // Limpiar opciones de origen
    origin.innerHTML = '<option value="">Seleccione país de origen</option>';
    
    // Lista de países disponibles con emojis
    const countries = [
        { value: 'Mexico', text: '🇲🇽 México' },
        { value: 'Estados_Unidos', text: '🇺🇸 Estados Unidos' },
        { value: 'China', text: '🇨🇳 China' },
        { value: 'Alemania', text: '🇩🇪 Alemania' },
        { value: 'Paises_Bajos', text: '🇳🇱 Países Bajos' },
        { value: 'Corea', text: '🇰🇷 Corea del Sur' }
    ];
    
    // Si el destino es México, mostrar todos los demás países
    if (destination === 'Mexico') {
        countries.forEach(country => {
            if (country.value !== 'Mexico') {
                const option = document.createElement('option');
                option.value = country.value;
                option.textContent = country.text;
                origin.appendChild(option);
            }
        });
    }
    // Si el destino NO es México, solo mostrar México como origen
    else if (destination && destination !== '') {
        const option = document.createElement('option');
        option.value = 'Mexico';
        option.textContent = '🇲🇽 México';
        origin.appendChild(option);
    }
    // Si no hay destino seleccionado, mostrar todos
    else {
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.value;
            option.textContent = country.text;
            origin.appendChild(option);
        });
    }
    
    // Mantener la selección anterior si es válida
    if (currentOrigin && [...origin.options].some(opt => opt.value === currentOrigin)) {
        origin.value = currentOrigin;
    }
}

// Función para actualizar opciones de tamaño según el tipo de contenedor
function updateContainerSizeOptions(containerType) {
    const containerSizeSelect = document.getElementById('containerSize');
    containerSizeSelect.innerHTML = '<option value="">Seleccione tamaño</option>';
    
    // Todos los tipos de contenedores tienen opciones de 20 y 40 pies
    const option20 = document.createElement('option');
    option20.value = '20';
    option20.textContent = '20 pies';
    containerSizeSelect.appendChild(option20);
    
    const option40 = document.createElement('option');
    option40.value = '40';
    option40.textContent = '40 pies';
    containerSizeSelect.appendChild(option40);
}

// Función para calcular la capacidad máxima según el tipo y tamaño
function getMaxContainerCapacity(containerType, containerSize) {
    const capacities = {
        'dryvan': {
            '20': 10000,
            '40': 5000
        },
        'highcube': {
            '20': 10000,  // High Cube 20' tiene la misma capacidad que Dry Van 20'
            '40': 5000    // High Cube 40' tiene la misma capacidad que Dry Van 40'
        },
        'reefer': {
            '20': 1000,
            '40': 500
        }
    };
    
    return capacities[containerType]?.[containerSize] || 0;
}

// Función para actualizar la información de capacidad
function updateContainerCapacity() {
    const containerType = document.getElementById('containerType').value;
    const containerSize = document.getElementById('containerSize').value;
    const containerQuantity = parseInt(document.getElementById('containerQuantity').value) || 0;
    const capacityInfo = document.getElementById('capacityInfo');
    
    if (!containerType || !containerSize) {
        capacityInfo.innerHTML = '';
        return;
    }
    
    const maxCapacity = getMaxContainerCapacity(containerType, containerSize);
    const containerQuantityInput = document.getElementById('containerQuantity');
    
    // Actualizar el máximo permitido
    containerQuantityInput.max = maxCapacity;
    
    // Mostrar información de capacidad
    let statusClass = 'capacity-ok';
    let statusText = 'Disponible';
    
    if (containerQuantity > maxCapacity) {
        statusClass = 'capacity-exceeded';
        statusText = 'Excede capacidad';
    } else if (containerQuantity > maxCapacity * 0.8) {
        statusClass = 'capacity-warning';
        statusText = 'Capacidad alta';
    }
    
    const containerTypeNames = {
        'dryvan': 'DC/GP',
        'highcube': 'HQ',
        'reefer': 'RF'
    };
    
    capacityInfo.innerHTML = `
        <div class="capacity-display ${statusClass}">
            <strong>${containerTypeNames[containerType]} ${containerSize}':</strong> 
            ${containerQuantity}/${maxCapacity} contenedores
            <span class="capacity-status">(${statusText})</span>
        </div>
        <div class="capacity-explanation">
            <small>Capacidad máxima del barco: ${maxCapacity.toLocaleString()} contenedores de ${containerSize} pies ${containerType === 'reefer' ? 'refrigerados' : ''}</small>
        </div>
    `;
}

// Función para obtener información de puertos/aeropuertos/cruces fronterizos según coordenadas
function getTransportInfo(coordinates, transportType) {
    if (!coordinates || coordinates.length < 2) return { origin: '', destination: '' };
    
    const originCoord = coordinates[0];
    const destinationCoord = coordinates[coordinates.length - 1];
    
    // Definir ubicaciones principales con sus coordenadas aproximadas
    const locations = {
        // México - Puertos
        'altamira_port': { name: 'Puerto de Altamira', coords: [22.4883, -97.8580] },
        // México - Aeropuertos
        'mexico_airport': { name: 'Aeropuerto Internacional de Tampico', coords: [22.291454589123013, -97.86610239439382] },
        // México - Frontera terrestre
        'nuevo_laredo': { name: 'Nuevo Laredo, Tamaulipas', coords: [25.6866, -100.3161] },
        
        // China - Puertos
        'shanghai_port': { name: 'Puerto de Shanghái', coords: [31.2304, 121.4737] },
        // China - Aeropuertos  
        'shanghai_airport': { name: 'Aeropuerto Shanghái-Pudong', coords: [31.2304, 121.4737] },
        
        // Estados Unidos - Puertos
        'los_angeles_port': { name: 'Puerto de Los Ángeles', coords: [34.0522, -118.2437] },
        // Estados Unidos - Aeropuertos
        'los_angeles_airport': { name: 'Aeropuerto LAX Los Ángeles', coords: [34.0522, -118.2437] },
        // Estados Unidos - Frontera terrestre
        'laredo': { name: 'Laredo, Texas', coords: [32.7767, -96.797] },
        
        // Alemania - Puertos
        'hamburgo_port': { name: 'Puerto de Hamburgo', coords: [53.5453, 9.9866] },
        // Alemania - Aeropuertos
        'frankfurt_airport': { name: 'Aeropuerto de Frankfurt', coords: [53.5453, 9.9866] },
        
        // Países Bajos - Puertos
        'rotterdam_port': { name: 'Puerto de Róterdam', coords: [51.885, 4.2867] },
        // Países Bajos - Aeropuertos
        'amsterdam_airport': { name: 'Aeropuerto Ámsterdam-Schiphol', coords: [51.885, 4.2867] },
        
        // Corea del Sur - Puertos
        'busan_port': { name: 'Puerto de Busan', coords: [35.1796, 129.0756] },
        // Corea del Sur - Aeropuertos
        'busan_airport': { name: 'Aeropuerto de Gimhae (Busan)', coords: [35.1796, 129.0756] }
    };
    
    // Función para encontrar la ubicación más cercana según el tipo de transporte
    function findNearestLocation(coord) {
        let nearestLocation = '';
        let minDistance = Infinity;
        
        Object.entries(locations).forEach(([key, location]) => {
            // Filtrar por tipo de transporte
            if (transportType === 'maritima' && !key.includes('port')) return;
            if (transportType === 'aerea' && !key.includes('airport')) return;
            if (transportType === 'terrestre' && key.includes('port')) return;
            if (transportType === 'terrestre' && key.includes('airport')) return;
            
            const distance = Math.sqrt(
                Math.pow(coord[0] - location.coords[0], 2) + 
                Math.pow(coord[1] - location.coords[1], 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestLocation = location.name;
            }
        });
        
        return nearestLocation;
    }
    
    const origin = findNearestLocation(originCoord);
    const destination = findNearestLocation(destinationCoord);
    
    return { origin, destination };
}

// Función para calcular flete marítimo with factor de estiba (FE)
function calculateMaritimeFreight(grossWeight, volume, cargoDetails) {
    // Calcular Factor de Estiba (FE = Volumen / Peso)
    const weightInTons = grossWeight / 1000;
    const FE = volume / weightInTons;
    
    // Tarifas base por tonelada o metro cúbico (según ejemplo original)
    const tarifaPorToneladaOM3 = 80; // USD por tonelada o m³
    
    // Aplicar tarifa por el mayor entre peso y volumen
    const costoBasePorPeso = weightInTons * tarifaPorToneladaOM3;
    const costoBasePorVolumen = volume * tarifaPorToneladaOM3;
    const costoBase = Math.max(costoBasePorPeso, costoBasePorVolumen);
    
    // Recargos según ejemplo original
    const CAF = costoBase * 0.20; // Currency Adjustment Factor (20%)
    const BAF = (FE > 1 ? volume : weightInTons) * 10; // Bunker Adjustment Factor ($10 por unidad)
    
    // Costo total
    const totalCost = Math.round(costoBase + CAF + BAF);
    
    // Generar desglose detallado
    const breakdown = `
        <div class="maritime-freight-breakdown">
            <h5>Desglose del flete marítimo</h5>
            <div class="freight-details">
                <p><strong>Datos de la carga:</strong></p>
                <p>• Peso bruto: ${grossWeight.toLocaleString()} kg (${weightInTons.toFixed(2)} ton)</p>
                <p>• Volumen: ${volume.toFixed(2)} m³</p>
                <p>• Factor de Estiba (FE): ${FE.toFixed(2)} m³/ton</p>
                <br>
                <p><strong>Cálculo de tarifa:</strong></p>
                <p>• Por peso: ${weightInTons.toFixed(2)} ton × $${tarifaPorToneladaOM3} = $${costoBasePorPeso.toLocaleString()}</p>
                <p>• Por volumen: ${volume.toFixed(2)} m³ × $${tarifaPorToneladaOM3} = $${costoBasePorVolumen.toLocaleString()}</p>
                <p>• <strong>Tarifa base (mayor):</strong> $${costoBase.toLocaleString()}</p>
                <br>
                <p><strong>Recargos:</strong></p>
                <p>• CAF (20%): $${CAF.toLocaleString()}</p>
                <p>• BAF ($10 × ${FE > 1 ? volume.toFixed(2) + ' m³' : weightInTons.toFixed(2) + ' ton'}): $${BAF.toLocaleString()}</p>
                <br>
                <p><strong>Total:</strong> $${totalCost.toLocaleString()}</p>
            </div>
        </div>
    `;
    
    return {
        totalCost: totalCost,
        breakdown: breakdown,
        details: {
            weight: weightInTons,
            volume: volume,
            FE: FE,
            baseCost: costoBase,
            CAF: CAF,
            BAF: BAF
        }
    };
}

// Función para crear una ruta curva para aviones
function createCurvedRoute(coordinates) {
    if (coordinates.length < 2) return coordinates;
    
    const start = coordinates[0];
    const end = coordinates[coordinates.length - 1];
    
    // Detectar si la ruta cruza el antimeridiano (Pacífico)
    const crossesPacific = shouldCrossPacific(start, end);
    
    if (crossesPacific) {
        return createPacificRoute(start, end);
    } else {
        return createStandardRoute(start, end);
    }
}

// Función para determinar si una ruta debe cruzar el Pacífico
function shouldCrossPacific(start, end) {
    const startLng = start[1];
    const endLng = end[1];
    
    // Rutas que van del oeste de América (-100 a -60) al este de Asia (100 a 140)
    // o viceversa, deben cruzar el Pacífico
    const isWestAmericaToEastAsia = (startLng < -60 && endLng > 100);
    const isEastAsiaToWestAmerica = (startLng > 100 && endLng < -60);
    
    return isWestAmericaToEastAsia || isEastAsiaToWestAmerica;
}

// Función para crear ruta transpacífica
function createPacificRoute(start, end) {
    const startLat = start[0];
    const startLng = start[1];
    const endLat = end[0];
    const endLng = end[1];
    
    const curvedPoints = [];
    const numPoints = 50; // Más puntos para rutas transpacíficas más suaves
    
    // Determinar dirección (oeste a este o este a oeste)
    const goingWest = startLng > 0 && endLng < 0; // De Asia a América
    const goingEast = startLng < 0 && endLng > 0; // De América a Asia
    
    if (goingWest) {
        // Ruta Asia → América (China → México)
        // Usar la copia del mundo de la derecha para mostrar la continuidad
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            
            // Interpolación de latitud con arco hacia el norte
            const lat = startLat + (endLat - startLat) * t + 
                       Math.sin(t * Math.PI) * 12; // Arco de 12 grados hacia el norte
            
            // Para longitud, crear ruta que va directamente hacia el este
            // usando la copia extendida del mundo (0 a 360 grados)
            const adjustedEndLng = endLng + 360; // Mover el destino a la copia de la derecha
            const lng = startLng + (adjustedEndLng - startLng) * t;
            
            curvedPoints.push([lat, lng]);
        }
    } else if (goingEast) {
        // Ruta América → Asia (México → China)
        // Usar la copia del mundo de la izquierda para mostrar la continuidad
        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            
            // Interpolación de latitud con arco hacia el norte
            const lat = startLat + (endLat - startLat) * t + 
                       Math.sin(t * Math.PI) * 12; // Arco de 12 grados hacia el norte
            
            // Para longitud, crear ruta que va directamente hacia el oeste
            // usando la copia extendida del mundo (-360 a 0 grados)
            const adjustedEndLng = endLng - 360; // Mover el destino a la copia de la izquierda
            const lng = startLng + (adjustedEndLng - startLng) * t;
            
            curvedPoints.push([lat, lng]);
        }
    }
    
    return curvedPoints;
}

// Función para crear ruta estándar (no transpacífica)
function createStandardRoute(start, end) {
    // Calcular el punto medio
    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;
    
    // Calcular la distancia entre puntos
    const distance = Math.sqrt(
        Math.pow(end[0] - start[0], 2) + 
        Math.pow(end[1] - start[1], 2)
    );
    
    // Crear un arco elevado para simular la curvatura de la Tierra
    const elevation = distance * 0.3; // Factor de curvatura
    
    // Determinar si vamos hacia el este o hacia el oeste
    const goingEast = end[1] > start[1];
    
    // Crear punto de control para la curva
    let controlLat, controlLng;
    
    if (Math.abs(end[1] - start[1]) > 90) {
        // Para rutas transcontinentales, elevar hacia el norte
        controlLat = midLat + elevation;
        controlLng = midLng;
    } else {
        // Para rutas más cortas, crear arco natural
        controlLat = midLat + elevation * 0.5;
        controlLng = midLng + (goingEast ? elevation * 0.3 : -elevation * 0.3);
    }
    
    // Generar puntos intermedios para crear una curva suave
    const curvedPoints = [];
    const numPoints = 20;
    
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        
        // Usar interpolación cuadrática de Bézier
        const lat = Math.pow(1 - t, 2) * start[0] + 
                   2 * (1 - t) * t * controlLat + 
                   Math.pow(t, 2) * end[0];
        
        const lng = Math.pow(1 - t, 2) * start[1] + 
                   2 * (1 - t) * t * controlLng + 
                   Math.pow(t, 2) * end[1];
        
        curvedPoints.push([lat, lng]);
    }
    
    return curvedPoints;
}

// Función para crear una curva spline suave para rutas marítimas
function createMaritimeSpline(coordinates) {
    console.log('createMaritimeSpline called with:', coordinates);
    
    // Función auxiliar para normalizar coordenadas (manejar tanto arrays como objetos)
    function normalizeCoordinates(coords) {
        const normalized = coords.map(coord => {
            if (Array.isArray(coord)) {
                return { coords: coord, strict: false };
            } else if (coord.coords) {
                return { coords: coord.coords, strict: coord.strict || false };
            } else {
                return { coords: coord, strict: false };
            }
        });
        console.log('Normalized coordinates:', normalized);
        return normalized;
    }
    
    if (coordinates.length < 2) return coordinates;
    
    // Normalizar las coordenadas
    const normalizedCoords = normalizeCoordinates(coordinates);
    
    // Si solo hay 2 puntos, crear una línea ligeramente curvada
    if (normalizedCoords.length === 2) {
        const start = normalizedCoords[0].coords;
        const end = normalizedCoords[1].coords;
        
        // Calcular punto medio con una ligera curvatura
        const midLat = (start[0] + end[0]) / 2;
        const midLng = (start[1] + end[1]) / 2;
        
        // Pequeña curvatura natural para rutas marítimas
        const distance = Math.sqrt(
            Math.pow(end[0] - start[0], 2) + 
            Math.pow(end[1] - start[1], 2)
        );
        
        const curvature = distance * 0.03; // Curvatura más sutil para rutas marítimas
        const offsetLat = curvature * Math.sin(midLng * Math.PI / 180);
        const offsetLng = curvature * Math.cos(midLat * Math.PI / 180);
        
        const result = [
            start,
            [midLat + offsetLat, midLng + offsetLng],
            end
        ];
        
        console.log('Simple maritime curve created:', result);
        return result;
    }
    
    // Para múltiples puntos, crear spline cúbico suave respetando puntos estrictos
    const splinePoints = [];
    const pointsPerSegment = 12; // Puntos por segmento optimizado para suavidad
    
    // Agregar el primer punto
    splinePoints.push(normalizedCoords[0].coords);
    
    // Crear spline entre cada par de puntos consecutivos
    for (let i = 0; i < normalizedCoords.length - 1; i++) {
        const currentPoint = normalizedCoords[i];
        const nextPoint = normalizedCoords[i + 1];
        
        // Si el punto actual o el siguiente son estrictos, crear línea recta
        if (currentPoint.strict || nextPoint.strict) {
            console.log(`Creating straight line segment from point ${i} to ${i + 1} (strict point detected)`);
            
            // Crear línea recta entre los dos puntos
            for (let t = 1; t <= pointsPerSegment; t++) {
                const u = t / pointsPerSegment;
                const lat = currentPoint.coords[0] + (nextPoint.coords[0] - currentPoint.coords[0]) * u;
                const lng = currentPoint.coords[1] + (nextPoint.coords[1] - currentPoint.coords[1]) * u;
                splinePoints.push([lat, lng]);
            }
        } else {
            // Crear spline suave normal
            const p0 = i > 0 ? normalizedCoords[i - 1].coords : normalizedCoords[i].coords;
            const p1 = normalizedCoords[i].coords;
            const p2 = normalizedCoords[i + 1].coords;
            const p3 = i < normalizedCoords.length - 2 ? normalizedCoords[i + 2].coords : normalizedCoords[i + 1].coords;
            
            // Calcular puntos intermedios usando spline cúbico
            for (let t = 1; t <= pointsPerSegment; t++) {
                const u = t / pointsPerSegment;
                const point = catmullRomSpline(p0, p1, p2, p3, u);
                splinePoints.push(point);
            }
        }
    }
    
    console.log('Maritime spline created with', splinePoints.length, 'points');
    return splinePoints;
}

// Función auxiliar para calcular spline Catmull-Rom optimizada para rutas marítimas
function catmullRomSpline(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    
    // Coeficientes para spline Catmull-Rom con tensión ajustada para rutas marítimas
    const tension = 0.5; // Tensión del spline (0.5 es el estándar)
    
    const lat = tension * (
        (2 * p1[0]) +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
    );
    
    const lng = tension * (
        (2 * p1[1]) +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
    );
    
    return [lat, lng];
}

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    // Configurar event listeners
    document.getElementById('routeForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('origin').addEventListener('change', updateDestinationOptions);
    document.getElementById('destination').addEventListener('change', updateOriginOptions);
    
    // Event listener para el botón de calcular costo
    document.getElementById('calculateCost').addEventListener('click', calculateRouteInfo);
    
    // Configurar el observador de redimensionamiento del mapa
    setupMapResizeObserver();
    
    // Verificar si rutasReales está disponible
    if (typeof rutasReales === 'undefined') {
        console.error('El archivo rutasReales.js no se ha cargado correctamente.');
    } else {
        console.log('rutasReales cargado correctamente:', Object.keys(rutasReales).length, 'rutas disponibles');
    }
});