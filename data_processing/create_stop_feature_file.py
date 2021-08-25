import json

with open('data/water_bodies.geojson', 'r') as f:
    lakes = json.load(f)

# Extract the 4000 largest named lakes
# This is way overkill as it is because very very few of these are stopping features, but ths will cut down the file size by about 99%
# It's possible this will miss some weird, small inland lakes that are stopping features, but that's worth the tradeoff for the file size
all_lake_features = lakes['features']
sorted_features = sorted(
    all_lake_features, key=lambda x: x['properties']['SQKM'], reverse=True)
filtered_feature_types = ['Canal/Ditch', 'Lake/Pond', 'Reservoir']
sorted_features = [x for x in sorted_features if x['properties']['NAME'] !=
                   '' and x['properties']['FTYPE'] in filtered_feature_types and x['geometry']]
sorted_features = sorted_features[:4000]

# I took out and simplified another ~7000 named smaller lake/pond/reservoir/canal/ditch, which we can tack back on in their simplified state
# I honestly don't think there are many here that will survive simplification and I don't know how much this will do, but it won't add too much to the file size
with open('data/smaller_water_bodies.geojson', 'r') as f:
    small_features = [x for x in json.load(f)['features'] if x['geometry']]
    sorted_features += small_features


for feature in sorted_features:
    del feature['properties']['FCODE_DESC']
    del feature['properties']['FCODE']
    del feature['properties']['SQMI']

    feature['properties']['stop_feature_type'] = 'inland lake'
    feature['properties']['stop_feature_name'] = feature['properties']['NAME']


with open('data/mexico_polygon.geojson', 'r') as f:
    mexico = json.load(f)
    mexico['features'][0]['properties']['stop_feature_type'] = 'country'
    mexico['features'][0]['properties']['stop_feature_name'] = 'Mexico'

with open('data/canada_polygon.geojson', 'r') as f:
    canada = json.load(f)
    canada['features'][0]['properties']['stop_feature_type'] = 'country'
    canada['features'][0]['properties']['stop_feature_name'] = 'Canada'

with open('data/ocean_area.geojson', 'r') as f:
    ocean = json.load(f)
    ocean_feature = [x for x in ocean['features']
                     if len(x['geometry']['coordinates']) > 2][0]
    ocean_feature['properties']['stop_feature_type'] = 'ocean'
    ocean_feature['properties']['stop_feature_name'] = 'Ocean'

bay_features = []
# Grabbed this feature from here: https://geodata.lib.berkeley.edu/catalog/stanford-qh320kj0191
with open('data/sf_bay.geojson', 'r') as f:
    sf_bay = json.load(f)
    bay_feature = sf_bay['features'][0]
    bay_feature['properties']['stop_feature_type'] = 'ocean'
    bay_feature['properties']['stop_feature_name'] = 'San Francisco Bay'
    bay_features.append(bay_feature)

# Created this feature here: https://geojson.io/#map=10/39.0507/-75.3827
with open('data/delaware_bay.geojson', 'r') as f:
    delaware_bay = json.load(f)
    bay_feature = delaware_bay['features'][0]
    bay_feature['properties']['stop_feature_type'] = 'ocean'
    bay_feature['properties']['stop_feature_name'] = 'Delaware Bay'
    bay_features.append(bay_feature)

all_features = canada['features'] + mexico['features'] + \
    [ocean_feature] + [bay_features] + sorted_features

# Output as a GeoJSON file for now (~7MB), but then use mapshaper.org to compress to a TopoJSON (~2MB)
output_data = {"type": "FeatureCollection", "features": all_features}
with open('data/stopping_features.geojson', 'w') as f:
    json.dump(output_data, f)
