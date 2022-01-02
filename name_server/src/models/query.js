const mongoose = require("mongoose");

const querySchema = new mongoose.Schema({
  lat: {
    type: String,
    required: true,
  },
  lng: {
    type: String,
    required: true,
  },
  from_share_link: {
    type: Boolean,
    required: true,
  },
  query_error: {
    type: Boolean,
    required: false
  },
  timestamp: Number,
});

const Query = mongoose.model("Query", querySchema);
module.exports = Query;
