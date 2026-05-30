require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/GeoJSONLayer",
    "esri/layers/FeatureLayer",
    "esri/layers/GraphicsLayer",
    "esri/Graphic",
    "esri/geometry/geometryEngine",
    "esri/widgets/Sketch"
], function(Map, MapView, GeoJSONLayer, FeatureLayer, GraphicsLayer, Graphic, geometryEngine, Sketch) {

    // Create layers
    const countiesLayer = new GeoJSONLayer({
        url: "https://raw.githubusercontent.com/media/Link0923/Omri_AOI_view/main/CA_counties.geojson",
        title: "Counties",
        visible: false,
        renderer: {
            type: "simple",
            symbol: {
                type: "simple-fill",
                color: [255, 140, 0, 0.3],  // Orange with transparency
                outline: {
                    color: [255, 140, 0, 0.8],
                    width: 2
                }
            }
        },
        popupTemplate: {
            title: "County",
            content: "{CountyName}"
        }
    });

    const zipcodesLayer = new FeatureLayer({
        url: "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_ZIP_Code_Areas_anaylsis/FeatureServer/0",
        title: "Zip Codes",
        visible: false,
        renderer: {
            type: "simple",
            symbol: {
                type: "simple-fill",
                color: [65, 105, 225, 0.3],  // Blue with transparency
                outline: {
                    color: [65, 105, 225, 0.8],
                    width: 1.5
                }
            }
        },
        popupTemplate: {
            title: "Zip Code",
            content: "{ZIP_CODE}"
        }
    });

    const aoiLayer = new GeoJSONLayer({
        url: "https://raw.githubusercontent.com/media/Link0923/Omri_AOI_view/main/Service_zones_20260703.geojson",
        title: "Areas of Interest",
        renderer: {
            type: "simple",
            symbol: {
                type: "simple-fill",
                color: [255, 0, 0, 1],  // red
                outline: {
                    color: [0, 0, 0, 1], // black
                    width: 0.5
                }
            }
        },
        popupTemplate: {
            title: "Area of Interest",
            content: "County: {CountyName}"
        }
    });

    const progressLayer = new GeoJSONLayer({
        url: "https://raw.githubusercontent.com/media/Link0923/Omri_AOI_view/main/In_progress.geojson",
        title: "In Progress",
        renderer: {
            type: "simple",
            symbol: {
                type: "simple-fill",
                color: [0, 112, 255, 1],  // blue
                outline: {
                    color: [0, 0, 0, 1], // black
                    width: 0.5
                }
            }
        },
        popupTemplate: {
            title: "In Progress",
            content: "County: {COUNTY_NAME}"
        }
    });

    // Create graphics layer for highlighting selected features
    const highlightLayer = new GraphicsLayer({
        title: "Highlights"
    });

    // Create map with topo-vector basemap
    const map = new Map({
        basemap: "topo-vector",
        layers: [countiesLayer, zipcodesLayer, aoiLayer, progressLayer, highlightLayer]
    });

    // Create map view centered on California
    const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-119.4179, 36.7783],  // California center
        zoom: 6
    });

    // Store layer references globally
    window.layers = {
        counties: countiesLayer,
        zipcodes: zipcodesLayer,
        aoi: aoiLayer,
        progress: progressLayer
    };

    // Store selection state
    window.selectedZipCodes = new Set();
    window.selectedFeatures = new Map();
    window.selectionMode = 'point';
    window.sketchWidget = null;
    window.clickHandler = null;

    // Store selected states
    window.selectedStates = new Set();

    // Toggle dropdown visibility
    window.toggleDropdown = function() {
        const dropdown = document.getElementById("layerDropdown");
        dropdown.classList.toggle("show");
    };

    // Toggle state dropdown visibility
    window.toggleStateDropdown = function() {
        const dropdown = document.getElementById("stateDropdown");
        dropdown.classList.toggle("show");
    };

    // Close dropdown when clicking outside
    window.addEventListener('click', function(event) {
        if (!event.target.matches('.dropdown-button')) {
            const layerDropdown = document.getElementById("layerDropdown");
            const stateDropdown = document.getElementById("stateDropdown");
            if (layerDropdown.classList.contains('show')) {
                layerDropdown.classList.remove('show');
            }
            if (stateDropdown.classList.contains('show')) {
                stateDropdown.classList.remove('show');
            }
        }
    });

    // Toggle layer visibility
    window.toggleLayer = function(layerName, event) {
        event.stopPropagation();  // Prevent dropdown from closing
        
        const checkbox = document.getElementById(layerName + 'Check');
        const layer = window.layers[layerName];
        
        // Toggle checkbox if label was clicked
        if (event.target.tagName === 'LABEL' || event.target.className === 'layer-item') {
            checkbox.checked = !checkbox.checked;
        }
        
        // Update layer visibility
        layer.visible = checkbox.checked;
    };

    // Filter layers by state
    window.filterByState = function(stateCode, event) {
        event.stopPropagation();  // Prevent dropdown from closing
        
        const checkbox = document.getElementById(`state${stateCode}`);
        
        // Toggle checkbox if label was clicked
        if (event.target.tagName === 'LABEL' || event.target.className === 'layer-item') {
            checkbox.checked = !checkbox.checked;
        }
        
        // Update selected states set
        if (checkbox.checked) {
            window.selectedStates.add(stateCode);
        } else {
            window.selectedStates.delete(stateCode);
        }
        
        // Build definition expression based on selected states
        if (window.selectedStates.size === 0) {
            // No states selected - hide zip codes layer and clear filter
            window.layers.zipcodes.visible = false;
            window.layers.zipcodes.definitionExpression = null;
        } else {
            // Enable zip codes layer and filter by selected states
            window.layers.zipcodes.visible = true;
            
            const stateFilter = Array.from(window.selectedStates)
                .map(state => `STATE = '${state}'`)
                .join(' OR ');
            
            window.layers.zipcodes.definitionExpression = stateFilter;
            
            console.log(`Filtering zip codes by states: ${Array.from(window.selectedStates).join(', ')}`);
        }
    };

    // Initialize sketch widget for lasso selection
    window.sketchWidget = new Sketch({
        layer: highlightLayer,
        view: view,
        creationMode: "single",
        defaultCreateOptions: {
            mode: "freehand"  // Enable freehand drawing for lasso
        },
        visibleElements: {
            createTools: {
                point: false,
                polyline: false,
                circle: false,
                rectangle: false,
                polygon: false  // Hide the UI, we'll activate programmatically
            },
            selectionTools: {
                "lasso-selection": false,
                "rectangle-selection": false
            },
            undoRedoMenu: false,
            settingsMenu: false
        },
        visible: false  // Start hidden, show only in lasso mode
    });
    
    // Set up sketch create event listener once
    window.sketchWidget.on('create', function(event) {
        if (event.state === 'complete') {
            handleLassoSelection(event.graphic.geometry);
            // Clear the drawn polygon and start a new one
            highlightLayer.graphics.forEach(g => {
                if (!g.attributes || !g.attributes.ZIP_CODE) {
                    highlightLayer.remove(g);
                }
            });
            setTimeout(() => {
                if (window.selectionMode === 'lasso') {
                    window.sketchWidget.create('polygon', { mode: 'freehand' });
                }
            }, 100);
        }
    });

    // Toggle selector pane
    window.toggleSelectorPane = function() {
        const pane = document.getElementById('selectorPane');
        const isOpen = pane.classList.contains('open');
        
        if (!isOpen) {
            pane.classList.add('open');
            // Auto-enable zip codes layer
            window.layers.zipcodes.visible = true;
            document.getElementById('zipcodesCheck').checked = true;
            // Start in point mode
            setSelectionMode('point');
        } else {
            pane.classList.remove('open');
            // Disable selection tools
            if (window.clickHandler) {
                window.clickHandler.remove();
                window.clickHandler = null;
            }
            if (window.sketchWidget) {
                window.sketchWidget.cancel();
            }
        }
    };

    // Set selection mode
    window.setSelectionMode = function(mode) {
        window.selectionMode = mode;
        
        // Update button states
        document.getElementById('pointModeBtn').classList.toggle('active', mode === 'point');
        document.getElementById('lassoModeBtn').classList.toggle('active', mode === 'lasso');
        
        // Clean up previous handlers
        if (window.clickHandler) {
            window.clickHandler.remove();
            window.clickHandler = null;
        }
        if (window.sketchWidget) {
            window.sketchWidget.cancel();
        }
        
        if (mode === 'point') {
            // Hide sketch widget
            window.sketchWidget.visible = false;
            // Set up click handler for point selection
            window.clickHandler = view.on('immediate-click', handlePointSelection);
        } else if (mode === 'lasso') {
            // Show and start sketch widget for lasso with freehand mode
            window.sketchWidget.visible = true;
            window.sketchWidget.create('polygon', { mode: 'freehand' });
        }
    };

    // Handle point selection
    async function handlePointSelection(event) {
        // Check if Ctrl key is pressed
        const ctrlPressed = event.native.ctrlKey || event.native.metaKey;
        
        // Only select if Ctrl key is pressed
        if (!ctrlPressed) {
            return;
        }
        
        // Prevent default popup behavior
        event.stopPropagation();
        
        const response = await view.hitTest(event);
        const results = response.results.filter(r => 
            r.graphic && r.graphic.layer === zipcodesLayer
        );
        
        if (results.length > 0) {
            const hitGraphic = results[0].graphic;
            const objectId = hitGraphic.attributes.OBJECTID;
            
            // Query the layer to get the full feature with all attributes
            const query = zipcodesLayer.createQuery();
            query.objectIds = [objectId];
            query.returnGeometry = true;
            query.outFields = ['*'];
            
            try {
                const queryResult = await zipcodesLayer.queryFeatures(query);
                
                if (queryResult.features.length > 0) {
                    const fullFeature = queryResult.features[0];
            
                    const zipCode = fullFeature.attributes.ZIP_CODE;
                    
                    if (zipCode) {
                        if (window.selectedZipCodes.has(zipCode)) {
                            // Deselect
                            removeZipCodeFromSelection(zipCode);
                        } else {
                            // Select
                            addZipCodeToSelection(zipCode, fullFeature);
                        }
                    } else {
                        console.warn('No zip code found. Available attributes:', Object.keys(fullFeature.attributes));
                    }
                }
            } catch (error) {
                console.error('Error querying feature:', error);
            }
        }
    }

    // Handle lasso selection
    async function handleLassoSelection(lassoGeometry) {
        const query = zipcodesLayer.createQuery();
        query.geometry = lassoGeometry;
        query.spatialRelationship = 'intersects';
        query.outFields = ['*'];
        query.returnGeometry = true;
        
        try {
            const results = await zipcodesLayer.queryFeatures(query);
            results.features.forEach(feature => {
                const zipCode = feature.attributes.ZIP_CODE;
                if (zipCode && !window.selectedZipCodes.has(zipCode)) {
                    addZipCodeToSelection(zipCode, feature);
                }
            });
            
            // Clear only the drawn lasso graphic (not the highlighted zip codes)
            const graphicsToRemove = [];
            highlightLayer.graphics.forEach(g => {
                if (!g.attributes || !g.attributes.ZIP_CODE) {
                    graphicsToRemove.push(g);
                }
            });
            highlightLayer.removeMany(graphicsToRemove);
        } catch (error) {
            console.error('Lasso selection error:', error);
        }
    }

    // Add zip code to selection
    function addZipCodeToSelection(zipCode, graphic) {
        window.selectedZipCodes.add(zipCode);
        
        // Create highlight graphic
        const highlightGraphic = new Graphic({
            geometry: graphic.geometry,
            symbol: {
                type: 'simple-fill',
                color: [255, 255, 0, 0.4],
                outline: {
                    color: [255, 215, 0, 1],
                    width: 3
                }
            },
            attributes: { ZIP_CODE: zipCode }
        });
        
        highlightLayer.add(highlightGraphic);
        updateZipCodeList();
    }

    // Remove zip code from selection
    function removeZipCodeFromSelection(zipCode) {
        window.selectedZipCodes.delete(zipCode);
        
        // Remove highlight - find and remove graphics with matching ZIP_CODE
        const graphicsToRemove = [];
        highlightLayer.graphics.forEach(g => {
            if (g.attributes && g.attributes.ZIP_CODE === zipCode) {
                graphicsToRemove.push(g);
            }
        });
        highlightLayer.removeMany(graphicsToRemove);
        
        updateZipCodeList();
    }

    // Update zip code list display
    function updateZipCodeList() {
        const listDiv = document.getElementById('zipcodeList');
        const countDiv = document.getElementById('selectionCount');
        const count = window.selectedZipCodes.size;
        
        countDiv.textContent = `Selected: ${count} zip code${count !== 1 ? 's' : ''}`;
        
        if (count === 0) {
            listDiv.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">Hold Ctrl + Click on map to select zip codes</div>';
        } else {
            const sorted = Array.from(window.selectedZipCodes).sort();
            listDiv.innerHTML = sorted.map(zip => `
                <div class="zipcode-item">
                    <span>${zip}</span>
                    <button class="remove-btn" onclick="removeZipCode('${zip}')">Remove</button>
                </div>
            `).join('');
        }
    }

    // Remove individual zip code
    window.removeZipCode = function(zipCode) {
        removeZipCodeFromSelection(zipCode);
    };

    // Clear all selections
    window.clearSelection = function() {
        window.selectedZipCodes.clear();
        highlightLayer.removeAll();
        updateZipCodeList();
    };

    // Export to CSV
    window.exportToCSV = function() {
        if (window.selectedZipCodes.size === 0) {
            alert('No zip codes selected');
            return;
        }
        
        const sorted = Array.from(window.selectedZipCodes).sort();
        const csv = 'ZIP_CODE\n' + sorted.join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'selected_zipcodes.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    console.log("Map loaded successfully!");
});
