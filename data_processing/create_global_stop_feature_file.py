import json

with open('data/ne_10m_geography_marine_polys.geojson', 'r') as f:
    seas = json.load(f)['features']

with open('data/ne_10m_lakes.geojson', 'r') as f:
    lakes = json.load(f)['features']


output_cols = ['name','featurecla']
ocean_feature_types = ['strait', 'gulf', 'river', 'inlet', 'sound', 'lagoon', 'ocean', 'sea', 'bay', 'fjord', 'generic', 'channel', 'reef']
lake_feature_types = ['alkaline lake', 'lake', 'reservoir']

all_output_features = []

for feature in (seas + lakes):
    if feature['properties']['featurecla'].lower() in ocean_feature_types:
        stop_feature_type = 'ocean'
    else:
        stop_feature_type = 'inland lake'

    slimmed_feature_properties = {
        'stop_feature_type': stop_feature_type,
        'stop_feature_type_specific': feature['properties']['featurecla'].lower(),
        'stop_feature_name': feature['properties']['name'],
    }

    geometry = feature['geometry']
    if type(geometry['coordinates'][0][0][0]) == list:
        geometry['type'] = "MultiPolygon"

    output_feature = {
        "type": "Feature",
        "geometry": geometry,
        "properties": slimmed_feature_properties
    }
    all_output_features.append(output_feature)

# Output as a GeoJSON file for now, but then use mapshaper.org to compress to a TopoJSON
output_data = {"type": "FeatureCollection", "features": all_output_features}
with open('data/global_stopping_features.geojson', 'w') as f:
    json.dump(output_data, f)
