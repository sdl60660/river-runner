import pandas as pd

# dtype_dict = {
#     'comid': str,
#     'streamleve': int,
#     'levelpathi': str,
#     'terminalfl': int,
#     'gnis_id': str,
#     'gnis_name': str
# }

# This parquet file comes from: https://www.hydroshare.org/resource/6092c8a62fac45be97a09bfd0b0bf726/
df = pd.read_parquet('data/nhdplusVAA.parquet', engine='pyarrow')
# df.head(5)

# Trim fields
keep_fields = ['comid', 'streamleve', 'levelpathi', 'pathlength', 'terminalfl', 'lengthkm', 'gnis_name']
out_df = df[keep_fields]

# Remove space for missing GNIS Names and replace with empty string
out_df['gnis_name'] = out_df['gnis_name'].apply(lambda x: x if x != " " else "")

# Convert datatypes
float_to_int_cols = ['comid', 'streamleve', 'levelpathi', 'terminalfl']
out_df[float_to_int_cols] = out_df[float_to_int_cols].astype(int)

int_to_str_cols = ['comid', 'levelpathi']
out_df[int_to_str_cols] = out_df[int_to_str_cols].astype(str)

# Replace truncated column names
out_df = out_df.rename(columns={"streamleve": "streamlvl", "levelpathi": "levelpathid"})

# Output to datafiles
out_df.to_csv('data/comid_vaa_mapping.csv', index=False)
# This and the CSV will probably be too large for the user to load, so I'll toss it in a firebase realtime database and make requests on a per-stream basis
out_df = out_df.set_index(['comid'], drop=False)
out_df.to_json('data/comid_vaa_mapping.json', orient='index')