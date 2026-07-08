const express = require('express');
const axios = require('axios');
const app = express();

// Your Azure Maps Subscription Key
const AZURE_MAPS_KEY = process.env.AZURE_MAPS_KEY;

app.get('/azure-embed', async (req, res) => {
    // 1. Extract inputs from the URL query parameters
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
        // Geocode the address
        const geocodeUrl = `https://atlas.microsoft.com/geocode?api-version=2026-01-01&query=${encodeURIComponent(addressQuery)}&subscription-key=${AZURE_MAPS_KEY}`;
        
        const geoResponse = await axios.get(geocodeUrl);
        
        if (!geoResponse.data.features || geoResponse.data.features.length === 0) {
            return res.status(404).send("Error: Address not found.");
        }

        // Extract Longitude and Latitude
        const lon = geoResponse.data.features[0].geometry.coordinates[0];
        const lat = geoResponse.data.features[0].geometry.coordinates[1];

        // Call Azure Static Image API
        const staticImageUrl = `https://atlas.microsoft.com/map/static?api-version=2024-04-01&subscription-key=${AZURE_MAPS_KEY}&zoom=15&center=${lon},${lat}&pins=default|co0078d4||${lon} ${lat}`;

        const imageResponse = await axios.get(staticImageUrl, { responseType: 'arraybuffer' });

        // Return the raw image
        res.setHeader('Content-Type', 'image/png');
        res.status(200).send(imageResponse.data);

    } catch (error) {
        console.error("Wrapper Error:", error.message);
        
        let errorDetails = error.message;
        if (error.response && error.response.data) {
            if (error.response.data instanceof Buffer) {
                errorDetails = error.response.data.toString('utf8');
            } else {
                errorDetails = JSON.stringify(error.response.data);
            }
        }

        res.status(500).send(`Internal Server Error. Azure API said: ${errorDetails}`);
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Azure Maps Static Wrapper API running on port ${PORT}`);
});
