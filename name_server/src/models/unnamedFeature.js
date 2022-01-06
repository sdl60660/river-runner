const mongoose = require("mongoose");

const unamedFeatureSchema = new mongoose.Schema({
  nameid: {
    type: Number,
    required: true,
  },
  current_name: {
    type: String,
    required: true,
  },
  timestamp: Number,
  route_start: String,
  route_url: String,
});

const UnnamedFeature = mongoose.model("UnnamedFeature", unamedFeatureSchema);
module.exports = UnnamedFeature;
