const express = require('express');
const axios = require('axios');
const app = express();

// Your Azure Maps Subscription Key (Loaded from environment variables)
const AZURE_MAPS_KEY = process.env.AZURE_MAPS_KEY;

// ENDPOINT 1: THE IFRAME GENERATOR
// Your system calls this. It outputs the iframe tag needed to display the map.
app.get('/azure-embed', (req, res) => {
const queryString = req.url.split('?')[1] || '';

const protocol = req.headers['x-forwarded-proto'] || req.protocol;
const host = req.get('host');
const internalMapUrl = protocol + '://' + host + '/render-map?' + queryString;

const iframeOutput = '<iframe width="100%" height="450" style="border:0" loading="lazy" allowfullscreen src="' + internalMapUrl + '"></iframe>';

res.setHeader('Content-Type', 'text/html');
res.status(200).send(iframeOutput);
});

// ENDPOINT 2: THE ACTUAL MAP RENDERER
// The iframe loads this URL to actually fetch the coordinates and draw the map.
app.get('/render-map', async (req, res) => {
const { q, Address1, Address2, City, StateRegionProvince, PostalCode, Country } = req.query;

let addressQuery = q;
if (!addressQuery) {
    const parts = [Address1, Address2, City, StateRegionProvince, PostalCode, Country].filter(Boolean);
    addressQuery = parts.join(', ');
}

if (!addressQuery || addressQuery.trim() === "") {
    return res.status(400).send("Error: Missing address parameters.");
}

try {
    const geocodeUrl = '[https://atlas.microsoft.com/geocode?api-version=2023-06-01&query=](https://atlas.microsoft.com/geocode?api-version=2023-06-01&query=)' + encodeURIComponent(addressQuery) + '&subscription-key=' + AZURE_MAPS_KEY;
    
    const geoResponse = await axios.get(geocodeUrl);
    const geoData = geoResponse.data;

    if (!geoData.features || geoData.features.length === 0) {
        return res.status(404).send("Error: Address not found.");
    }

    const lon = geoData.features[0].geometry.coordinates[0];
    const lat = geoData.features[0].geometry.coordinates[1];

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
                        center: [${lon}, ${lat}],
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
                            position: [${lon}, ${lat}]
                        });
                        map.markers.add(marker);
                        map.controls.add([new atlas.control.ZoomControl()], { position: "top-right" });
                    });
                }
            </script>
        </body>
        </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(htmlContent);

} catch (error) {
    console.error("Wrapper Error:", error.message);
    res.status(500).send("Internal Server Error processing the map request.");
}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log("Azure Maps Wrapper API running on port " + PORT);
});
