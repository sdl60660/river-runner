const dotenv = require("dotenv");
const path = require("path");
const assert = require("assert");
const MongoClient = require("mongodb").MongoClient;

const fs = require("fs");
const csv = require("fast-csv");

dotenv.config({ path: path.join(__dirname, "../.env") });

const unnamedFeatureCounts = [
  {
    $group: {
      _id: "$levelpathid",
      count: {
        $sum: 1,
      },
      route_url: {
        $first: "$route_url",
      },
    },
  },
  {
    $sort: {
      count: -1,
    },
  },
];

const suggestionCounts = [
  {
    $group: {
      _id: "$nameid",
      count: {
        $sum: 1,
      },
      route_url: {
        $push: "$route_url",
      },
      suggestions: {
        $push: "$suggested_name",
      },
    },
  },
  {
    $sort: {
      count: -1,
    },
  },
];

const getExistingOverrides = async (filepath) => {
  let rows = [];

  return new Promise((resolve) => {
    fs.createReadStream(path.join(__dirname, filepath))
      .pipe(csv.parse({ headers: true }))
      .on("error", (error) => console.error(error))
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows));
  });
};

const runAggregation = async (aggregationPipeline, collection) => {
  return new Promise((resolve) => {
    MongoClient.connect(
      process.env.MONGODB_URL,
      { useNewUrlParser: true, useUnifiedTopology: true },
      function (connectErr, client) {
        assert.equal(null, connectErr);

        const coll = client.db("river_runner").collection(collection);

        coll.aggregate(aggregationPipeline, async (cmdErr, result) => {
          assert.equal(null, cmdErr);

          const aggregationData = await result.toArray();
          client.close();

          resolve(aggregationData);
        });
      }
    );
  });
};

const main = async () => {
  const csvFilepath = "../../public/data/name_overrides.csv";

  const existingOverrides = await getExistingOverrides(csvFilepath);
  const groupedOccurences = await runAggregation(unnamedFeatureCounts, "unnamed_features");
  const groupedSuggestions = await runAggregation(suggestionCounts, "suggestions");

  //   const overridenIDs = existingOverrides.map((d) => Number(d.levelpathid));
  //   const unhandledSuggestions = groupedSuggestions
  //     .filter((d) => d.count > 3)
  //     .filter((d) => !overridenIDs.includes(d._id));

  //   console.log(unhandledSuggestions);
  const joinedData = groupedOccurences.map((d) => {
    const suggestions = groupedSuggestions.find((a) => a._id === d._id) || {
      count: 0,
      route_url: [],
      suggestions: null,
    };

    const override = existingOverrides.find((a) => Number(a.levelpathid) === d._id);

    return {
      levelpathid: d._id,
      sample_route_url: [...suggestions.route_url, d.route_url].filter((d) => d)[0],
      num_suggestions: suggestions.count,
      num_occurences: d.count,
      suggestions: suggestions.suggestions,
      overriden: override ? true : false,
      overriden_val: override ? override.feature_name : null,
    };
  });

  const outputFile = fs.createWriteStream("data/aggregated_suggestions.csv");

  csv
    .write(joinedData, { headers: true })
    .on("finish", function () {
      console.log("Write to CSV successfully!");
    })
    .pipe(outputFile);

  //   console.log(joinedData.slice(0,5));
};

main();
