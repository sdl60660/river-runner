const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  "nameid": {
    type: Number,
    required: true
  },
  "suggested_name": {
    type: String,
    required: true
  },
  "timestamp": Number,
  "route_start": String,
  "has_existing_name": Boolean,
  "user_email": String
});

const Suggestion = mongoose.model('Suggestion', suggestionSchema);
module.exports = Suggestion;