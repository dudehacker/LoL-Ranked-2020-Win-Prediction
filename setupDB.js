db = connect("localhost:27017/lol");

// pipeline
db.matches.aggregate(
  [
    // {
    //   // filter by NA region
    //   $match: {
    //     platformId: "NA1",
    //   },
    // },
    {
      // remove duplicate games
      $group: { _id: "$gameId", doc: { $first: "$$ROOT" } },
    },
    {
      $replaceRoot: { newRoot: "$doc" },
    },
    { $out: "Games" }, // Output collection is in the same database
  ],
  { allowDiskUse: true }
);
