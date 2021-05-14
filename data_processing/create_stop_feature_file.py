import json

with open('data/water_bodies.geojson', 'r') as f:
    lakes = json.load(f)

# Extract the 4000 largest named lakes
# This is way overkill as it is because very very few of these are stopping features, but ths will cut down the file size by about 99%
# It's possible this will miss some weird, small inland lakes that are stopping features, but that's worth the tradeoff for the file size
all_lake_features = lakes['features']
sorted_features = sorted(all_lake_features, key=lambda x: x['properties']['SQKM'], reverse=True)
sorted_features = [x for x in sorted_features if x['properties']['NAME'] != '' and x['properties']['FTYPE'] == "Lake/Pond" and x['geometry']]
sorted_features = sorted_features[:4000]

for feature in sorted_features:
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
    ocean_feature = [x for x in ocean['features'] if len(x['geometry']['coordinates']) > 2][0]
    ocean_feature['properties']['stop_feature_type'] = 'ocean'
    ocean_feature['properties']['stop_feature_name'] = 'Ocean'


all_features = canada['features'] + mexico['features'] + [ocean_feature] + sorted_features

# Output as a GeoJSON file for now (~6MB), but then use mapshaper.org to compress to a TopoJSON (~2MB)
output_data = {"type":"FeatureCollection", "features": all_features }
with open('data/stopping_features.geojson', 'w') as f:
    json.dump(output_data, f)