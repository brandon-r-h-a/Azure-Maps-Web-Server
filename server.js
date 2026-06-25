const express = require('express');
const axios = require('axios');
const app = express();

// Your Azure Maps Subscription Key (Loaded from environment variables)
const AZURE_MAPS_KEY = process.env.AZURE_MAPS_KEY;

/**
 * THIS IS YOUR WRAPPER ENDPOINT
 * Your system will call: [http://your-server.com/azure-embed?Address1=...&City=](http://your-server.com/azure-embed?Address1=...&City=)...
 */
app.get('/azure-embed', async (req, res) => {
    // Extract structured inputs from the URL query parameters
    const { q, Address1, Address2, City, StateRegionProvince, PostalCode, Country } = req.query;

    // Build the address string: Use 'q' if provided, otherwise combine the structured fields
    let addressQuery = q;
    if (!addressQuery) {
        // Filter out any undefined or empty variables, then join them with commas
        const parts = [Address1, Address2, City, StateRegionProvince, PostalCode, Country].filter(Boolean);
        addressQuery = parts.join(', ');
    }

    if (!addressQuery || addressQuery.trim() === "") {
        return res.status(400).send("Error: Missing address parameters.");
    }

    try {
        // STEP 1: Geocode the address using Azure Maps REST API
        const geocodeUrl = `https://atlas.microsoft.com/geocode?api-version=2023-06-01&query=${encodeURIComponent(addressQuery)}&subscription-key=${AZURE_MAPS_KEY}`;
        
        const geoResponse = await axios.get(geocodeUrl);
        const geoData = geoResponse.data;

        if (!geoData.features || geoData.features.length === 0) {
            return res.status(404).send("Error: Address not found.");
        }

        // Extract coordinates from the Azure payload
        const lon = geoData.features[0].geometry.coordinates[0];
        const lat = geoData.features[0].geometry.coordinates[1];

        // STEP 2: Generate the HTML document with the coordinates injected
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="[https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.css](https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.css)" rel="stylesheet" />
                <script src="[https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.js](https://atlas.microsoft.com/sdk/javascript/mapcontrol/3/atlas.min.js)"></script>
                <style>
                    html, body, #myMap { margin: 0; padding: 0; width: 100%; height: 100%; }
                </style>
            </head>
            <body>
                <div id="myMap"></div>
                <script>
                    window.onload = function() {
                        var map = new atlas.Map('myMap', {
                            center: [${lon}, ${lat}], // Injected coordinates!
                            zoom: 15,
                            view: 'Auto',
                            authOptions: {
                                authType: 'subscriptionKey',
                                subscriptionKey: '${AZURE_MAPS_KEY}'
                            }
                        });

                        map.events.add('ready', function () {
                            var marker = new atlas.HtmlMarker({
                                color: 'DodgerBlue',
                                position: [${lon}, ${lat}] // Injected coordinates!
                            });
                            map.markers.add(marker);
                            map.controls.add([new atlas.control.ZoomControl()], { position: "top-right" });
                        });
                    }
                </script>
            </body>
            </html>
        `;

        // STEP 3: Return the HTML output directly to your system
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(htmlContent);

    } catch (error) {
        console.error("Wrapper Error:", error.message);
        res.status(500).send("Internal Server Error processing the map request.");
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Azure Maps Wrapper API running on port ${PORT}`);
});
