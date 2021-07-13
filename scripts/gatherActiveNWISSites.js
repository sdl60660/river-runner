const axios = require("axios");
const dateFormat = require('dateformat');
const fs = require("fs");
const parser = require('fast-xml-parser');


const xmlParserOptions = {
    attributeNamePrefix: "",
    ignoreAttributes: false
};

const stateAbbreviations = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

const getActiveNWISSites = async (stateAbbreviation) => {
    // This URL returns an XML response with a little extra text at the top
    const url = `https://waterservices.usgs.gov/nwis/site/?format=gm,1.0&stateCd=${stateAbbreviation}&period=P7D&outputDataTypeCd=iv&parameterCd=00060&siteType=ST&siteStatus=active&hasDataTypeCd=iv`;

    return response = axios(url)
        .then(res => {
            // console.log('response for:', stateAbbreviation, 'received');

            // Parse XML data
            const rawData = res.data;
            const jsonObj = parser.parse(rawData, xmlParserOptions);

            // Return each site's ID (located in Placemark attributes)
            const stateIDs = [...jsonObj.kml.Document.Placemark];
            return stateIDs.map(a => a.id);
        })
        .catch(err => {
            console.log('Error:', err);
            throw new Error(`Unable to gather data for ${stateAbbreviation}`);
        });
}

const main = async () => {
    // Gather active site data by state
    const dataPromises = [...stateAbbreviations.map(async (state) => await getActiveNWISSites(state.toLowerCase()))];
    const data = await Promise.all(dataPromises);
    const flattenedData = data.flat();

    // Get/format today's date and append it to JSON data
    const now = new Date();
    const date = dateFormat(now, 'yyyy-mm-dd');

    const outData = {
        date_gathered: date,
        sites: flattenedData
    };

    // Write to JSON file in public/data
    fs.writeFileSync('public/data/active_nwis_sites.json', JSON.stringify(outData));

    return;
}

main();
