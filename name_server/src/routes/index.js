const express = require('express');
const Suggestion = require('../models/suggestion');

const router = express.Router();

router.get("/test", async (req, res) => {
  const result = {
    result: 'OK'
  };

  res.status(200).json(result);
});

router.post("/suggestions", async (req, res) => {
    console.log(req.body);
    const suggestions = JSON.parse(req.body).map(item => ({...item, timestamp: Date.now()}));

    suggestions.forEach(async (item) => {
      const suggestion = new Suggestion(item);
      const mongoResponse = await suggestion.save();
    })

    res.status(201).json(suggestions);
});

module.exports = { router };