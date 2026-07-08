const express = require('express');
const axios = require('axios');
const app = express();

// Your Azure Maps Subscription Key
const AZURE_MAPS_KEY = process.env.AZURE_MAPS_KEY;

/**
 * SINGLE ENDPOINT: STATIC MAP GENERATOR
 * Your system calls this with address parameters, and it returns a raw PNG image.
 */
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
        // STEP 1: Geocode the address using Azure Maps REST API
        const geocodeUrl = `https://atlas.microsoft.com/geocode?api-version=2023-06-01&query=${encodeURIComponent(addressQuery)}&subscription-key=${AZURE_MAPS_KEY}`;
        
        const geoResponse = await axios.get(geocodeUrl);
        
        if (!geoResponse.data.features || geoResponse.data.features.length === 0) {
            return res.status(404).send("Error: Address not found.");
        }

        // Extract Longitude and Latitude
        const lon = geoResponse.data.features[0].geometry.coordinates[0];
        const lat = geoResponse.data.features[0].geometry.coordinates[1];

        // STEP 2: Call Azure Static Image API using the coordinates
        // We add a default blue pin (co0078d4) at the lon/lat coordinates
        const staticImageUrl = `https://atlas.microsoft.com/map/static/png?api-version=2022-08-01&subscription-key=${AZURE_MAPS_KEY}&zoom=15&center=${lon},${lat}&pins=default|co0078d4||${lon} ${lat}`;

        // Fetch the image as a binary buffer
        const imageResponse = await axios.get(staticImageUrl, { responseType: 'arraybuffer' });

        // STEP 3: Return the raw PNG image directly to your system
        res.setHeader('Content-Type', 'image/png');
        res.status(200).send(imageResponse.data);

    } catch (error) {
        console.error("Wrapper Error:", error.message);
        
        let errorDetails = error.message;
        if (error.response && error.response.data) {
            // If the error comes from the arraybuffer, we have to parse it back to a string
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
