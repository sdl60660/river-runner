export const nwisPopupFormat = ({ feature }) => {
    const siteNumber = feature.properties.identifier.slice(5);
    const formattedFeatureName = formatPopupTitleCase(
        feature.properties.name
    );

    return feature.properties.display_image
        ? `
        <div style="text-align: center; height: 440px; width: 576px;">
            <h3>${formattedFeatureName} (<a target="_blank" href="https://geoconnex.us/usgs/monitoring-location/${siteNumber}">${siteNumber}</a>)</h3>
            <div style="position: relative; min-height: 40px;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translateX(-50%); z-index: 10;">
                    <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
                </div>
                <img style="position: absolute; top: 0; left: 0; z-index: 20;" src="https://waterdata.usgs.gov/nwisweb/graph?agency_cd=USGS&site_no=${siteNumber}&parm_cd=00065&period=7" alt="NWIS streamgage data for site ${siteNumber}" />
            </div>
        </div>
    `
        : `
        <div style="text-align: center">
            <h3>${formattedFeatureName} (<a target="_blank" href="https://geoconnex.us/usgs/monitoring-location/${siteNumber}">${siteNumber}</a>)</h3>
            <em>[No chart data available]</em>
        </div>
    `;
};

export const wqpPopupFormat = ({ feature }) => {
    const identifier = feature.properties.identifier;
    const portalLink = feature.properties.uri.replace(
        "https://www.waterqualitydata.us/data/provider/",
        "https://geoconnex.us/wqp/"
    );
    const dataLink = `https://www.waterqualitydata.us/data/Result/search?siteid=${identifier}`;

    const formattedName = feature.properties.name.includes(" ")
        ? formatPopupTitleCase(feature.properties.name)
        : feature.properties.name;

    return `
        <div style="padding: 0 1rem; display: flex; flex-direction: column;">
            <h3 style="margin: 0.5rem 0; justify-self: center;">Water Quality Portal Site (${formattedName})</h3>
            <a target="_blank" href="${portalLink}">Portal Site Metadata</a></li>
            <a target="_blank" href="${dataLink}">Water Quality Sample Data</a>
        </div>
    `;
};

export const caGagePopupFormat = ({ feature }) => {
    return `
        <div style="padding: 0 1rem; display: flex; flex-direction: column;">
            <h3 style="margin: 0.5rem 0; justify-self: center;">Stream Gage: ${formatPopupTitleCase(
                feature.properties.name
            )} (${feature.properties.identifier})</h3>
            <a target="_blank" href="${
                feature.properties.weblink
            }">Station Metadata</a></li>
        </div>
    `;
};

export const wadePopupFormat = ({ feature }) => {
    return `<span>Water Data Exchange Water Point of Diversion: <a target="_blank" href="${feature.properties.uri}">${feature.properties.identifier}</a></span>`;
};

export const formatPopupTitleCase = (rawText) => {

    let correctedText = rawText.slice();
    // Check for commas without spaces after (seems to happen a lot with these)
    for (let i=0; i < rawText.length; i++) {
      if (rawText[i] === ',' && i+1 < rawText.length && rawText[i+1] !== " ") {
        correctedText = correctedText.substr(0, i+1) + ' ' + correctedText.substr(i+1);
      }
    }
  
    // This will use the library's default titlecase rules, which are close, but miss a few cases
    const firstPass = titleCase(correctedText.toLowerCase());
  
    return firstPass.split(" ").map(word => {
      // If a word/segment ends with a dot (acroynm), is two letters or less and not in library's codec (probably a direction/state name), or contains a number, we'll want uppercase
      if (word.slice(-1)[0] === '.' || (word.length <= 2 && /[A-Z]/.test(word)) || /\d/.test(word)) {
        return word.toUpperCase();
      }
      // Otherwise stick with default titelcase
      else {
        return word
      }
    }).join(" ")
  }