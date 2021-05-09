import json
import csv


with open('./data/simplified_rivers.geojson', 'r') as f:
    data = json.load(f)

all_coordinates = []
for i, feature in enumerate(data["features"]):
    # print(i+1, "of", len(data["features"]))

    if not feature["geometry"]:
        continue

    feature_coordinates = [{'lng': round(x[0], 5), 'lat': round(x[1], 5), 'feature_id': feature["properties"]["OBJECTID"] } for x in feature["geometry"]["coordinates"]]
    all_coordinates += feature_coordinates

with open('./data/coordinate_set.csv', 'w') as f:
    out_csv = csv.DictWriter(f, fieldnames=["lat", "lng", "feature_id"])
    out_csv.writeheader()

    for row in all_coordinates:
        out_csv.writerow(row)